/**
 * Server only. What each business's Calls & Texts uses (domain/design/voice-usage.ts): a row a call or text in
 * `design_voice_usage`, business id first, kept once by its reference (Vapi's call id, our text id), so a webhook
 * arriving twice counts once; the spending cap on `businesses.voice_cap_cents`; and each month's charge beyond the free
 * allowance put on the business's next Stripe invoice once, kept in `design_voice_usage_charges`.
 *
 * RENUABL's own business, and one RENUABL doesn't bill, are counted but never charged or capped.
 */
import type Stripe from "stripe";
import {
  capReached,
  DEFAULT_CAP_CENTS,
  minutesOf,
  monthBefore,
  usageBill,
  usageInvoiceLine,
  usageMonth,
  type Usage,
} from "@/lib/domain/design/voice-usage";
import { textParts } from "@/lib/domain/design/contact-reach";
import { dbConfigured, query } from "./db";
import { isNotBilled } from "./design-not-billed";
import { renuablCrm } from "./renuabl-crm";
import { gstTaxRate } from "./stripe-billing";

let made: Promise<void> | null = null;
function tables(): Promise<void> {
  made ??= query(
    `create table if not exists design_voice_usage (
       business_id text not null references businesses(id) on delete cascade,
       kind text not null,
       ref text not null,
       month text not null,
       units integer not null,
       at timestamptz not null default now(),
       primary key (business_id, kind, ref)
     );
     create index if not exists design_voice_usage_month on design_voice_usage(business_id, month);
     create table if not exists design_voice_usage_charges (
       business_id text not null references businesses(id) on delete cascade,
       month text not null,
       minutes integer not null,
       texts integer not null,
       cents integer not null,
       stripe_item text,
       at timestamptz not null default now(),
       primary key (business_id, month)
     );
     alter table businesses add column if not exists voice_cap_cents integer;`,
  ).then(
    () => undefined,
    (e) => {
      made = null;
      throw e;
    },
  );
  return made;
}

async function keep(businessId: string, kind: "minute" | "text", ref: string, units: number, at: Date): Promise<void> {
  if (!dbConfigured() || !businessId || !ref || units <= 0) return;
  await tables();
  await query(
    `insert into design_voice_usage (business_id, kind, ref, month, units, at) values ($1,$2,$3,$4,$5,$6)
     on conflict (business_id, kind, ref) do nothing`,
    [businessId, kind, ref.slice(0, 120), usageMonth(at), units, at.toISOString()],
  );
}

/** A voice-agent call that ended (Vapi's end-of-call report): its minutes, rounded up. */
export const recordCallMinutes = (businessId: string, callId: string, seconds: number, at = new Date()) =>
  keep(businessId, "minute", callId, minutesOf(seconds), at).catch((e) =>
    console.error("call minutes not kept", e instanceof Error ? e.message : e),
  );

/** A text sent from the business's number: the parts it goes as. */
export const recordTextSent = (businessId: string, textId: string, text: string, at = new Date()) =>
  keep(businessId, "text", textId, textParts(text), at).catch((e) => console.error("text not counted", e instanceof Error ? e.message : e));

/** A month's use (this month by default). */
export async function usageOf(businessId: string, month = usageMonth()): Promise<Usage> {
  if (!dbConfigured()) return { minutes: 0, texts: 0 };
  await tables();
  const rows = await query<{ kind: string; units: string }>(
    `select kind, sum(units)::text as units from design_voice_usage where business_id = $1 and month = $2 group by kind`,
    [businessId, month],
  );
  const of = (k: string) => Number(rows.find((r) => r.kind === k)?.units ?? 0);
  return { minutes: of("minute"), texts: of("text") };
}

/** The business's spending cap in cents (the default until the owner sets one). */
export async function capOf(businessId: string): Promise<number> {
  if (!dbConfigured()) return DEFAULT_CAP_CENTS;
  await tables();
  const rows = await query<{ voice_cap_cents: number | null }>(`select voice_cap_cents from businesses where id = $1`, [businessId]);
  return rows[0]?.voice_cap_cents ?? DEFAULT_CAP_CENTS;
}

export async function setCap(businessId: string, cents: number): Promise<void> {
  await tables();
  await query(`update businesses set voice_cap_cents = $2 where id = $1`, [businessId, cents]);
}

/** RENUABL's own business, or one RENUABL doesn't bill: never charged or capped. */
const free = async (businessId: string) =>
  (await renuablCrm().catch(() => null))?.businessId === businessId || (await isNotBilled(businessId).catch(() => false));

/** Whether the cap stops this business starting a call (or sending a text) now. */
export async function overCap(businessId: string, kind: "minute" | "text"): Promise<boolean> {
  if (!dbConfigured() || (await free(businessId))) return false;
  const [u, cap] = await Promise.all([usageOf(businessId), capOf(businessId)]);
  return capReached(u, cap, kind);
}

/**
 * The daily cron: last month's use beyond the free allowance put on each business's next Stripe invoice, once. A
 * charge that fails is let go, so the next day tries again. Answers how many were charged.
 */
export async function chargeLastMonth(stripe: Stripe | null, now = new Date()): Promise<number> {
  if (!stripe || !dbConfigured()) return 0;
  await tables();
  const month = monthBefore(usageMonth(now));
  const due = await query<{ business_id: string }>(
    `select distinct u.business_id from design_voice_usage u
      where u.month = $1 and not exists (select 1 from design_voice_usage_charges c where c.business_id = u.business_id and c.month = $1)`,
    [month],
  );
  let charged = 0;
  for (const { business_id: businessId } of due) {
    if (await free(businessId)) continue;
    const u = await usageOf(businessId, month);
    const bill = usageBill(u);
    if (bill.cents <= 0) continue;
    const plan = await query<{ stripe_customer: string | null; stripe_subscription: string | null }>(
      `select stripe_customer, stripe_subscription from design_subscriptions where business_id = $1
        order by updated_at desc limit 1`,
      [businessId],
    );
    const customer = plan[0]?.stripe_customer;
    if (!customer) continue;
    const claimed = await query(
      `insert into design_voice_usage_charges (business_id, month, minutes, texts, cents) values ($1,$2,$3,$4,$5)
       on conflict do nothing returning month`,
      [businessId, month, u.minutes, u.texts, bill.cents],
    );
    if (!claimed.length) continue;
    try {
      const item = await stripe.invoiceItems.create({
        customer,
        ...(plan[0]?.stripe_subscription ? { subscription: plan[0].stripe_subscription } : {}),
        amount: bill.cents,
        currency: "aud",
        description: usageInvoiceLine(month, bill),
        tax_rates: [await gstTaxRate(stripe)],
        metadata: { kind: "renuabl-voice-usage", business: businessId, month },
      });
      await query(`update design_voice_usage_charges set stripe_item = $3 where business_id = $1 and month = $2`, [
        businessId,
        month,
        item.id,
      ]);
      charged++;
    } catch (e) {
      console.error("voice usage not charged", e instanceof Error ? e.message : e);
      await query(`delete from design_voice_usage_charges where business_id = $1 and month = $2 and stripe_item is null`, [
        businessId,
        month,
      ]);
    }
  }
  return charged;
}
