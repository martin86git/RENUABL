/**
 * Server only. Topping up by itself (domain/design/top-up.ts): each business's settings, the check after credits are
 * used, and the charge. Business id first in every function, from the signed-in member or the business whose credits
 * were just used, never from a browser.
 *
 * The check is run after the answer has gone back (`topUpSoon`), so a design saved or an answer from Sol is never slowed
 * by a charge. One try at a time a business and kind: the try is claimed under an advisory lock and kept before Stripe is
 * asked, so two saves at once can't buy two packs.
 */
import { after } from "next/server";
import { monthOf } from "@/lib/domain/design/sol-credits";
import { dollars } from "@/lib/domain/design/plans";
import {
  TOP_UP_DEFAULTS,
  TOP_UP_KINDS,
  cleanTopUp,
  topUpDue,
  topUpPackCents,
  topUpPackCredits,
  type TopUpKind,
  type TopUpSettings,
} from "@/lib/domain/design/top-up";
import { todayInMarket } from "@/lib/domain/market";
import { newId, query, transaction } from "./db";
import { creditPack, creditSolPack, designPoolOf, solBalanceOf, tokenBalance } from "./design-billing-repo";
import { billingCustomer } from "./design-billing-customer";
import { isDemoBusiness } from "./design-demo-check";
import { stripeClient } from "./stripe";
import { chargeTopUp } from "./stripe-billing";

export async function topUpSettingsOf(businessId: string): Promise<Record<TopUpKind, TopUpSettings>> {
  const rows = await query<{ kind: string; settings: unknown }>(`select kind, settings from design_top_ups where business_id = $1`, [
    businessId,
  ]);
  const out = { ...TOP_UP_DEFAULTS };
  for (const r of rows)
    if (TOP_UP_KINDS.includes(r.kind as TopUpKind)) out[r.kind as TopUpKind] = cleanTopUp(r.kind as TopUpKind, r.settings);
  return out;
}

export async function saveTopUpSettings(businessId: string, kind: TopUpKind, settings: TopUpSettings, by: string): Promise<void> {
  await query(
    `insert into design_top_ups (business_id, kind, settings, by_email) values ($1, $2, $3, $4)
     on conflict (business_id, kind) do update set settings = excluded.settings, by_email = excluded.by_email, updated_at = now()`,
    [businessId, kind, JSON.stringify(settings), by.toLowerCase()],
  );
}

export interface TopUpLine {
  kind: TopUpKind;
  credits: number;
  cents: number;
  status: "paid" | "failed" | "trying";
  reason: string | null;
  at: string;
}

/** The latest packs bought by themselves, newest first. */
export async function topUpHistory(businessId: string, limit = 8): Promise<TopUpLine[]> {
  return query<TopUpLine>(
    `select kind, credits, cents, status, reason, to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at
       from design_top_up_charges where business_id = $1 order by at desc limit $2`,
    [businessId, limit],
  );
}

/** The credits that can still be used before a top-up is wanted: what's bought, plus the trial's or the month's own. */
async function creditsLeft(businessId: string, kind: TopUpKind, today: string): Promise<number> {
  if (kind === "sol") return (await solBalanceOf(businessId, today)).left;
  const [balance, pool] = await Promise.all([tokenBalance(businessId), designPoolOf(businessId, today)]);
  // A free trial site covers any site, so while one is left nothing is short.
  return pool.left > 0 ? Number.POSITIVE_INFINITY : balance;
}

/** Claims a try when one is due: the row's id, else null. */
async function claimTry(businessId: string, kind: TopUpKind, settings: TopUpSettings, left: number, today: string): Promise<string | null> {
  return transaction(async (q) => {
    await q(`select pg_advisory_xact_lock(hashtext('top-up:' || $1 || ':' || $2))`, [businessId, kind]);
    const month = monthOf(today);
    const spent = await q<{ n: string | null }>(
      `select sum(cents) as n from design_top_up_charges
        where business_id = $1 and kind = $2 and status in ('paid', 'trying') and to_char(at at time zone 'Australia/Melbourne', 'YYYY-MM') = $3`,
      [businessId, kind, month],
    );
    const last = await q<{ at: string; status: string }>(
      `select to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at, status from design_top_up_charges
        where business_id = $1 and kind = $2 order by at desc limit 1`,
      [businessId, kind],
    );
    const verdict = topUpDue({
      kind,
      settings,
      left,
      spentThisMonthCents: Number(spent[0]?.n ?? 0),
      last: last[0] ? { at: last[0].at, failed: last[0].status === "failed" } : null,
      now: new Date(),
    });
    if (verdict !== "buy") return null;
    const id = newId("tu");
    await q(
      `insert into design_top_up_charges (id, business_id, kind, pack, cents, credits, status) values ($1, $2, $3, $4, $5, $6, 'trying')`,
      [id, businessId, kind, settings.pack, topUpPackCents(kind, settings.pack), topUpPackCredits(kind, settings.pack)],
    );
    return id;
  });
}

/** Buys a pack when the business's settings say so. Never throws. */
export async function maybeTopUp(businessId: string, kind: TopUpKind): Promise<void> {
  try {
    const settings = (await topUpSettingsOf(businessId))[kind];
    if (!settings.on) return;
    const stripe = stripeClient();
    if (!stripe || (await isDemoBusiness(businessId))) return;
    const today = todayInMarket();
    const left = await creditsLeft(businessId, kind, today);
    const tryId = await claimTry(businessId, kind, settings, left, today);
    if (!tryId) return;
    const customer = await billingCustomer(businessId);
    const cents = topUpPackCents(kind, settings.pack) ?? 0;
    const credits = topUpPackCredits(kind, settings.pack);
    const result = customer
      ? await chargeTopUp(stripe, {
          customer,
          businessId,
          cents,
          kind,
          credits,
          description: `${credits.toLocaleString("en-AU")} ${kind === "sol" ? "Sol" : "design"} credits, topped up by themselves (${dollars(cents)}, includes GST)`,
        })
      : ({ paid: false, invoice: null, reason: "No billing account yet." } as const);
    if (result.paid) {
      // Keyed by the invoice, so the credits are added once however this is reached.
      if (kind === "sol") await creditSolPack(businessId, result.invoice, credits, "auto top-up", today);
      else await creditPack(businessId, result.invoice, credits, "auto top-up");
    }
    await query(`update design_top_up_charges set status = $3, invoice = $4, reason = $5 where business_id = $1 and id = $2`, [
      businessId,
      tryId,
      result.paid ? "paid" : "failed",
      result.invoice,
      result.paid ? null : result.reason,
    ]);
  } catch (e) {
    console.error("top-up not done", e instanceof Error ? e.message : e);
  }
}

/** Runs the check once the answer has gone back; outside a request, straight away. */
export function topUpSoon(businessId: string, kind: TopUpKind): void {
  try {
    after(() => maybeTopUp(businessId, kind));
  } catch {
    void maybeTopUp(businessId, kind);
  }
}
