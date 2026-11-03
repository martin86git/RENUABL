/**
 * Server only. Watching on the Marketplace and job alerts (domain/design/market-alerts.ts). A watch and an alert are a
 * person's own (the business id and their email, both from the signed-in member). Another business sees only how many
 * are watching, never who. Emails go from RENUABL, only when email and SITE_URL are set up, and never block anything.
 */
import {
  MAX_ALERT_EMAILS,
  alertMatches,
  cleanAlert,
  closingSoonEmail,
  itemGoneEmail,
  newListingEmail,
  REMIND_DAYS_BEFORE,
  type JobAlert,
  type WatchKind,
} from "@/lib/domain/design/market-alerts";
import { closesWords, kmBetween, systemLine, type ListingSystem } from "@/lib/domain/design/marketplace";
import { addDaysISO } from "@/lib/domain/scheduling";
import { todayInMarket } from "@/lib/domain/market";
import { siteUrl } from "@/lib/domain/sms";
import { query } from "./db";
import { listingDetail } from "./design-marketplace-repo";
import { itemDetail } from "./design-trade-repo";
import { emailProvider, sendEmail } from "./email";

type Person = { businessId: string; email: string };
const lower = (e: string) => e.trim().toLowerCase();

/**
 * Watches or stops watching. Only something this business may see and didn't post itself: a job listing still taking
 * bids, or an item for sale. Answers false when it can't be watched.
 */
export async function setWatch(who: Person, kind: WatchKind, id: string, on: boolean): Promise<boolean> {
  if (!on) {
    await query(`delete from design_watches where kind = $1 and target_id = $2 and business_id = $3 and email = $4`, [
      kind,
      id,
      who.businessId,
      lower(who.email),
    ]);
    return true;
  }
  const ok =
    kind === "listing"
      ? await listingDetail(who.businessId, id).then((d) => Boolean(d && !d.listing.mine && d.listing.status === "open"))
      : await itemDetail(who.businessId, id).then((d) => Boolean(d && !d.item.mine && ["available", "pending"].includes(d.item.status)));
  if (!ok) return false;
  await query(`insert into design_watches (kind, target_id, business_id, email) values ($1,$2,$3,$4) on conflict do nothing`, [
    kind,
    id,
    who.businessId,
    lower(who.email),
  ]);
  return true;
}

/** Adds how many are watching each, and whether this person is, to listings or items as they are sent to the browser. */
export async function withWatches<T extends { id: string }>(
  who: Person,
  kind: WatchKind,
  rows: T[],
): Promise<(T & { watching: number; watched: boolean })[]> {
  if (!rows.length) return [];
  const counts = await query<{ id: string; n: string; mine: boolean }>(
    `select target_id as id, count(*) as n, bool_or(business_id = $3 and email = $4) as mine
       from design_watches where kind = $1 and target_id = any($2) group by target_id`,
    [kind, rows.map((r) => r.id), who.businessId, lower(who.email)],
  );
  const by = new Map(counts.map((c) => [c.id, c]));
  return rows.map((r) => ({ ...r, watching: Number(by.get(r.id)?.n ?? 0), watched: Boolean(by.get(r.id)?.mine) }));
}

export async function loadAlert(who: Person): Promise<JobAlert> {
  const rows = await query<{ alert: unknown }>(`select alert from design_market_alerts where business_id = $1 and email = $2`, [
    who.businessId,
    lower(who.email),
  ]);
  return cleanAlert(rows[0]?.alert);
}

export async function saveAlert(who: Person, alert: JobAlert): Promise<JobAlert> {
  const clean = cleanAlert(alert);
  await query(
    `insert into design_market_alerts (business_id, email, alert) values ($1,$2,$3)
     on conflict (business_id, email) do update set alert = excluded.alert, updated_at = now()`,
    [who.businessId, lower(who.email), JSON.stringify(clean)],
  );
  return clean;
}

/**
 * A new listing: emails everyone whose alert it matches, in businesses that may bid (retailers and installers, not
 * the poster), measured from each business's base. Answers how many were emailed.
 */
export async function alertNewListing(listingId: string): Promise<number> {
  const site = siteUrl();
  if (!site || !emailProvider()) return 0;
  const found = await alertRecipients(listingId);
  if (!found) return 0;
  const { listing: l, people } = found;
  const link = `${site}/design/marketplace/${encodeURIComponent(listingId)}`;
  const closes = closesWords({ status: "open", closesOn: l.closesOn }, todayInMarket());
  let sent = 0;
  for (const p of people.slice(0, MAX_ALERT_EMAILS))
    await sendEmail({
      to: p.email,
      ...newListingEmail({
        suburb: l.suburb,
        system: systemLine(l.system),
        km: p.km,
        closes,
        link,
        settings: `${site}/design/marketplace`,
      }),
    })
      .then(() => sent++)
      .catch((e) => console.error("job alert email failed", e instanceof Error ? e.message : e));
  return sent;
}

/** Who a new listing's alerts go to (each person once, with how far it is from their business's base); null when it isn't open. */
export async function alertRecipients(listingId: string): Promise<{
  listing: { suburb: string; system: ListingSystem; closesOn: string };
  people: { email: string; km: number | null }[];
} | null> {
  const ls = await query<{
    business_id: string;
    suburb: string;
    system: ListingSystem;
    near_lat: number | null;
    near_lng: number | null;
    closes_on: string;
    status: string;
  }>(
    `select business_id, suburb, system, near_lat, near_lng, to_char(closes_on, 'YYYY-MM-DD') as closes_on, status from design_listings where id = $1`,
    [listingId],
  );
  const l = ls[0];
  if (!l || l.status !== "open") return null;
  const near = l.near_lat !== null && l.near_lng !== null ? { lat: l.near_lat, lng: l.near_lng } : null;
  const people = await query<{ email: string; alert: unknown; base: { lat?: unknown; lng?: unknown } | null }>(
    `select a.email, a.alert, p.prefs->'places'->'base' as base
       from design_market_alerts a
       join businesses b on b.id = a.business_id
       join business_members m on m.business_id = a.business_id and lower(m.email) = a.email
       left join design_prefs p on p.business_id = a.business_id
      where a.business_id <> $1 and b.kind in ('retailer','installer') and (a.alert->>'on')::boolean`,
    [l.business_id],
  );
  const out: { email: string; km: number | null }[] = [];
  for (const p of people) {
    const base = p.base && typeof p.base.lat === "number" && typeof p.base.lng === "number" ? { lat: p.base.lat, lng: p.base.lng } : null;
    const km = base && near ? Math.round(kmBetween(base, near)) : null;
    if (alertMatches(cleanAlert(p.alert), l.system, km) && !out.some((o) => o.email === p.email)) out.push({ email: p.email, km });
  }
  return { listing: { suburb: l.suburb, system: l.system, closesOn: l.closes_on }, people: out };
}

/**
 * The daily cron: each watched listing that stops taking bids tomorrow, to each watcher whose business hasn't bid on
 * it, once. Answers how many were emailed.
 */
export async function remindWatchers(): Promise<number> {
  const site = siteUrl();
  if (!site || !emailProvider()) return 0;
  const tomorrow = addDaysISO(todayInMarket(), REMIND_DAYS_BEFORE);
  const due = await query<{ id: string; business_id: string; email: string; suburb: string; system: ListingSystem }>(
    `select l.id, w.business_id, w.email, l.suburb, l.system
       from design_watches w join design_listings l on l.id = w.target_id
      where w.kind = 'listing' and w.reminded_at is null and l.status = 'open' and l.closes_on = $1::date
        and not exists (select 1 from design_bids x where x.listing_id = l.id and x.business_id = w.business_id and x.status in ('open','accepted'))
      limit 1000`,
    [tomorrow],
  );
  let sent = 0;
  for (const d of due) {
    // Marked first, so a failure is never sent twice.
    await query(
      `update design_watches set reminded_at = now() where kind = 'listing' and target_id = $1 and business_id = $2 and email = $3`,
      [d.id, d.business_id, d.email],
    );
    await sendEmail({
      to: d.email,
      ...closingSoonEmail({
        suburb: d.suburb,
        system: systemLine(d.system),
        link: `${site}/design/marketplace/${encodeURIComponent(d.id)}`,
      }),
    })
      .then(() => sent++)
      .catch((e) => console.error("watch reminder failed", e instanceof Error ? e.message : e));
  }
  return sent;
}

/** An item sold or taken down: its watchers are told once, and their watches end. Answers how many were emailed. */
export async function tellItemWatchers(itemId: string, sold: boolean): Promise<number> {
  const watchers = await query<{ email: string; title: string }>(
    `delete from design_watches w using design_trade_items i
      where w.kind = 'item' and w.target_id = $1 and i.id = w.target_id returning w.email, i.title`,
    [itemId],
  );
  const site = siteUrl();
  if (!site || !emailProvider()) return 0;
  let sent = 0;
  for (const w of watchers)
    await sendEmail({ to: w.email, ...itemGoneEmail({ title: w.title, sold, link: `${site}/design/marketplace/equipment` }) })
      .then(() => sent++)
      .catch((e) => console.error("watched item email failed", e instanceof Error ? e.message : e));
  return sent;
}
