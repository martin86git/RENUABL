/**
 * Server only. What the database keeps for proposals: each business's
 * branding and pictures, and the proposals it has sent.
 *
 * The same rule as the rest of the designer for everything a signed-in
 * member does: the business's id first, `business_id = $1` in every
 * statement, the id only ever from `design-context.ts`.
 *
 * The one exception is the last part of this file, which a customer reaches
 * with no account: there the proposal's private link (48 random hex
 * characters) is the key, and each function hands back only that one
 * proposal's customer copy (`view`). Nothing there reads `internal`, where
 * the costs and margin are.
 */
import { randomBytes } from "node:crypto";
import { IMAGE_LIMITS, readBrandKit, type BrandImage, type BrandKit, type ImageKind, type TermsFile } from "@/lib/domain/design/brand";
import { stageMoveText, type Customer, type Job, type JobStage } from "@/lib/domain/design/crm";
import {
  depositAsked,
  depositStatus,
  markedNotReceived,
  markedReceived,
  newReference,
  publicDeposit,
  saidPaid,
  waysToPay,
  type DepositRecord,
  type PaidWay,
  type PublicDeposit,
} from "@/lib/domain/design/deposit";
import { DEFAULT_WORKSPACE, cleanWorkspace, type Workspace } from "@/lib/domain/design/pricing";
import {
  FROM_CUSTOMER,
  PROPOSAL_OPENED,
  PROPOSAL_WITHDRAWN,
  accepted as acceptedText,
  isProposalToken,
  proposalPath,
  proposalState,
  published,
  recommendedGoal,
  viewForChoice,
  type ProposalInternal,
  type ProposalState,
  type ProposalStatus,
  type ProposalView,
} from "@/lib/domain/design/proposal";
import { cleanExtras, defaultBill, postcodeIn, type DesignExtras } from "@/lib/domain/design/quote";
import { cleanDesignSet, type DesignGoal, type DesignSet } from "@/lib/domain/design/roof-design";
import type { ISODate } from "@/lib/domain/types";
import { newId, query, transaction } from "./db";
import { jobById, record, type Q } from "./design-crm-repo";
import { loadLists, loadSettings, projectById } from "./design-repo";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

/** The business's brand kit: what it has saved, or what it starts with (its account's name, plain colours). */
export async function loadBrand(businessId: string, businessName: string): Promise<BrandKit> {
  const rows = await query<{ kit: unknown }>(`select kit from design_brand where business_id = $1`, [businessId]);
  return readBrandKit(rows[0]?.kit ?? null, businessName);
}

export async function saveBrand(businessId: string, kit: BrandKit, by: string): Promise<void> {
  await query(
    `insert into design_brand (business_id, kit, updated_by) values ($1,$2,$3)
     on conflict (business_id) do update set kit = excluded.kit, updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, JSON.stringify(kit), by.toLowerCase()],
  );
}

/** The business's pictures as they stand: its logo, its cover, and its photos, oldest first. Never the bytes. */
export async function listImages(businessId: string): Promise<BrandImage[]> {
  return query<BrandImage>(
    `select id, kind, width, height from design_files
      where business_id = $1 and removed_at is null and kind <> 'terms'
      order by case kind when 'logo' then 0 when 'cover' then 1 else 2 end, created_at, id`,
    [businessId],
  );
}

/**
 * Keeps a picture (already made safe and small: `design-images.ts`). A new
 * logo or cover takes the place of the one before; photos add up to the
 * limit, and past it the answer is "full".
 */
export async function addImage(
  businessId: string,
  kind: ImageKind,
  image: { bytes: Buffer; contentType: string; width: number; height: number },
  by: string,
): Promise<BrandImage | "full"> {
  return transaction(async (q) => {
    if (kind === "photo" || kind === "block") {
      const count = await q<{ n: string }>(
        `select count(*) as n from design_files where business_id = $1 and kind = $2 and removed_at is null`,
        [businessId, kind],
      );
      if (Number(count[0]?.n ?? 0) >= (kind === "photo" ? IMAGE_LIMITS.photos : IMAGE_LIMITS.blocks)) return "full";
    } else {
      await q(`update design_files set removed_at = now() where business_id = $1 and kind = $2 and removed_at is null`, [businessId, kind]);
    }
    const id = newId("img");
    await q(
      `insert into design_files (id, business_id, kind, content_type, bytes, width, height, created_by) values ($2,$1,$3,$4,$5,$6,$7,$8)`,
      [businessId, id, kind, image.contentType, image.bytes, image.width, image.height, by.toLowerCase()],
    );
    return { id, kind, width: image.width, height: image.height };
  });
}

/**
 * Takes a picture out of the brand kit. It is marked removed, not deleted:
 * a proposal already sent keeps the pictures it was sent with.
 */
export async function removeImage(businessId: string, id: string): Promise<boolean> {
  const rows = await query(
    `update design_files set removed_at = now() where business_id = $1 and id = $2 and removed_at is null returning id`,
    [businessId, id],
  );
  return rows.length > 0;
}

export interface ImageFile {
  bytes: Buffer;
  contentType: string;
}

/** One of the business's own pictures, for its own screens. */
export async function imageFile(businessId: string, id: string): Promise<ImageFile | null> {
  const rows = await query<{ bytes: Buffer; content_type: string }>(
    `select bytes, content_type from design_files where business_id = $1 and id = $2`,
    [businessId, id],
  );
  return rows[0] ? { bytes: rows[0].bytes, contentType: rows[0].content_type } : null;
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/** The business's settings and price lists as the quote reads them: the same as the designer loads. */
export async function loadWorkspace(businessId: string): Promise<Workspace> {
  const [settings, lists] = await Promise.all([loadSettings(businessId), loadLists(businessId)]);
  return cleanWorkspace({ ...(settings ?? DEFAULT_WORKSPACE), lists });
}

export interface Saved {
  job: Job;
  customer: Customer;
  project: { address: string; lat: number; lng: number; version: number; set: DesignSet; extras: DesignExtras };
  workspace: Workspace;
  brand: BrandKit;
  images: BrandImage[];
  /** The number the next publishing will carry: the newest version's own while the customer hasn't opened it, else the one after. */
  nextVersion: number;
}

export const NO_DESIGN = "This deal has no roof design yet. Open it in the design tool and save a design first.";

/**
 * Everything saved that a proposal for this job is worked out from. Null
 * when the business has no such job; `NO_DESIGN` when the job has no roof
 * design to price.
 */
export async function savedFor(businessId: string, businessName: string, jobId: string): Promise<Saved | typeof NO_DESIGN | null> {
  const found = await jobById(businessId, jobId);
  if (!found) return null;
  const row = found.job.projectId ? await projectById(businessId, found.job.projectId) : null;
  const set = row ? cleanDesignSet(row.design) : null;
  if (!row || !set) return NO_DESIGN;
  const [workspace, brand, images, versions] = await Promise.all([
    loadWorkspace(businessId),
    loadBrand(businessId, businessName),
    listImages(businessId),
    query<{ version: number; seen: boolean }>(
      `select v.version, (v.opened_at is not null or v.accepted_at is not null or p.withdrawn_at is not null) as seen
         from design_proposal_versions v join design_proposals p on p.business_id = v.business_id and p.id = v.proposal_id
        where v.business_id = $1 and p.job_id = $2 order by v.version desc limit 1`,
      [businessId, jobId],
    ),
  ]);
  const extras = cleanExtras(row.extras, set.designs.length, {
    bill: defaultBill(workspace.settings.bill),
    postcode: postcodeIn(row.address),
  });
  return {
    ...found,
    project: { address: row.address, lat: row.lat, lng: row.lng, version: row.version, set, extras },
    workspace,
    brand,
    images,
    // A version the customer hasn't opened yet is brought up to date in place; once they have seen one, the next is a new version.
    nextVersion: versions[0] ? versions[0].version + (versions[0].seen ? 1 : 0) : 1,
  };
}

interface VersionRow {
  version: number;
  view: ProposalView;
  publishedAt: string;
  openedAt: string | null;
  acceptedAt: string | null;
  acceptedName: string | null;
  /** The system chosen, when the proposal offered a choice. */
  acceptedOption: DesignGoal | null;
  token: string;
  withdrawn: boolean;
  depositRef: string | null;
  saidWay: PaidWay | null;
  saidAt: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
}

const VERSION = `v.version, v.view, ${moment("v.published_at")} as "publishedAt", ${moment("v.opened_at")} as "openedAt",
  ${moment("v.accepted_at")} as "acceptedAt", v.accepted_name as "acceptedName", p.token, p.withdrawn_at is not null as withdrawn,
  v.deposit_ref as "depositRef", v.deposit_said_way as "saidWay", ${moment("v.deposit_said_at")} as "saidAt",
  ${moment("v.deposit_received_at")} as "receivedAt", v.deposit_received_by as "receivedBy", v.accepted_option as "acceptedOption"`;

/** An accepted version as it was agreed: the system the customer chose in place of the recommended one. */
const asAgreed = <T extends { view: ProposalView; acceptedOption?: string | null }>(row: T): T =>
  row.acceptedOption ? { ...row, view: viewForChoice(row.view, row.acceptedOption as DesignGoal) } : row;

/** What is kept about a version's deposit, as the domain reads it. */
const depositRecord = (row: VersionRow): DepositRecord => ({
  reference: row.depositRef,
  saidWay: row.saidWay,
  saidAt: row.saidAt,
  receivedAt: row.receivedAt,
  receivedBy: row.receivedBy,
});
const depositOn = (row: VersionRow) => depositStatus(row.view, Boolean(row.acceptedAt), depositRecord(row));

const statusOf = (row: VersionRow, today: ISODate): ProposalStatus => ({
  state: proposalState({ withdrawn: row.withdrawn, accepted: Boolean(row.acceptedAt), validUntil: row.view.validUntil }, today),
  path: proposalPath(row.token),
  version: row.version,
  publishedAt: row.publishedAt,
  validUntil: row.view.validUntil,
  template: row.view.template,
  youPay: row.view.price.youPay,
  openedAt: row.openedAt,
  acceptedAt: row.acceptedAt,
  acceptedName: row.acceptedName,
  indicative: Boolean(row.view.indicative),
  deposit: depositOn(row),
});

/** A job's proposal as its deal page shows it: every version sent, newest first. Empty when none has been. */
export async function proposalVersions(businessId: string, jobId: string, today: ISODate): Promise<ProposalStatus[]> {
  const rows = await query<VersionRow>(
    `select ${VERSION} from design_proposal_versions v join design_proposals p on p.business_id = v.business_id and p.id = v.proposal_id
      where v.business_id = $1 and p.job_id = $2 order by v.version desc`,
    [businessId, jobId],
  );
  return rows.map((row) => statusOf(asAgreed(row), today));
}

/** The customer's copy of one version the business sent, for its own preview of what went out. */
export async function sentView(businessId: string, jobId: string, version: number): Promise<ProposalView | null> {
  const rows = await query<{ view: ProposalView; acceptedOption: string | null }>(
    `select v.view, v.accepted_option as "acceptedOption" from design_proposal_versions v join design_proposals p on p.business_id = v.business_id and p.id = v.proposal_id
      where v.business_id = $1 and p.job_id = $2 and v.version = $3`,
    [businessId, jobId, version],
  );
  return rows[0] ? asAgreed(rows[0]).view : null;
}

/** The stages a job is taken out of when a proposal is sent, and when one is accepted. Never backwards. */
const BEFORE_PROPOSAL: readonly JobStage[] = ["lead", "designed"];
const BEFORE_WON: readonly JobStage[] = ["lead", "designed", "proposal"];

/**
 * Keeps a proposal that has been worked out (`buildProposal`), with its
 * private link (made the first time, the same ever after). While the
 * customer hasn't opened the newest version, publishing again brings that
 * version up to date in place, so the design tool can publish on every save
 * without piling up versions; once they have opened or accepted one, it
 * stays as they saw it and this is the next version. A job at "lead" or
 * "designed" moves to "proposal", its value becomes what the customer pays,
 * and a new version is written on the customer's record. "raced" when the
 * version it was worked out as has been opened or published over in the
 * meantime: nothing is kept.
 */
export async function publishProposal(
  businessId: string,
  jobId: string,
  built: { view: ProposalView; internal: ProposalInternal },
  by: string,
): Promise<{ token: string } | "raced" | null> {
  const who = by.toLowerCase();
  return transaction(async (q) => {
    const jobs = await q<{ customer_id: string; stage: JobStage }>(
      `select customer_id, stage from design_jobs where business_id = $1 and id = $2 for update`,
      [businessId, jobId],
    );
    const job = jobs[0];
    if (!job) return null;
    const token = randomBytes(24).toString("hex");
    const kept = await q<{ id: string; token: string }>(
      `insert into design_proposals (id, business_id, job_id, customer_id, token, created_by) values ($2,$1,$3,$4,$5,$6)
       on conflict (business_id, job_id) do update set withdrawn_at = null returning id, token`,
      [businessId, newId("prop"), jobId, job.customer_id, token, who],
    );
    const made = await q<{ id: string; fresh: boolean }>(
      `insert into design_proposal_versions (id, business_id, proposal_id, version, view, internal, published_by)
       values ($2,$1,$3,$4,$5,$6,$7)
       on conflict (proposal_id, version) do update
         set view = excluded.view, internal = excluded.internal, published_by = excluded.published_by, published_at = now()
         where design_proposal_versions.opened_at is null and design_proposal_versions.accepted_at is null
       returning id, (xmax = 0) as fresh`,
      [businessId, newId("pver"), kept[0].id, built.view.version, JSON.stringify(built.view), JSON.stringify(built.internal), who],
    );
    if (!made.length) throw new Raced();
    const moves = BEFORE_PROPOSAL.includes(job.stage);
    await q(`update design_jobs set value = $3, stage = $4, updated_at = now() where business_id = $1 and id = $2`, [
      businessId,
      jobId,
      built.view.price.youPay,
      moves ? "proposal" : job.stage,
    ]);
    const line = { customerId: job.customer_id, jobId, by: who };
    if (made[0].fresh)
      await record(q, businessId, { ...line, kind: "proposal", text: published(built.view.version, built.view.indicative) });
    if (moves) await record(q, businessId, { ...line, kind: "stage", text: stageMoveText("proposal") });
    return { token: kept[0].token };
  }).catch((e) => {
    if (e instanceof Raced) return "raced" as const;
    throw e;
  });
}

/** Thrown inside the publishing transaction to undo it when the version number was taken a moment before. */
class Raced extends Error {}

/** Takes a job's proposal back: its link then shows only how to reach the business. False when there was none out. */
export async function withdrawProposal(businessId: string, jobId: string, by: string): Promise<boolean> {
  return transaction(async (q) => {
    const rows = await q<{ customer_id: string }>(
      `update design_proposals set withdrawn_at = now() where business_id = $1 and job_id = $2 and withdrawn_at is null returning customer_id`,
      [businessId, jobId],
    );
    if (!rows[0]) return false;
    await record(q, businessId, {
      customerId: rows[0].customer_id,
      jobId,
      kind: "proposal",
      text: PROPOSAL_WITHDRAWN,
      by: by.toLowerCase(),
    });
    return true;
  });
}

// ---------------------------------------------------------------------------
// The customer's side: reached by the private link alone
// ---------------------------------------------------------------------------

/** What a customer's link opens. `view` is null once the proposal is withdrawn: then only who to contact is shown. */
export interface PublicProposal {
  state: ProposalState;
  view: ProposalView | null;
  /** Who to contact, always: the business's name and how to reach it, as it was when the proposal was sent. */
  business: Pick<ProposalView["business"], "name" | "phone" | "email" | "website">;
  /** Who went ahead, when, and on which system when there was a choice. */
  accepted: { name: string; at: string; option?: DesignGoal | null } | null;
  /** The deposit, once the proposal is accepted and it asks for one: the amount, the reference to pay with, where it stands. */
  deposit: PublicDeposit | null;
}

interface Found extends VersionRow {
  businessId: string;
  jobId: string;
  customerId: string;
  versionId: string;
  questions: number;
}

/** The newest version behind a link. Only ever the customer's copy: `internal` is not among the columns. */
async function behind(q: Q | typeof query, token: string, lock = false): Promise<Found | null> {
  if (!isProposalToken(token)) return null;
  const rows = await q<Found>(
    `select ${VERSION}, v.id as "versionId", p.business_id as "businessId", p.job_id as "jobId", p.customer_id as "customerId", p.questions
       from design_proposals p join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id
      where p.token = $1 order by v.version desc limit 1 ${lock ? "for update of p, v" : ""}`,
    [token],
  );
  return rows[0] ? asAgreed(rows[0]) : null;
}

const stateOf = (row: Found, today: ISODate) =>
  proposalState({ withdrawn: row.withdrawn, accepted: Boolean(row.acceptedAt), validUntil: row.view.validUntil }, today);

/** What the link opens for the customer. Null for a link we never made: the same as one that doesn't exist. */
export async function publicProposal(token: string, today: ISODate): Promise<PublicProposal | null> {
  const row = await behind(query, token);
  if (!row) return null;
  const state = stateOf(row, today);
  const { name, phone, email, website } = row.view.business;
  // A proposal accepted before deposits had references is given one the first time it is opened after.
  if (state === "accepted" && depositAsked(row.view) !== null && !row.depositRef)
    row.depositRef = await giveReference(query, row.businessId, row.versionId);
  return {
    state,
    view: state === "withdrawn" ? null : row.view,
    business: { name, phone, email, website },
    accepted: row.acceptedAt && row.acceptedName ? { name: row.acceptedName, at: row.acceptedAt, option: row.acceptedOption } : null,
    deposit: state === "accepted" ? publicDeposit(depositOn(row)) : null,
  };
}

/**
 * Gives a version its payment reference, once: short, random, and the only one like it in the business, so a
 * payment can be matched to its deal. It says nothing of the private link. Kept if one is already there.
 */
async function giveReference(q: Q | typeof query, businessId: string, versionId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const rows = await q<{ ref: string }>(
      `update design_proposal_versions v set deposit_ref = coalesce(v.deposit_ref, $3)
        where v.business_id = $1 and v.id = $2
          and not exists (select 1 from design_proposal_versions o where o.business_id = $1 and o.deposit_ref = $3)
        returning v.deposit_ref as ref`,
      [businessId, versionId, newReference(randomBytes(16))],
    );
    if (rows[0]) return rows[0].ref;
  }
  return null;
}

/**
 * Keeps the business's own terms and conditions (a PDF, already checked to be
 * one) beside its pictures, in place of any it had before. The one before is
 * only marked removed, so a proposal sent with it can still be read.
 */
export async function addTermsFile(businessId: string, bytes: Buffer, name: string, by: string): Promise<TermsFile> {
  return transaction(async (q) => {
    await q(`update design_files set removed_at = now() where business_id = $1 and kind = 'terms' and removed_at is null`, [businessId]);
    const id = newId("doc");
    await q(
      `insert into design_files (id, business_id, kind, content_type, bytes, width, height, created_by) values ($2,$1,'terms','application/pdf',$3,0,0,$4)`,
      [businessId, id, bytes, by.toLowerCase()],
    );
    return { id, name };
  });
}

/** The business's own terms file, for its own screens: only a terms file, and only its own. */
export async function termsFile(businessId: string, id: string): Promise<ImageFile | null> {
  const rows = await query<{ bytes: Buffer; content_type: string }>(
    `select bytes, content_type from design_files where business_id = $1 and id = $2 and kind = 'terms'`,
    [businessId, id],
  );
  return rows[0] ? { bytes: rows[0].bytes, contentType: rows[0].content_type } : null;
}

/** The business's own terms on the proposal behind a link: only the file that proposal was sent with, and none once it is withdrawn. */
export async function publicTerms(token: string): Promise<(ImageFile & { name: string }) | null> {
  const row = await behind(query, token);
  if (!row || row.withdrawn || !row.view.ownTerms) return null;
  const file = await termsFile(row.businessId, row.view.ownTerms.id);
  return file ? { ...file, name: row.view.ownTerms.name } : null;
}

/** A picture on the proposal behind a link: only one that proposal was sent with, and none once it is withdrawn. */
export async function publicImage(token: string, id: string): Promise<ImageFile | null> {
  const row = await behind(query, token);
  if (!row || row.withdrawn) return null;
  const { logo, cover, photos } = row.view.business;
  if (![logo, cover, ...photos, ...(row.view.blocks ?? []).map((b) => b.image)].some((image) => image?.id === id)) return null;
  return imageFile(row.businessId, id);
}

/** Everything the PDF of the proposal behind a link is made from: the customer's copy and the pictures it was sent with. Null once withdrawn. */
export async function publicPdfParts(
  token: string,
): Promise<{ view: ProposalView; images: Record<string, ImageFile>; accepted: { name: string; at: string } | null } | null> {
  const row = await behind(query, token);
  if (!row || row.withdrawn) return null;
  const { logo, cover } = row.view.business;
  const images: Record<string, ImageFile> = {};
  for (const image of [logo, cover, ...(row.view.blocks ?? []).map((b) => b.image)]) {
    const file = image ? await imageFile(row.businessId, image.id) : null;
    if (image && file) images[image.id] = file;
  }
  return { view: row.view, images, accepted: row.acceptedAt && row.acceptedName ? { name: row.acceptedName, at: row.acceptedAt } : null };
}

/** Where the roof behind a link is, for its picture from above. Null once withdrawn. */
export async function publicRoof(token: string): Promise<{ lat: number; lng: number } | null> {
  const row = await behind(query, token);
  return row && !row.withdrawn ? { lat: row.view.roof.lat, lng: row.view.roof.lng } : null;
}

/** The first time a customer opens their proposal is written on their record, once for each version. */
export async function markOpened(token: string): Promise<void> {
  await transaction(async (q) => {
    const row = await behind(q, token, true);
    if (!row || row.withdrawn || row.openedAt) return;
    await q(`update design_proposal_versions set opened_at = now() where business_id = $1 and id = $2`, [row.businessId, row.versionId]);
    await record(q, row.businessId, {
      customerId: row.customerId,
      jobId: row.jobId,
      kind: "proposal",
      text: PROPOSAL_OPENED,
      by: FROM_CUSTOMER,
    });
  });
}

/**
 * A customer going ahead. Kept once, against the version they were looking
 * at, with the name they typed and the server's time; the job moves to "won"
 * (never backwards), and both are written on their record. Anything but a
 * live proposal is refused with its state ("accepted" for one accepted
 * before: only "accepted-now" means this call did it).
 */
export async function acceptProposal(
  token: string,
  name: string,
  today: ISODate,
  /** The system the customer chose, when the proposal offers a choice; the recommended one when it isn't one on offer. */
  option: string | null = null,
): Promise<"accepted-now" | "indicative" | ProposalState | null> {
  return transaction(async (q) => {
    const found = await behind(q, token, true);
    if (!found) return null;
    const state = stateOf(found, today);
    if (state !== "live") return state;
    // An indicative proposal is for the customer's thoughts: the final one, after the site visit, is the one accepted.
    if (found.view.indicative) return "indicative";
    const chosen = found.view.options?.some((o) => o.goal === option) ? (option as DesignGoal) : recommendedGoal(found.view);
    // From here on it is the proposal as agreed: the chosen system's price, and so its deposit.
    const row = { ...found, view: viewForChoice(found.view, chosen) };
    await q(
      `update design_proposal_versions set accepted_at = now(), accepted_name = $3, accepted_option = $4 where business_id = $1 and id = $2`,
      [row.businessId, row.versionId, name, chosen],
    );
    const jobs = await q<{ stage: JobStage }>(`select stage from design_jobs where business_id = $1 and id = $2 for update`, [
      row.businessId,
      row.jobId,
    ]);
    // The reference a deposit is paid with is made now, with the acceptance it belongs to.
    if (depositAsked(row.view) !== null) await giveReference(q, row.businessId, row.versionId);
    const line = { customerId: row.customerId, jobId: row.jobId, by: FROM_CUSTOMER };
    await record(q, row.businessId, { ...line, kind: "proposal", text: acceptedText(name) });
    if (jobs[0] && BEFORE_WON.includes(jobs[0].stage)) {
      await q(`update design_jobs set stage = 'won', updated_at = now() where business_id = $1 and id = $2`, [row.businessId, row.jobId]);
      await record(q, row.businessId, { ...line, kind: "stage", text: stageMoveText("won") });
    }
    return "accepted-now";
  });
}

/**
 * A customer saying they have paid the deposit, from their link. Kept as exactly that: what they said, how, and
 * when. It is never a payment we have seen, and it never marks the deposit received (only the business does that).
 * Taken once, and only on an accepted proposal that asks for a deposit, by a way that proposal offers. "said-now"
 * when this call kept it; otherwise why not.
 */
export async function sayPaid(
  token: string,
  way: PaidWay,
  today: ISODate,
): Promise<"said-now" | "said-before" | "received" | "not-accepted" | "no-deposit" | "no-such-way" | null> {
  return transaction(async (q) => {
    const row = await behind(q, token, true);
    if (!row) return null;
    if (stateOf(row, today) !== "accepted") return "not-accepted";
    const deposit = depositOn(row);
    if (!deposit) return "no-deposit";
    if (!waysToPay(row.view).includes(way)) return "no-such-way";
    if (deposit.standing === "received") return "received";
    if (deposit.standing === "said") return "said-before";
    await q(`update design_proposal_versions set deposit_said_way = $3, deposit_said_at = now() where business_id = $1 and id = $2`, [
      row.businessId,
      row.versionId,
      way,
    ]);
    await record(q, row.businessId, {
      customerId: row.customerId,
      jobId: row.jobId,
      kind: "proposal",
      text: saidPaid(way, deposit.amount, deposit.reference),
      by: FROM_CUSTOMER,
    });
    return "said-now";
  });
}

/**
 * The business marking a job's deposit received, or not received (which also sets aside what the customer said, so
 * the deposit is due again and they can be asked again). On the newest version, once accepted. Each is written on
 * the customer's record with who did it. False when there is no accepted proposal with a deposit; doing it twice
 * changes nothing the second time.
 */
export async function markDeposit(businessId: string, jobId: string, received: boolean, by: string): Promise<boolean> {
  const who = by.toLowerCase();
  return transaction(async (q) => {
    const rows = await q<Found>(
      `select ${VERSION}, v.id as "versionId", p.business_id as "businessId", p.job_id as "jobId", p.customer_id as "customerId", p.questions
         from design_proposals p join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id
        where p.business_id = $1 and p.job_id = $2 order by v.version desc limit 1 for update of p, v`,
      [businessId, jobId],
    );
    const row = rows[0];
    const deposit = row ? depositOn(row) : null;
    if (!row || !deposit) return false;
    if (received ? deposit.standing === "received" : deposit.standing === "due") return true;
    if (received)
      await q(
        `update design_proposal_versions set deposit_received_at = now(), deposit_received_by = $3 where business_id = $1 and id = $2`,
        [businessId, row.versionId, who],
      );
    else
      await q(
        `update design_proposal_versions set deposit_received_at = null, deposit_received_by = null, deposit_said_way = null,
           deposit_said_at = null where business_id = $1 and id = $2`,
        [businessId, row.versionId],
      );
    await record(q, businessId, {
      customerId: row.customerId,
      jobId,
      kind: "proposal",
      text: received ? markedReceived(deposit.amount) : markedNotReceived(deposit.amount),
      by: who,
    });
    return true;
  });
}

/**
 * Who to tell that a customer says they have paid their deposit, and what to say: the same addresses as an
 * acceptance, the customer, the job, how they say they paid and the reference to look for. Never the bank details,
 * the price or the amount. Null when nothing has been said or nobody is listed.
 */
export async function paidNotice(token: string): Promise<{
  to: string[];
  business: string;
  customer: string;
  title: string;
  jobId: string;
  way: PaidWay;
  reference: string | null;
} | null> {
  const row = await behind(query, token);
  if (!row || !row.acceptedAt || !row.saidWay || row.receivedAt) return null;
  const brand = await loadBrand(row.businessId, row.view.business.name);
  if (!brand.notify.length) return null;
  return {
    to: brand.notify,
    business: brand.name,
    customer: row.view.customer.name,
    title: row.view.title,
    jobId: row.jobId,
    way: row.saidWay,
    reference: row.depositRef,
  };
}

/**
 * Who to tell that the proposal behind a link has been accepted, and what to
 * say: the business's own extra addresses as they stand now, the customer's
 * name and the job. Never the price, the bank details or anything else of
 * the proposal. Null when it isn't accepted or nobody is listed.
 */
export async function acceptedNotice(
  token: string,
): Promise<{ to: string[]; business: string; customer: string; title: string; jobId: string; acceptedBy: string } | null> {
  const row = await behind(query, token);
  if (!row || !row.acceptedAt || !row.acceptedName) return null;
  const brand = await loadBrand(row.businessId, row.view.business.name);
  if (!brand.notify.length) return null;
  return {
    to: brand.notify,
    business: brand.name,
    customer: row.view.customer.name,
    title: row.view.title,
    jobId: row.jobId,
    acceptedBy: row.acceptedName,
  };
}

/**
 * The job behind a link, for its conversation: whose it is, what to call each side, and whether the proposal has
 * been withdrawn. The customer's name is theirs as it stands now; the business's is as it was on the proposal.
 */
export async function proposalJob(token: string): Promise<{
  businessId: string;
  jobId: string;
  customerId: string;
  withdrawn: boolean;
  businessName: string;
  customerName: string;
  title: string;
} | null> {
  const row = await behind(query, token);
  if (!row) return null;
  const who = await query<{ name: string; title: string }>(
    `select c.name, j.title from design_jobs j join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where j.business_id = $1 and j.id = $2`,
    [row.businessId, row.jobId],
  );
  if (!who[0]) return null;
  return {
    businessId: row.businessId,
    jobId: row.jobId,
    customerId: row.customerId,
    withdrawn: row.withdrawn,
    businessName: row.view.business.name,
    customerName: who[0].name,
    title: who[0].title,
  };
}

/** The private link's token for one of the business's jobs, when it has a proposal out (not withdrawn). Null otherwise. */
export async function tokenForJob(businessId: string, jobId: string): Promise<string | null> {
  const rows = await query<{ token: string }>(
    `select token from design_proposals where business_id = $1 and job_id = $2 and withdrawn_at is null`,
    [businessId, jobId],
  );
  return rows[0]?.token ?? null;
}
