/**
 * Server only. The Marketplace's job listings (domain/design/marketplace.ts). This is the one place businesses see
 * each other's work, so the rule is narrower than anywhere else: a listing row holds only what was chosen to be shown
 * (built here from the job, never sent from a browser), a business's id never leaves the server (only its name), the
 * poster alone sees the bids on its listing, a bidder sees only its own, and the street address and both businesses'
 * contact are given only to the poster and the business it awarded the job to.
 */
import { randomBytes } from "node:crypto";
import { systemDetails } from "@/lib/domain/design/deal";
import { PRE_INSTALL_STAGES } from "@/lib/domain/design/crm";
import {
  bidRefusal,
  closesOn,
  roughPlace,
  suburbAlone,
  systemLine,
  type Bid,
  type BidState,
  type Listing,
  type ListingState,
  type ListingSystem,
} from "@/lib/domain/design/marketplace";
import { todayInMarket } from "@/lib/domain/market";
import { siteUrl } from "@/lib/domain/sms";
import { query, transaction } from "./db";
import { jobById, record } from "./design-crm-repo";
import { NO_DESIGN, savedFor } from "./design-proposal-repo";
import { emailProvider, sendEmail } from "./email";
import { newBidEmail, awardedEmail } from "@/lib/domain/design/marketplace";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const day = (column: string) => `to_char(${column}, 'YYYY-MM-DD')`;
type Who = { businessId: string; businessName: string; email: string };

const num = (v: string | null | undefined) => {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** What a listing says of a job's system, from the deal and its design: words and sizes only, nothing of the customer. */
async function systemOf(member: Who, jobId: string): Promise<ListingSystem | null> {
  const saved = await savedFor(member.businessId, member.businessName, jobId);
  if (!saved) return null;
  const found = saved === NO_DESIGN ? await jobById(member.businessId, jobId) : saved;
  if (!found) return null;
  const set = saved === NO_DESIGN ? null : saved.project.set;
  const design = set ? set.designs[set.primary] : null;
  const form = set && saved !== NO_DESIGN ? (saved.project.extras.quotes[set.primary]?.form ?? null) : null;
  const d = Object.fromEntries(systemDetails(design, form, found.job.details).map((x) => [x.key, x.value ?? ""])) as Record<string, string>;
  return {
    kw: found.job.kw ?? num(d.systemSize),
    panels: num(d.panelQty),
    panel: (d.panel ?? "").slice(0, 80),
    inverter: (d.inverter ?? "").slice(0, 80),
    batteryKwh: num(d.batteryStorage),
    ev: Boolean(d.evCharger && !/^(none|no|-)$/i.test(d.evCharger.trim())),
    storeys: (d.storeys ?? "").slice(0, 30),
    roof: (d.roofType ?? "").slice(0, 30),
    phases: (d.phases ?? "").slice(0, 30),
  };
}

/** Lists one of the business's sold jobs. Refused for a job not sold, one already installing, or one already listed. */
export async function createListing(
  member: Who,
  jobId: string,
  input: { notes: string; from: string | null; to: string | null; guide: number | null; openFor: number },
): Promise<{ ok: true; id: string } | { ok: false; status: number; message: string }> {
  const found = await jobById(member.businessId, jobId);
  if (!found) return { ok: false, status: 404, message: "There's no such deal." };
  const { job, customer } = found;
  if (!PRE_INSTALL_STAGES.includes(job.stage))
    return { ok: false, status: 409, message: "Only a sold job not yet installed can be listed." };
  const system = await systemOf(member, jobId);
  if (!system) return { ok: false, status: 404, message: "There's no such deal." };
  const address = job.address || customer.address;
  const suburb = suburbAlone(address);
  if (!suburb) return { ok: false, status: 409, message: "Give the deal an address first: a listing shows its suburb." };
  const state = address.match(/\b(VIC|NSW|QLD|SA|WA|TAS|ACT|NT)\b/i)?.[1]?.toUpperCase() ?? "";
  const postcode = address.match(/\b(\d{4})\b(?!.*\b\d{4}\b)/)?.[1] ?? "";
  const near = job.lat !== null && job.lng !== null ? roughPlace({ lat: job.lat, lng: job.lng }) : null;
  const id = `lst_${randomBytes(10).toString("hex")}`;
  try {
    await query(
      `insert into design_listings (id, business_id, job_id, title, suburb, state, postcode, near_lat, near_lng, system, notes,
         from_day, to_day, guide, closes_on, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        id,
        member.businessId,
        jobId,
        `${systemLine(system)} in ${suburb}`.slice(0, 160),
        suburb,
        state,
        postcode,
        near?.lat ?? null,
        near?.lng ?? null,
        JSON.stringify(system),
        input.notes,
        input.from,
        input.to,
        input.guide,
        closesOn(todayInMarket(), input.openFor),
        member.email.toLowerCase(),
      ],
    );
  } catch (e) {
    if (String((e as { code?: string }).code) === "23505") return { ok: false, status: 409, message: "This job is already listed." };
    throw e;
  }
  await record(query, member.businessId, {
    customerId: customer.id,
    jobId,
    kind: "note",
    text: "Listed on the marketplace for installers to bid on (suburb, system and dates only).",
    by: member.email.toLowerCase(),
  }).catch(() => undefined);
  return { ok: true, id };
}

const LISTING = `l.id, b.name as business, l.title, l.suburb, l.state, l.postcode, l.near_lat, l.near_lng, l.system, l.notes,
  ${day("l.from_day")} as "from", ${day("l.to_day")} as "to", l.guide, l.status, ${day("l.closes_on")} as "closesOn",
  ${moment("l.created_at")} as "createdAt", (l.business_id = $1) as mine,
  (select count(*) from design_bids x where x.listing_id = l.id and x.status in ('open','accepted')) as bids`;

type ListingRow = Omit<Listing, "near" | "bids" | "myBid"> & { near_lat: number | null; near_lng: number | null; bids: string };

const BID = (alias: string) =>
  `${alias}.id, ${alias}.listing_id as "listingId", bb.name as business, ${alias}.amount, ${day(`${alias}.start_day`)} as start, ${alias}.note,
   ${alias}.status, ${moment(`${alias}.at`)} as at`;

async function withMyBids(businessId: string, rows: ListingRow[]): Promise<Listing[]> {
  const mine = rows.length
    ? await query<Bid>(
        `select ${BID("x")} from design_bids x join businesses bb on bb.id = x.business_id where x.business_id = $1 and x.listing_id = any($2)`,
        [businessId, rows.map((r) => r.id)],
      )
    : [];
  return rows.map(({ near_lat, near_lng, bids, ...r }) => ({
    ...r,
    near: near_lat !== null && near_lng !== null ? { lat: near_lat, lng: near_lng } : null,
    bids: Number(bids),
    myBid: mine.find((m) => m.listingId === r.id) ?? null,
  }));
}

/** Every open listing (anyone's), and this business's own whatever their state, and any it has bid on. */
export async function listListings(businessId: string): Promise<Listing[]> {
  const rows = await query<ListingRow>(
    `select ${LISTING} from design_listings l join businesses b on b.id = l.business_id
      where l.status = 'open' or l.business_id = $1 or exists (select 1 from design_bids x where x.listing_id = l.id and x.business_id = $1)
      order by l.created_at desc limit 500`,
    [businessId],
  );
  return withMyBids(businessId, rows);
}

export interface ListingDetail {
  listing: Listing;
  /** The poster's own: every bid, with the business behind each. */
  bids: Bid[] | null;
  /** Given only once awarded, and only to the poster and the business awarded it. */
  handover: { address: string; poster: { business: string; email: string }; installer: { business: string; email: string } } | null;
  /** The deal it came from, for the poster. */
  jobId: string | null;
}

/** One listing as this business may see it; null when it isn't one it may see (another's that is no longer open and it never bid on). */
export async function listingDetail(businessId: string, id: string): Promise<ListingDetail | null> {
  const rows = await query<ListingRow & { jobId: string; awarded: string | null }>(
    `select ${LISTING}, l.job_id as "jobId", l.awarded_bid as awarded from design_listings l join businesses b on b.id = l.business_id
      where l.id = $2 and (l.status = 'open' or l.business_id = $1 or exists (select 1 from design_bids x where x.listing_id = l.id and x.business_id = $1))`,
    [businessId, id],
  );
  const row = rows[0];
  if (!row) return null;
  const { jobId, awarded, ...rest } = row;
  const [listing] = await withMyBids(businessId, [rest]);
  const bids = listing.mine
    ? await query<Bid>(`select ${BID("x")} from design_bids x join businesses bb on bb.id = x.business_id where x.listing_id = $1`, [id])
    : null;
  let handover: ListingDetail["handover"] = null;
  if (listing.status === "awarded" && awarded) {
    const h = await query<{
      address: string;
      poster: string;
      posterEmail: string;
      installer: string;
      installerEmail: string;
      installerBusiness: string;
    }>(
      `select coalesce(nullif(j.address, ''), c.address) as address, pb.name as poster, l.created_by as "posterEmail",
              ib.name as installer, x.by_email as "installerEmail", x.business_id as "installerBusiness"
         from design_listings l
         join design_jobs j on j.business_id = l.business_id and j.id = l.job_id
         join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
         join businesses pb on pb.id = l.business_id
         join design_bids x on x.id = l.awarded_bid
         join businesses ib on ib.id = x.business_id
        where l.id = $1`,
      [id],
    );
    const v = h[0];
    if (v && (listing.mine || v.installerBusiness === businessId))
      handover = {
        address: v.address,
        poster: { business: v.poster, email: v.posterEmail },
        installer: { business: v.installer, email: v.installerEmail },
      };
  }
  return { listing, bids, handover, jobId: listing.mine ? jobId : null };
}

/** Places (or changes) this business's bid; the poster is told by email from RENUABL when one is set up. */
export async function placeBid(
  member: Who,
  id: string,
  bid: { amount: number; start: string | null; note: string },
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const today = todayInMarket();
  const detail = await listingDetail(member.businessId, id);
  if (!detail) return { ok: false, status: 404, message: "That listing isn't there any more." };
  const refused = bidRefusal(detail.listing, today);
  if (refused) return { ok: false, status: 409, message: refused };
  const fresh = !detail.listing.myBid || detail.listing.myBid.status === "withdrawn";
  await query(
    `insert into design_bids (id, listing_id, business_id, by_email, amount, start_day, note) values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (listing_id, business_id) do update set by_email = excluded.by_email, amount = excluded.amount,
       start_day = excluded.start_day, note = excluded.note, status = 'open', at = now()`,
    [`bid_${randomBytes(10).toString("hex")}`, id, member.businessId, member.email.toLowerCase(), bid.amount, bid.start, bid.note],
  );
  const site = siteUrl();
  if (fresh && site && emailProvider()) {
    const poster = await query<{ email: string }>(`select created_by as email from design_listings where id = $1`, [id]);
    if (poster[0])
      await sendEmail({
        to: poster[0].email,
        ...newBidEmail({
          suburb: detail.listing.suburb,
          system: systemLine(detail.listing.system),
          bidder: member.businessName,
          amount: bid.amount,
          link: `${site}/design/marketplace/${id}`,
        }),
      }).catch((e) => console.error("new bid email failed", e instanceof Error ? e.message : e));
  }
  return { ok: true };
}

export async function withdrawBid(businessId: string, id: string): Promise<boolean> {
  const rows = await query(
    `update design_bids set status = 'withdrawn' where listing_id = $1 and business_id = $2 and status = 'open'
       and exists (select 1 from design_listings l where l.id = $1 and l.status = 'open') returning id`,
    [id, businessId],
  );
  return rows.length > 0;
}

/**
 * The poster chooses a bid: the job goes to that business, every other bid is declined, the listing is awarded, the
 * deal's installer is set to that business and it is written on the deal's record. The winner is told by email.
 */
export async function awardBid(
  member: Who,
  id: string,
  bidId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const done = await transaction(async (q) => {
    const ls = await q<{ jobId: string; status: ListingState; suburb: string; system: ListingSystem }>(
      `select job_id as "jobId", status, suburb, system from design_listings where id = $1 and business_id = $2 for update`,
      [id, member.businessId],
    );
    const l = ls[0];
    if (!l) return { ok: false as const, status: 404, message: "That listing isn't yours." };
    if (l.status !== "open") return { ok: false as const, status: 409, message: "This listing is closed." };
    const bs = await q<{ amount: number; email: string; business: string; status: BidState }>(
      `select x.amount, x.by_email as email, b.name as business, x.status from design_bids x join businesses b on b.id = x.business_id
        where x.id = $1 and x.listing_id = $2`,
      [bidId, id],
    );
    const b = bs[0];
    if (!b || b.status !== "open") return { ok: false as const, status: 409, message: "That bid isn't open any more." };
    await q(
      `update design_bids set status = case when id = $2 then 'accepted' else 'declined' end where listing_id = $1 and status = 'open'`,
      [id, bidId],
    );
    await q(`update design_listings set status = 'awarded', awarded_bid = $2 where id = $1`, [id, bidId]);
    const job = await q<{ customerId: string }>(
      `update design_jobs set details = jsonb_set(details, '{installer}', to_jsonb($3::text)), updated_at = now()
        where business_id = $1 and id = $2 returning customer_id as "customerId"`,
      [member.businessId, l.jobId, b.business],
    );
    if (job[0])
      await record(q, member.businessId, {
        customerId: job[0].customerId,
        jobId: l.jobId,
        kind: "note",
        text: `Awarded on the marketplace to ${b.business} for $${b.amount.toLocaleString("en-AU")} ex GST.`,
        by: member.email.toLowerCase(),
      });
    return { ok: true as const, winner: b, suburb: l.suburb, system: l.system };
  });
  if (!done.ok) return done;
  const site = siteUrl();
  if (site && emailProvider())
    await sendEmail({
      to: done.winner.email,
      ...awardedEmail({
        suburb: done.suburb,
        system: systemLine(done.system),
        poster: member.businessName,
        amount: done.winner.amount,
        link: `${site}/design/marketplace/${id}`,
      }),
      replyTo: member.email,
    }).catch((e) => console.error("awarded email failed", e instanceof Error ? e.message : e));
  return { ok: true };
}

/** The poster takes a listing down: open bids are declined. */
export async function withdrawListing(businessId: string, id: string): Promise<boolean> {
  return transaction(async (q) => {
    const rows = await q(
      `update design_listings set status = 'withdrawn' where id = $1 and business_id = $2 and status = 'open' returning id`,
      [id, businessId],
    );
    if (!rows.length) return false;
    await q(`update design_bids set status = 'declined' where listing_id = $1 and status = 'open'`, [id]);
    return true;
  });
}
