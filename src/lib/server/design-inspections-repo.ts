/**
 * Server only. Inspections an installer nominates (domain/design/inspections.ts). The installer's functions take its
 * business id first and reach a job only through a share it accepted; the inspector's take the inspector's and reach
 * a job only through its live inspection, while the share is still accepted and both pairs (retailer and installer,
 * installer and inspector) are still connected; the retailer's take its own. Nothing here changes the job card itself.
 */
import { cleanKind } from "@/lib/domain/design/business-kind";
import {
  inspectionLive,
  nominateRefusal,
  type InspectionLine,
  type InspectionState,
  type InspectionView,
  type Outcome,
} from "@/lib/domain/design/inspections";
import { newId, query } from "./db";
import { areConnected } from "./design-connections-repo";
import { record } from "./design-crm-repo";
import { jobCard, jobFile, type JobCardView } from "./design-job-card-repo";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
const owner = async (businessId: string) =>
  (await query<{ email: string }>(`select email from business_members where business_id = $1 and role = 'owner' limit 1`, [businessId]))[0]
    ?.email ?? null;

const VIEW = `i.id, ib.name as inspector, nb.name as installer, i.state, to_char(i.inspect_on, 'YYYY-MM-DD') as "on", i.notes,
  case when i.cert_name is null then null else json_build_object('name', i.cert_name) end as certificate,
  ${moment("i.updated_at")} as "updatedAt"`;
const FROM = `from design_inspections i join businesses ib on ib.id = i.inspector_business join businesses nb on nb.id = i.installer_business`;

/** The inspectors this installer is connected with, by directory key and name. */
export async function inspectorsToNominate(installerId: string): Promise<{ key: string; name: string }[]> {
  return query<{ key: string; name: string }>(
    `select d.key, b.name from design_connections c
       join businesses b on b.id = case when c.a_business = $1 then c.b_business else c.a_business end
       join design_directory d on d.business_id = b.id
      where (c.a_business = $1 or c.b_business = $1) and c.status = 'connected' and b.kind = 'inspector'
      order by b.name`,
    [installerId],
  );
}

/** A share this installer accepted, with its job. */
async function acceptedShare(installerId: string, shareId: string) {
  const rows = await query<{
    businessId: string;
    jobId: string;
    suburb: string;
    system: string;
    installDate: string | null;
    customerId: string;
  }>(
    `select s.business_id as "businessId", s.job_id as "jobId", s.suburb, s.system, to_char(j.install_date, 'YYYY-MM-DD') as "installDate",
            j.customer_id as "customerId"
       from design_job_shares s join design_jobs j on j.business_id = s.business_id and j.id = s.job_id
      where s.id = $1 and s.installer_business = $2 and s.state = 'accepted'`,
    [shareId, installerId],
  );
  return rows[0] ?? null;
}

/** The newest inspection on the job behind this installer's share, or null. */
export async function inspectionForShare(installerId: string, shareId: string): Promise<InspectionView | null> {
  const rows = await query<InspectionView>(
    `select ${VIEW} ${FROM} where i.share_id = $1 and i.installer_business = $2 order by i.nominated_at desc limit 1`,
    [shareId, installerId],
  );
  return rows[0] ?? null;
}

/** The newest inspection on a retailer's job, or null. */
export async function inspectionOfJob(businessId: string, jobId: string): Promise<InspectionView | null> {
  const rows = await query<InspectionView>(
    `select ${VIEW} ${FROM} where i.business_id = $1 and i.job_id = $2 order by i.nominated_at desc limit 1`,
    [businessId, jobId],
  );
  return rows[0] ?? null;
}

/**
 * The installer nominates a connected inspector (by directory key) on a job it accepted. Written on the retailer's
 * record. Answers who to tell (the inspector's owner) and where.
 */
export async function nominate(
  member: { businessId: string; businessName: string; email: string },
  shareId: string,
  key: string,
): Promise<{ ok: true; tell: string | null; suburb: string; day: string | null } | { ok: false; status: number; message: string }> {
  const share = await acceptedShare(member.businessId, shareId);
  const target = (
    await query<{ id: string; name: string; kind: string }>(
      `select b.id, b.name, b.kind from design_directory d join businesses b on b.id = d.business_id where d.key = $1`,
      [key],
    )
  )[0];
  const current = share ? await inspectionForShare(member.businessId, shareId) : null;
  const refused = nominateRefusal({
    accepted: Boolean(share) && (share ? await areConnected(share.businessId, member.businessId) : false),
    connected: Boolean(target) && (await areConnected(member.businessId, target!.id)),
    kind: target ? cleanKind(target.kind) : "",
    live: Boolean(current && inspectionLive(current.state)),
  });
  if (refused || !share || !target) return { ok: false, status: 409, message: refused ?? "Choose an inspector you're connected with." };
  try {
    await query(
      `insert into design_inspections (id, business_id, job_id, share_id, installer_business, inspector_business, nominated_by)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [newId("ins"), share.businessId, share.jobId, shareId, member.businessId, target.id, member.email.toLowerCase()],
    );
  } catch (e) {
    if (String((e as { code?: string }).code) === "23505") return { ok: false, status: 409, message: "An inspector is already nominated." };
    throw e;
  }
  await record(query, share.businessId, {
    customerId: share.customerId,
    jobId: share.jobId,
    kind: "note",
    text: `${member.businessName} nominated ${target.name} to inspect the installation.`,
    by: member.email.toLowerCase(),
  }).catch(() => undefined);
  return { ok: true, tell: await owner(target.id), suburb: share.suburb, day: share.installDate };
}

/** The installer takes its nomination back: the inspector's view of the job closes. */
export async function withdrawNomination(member: { businessId: string; email: string }, shareId: string): Promise<boolean> {
  const rows = await query(
    `update design_inspections set state = 'withdrawn', updated_at = now(), updated_by = $3
      where share_id = $1 and installer_business = $2 and state not in ('declined','withdrawn') returning id`,
    [shareId, member.businessId, member.email.toLowerCase()],
  );
  return rows.length > 0;
}

/** The inspections nominated to this inspector that are still live, newest first: where, when and what only. */
export async function inspectionsFor(inspectorId: string): Promise<InspectionLine[]> {
  return query<InspectionLine>(
    `select i.id, nb.name as "from", s.suburb, to_char(j.install_date, 'YYYY-MM-DD') as "installDate", s.system, i.state,
            to_char(i.inspect_on, 'YYYY-MM-DD') as "on"
       from design_inspections i join businesses nb on nb.id = i.installer_business
       join design_job_shares s on s.id = i.share_id
       join design_jobs j on j.business_id = i.business_id and j.id = i.job_id
      where i.inspector_business = $1 and i.state not in ('declined','withdrawn')
      order by (i.state in ('nominated','booked')) desc, coalesce(i.inspect_on, j.install_date) nulls last, i.nominated_at desc limit 200`,
    [inspectorId],
  );
}

/** How many inspections wait for this inspector to book them. */
export async function nominatedCount(inspectorId: string): Promise<number> {
  const rows = await query<{ n: string }>(
    `select count(*) as n from design_inspections where inspector_business = $1 and state = 'nominated'`,
    [inspectorId],
  );
  return Number(rows[0]?.n ?? 0);
}

/** An inspection this inspector may open: live, the share still accepted, both pairs still connected. */
async function openFor(inspectorId: string, id: string) {
  const rows = await query<{
    businessId: string;
    jobId: string;
    installerId: string;
    retailer: string;
    suburb: string;
    customerId: string;
    sentBy: string;
    state: InspectionState;
  }>(
    `select i.business_id as "businessId", i.job_id as "jobId", i.installer_business as "installerId", rb.name as retailer, s.suburb,
            j.customer_id as "customerId", s.sent_by as "sentBy", i.state
       from design_inspections i join design_job_shares s on s.id = i.share_id
       join businesses rb on rb.id = i.business_id
       join design_jobs j on j.business_id = i.business_id and j.id = i.job_id
      where i.id = $1 and i.inspector_business = $2 and s.state = 'accepted' and i.state not in ('declined','withdrawn')`,
    [id, inspectorId],
  );
  const r = rows[0];
  if (!r) return null;
  const [one, two] = await Promise.all([areConnected(r.businessId, r.installerId), areConnected(r.installerId, inspectorId)]);
  return one && two ? r : null;
}

/** The job as the inspector sees it (read only, never the customer's email), with the inspection; null when closed. */
export async function inspectionCard(inspectorId: string, id: string): Promise<{ card: JobCardView; inspection: InspectionView } | null> {
  const open = await openFor(inspectorId, id);
  if (!open) return null;
  const [card, rows] = await Promise.all([
    jobCard({ businessId: open.businessId, businessName: open.retailer }, open.jobId, true),
    query<InspectionView>(`select ${VIEW} ${FROM} where i.id = $1`, [id]),
  ]);
  return card && rows[0] ? { card, inspection: rows[0] } : null;
}

/** A photo from the job card, for the inspector of a live inspection only. */
export async function inspectionFile(inspectorId: string, id: string, fileId: string) {
  const open = await openFor(inspectorId, id);
  return open ? jobFile(open.businessId, open.jobId, fileId) : null;
}

/** Where the inspector's view gets its roof picture: the job's place and address. */
export async function inspectionRoof(inspectorId: string, id: string): Promise<{ lat: number; lng: number; address: string } | null> {
  const got = await inspectionCard(inspectorId, id);
  return got?.card.roof ? { ...got.card.roof, address: got.card.job.address } : null;
}

/**
 * The inspector records where it stands, with notes and, when sent, the certificate (kept as sent; the last one
 * replaces an earlier one). Written on the retailer's record. Answers who to tell (the installer's owner and whoever
 * sent the job) and where.
 */
export async function recordOutcome(
  member: { businessId: string; businessName: string; email: string },
  id: string,
  outcome: { state: Outcome; on: string | null; notes: string },
  certificate: { name: string; type: string; bytes: Buffer } | null,
): Promise<{ ok: true; tell: string[]; suburb: string } | { ok: false; status: number; message: string }> {
  const open = await openFor(member.businessId, id);
  if (!open) return { ok: false, status: 404, message: "This inspection isn't open to you any more." };
  await query(
    `update design_inspections set state = $2, inspect_on = $3, notes = $4, updated_at = now(), updated_by = $5,
       cert_name = coalesce($6, cert_name), cert_type = coalesce($7, cert_type), cert_bytes = coalesce($8, cert_bytes)
     where id = $1`,
    [
      id,
      outcome.state,
      outcome.on,
      outcome.notes,
      member.email.toLowerCase(),
      certificate?.name ?? null,
      certificate?.type ?? null,
      certificate?.bytes ?? null,
    ],
  );
  const words =
    outcome.state === "booked"
      ? `${member.businessName} booked the inspection${outcome.on ? ` for ${outcome.on}` : ""}.`
      : outcome.state === "passed"
        ? `${member.businessName} passed the installation.`
        : `${member.businessName} found defects: ${outcome.notes}`;
  await record(query, open.businessId, {
    customerId: open.customerId,
    jobId: open.jobId,
    kind: "note",
    text: `${words}${certificate ? " Certificate added." : ""}`.slice(0, 2000),
    by: member.email.toLowerCase(),
  }).catch(() => undefined);
  const tell = [await owner(open.installerId), open.sentBy].filter((e): e is string => Boolean(e));
  return { ok: true, tell: [...new Set(tell)], suburb: open.suburb };
}

/** The inspector declines: the installer can nominate someone else. */
export async function declineInspection(member: { businessId: string; email: string }, id: string): Promise<boolean> {
  const rows = await query(
    `update design_inspections set state = 'declined', updated_at = now(), updated_by = $3
      where id = $1 and inspector_business = $2 and state = 'nominated' returning id`,
    [id, member.businessId, member.email.toLowerCase()],
  );
  return rows.length > 0;
}

/** The certificate, for the retailer, the installer or the inspector of that inspection only. */
export async function certificateFor(viewerId: string, id: string): Promise<{ name: string; type: string; bytes: Buffer } | null> {
  const rows = await query<{ name: string; type: string; bytes: Buffer }>(
    `select cert_name as name, cert_type as type, cert_bytes as bytes from design_inspections
      where id = $1 and cert_bytes is not null and $2 in (business_id, installer_business, inspector_business)`,
    [id, viewerId],
  );
  return rows[0] ?? null;
}
