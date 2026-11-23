/**
 * Server only. A business's usage this month (domain/design/usage.ts): its meters, Sol's use by day for the Usage
 * page's chart, and the owner emailed as each meter passes 50%, 80% and 100% of its allowance, each step claimed once
 * a month a meter in `design_usage_notices` (business id first). Never for a made-up business (an owner on a .example
 * address), a demo, or Calls & Texts where RENUABL doesn't charge it (its own business, one not billed).
 */
import { noticeDue, usageNoticeEmail, voiceMeters, type Meter, type MeterKey, type SolDayRow } from "@/lib/domain/design/usage";
import { monthOf } from "@/lib/domain/design/sol-credits";
import { todayInMarket } from "@/lib/domain/market";
import { siteUrl } from "@/lib/domain/sms";
import { dbConfigured, query } from "./db";
import { addOnOn } from "./design-addons";
import { billingDetailsOf, solBalanceOf } from "./design-billing-repo";
import { isDemoBusiness } from "./design-demo-check";
import { capOf, usageOf, voiceFree } from "./design-voice-usage";
import { billingEnforced } from "./sol-credits";
import { sendEmail } from "./email";

let made: Promise<void> | null = null;
function tables(): Promise<void> {
  made ??= query(
    `create table if not exists design_usage_notices (
       business_id text not null references businesses(id) on delete cascade,
       month text not null,
       meter text not null,
       step integer not null,
       at timestamptz not null default now(),
       primary key (business_id, month, meter, step)
     );`,
  ).then(
    () => undefined,
    (e) => {
      made = null;
      throw e;
    },
  );
  return made;
}

export interface UsageNow {
  month: string;
  meters: Meter[];
  /** Sol credits bought and not yet used. */
  solBought: number;
  voice: { on: boolean; capCents: number; charged: boolean };
}

/** The business's meters this month: Sol's included credits, and Calls & Texts' free allowance when it has the add-on. */
export async function usageNow(businessId: string, today = todayInMarket()): Promise<UsageNow> {
  const [sol, voiceOn] = await Promise.all([solBalanceOf(businessId, today), addOnOn(businessId, "voice").catch(() => false)]);
  const meters: Meter[] = [];
  if (sol.included > 0) meters.push({ key: "sol", used: sol.usedIncluded, included: sol.included });
  let capCents = 0;
  let charged = false;
  if (voiceOn) {
    const [u, cap, free] = await Promise.all([usageOf(businessId), capOf(businessId), voiceFree(businessId)]);
    meters.push(...voiceMeters(u));
    capCents = cap;
    charged = !free;
  }
  return { month: monthOf(today), meters, solBought: sol.bought, voice: { on: voiceOn, capCents, charged } };
}

/** The month's Sol use by day (market time), what it was for and who asked: the credits each took. */
export async function solDays(businessId: string, month: string): Promise<SolDayRow[]> {
  if (!dbConfigured()) return [];
  const rows = await query<{ day: string; use: string | null; by: string | null; credits: string }>(
    `select to_char(at at time zone 'Australia/Melbourne', 'YYYY-MM-DD') as day, use, by_email as by,
            coalesce(-sum(change) filter (where change < 0), 0)::text as credits
       from design_sol_credits where business_id = $1 and month = $2 and source <> 'pack'
      group by 1, 2, 3`,
    [businessId, month],
  );
  return rows.map((r) => ({ day: r.day, use: r.use ?? "other", by: r.by, credits: Number(r.credits) }));
}

/** Calls & Texts by day this month: minutes and texts. */
export async function voiceDays(businessId: string, month: string): Promise<{ day: string; minutes: number; texts: number }[]> {
  if (!dbConfigured()) return [];
  const rows = await query<{ day: string; kind: string; units: string }>(
    `select to_char(at at time zone 'Australia/Melbourne', 'YYYY-MM-DD') as day, kind, sum(units)::text as units
       from design_voice_usage where business_id = $1 and month = $2 group by 1, 2`,
    [businessId, month],
  ).catch(() => []);
  const by = new Map<string, { day: string; minutes: number; texts: number }>();
  for (const r of rows) {
    const d = by.get(r.day) ?? { day: r.day, minutes: 0, texts: 0 };
    if (r.kind === "minute") d.minutes += Number(r.units);
    else d.texts += Number(r.units);
    by.set(r.day, d);
  }
  return [...by.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Who a notice goes to: the owner, and the billing email on the invoices when it's another address. */
async function recipients(businessId: string): Promise<{ to: string[]; name: string }> {
  const [owner, details] = await Promise.all([
    query<{ email: string; name: string }>(
      `select m.email, b.name from business_members m join businesses b on b.id = m.business_id
        where m.business_id = $1 and m.role = 'owner' limit 1`,
      [businessId],
    ),
    billingDetailsOf(businessId).catch(() => null),
  ]);
  const first = owner[0]?.email;
  if (!first || /\.example$/i.test(first)) return { to: [], name: owner[0]?.name ?? "" };
  const to = [first];
  const billing = details?.email?.trim().toLowerCase();
  if (billing && billing !== first.toLowerCase() && !/\.example$/i.test(billing)) to.push(billing);
  return { to, name: owner[0]?.name || "Your business" };
}

/**
 * After use is counted (a Sol answer, a call's minutes, a text): emails the owner when a meter has passed a step not
 * yet sent this month. Never throws. Answers the steps sent, for tests.
 */
export async function noticeUsage(businessId: string, today = todayInMarket()): Promise<{ key: MeterKey; step: number }[]> {
  const sent: { key: MeterKey; step: number }[] = [];
  try {
    if (!dbConfigured() || !businessId || (await isDemoBusiness(businessId).catch(() => false))) return sent;
    await tables();
    const now = await usageNow(businessId, today);
    const counted = now.meters.filter((m) => m.key === "sol" || now.voice.charged);
    if (!counted.length) return sent;
    const prior = await query<{ meter: string; step: number }>(
      `select meter, step from design_usage_notices where business_id = $1 and month = $2`,
      [businessId, now.month],
    );
    const due = counted
      .map((m) => ({
        m,
        step: noticeDue(
          m,
          prior.filter((p) => p.meter === m.key).map((p) => p.step),
        ),
      }))
      .filter((d): d is { m: Meter; step: 50 | 80 | 100 } => d.step !== null);
    if (!due.length) return sent;
    const who = await recipients(businessId);
    if (!who.to.length) return sent;
    const site = siteUrl();
    for (const { m, step } of due) {
      // Claimed first: two answers ending together send it once.
      const claimed = await query(
        `insert into design_usage_notices (business_id, month, meter, step) values ($1,$2,$3,$4) on conflict do nothing returning step`,
        [businessId, now.month, m.key, step],
      );
      if (!claimed.length) continue;
      const mail = usageNoticeEmail({
        business: who.name,
        step,
        key: m.key,
        meters: counted,
        month: now.month,
        solStops: billingEnforced(),
        capCents: now.voice.capCents,
        link: site ? `${site}/design/settings/usage` : null,
      });
      await sendEmail({ to: who.to[0]!, cc: who.to.slice(1), subject: mail.subject, text: mail.text, html: mail.html }).catch((e) =>
        console.error("usage notice not sent", e instanceof Error ? e.message : e),
      );
      sent.push({ key: m.key, step });
    }
  } catch (e) {
    console.error("usage notices not checked", e instanceof Error ? e.message : e);
  }
  return sent;
}

/** Fire and forget, after use is counted. */
export const noticeUsageSoon = (businessId: string) => void noticeUsage(businessId);
