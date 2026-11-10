/**
 * Server only. The installation job card (domain/design/job-card.ts): read from the job, its customer, its roof design
 * and the business's installers on file, with the card's own thread of notes and photos. Under the designer's tenant
 * rule: the business id first, from the signed-in member, or from an installer's private link, which opens only its
 * own job and only while that installer is still on file (or, for a connected installer, while the job is accepted).
 */
import { randomBytes } from "node:crypto";
import { systemDetails } from "@/lib/domain/design/deal";
import { jobDrawing, stringsInWords, type Installer, type JobDrawing, type JobNote } from "@/lib/domain/design/job-card";
import { designSummary, type RoofDesign } from "@/lib/domain/design/roof-design";
import { cleanAsBuilt, type AsBuilt, type AsBuiltInput, type Designed } from "@/lib/domain/design/as-built";
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import { query, transaction } from "./db";
import { loadPrefs } from "./design-after-sale-repo";
import { jobById, record } from "./design-crm-repo";
import { NO_DESIGN, savedFor } from "./design-proposal-repo";
import { linkedBusiness } from "./design-job-shares-repo";
import { BUSINESS_LINK } from "@/lib/domain/design/job-shares";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export interface JobCardView {
  business: string;
  job: { id: string; title: string; address: string; installDate: string | null; stage: string };
  customer: { name: string; phone: string; email?: string };
  /** The system, as the deal and its design say: only the lines filled in. */
  details: { label: string; value: string }[];
  /** The solar and battery in sizes, for the card's title (`cardHeadline`): the design's, else the deal's. */
  system: { kw: number | null; batteryKwh: number | null };
  /** The roof picture's place, for the drawings' backdrop. Null without a design. */
  roof: { lat: number; lng: number } | null;
  layout: JobDrawing | null;
  strings: JobDrawing | null;
  stringWords: string[];
  notes: JobNote[];
  /** What the design says to install, and what was really installed (null until recorded): the as-built. */
  designed: Designed | null;
  asBuilt: AsBuilt | null;
  /** For the business's own people: the installers on file, and when the card last went to each. */
  installers?: (Installer & { sentAt: string | null })[];
}

/** The design the installer builds: the system the customer chose when they signed, else the roof's primary design. */
async function chosenDesign(businessId: string, jobId: string, designs: RoofDesign[], primary: number): Promise<RoofDesign> {
  const rows = await query<{ option: string | null }>(
    `select v.accepted_option as option from design_proposals p
       join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id
      where p.business_id = $1 and p.job_id = $2 and v.accepted_at is not null order by v.version desc limit 1`,
    [businessId, jobId],
  );
  const goal = rows[0]?.option;
  return (goal && designs.find((d) => d.goal === goal)) || designs[primary] || designs[0];
}

/** The card, or null for a job that isn't the business's. An installer's card leaves out the customer's email. */
export async function jobCard(
  member: { businessId: string; businessName: string },
  jobId: string,
  forInstaller = false,
): Promise<JobCardView | null> {
  const saved = await savedFor(member.businessId, member.businessName, jobId);
  if (!saved) return null;
  const found = saved === NO_DESIGN ? await jobById(member.businessId, jobId) : saved;
  if (!found) return null;
  const { job, customer } = found;
  const design =
    saved === NO_DESIGN ? null : await chosenDesign(member.businessId, jobId, saved.project.set.designs, saved.project.set.primary);
  const at = design && saved !== NO_DESIGN ? saved.project.set.designs.indexOf(design) : -1;
  const form = at >= 0 && saved !== NO_DESIGN ? (saved.project.extras.quotes[at]?.form ?? null) : null;
  const details = systemDetails(design, form, job.details)
    .filter((d) => d.value && d.value.trim() && d.value.trim() !== "--")
    .map((d) => ({ label: d.label, value: d.value!.trim() }));
  const designed: Designed | null = design
    ? {
        panels: designSummary(design).panels,
        panelModel: design.panel?.name ?? "",
        inverters: (design.inverters ?? []).map((i) => i.name),
        battery: design.battery ? { model: design.battery.name, modules: design.battery.qty } : null,
      }
    : null;
  const [notes, prefs, links, built] = await Promise.all([
    jobNotes(member.businessId, jobId),
    loadPrefs(member.businessId),
    forInstaller
      ? Promise.resolve([])
      : query<{ installer: string; sentAt: string | null }>(
          `select installer_id as installer, ${moment("sent_at")} as "sentAt" from design_job_links where business_id = $1 and job_id = $2`,
          [member.businessId, jobId],
        ),
    asBuiltOf(member.businessId, jobId),
  ]);
  return {
    business: saved === NO_DESIGN ? member.businessName : saved.brand.name || member.businessName,
    job: {
      id: job.id,
      title: job.title,
      address: job.address || customer.address,
      installDate: job.installDate,
      stage: STAGE_LABELS[job.stage],
    },
    customer: { name: customer.name, phone: customer.phone, ...(forInstaller ? {} : { email: customer.email }) },
    details,
    system: {
      kw: design ? designSummary(design).kw || null : (job.kw ?? null),
      batteryKwh: design?.battery
        ? Math.round(design.battery.kwh * design.battery.qty * 10) / 10
        : Number.parseFloat(String(job.details?.batteryStorage ?? "")) || null,
    },
    roof: design && saved !== NO_DESIGN ? { lat: saved.project.lat, lng: saved.project.lng } : null,
    layout: design ? jobDrawing(design, "layout") : null,
    strings: design && (design.strings ?? []).some((s) => s.panels.length) ? jobDrawing(design, "strings") : null,
    stringWords: design ? stringsInWords(design) : [],
    notes,
    designed,
    asBuilt: built,
    ...(forInstaller
      ? {}
      : { installers: prefs.installers.map((i) => ({ ...i, sentAt: links.find((l) => l.installer === i.id)?.sentAt ?? null })) }),
  };
}

/** What was really installed on a job, or null until it is recorded. */
export async function asBuiltOf(businessId: string, jobId: string): Promise<AsBuilt | null> {
  const rows = await query<{ data: AsBuiltInput; by: string; at: string }>(
    `select data, updated_by as by, ${moment("updated_at")} as at from design_as_built where business_id = $1 and job_id = $2`,
    [businessId, jobId],
  );
  return rows[0] ? { ...rows[0].data, by: rows[0].by, at: rows[0].at } : null;
}

/**
 * Keeps what was installed on a job (the installer from their card, or the business), cleaned, with who and the
 * server's time, and writes it on the deal's record once with how it differs from the design. Null for a job that
 * isn't the business's.
 */
export async function saveAsBuilt(
  businessId: string,
  jobId: string,
  raw: unknown,
  by: string,
  differences: string[],
): Promise<AsBuilt | null> {
  const found = await jobById(businessId, jobId);
  if (!found) return null;
  const data = cleanAsBuilt(raw);
  await query(
    `insert into design_as_built (business_id, job_id, data, updated_by) values ($1, $2, $3, $4)
       on conflict (business_id, job_id) do update set data = excluded.data, updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, jobId, JSON.stringify(data), by],
  );
  await record(query, businessId, {
    customerId: found.customer.id,
    jobId,
    kind: "note",
    text: `As built recorded by ${by}${differences.length ? `: ${differences.join(" ")}` : ": as designed."}`,
    by,
  }).catch(() => undefined);
  return asBuiltOf(businessId, jobId);
}

/** The card's notes, newest first, each with its files (names and types only: the bytes are served one at a time). */
export async function jobNotes(businessId: string, jobId: string): Promise<JobNote[]> {
  const rows = await query<{
    id: string;
    at: string;
    side: "team" | "installer";
    by: string;
    text: string;
    files: { id: string; name: string; type: string }[] | null;
  }>(
    `select n.id, ${moment("n.at")} as at, n.side, n.by_name as by, n.text,
            (select json_agg(json_build_object('id', f.id, 'name', f.name, 'type', f.type) order by f.at)
               from design_job_files f where f.business_id = n.business_id and f.note_id = n.id) as files
       from design_job_notes n where n.business_id = $1 and n.job_id = $2 order by n.at desc limit 300`,
    [businessId, jobId],
  );
  return rows.map((r) => ({ ...r, files: r.files ?? [] }));
}

/**
 * Adds a note (words, photos or both) to the card. A team note is also written on the deal's record, so the job's
 * history is in one place; an installer's is written there too, named for the installer.
 */
export async function addJobNote(
  businessId: string,
  jobId: string,
  note: {
    side: "team" | "installer";
    by: string;
    byEmail: string | null;
    text: string;
    files: { name: string; type: string; bytes: Buffer }[];
  },
): Promise<JobNote | null> {
  return transaction(async (q) => {
    const job = await q<{ customerId: string }>(`select customer_id as "customerId" from design_jobs where business_id = $1 and id = $2`, [
      businessId,
      jobId,
    ]);
    if (!job[0]) return null;
    const id = `jn_${randomBytes(12).toString("hex")}`;
    const made = await q<{ at: string }>(
      `insert into design_job_notes (id, business_id, job_id, side, by_name, by_email, text) values ($1,$2,$3,$4,$5,$6,$7)
       returning ${moment("at")} as at`,
      [id, businessId, jobId, note.side, note.by, note.byEmail, note.text],
    );
    const files = [];
    for (const f of note.files) {
      const fileId = `jf_${randomBytes(12).toString("hex")}`;
      await q(`insert into design_job_files (id, business_id, job_id, note_id, name, type, size, bytes) values ($1,$2,$3,$4,$5,$6,$7,$8)`, [
        fileId,
        businessId,
        jobId,
        id,
        f.name.slice(0, 160) || "photo",
        f.type,
        f.bytes.length,
        f.bytes,
      ]);
      files.push({ id: fileId, name: f.name.slice(0, 160) || "photo", type: f.type });
    }
    const said = [note.text, files.length ? `(${files.length} ${files.length === 1 ? "photo" : "photos"})` : ""].filter(Boolean).join(" ");
    await record(q, businessId, {
      customerId: job[0].customerId,
      jobId,
      kind: "note",
      text: `Job card${note.side === "installer" ? `, from ${note.by}` : ""}: ${said}`.slice(0, 2000),
      by: note.byEmail ?? note.by,
    });
    return { id, at: made[0].at, side: note.side, by: note.by, text: note.text, files };
  });
}

/** A file on a job's card, only when it is on that job. */
export async function jobFile(
  businessId: string,
  jobId: string,
  fileId: string,
): Promise<{ name: string; type: string; bytes: Buffer } | null> {
  const rows = await query<{ name: string; type: string; bytes: Buffer }>(
    `select name, type, bytes from design_job_files where business_id = $1 and job_id = $2 and id = $3`,
    [businessId, jobId, fileId],
  );
  return rows[0] ?? null;
}

/** An installer's link to a job's card, made once and kept. */
export async function installerLink(businessId: string, jobId: string, installerId: string): Promise<string> {
  await query(
    `insert into design_job_links (token, business_id, job_id, installer_id) values ($1,$2,$3,$4)
     on conflict (business_id, job_id, installer_id) do nothing`,
    [randomBytes(24).toString("hex"), businessId, jobId, installerId],
  );
  const rows = await query<{ token: string }>(
    `select token from design_job_links where business_id = $1 and job_id = $2 and installer_id = $3`,
    [businessId, jobId, installerId],
  );
  return rows[0].token;
}

export async function markSent(token: string): Promise<void> {
  await query(`update design_job_links set sent_at = now() where token = $1`, [token]);
}

/** Who a link is for, and which job: only while the installer is still on the business's file. */
export async function cardByToken(
  token: string,
): Promise<{ businessId: string; businessName: string; jobId: string; installer: Installer } | null> {
  const rows = await query<{ businessId: string; businessName: string; jobId: string; installerId: string }>(
    `select l.business_id as "businessId", b.name as "businessName", l.job_id as "jobId", l.installer_id as "installerId"
       from design_job_links l join businesses b on b.id = l.business_id where l.token = $1`,
    [token],
  );
  const link = rows[0];
  if (!link) return null;
  // A connected installer's link (job-shares.ts) lasts while the job is accepted and the two are connected.
  const installer = link.installerId.startsWith(BUSINESS_LINK)
    ? await linkedBusiness(link.businessId, link.jobId, link.installerId)
    : (await loadPrefs(link.businessId)).installers.find((i) => i.id === link.installerId);
  return installer ? { businessId: link.businessId, businessName: link.businessName, jobId: link.jobId, installer } : null;
}
