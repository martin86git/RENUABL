/**
 * Server only. The add-ons a business has on its plan (domain/design/add-ons.ts), one row each in `design_addons`,
 * business id first: asked for (unpriced) or on, with the Stripe subscription item that charges it. RENUABL's own
 * business has every add-on without a row.
 *
 * Adding a priced add-on puts an item of its own on the plan's Stripe subscription (`addToSubscription`, prorated) and
 * keeps the row; the webhook keeps the rows in step with the subscription after that (`syncAddOnsFromStripe`). Ending one
 * takes the item off (prorated) and, for voice, releases the business's number.
 */
import type Stripe from "stripe";
import {
  ADD_ON_MONTHLY_CENTS,
  ADD_ON_WORDS,
  addOnStanding,
  addOnUsable,
  cleanAddOnKey,
  type AddOnKey,
  type AddOnRow,
  type AddOnStanding,
} from "@/lib/domain/design/add-ons";
import { CUSTOM_PROPOSALS, CUSTOM_PROPOSALS_MONTHLY_CENTS, mayPublishCustom } from "@/lib/domain/design/custom-proposals";
import { releaseNumber } from "./business-numbers";
import { dbConfigured, query } from "./db";
import { renuablCrm } from "./renuabl-crm";
import { billingEnforced } from "./sol-credits";
import { gstTaxRate } from "./stripe-billing";

/** Whether the business has this add-on on (a row; RENUABL's own business isn't counted here, see `standingOf`). */
export async function hasAddOn(businessId: string, addOn: string): Promise<boolean> {
  const rows = await query(`select 1 from design_addons where business_id = $1 and add_on = $2 and ended_at is null and status = 'on'`, [
    businessId,
    addOn,
  ]);
  return rows.length > 0;
}

async function rowOf(businessId: string, key: AddOnKey): Promise<AddOnRow> {
  const rows = await query<{ status: string; stripe_item: string | null }>(
    `select status, stripe_item from design_addons where business_id = $1 and add_on = $2 and ended_at is null`,
    [businessId, key],
  );
  const r = rows[0];
  if (!r) return null;
  return { status: r.status === "requested" ? "requested" : "on", stripeItem: r.stripe_item };
}

const isOwn = async (businessId: string) => (await renuablCrm().catch(() => null))?.businessId === businessId;

/** Where the add-on stands for the business. */
export async function standingOf(businessId: string, key: AddOnKey): Promise<AddOnStanding> {
  if (!dbConfigured()) return "off";
  const [own, row] = await Promise.all([isOwn(businessId), rowOf(businessId, key).catch(() => null)]);
  return addOnStanding({ own, row });
}

/** Whether the business may use the add-on now (on its plan, or RENUABL's own business). */
export async function addOnOn(businessId: string, key: AddOnKey): Promise<boolean> {
  return addOnUsable(await standingOf(businessId, key));
}

/** Every add-on with where it stands and its price, for Billing and the offers. */
export async function addOnsOf(businessId: string): Promise<{ key: AddOnKey; standing: AddOnStanding; cents: number | null }[]> {
  const keys = Object.keys(ADD_ON_WORDS) as AddOnKey[];
  return Promise.all(keys.map(async (key) => ({ key, standing: await standingOf(businessId, key), cents: ADD_ON_MONTHLY_CENTS[key] })));
}

/** An unpriced add-on asked for: kept as asked for (nothing charged). False when it is already asked for or on. */
export async function requestAddOn(businessId: string, key: AddOnKey, by: string): Promise<boolean> {
  const rows = await query(
    `insert into design_addons (business_id, add_on, status, by_email, requested_at, since, ended_at)
     values ($1, $2, 'requested', $3, now(), now(), null)
     on conflict (business_id, add_on) do update set status = 'requested', by_email = $3, requested_at = now(), since = now(), ended_at = null, stripe_item = null
       where design_addons.ended_at is not null
     returning add_on`,
    [businessId, key, by.toLowerCase()],
  );
  return rows.length > 0;
}

/** The add-on switched on (by staff once the price is agreed, or after Stripe took the item). */
export async function switchOn(businessId: string, key: AddOnKey, by: string, stripeItem: string | null = null): Promise<void> {
  await query(
    `insert into design_addons (business_id, add_on, status, by_email, stripe_item, since, ended_at)
     values ($1, $2, 'on', $3, $4, now(), null)
     on conflict (business_id, add_on) do update set status = 'on', by_email = $3, stripe_item = coalesce($4, design_addons.stripe_item),
       since = case when design_addons.status = 'on' and design_addons.ended_at is null then design_addons.since else now() end, ended_at = null`,
    [businessId, key, by.toLowerCase(), stripeItem],
  );
}

/** The add-on ended (kept as a record). Voice ending releases the business's number. */
export async function endAddOn(businessId: string, key: AddOnKey): Promise<void> {
  await query(`update design_addons set ended_at = now() where business_id = $1 and add_on = $2 and ended_at is null`, [businessId, key]);
  if (key === "voice")
    await releaseNumber(businessId).catch((e) => console.error("number not released", e instanceof Error ? e.message : e));
}

/** Add-ons asked for and not yet on, across every business, for RENUABL's staff on /admin. Read only. */
export async function addOnsAskedFor(): Promise<{ businessId: string; business: string; key: AddOnKey; by: string | null; at: string }[]> {
  const rows = await query<{ business_id: string; name: string; add_on: string; by_email: string | null; at: string }>(
    `select a.business_id, b.name, a.add_on, a.by_email, to_char(a.requested_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at
       from design_addons a join businesses b on b.id = a.business_id
      where a.status = 'requested' and a.ended_at is null order by a.requested_at`,
  );
  return rows.flatMap((r) => {
    const key = cleanAddOnKey(r.add_on);
    return key ? [{ businessId: r.business_id, business: r.name, key, by: r.by_email, at: r.at }] : [];
  });
}

/** Add-ons on, across every business, for staff (to end one). */
export async function addOnsOnForStaff(): Promise<{ businessId: string; business: string; key: AddOnKey; charged: boolean }[]> {
  const rows = await query<{ business_id: string; name: string; add_on: string; stripe_item: string | null }>(
    `select a.business_id, b.name, a.add_on, a.stripe_item from design_addons a join businesses b on b.id = a.business_id
      where a.status = 'on' and a.ended_at is null order by b.name`,
  );
  return rows.flatMap((r) => {
    const key = cleanAddOnKey(r.add_on);
    return key ? [{ businessId: r.business_id, business: r.name, key, charged: Boolean(r.stripe_item) }] : [];
  });
}

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

/** The Stripe product an add-on is charged under, made once in the account and found again by its metadata. */
const productIds = new Map<AddOnKey, string>();

async function addOnProduct(stripe: Stripe, key: AddOnKey): Promise<string> {
  const known = productIds.get(key);
  if (known) return known;
  const found = (await stripe.products.list({ active: true, limit: 100 })).data.find((p) => p.metadata?.kind === `renuabl-addon-${key}`);
  const product =
    found ??
    (await stripe.products.create({ name: `RENUABL Business · ${ADD_ON_WORDS[key].name}`, metadata: { kind: `renuabl-addon-${key}` } }));
  productIds.set(key, product.id);
  return product.id;
}

/**
 * A priced add-on put on the plan's subscription: an item of its own at its monthly price (GST inclusive), prorated for
 * the rest of the month, and the row switched on with the item. Answers the item, or why not.
 */
export async function addToSubscription(
  stripe: Stripe,
  given: { businessId: string; key: AddOnKey; subscriptionId: string; by: string },
): Promise<{ item: string } | "unpriced" | "ended" | "already"> {
  const cents = ADD_ON_MONTHLY_CENTS[given.key];
  if (cents === null) return "unpriced";
  const sub = await stripe.subscriptions.retrieve(given.subscriptionId);
  if (["canceled", "incomplete_expired"].includes(sub.status)) return "ended";
  const existing = sub.items.data.find((i) => i.metadata?.addon === given.key);
  if (existing) {
    await switchOn(given.businessId, given.key, given.by, existing.id);
    return "already";
  }
  const item = await stripe.subscriptionItems.create({
    subscription: given.subscriptionId,
    price_data: { currency: "aud", product: await addOnProduct(stripe, given.key), unit_amount: cents, recurring: { interval: "month" } },
    tax_rates: [await gstTaxRate(stripe)],
    quantity: 1,
    metadata: { addon: given.key, business: given.businessId },
    proration_behavior: "create_prorations",
  });
  await switchOn(given.businessId, given.key, given.by, item.id);
  return { item: item.id };
}

/** An add-on taken off the plan: its subscription item removed (prorated), then ended here. */
export async function removeFromSubscription(stripe: Stripe | null, businessId: string, key: AddOnKey): Promise<void> {
  const row = await rowOf(businessId, key);
  if (row?.stripeItem && stripe)
    await stripe.subscriptionItems.del(row.stripeItem, { proration_behavior: "create_prorations" }).catch((e) => {
      // Already gone at Stripe (the plan ended): nothing to take off.
      console.error("add-on item not removed", e instanceof Error ? e.message : e);
    });
  await endAddOn(businessId, key);
}

/**
 * The webhook keeping a business's charged add-ons in step with its subscription: an add-on item there is on here; a
 * charged add-on whose item is gone (or the whole plan ended) is ended here. Add-ons staff switched on without a charge
 * are left alone.
 */
export async function syncAddOnsFromStripe(stripeSubscription: string, items: { id: string; addon: string | undefined }[], ended: boolean) {
  const subs = await query<{ business_id: string | null }>(`select business_id from design_subscriptions where stripe_subscription = $1`, [
    stripeSubscription,
  ]);
  const businessId = subs[0]?.business_id;
  if (!businessId) return;
  const live = ended ? [] : items.flatMap((i) => (cleanAddOnKey(i.addon) ? [{ key: cleanAddOnKey(i.addon)!, id: i.id }] : []));
  for (const i of live) await switchOn(businessId, i.key, "stripe", i.id);
  const charged = await query<{ add_on: string; stripe_item: string }>(
    `select add_on, stripe_item from design_addons where business_id = $1 and ended_at is null and stripe_item is not null`,
    [businessId],
  );
  for (const c of charged) {
    const key = cleanAddOnKey(c.add_on);
    if (key && !live.some((l) => l.id === c.stripe_item)) await endAddOn(businessId, key);
  }
}

// ---------------------------------------------------------------------------
// Custom proposals (the first add-on)
// ---------------------------------------------------------------------------

/** Whether this business may publish a proposal with its own design now. */
export async function customProposalsAllowed(businessId: string): Promise<boolean> {
  const enforced = billingEnforced();
  const cents = CUSTOM_PROPOSALS_MONTHLY_CENTS;
  if (!enforced || cents === null) return true;
  return mayPublishCustom({ enforced, cents, hasAddOn: await addOnOn(businessId, CUSTOM_PROPOSALS).catch(() => false) });
}
