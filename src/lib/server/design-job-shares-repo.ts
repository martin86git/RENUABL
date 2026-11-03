/**
 * Server only. Jobs a retailer sends to a connected installer (domain/design/job-shares.ts). The retailer's functions
 * take its business id first; the installer's take the installer's. The installer reaches a job only through its
 * share: the line (suburb, day, system) while it waits, and once accepted the job card's own installer link, which
 * stays open only while the share is live and the two are still connected (`linkedBusiness`, read by cardByToken).
 */
import { cleanKind } from "@/lib/domain/design/business-kind";
import { suburbAlone } from "@/lib/domain/design/marketplace";
import {
  BUSINESS_LINK,
  answerRefusal,
  sendRefusal,
  shareLive,
  type ShareState,
  type ShareStatus,
  type SharedJobLine,
} from "@/lib/domain/design/job-shares";
import { collectionOf, jobSheet, type JobSheet } from "@/lib/domain/design/my-jobs";
import { newId, query, transaction } from "./db";
import { jobOrder, loadPrefs } from "./design-after-sale-repo";
import { areConnected } from "./design-connections-repo";
import { jobById, record } from "./design-crm-repo";
import { installerLink, jobCard } from "./design-job-card-repo";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
const owner = async (businessId: string) =>
  (await query<{ email: string }>(`select email from business_members where business_id = $1 and role = 'owner' limit 1`, [businessId]))[0]
    ?.email ?? null;

/** The connected installers this retailer can send a job to, by their directory key and name. */
export async function installersToSendTo(businessId: string): Promise<{ key: string; name: string }[]> {
  return query<{ key: string; name: string }>(
    `select d.key, b.name from design_connections c
       join businesses b on b.id = case when c.a_business = $1 then c.b_business else c.a_business end
       join design_directory d on d.business_id = b.id
      where (c.a_business = $1 or c.b_business = $1) and c.status = 'connected' and b.kind = 'installer'
      order by b.name`,
    [businessId],
  );
}

/** Where a job stands with an installer: the newest share, or null when it was never sent. */
export async function shareOf(businessId: string, jobId: string): Promise<ShareStatus | null> {
  const rows = await query<ShareStatus>(
    `select s.id, b.name as "to", s.state, ${moment("s.sent_at")} as "sentAt", ${moment("s.answered_at")} as "answeredAt"
       from design_job_shares s join businesses b on b.id = s.installer_business
      where s.business_id = $1 and s.job_id = $2 order by s.sent_at desc limit 1`,
    [businessId, jobId],
  );
  return rows[0] ?? null;
}

/**
 * Sends a job to a connected installer (by its directory key): refused unless they are connected, it is an installer,
 * and the job isn't already with someone. Written on the deal's record. Answers who to tell (the installer's owner).
 */
export async function sendJob(
  member: { businessId: string; businessName: string; email: string },
  jobId: string,
  key: string,
): Promise<{ ok: true; tell: string | null; suburb: string; day: string | null } | { ok: false; status: number; message: string }> {
  const found = await jobById(member.businessId, jobId);
  if (!found) return { ok: false, status: 404, message: "There's no such job." };
  const target = (
    await query<{ id: string; name: string; kind: string }>(
      `select b.id, b.name, b.kind from design_directory d join businesses b on b.id = d.business_id where d.key = $1`,
      [key],
    )
  )[0];
  if (!target) return { ok: false, status: 404, message: "Choose an installer you're connected with." };
  const live = await shareOf(member.businessId, jobId);
  const refused = sendRefusal({
    connected: await areConnected(member.businessId, target.id),
    kind: cleanKind(target.kind),
    live: live && shareLive(live.state) ? live : null,
  });
  if (refused) return { ok: false, status: 409, message: refused };
  const { job, customer } = found;
  const suburb = suburbAlone(job.address || customer.address) || "a suburb to confirm";
  const battery = (job.details.batteryStorage ?? "").trim();
  const system =
    [job.kw ? `${job.kw.toFixed(2)} kW solar` : "", battery ? `${battery} battery` : ""].filter(Boolean).join(" with ") || job.title;
  const token = await installerLink(member.businessId, jobId, `${BUSINESS_LINK}${target.id}`);
  try {
    await query(
      `insert into design_job_shares (id, business_id, job_id, installer_business, token, suburb, system, sent_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [newId("shr"), member.businessId, jobId, target.id, token, suburb, system.slice(0, 120), member.email.toLowerCase()],
    );
  } catch (e) {
    if (String((e as { code?: string }).code) === "23505")
      return { ok: false, status: 409, message: "This job is already with an installer." };
    throw e;
  }
  await record(query, member.businessId, {
    customerId: customer.id,
    jobId,
    kind: "note",
    text: `Sent to ${target.name} on RENUABL to install.`,
    by: member.email.toLowerCase(),
  }).catch(() => undefined);
  return { ok: true, tell: await owner(target.id), suburb, day: job.installDate };
}

/** The retailer takes a job back: the installer's card closes. */
export async function withdrawJob(member: { businessId: string; email: string }, jobId: string): Promise<boolean> {
  const rows = await query<{ name: string; customerId: string }>(
    `update design_job_shares s set state = 'withdrawn', answered_at = now(), answered_by = $3
       from businesses b, design_jobs j
      where s.business_id = $1 and s.job_id = $2 and s.state in ('sent','accepted')
        and b.id = s.installer_business and j.business_id = s.business_id and j.id = s.job_id
      returning b.name, j.customer_id as "customerId"`,
    [member.businessId, jobId, member.email.toLowerCase()],
  );
  if (!rows.length) return false;
  // The job's inspection still waiting (nominated or booked) goes with the share, so a new one can be nominated and
  // the inspector no longer sees the job (3 Nov 2026, a bug review). A finished one stays as the job's record.
  await query(
    `update design_inspections set state = 'withdrawn', updated_at = now(), updated_by = $3
      where business_id = $1 and job_id = $2 and state in ('nominated','booked')`,
    [member.businessId, jobId, member.email.toLowerCase()],
  );
  await record(query, member.businessId, {
    customerId: rows[0].customerId,
    jobId,
    kind: "note",
    text: `Taken back from ${rows[0].name}.`,
    by: member.email.toLowerCase(),
  }).catch(() => undefined);
  return true;
}

/** The jobs sent to this installer still waiting or accepted, newest first: suburb, day and system only. */
export async function jobsFor(installerBusinessId: string): Promise<SharedJobLine[]> {
  return query<SharedJobLine>(
    `select s.id, b.name as "from", s.suburb, to_char(j.install_date, 'YYYY-MM-DD') as "installDate", s.system, s.state,
            ${moment("s.sent_at")} as "sentAt"
       from design_job_shares s join businesses b on b.id = s.business_id
       join design_jobs j on j.business_id = s.business_id and j.id = s.job_id
      where s.installer_business = $1 and s.state in ('sent','accepted')
      order by (s.state = 'sent') desc, j.install_date nulls last, s.sent_at desc limit 200`,
    [installerBusinessId],
  );
}

/** How many jobs wait for this installer's answer. */
export async function waitingCount(installerBusinessId: string): Promise<number> {
  const rows = await query<{ n: string }>(`select count(*) as n from design_job_shares where installer_business = $1 and state = 'sent'`, [
    installerBusinessId,
  ]);
  return Number(rows[0]?.n ?? 0);
}

/**
 * The installer accepts or declines a job sent to it. Accepting names it as the deal's installer; both are written on
 * the retailer's record. Answers who to tell (whoever sent it) and the suburb.
 */
export async function answerJob(
  member: { businessId: string; businessName: string; email: string },
  shareId: string,
  action: "accept" | "decline",
): Promise<{ ok: true; tell: string; suburb: string } | { ok: false; status: number; message: string }> {
  return transaction(async (q) => {
    const rows = await q<{ state: ShareState; businessId: string; jobId: string; sentBy: string; suburb: string; customerId: string }>(
      `select s.state, s.business_id as "businessId", s.job_id as "jobId", s.sent_by as "sentBy", s.suburb, j.customer_id as "customerId"
         from design_job_shares s join design_jobs j on j.business_id = s.business_id and j.id = s.job_id
        where s.id = $1 and s.installer_business = $2 for update of s`,
      [shareId, member.businessId],
    );
    const s = rows[0];
    if (!s) return { ok: false as const, status: 404, message: "That job isn't there any more." };
    const refused = answerRefusal(s.state, action);
    if (refused) return { ok: false as const, status: 409, message: refused };
    if (s.state === "accepted") return { ok: true as const, tell: s.sentBy, suburb: s.suburb };
    if (!(await areConnected(s.businessId, member.businessId)))
      return { ok: false as const, status: 409, message: "You're no longer connected with this retailer." };
    await q(`update design_job_shares set state = $2, answered_at = now(), answered_by = $3 where id = $1`, [
      shareId,
      action === "accept" ? "accepted" : "declined",
      member.email.toLowerCase(),
    ]);
    if (action === "accept")
      await q(
        `update design_jobs set details = jsonb_set(details, '{installer}', to_jsonb($3::text)), updated_at = now() where business_id = $1 and id = $2`,
        [s.businessId, s.jobId, member.businessName],
      );
    await record(q, s.businessId, {
      customerId: s.customerId,
      jobId: s.jobId,
      kind: "note",
      text:
        action === "accept" ? `${member.businessName} accepted the job on RENUABL.` : `${member.businessName} declined the job on RENUABL.`,
      by: member.email.toLowerCase(),
    });
    return { ok: true as const, tell: s.sentBy, suburb: s.suburb };
  });
}

/** The job card's link for an accepted job of this installer's, while the two are still connected; else null. */
export async function openShared(installerBusinessId: string, shareId: string): Promise<{ token: string; from: string } | null> {
  const rows = await query<{ token: string; from: string; businessId: string }>(
    `select s.token, b.name as "from", s.business_id as "businessId" from design_job_shares s join businesses b on b.id = s.business_id
      where s.id = $1 and s.installer_business = $2 and s.state = 'accepted'`,
    [shareId, installerBusinessId],
  );
  const r = rows[0];
  return r && (await areConnected(r.businessId, installerBusinessId)) ? { token: r.token, from: r.from } : null;
}

/**
 * For cardByToken: who a business link is for, while its job's share is live and the two are connected; null
 * otherwise (so taking a job back, declining or disconnecting closes the card).
 */
export async function linkedBusiness(
  businessId: string,
  jobId: string,
  installerId: string,
): Promise<{ id: string; name: string; email: string; phone: string } | null> {
  if (!installerId.startsWith(BUSINESS_LINK)) return null;
  const partner = installerId.slice(BUSINESS_LINK.length);
  const rows = await query<{ name: string; state: ShareState }>(
    `select b.name, s.state from design_job_shares s join businesses b on b.id = s.installer_business
      where s.business_id = $1 and s.job_id = $2 and s.installer_business = $3 order by s.sent_at desc limit 1`,
    [businessId, jobId, partner],
  );
  const r = rows[0];
  if (!r || r.state !== "accepted" || !(await areConnected(businessId, partner))) return null;
  return { id: installerId, name: r.name, email: (await owner(partner)) ?? "", phone: "" };
}

/**
 * The installer's accepted jobs as My Jobs shows them (domain/design/my-jobs.ts): each read from the retailer's job
 * card (as the installer sees it: never the customer's email) and its order's collection, only while the two are
 * still connected. Reading changes nothing of the retailer's (the order isn't opened). At most 60, soonest first.
 */
export async function installerSheets(installerBusinessId: string): Promise<JobSheet[]> {
  const shares = await query<{ id: string; businessId: string; retailer: string; jobId: string }>(
    `select s.id, s.business_id as "businessId", b.name as retailer, s.job_id as "jobId"
       from design_job_shares s join businesses b on b.id = s.business_id
       join design_jobs j on j.business_id = s.business_id and j.id = s.job_id
      where s.installer_business = $1 and s.state = 'accepted'
      order by j.install_date nulls last, s.sent_at desc limit 60`,
    [installerBusinessId],
  );
  const sheets = await Promise.all(
    shares.map(async (s) => {
      if (!(await areConnected(s.businessId, installerBusinessId))) return null;
      const [card, order, prefs] = await Promise.all([
        jobCard({ businessId: s.businessId, businessName: s.retailer }, s.jobId, true),
        jobOrder(s.businessId, s.jobId, false),
        loadPrefs(s.businessId),
      ]);
      if (!card) return null;
      const collection = typeof order === "string" ? [] : collectionOf(order.groups, order.order, prefs.places.collection);
      return jobSheet({ id: s.id, retailer: card.business || s.retailer, card, collection });
    }),
  );
  return sheets.filter((s): s is JobSheet => s !== null);
}
