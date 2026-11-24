/**
 * Xero's three jobs for a business (domain/design/xero.ts): the customer's invoice raised when a proposal is signed,
 * the deal's "Customer invoice" marked paid when Xero says it is paid, and installer invoices sent as bills once they
 * match. Each thing sent is noted once in `design_xero_links` (claimed before it is sent, so it goes once), and on the
 * deal's record. Business id first in every function.
 */
import {
  billGoes,
  billLine,
  customerInvoice,
  installerBill,
  paidLine,
  progressFromXero,
  raisedLine,
  type XeroInvoiceBody,
} from "@/lib/domain/design/xero";
import { todayInMarket } from "@/lib/domain/market";
import { query } from "./db";
import { record } from "./design-crm-repo";
import { defaultReference, invoicesView, signedVersion, systemLine } from "./design-after-sale-repo";
import { noteXeroProblem, xeroCall, xeroConnection, xeroTables } from "./xero";

interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber?: string;
  Status: string;
  Total?: number;
  AmountDue?: number;
}

type Kind = "invoice" | "bill";
type Sent = { ok: true; number: string } | { ok: false; message: string };

/** Claims a thing to send: a new one, or one that failed before. Answers the claim's time (for Xero's idempotency key), or null if it is already sent or sending. */
async function claim(businessId: string, kind: Kind, ref: string, jobId: string | null): Promise<string | null> {
  await xeroTables();
  const rows = await query<{ at: Date }>(
    `insert into design_xero_links (business_id, kind, ref, job_id) values ($1,$2,$3,$4)
     on conflict (business_id, kind, ref) do update set status = 'sending', error = null, at = now(), updated_at = now()
       where design_xero_links.status = 'failed' or (design_xero_links.status = 'sending' and design_xero_links.updated_at < now() - interval '15 minutes')
     returning at`,
    [businessId, kind, ref, jobId],
  );
  return rows[0] ? `${kind}-${ref}-${rows[0].at.getTime()}` : null;
}

async function failed(businessId: string, kind: Kind, ref: string, message: string) {
  await query(
    `update design_xero_links set status = 'failed', error = $4, updated_at = now() where business_id = $1 and kind = $2 and ref = $3`,
    [businessId, kind, ref, message.slice(0, 300)],
  );
}

async function sendToXero(
  businessId: string,
  kind: Kind,
  ref: string,
  body: XeroInvoiceBody,
  key: string,
): Promise<{ ok: true; inv: XeroInvoice } | { ok: false; message: string }> {
  const res = await xeroCall<{ Invoices?: XeroInvoice[] }>(businessId, "POST", "Invoices", { Invoices: [body] }, key);
  const inv = res.ok ? res.body.Invoices?.[0] : undefined;
  if (!res.ok || !inv?.InvoiceID) {
    const message = res.ok ? "Xero didn't send the invoice back." : res.message;
    await failed(businessId, kind, ref, message);
    if (!res.ok && res.status === 401)
      await noteXeroProblem(businessId, "Xero stopped accepting RENUABL's connection. Connect Xero again.");
    return { ok: false, message };
  }
  await query(
    `update design_xero_links set xero_id = $4, number = $5, status = $6, total = $7, amount_due = $8, error = null, updated_at = now()
      where business_id = $1 and kind = $2 and ref = $3`,
    [businessId, kind, ref, inv.InvoiceID, inv.InvoiceNumber ?? "", inv.Status, inv.Total ?? null, inv.AmountDue ?? null],
  );
  return { ok: true, inv };
}

async function jobFacts(businessId: string, jobId: string) {
  const rows = await query<{
    customer_id: string;
    name: string;
    email: string | null;
    address: string;
    title: string;
    progress: string | null;
    ref: string | null;
  }>(
    `select j.customer_id, c.name, nullif(c.email, '') as email, coalesce(nullif(j.address, ''), c.address, '') as address, j.title, j.details->>'customerInvoice' as progress,
            (select v.deposit_ref from design_proposal_versions v join design_proposals p on p.business_id = v.business_id and p.id = v.proposal_id
              where p.business_id = j.business_id and p.job_id = j.id and v.accepted_at is not null order by v.version desc limit 1) as ref
       from design_jobs j join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where j.business_id = $1 and j.id = $2`,
    [businessId, jobId],
  );
  return rows[0] ?? null;
}

async function setProgress(businessId: string, jobId: string, value: "pending" | "paid") {
  await query(
    `update design_jobs set details = details || jsonb_build_object('customerInvoice', $3::text) where business_id = $1 and id = $2`,
    [businessId, jobId, value],
  );
}

/**
 * Raises the customer's invoice in Xero for a signed job, once. `by` is who pressed it, or "RENUABL" at signing.
 * Refused when Xero isn't connected, the job isn't signed, or it already has one.
 */
export async function raiseCustomerInvoice(businessId: string, jobId: string, by: string): Promise<Sent> {
  const conn = await xeroConnection(businessId);
  if (!conn) return { ok: false, message: "Connect Xero first." };
  const [signed, job] = await Promise.all([signedVersion(businessId, jobId), jobFacts(businessId, jobId)]);
  if (!signed || !job) return { ok: false, message: "That job has no signed proposal." };
  const key = await claim(businessId, "invoice", jobId, jobId);
  if (!key) return { ok: false, message: "This job's invoice is already in Xero." };
  const v = signed.view;
  const body = customerInvoice(
    {
      customer: { name: job.name || v.customer.name, email: job.email, address: job.address || v.customer.address },
      title: v.title || job.title,
      system: systemLine(v),
      price: { incGst: v.price.incGst, stc: v.price.stc, youPay: v.price.youPay },
      terms: v.terms,
      reference: job.ref ?? defaultReference(jobId),
    },
    conn.settings,
    todayInMarket(),
  );
  const sent = await sendToXero(businessId, "invoice", jobId, body, key);
  if (!sent.ok) return sent;
  const number = sent.inv.InvoiceNumber ?? "";
  await record(query, businessId, {
    customerId: job.customer_id,
    jobId,
    kind: "invoice",
    text: raisedLine(number, conn.settings.status, sent.inv.Total ?? v.price.youPay),
    by,
  });
  if (sent.inv.Status === "AUTHORISED" && job.progress !== "paid") await setProgress(businessId, jobId, "pending");
  return { ok: true, number };
}

/** At signing: the invoice raised by itself, when the business has Xero connected and invoices switched on. */
export async function invoiceOnSigning(businessId: string, jobId: string): Promise<void> {
  const conn = await xeroConnection(businessId).catch(() => null);
  if (!conn?.settings.invoices) return;
  await raiseCustomerInvoice(businessId, jobId, "RENUABL");
}

/** Sends one installer invoice to Xero as a draft bill, once. Only an invoice already put against one of the business's jobs. */
export async function sendInstallerBill(businessId: string, invoiceId: string, by: string): Promise<Sent> {
  const conn = await xeroConnection(businessId);
  if (!conn) return { ok: false, message: "Connect Xero first." };
  const rows = await query<{ job_id: string | null; invoice: Record<string, unknown> }>(
    `select job_id, invoice from design_installer_invoices where business_id = $1 and id = $2`,
    [businessId, invoiceId],
  );
  const row = rows[0];
  if (!row?.job_id) return { ok: false, message: "Put the invoice against a job first." };
  const job = await jobFacts(businessId, row.job_id);
  if (!job) return { ok: false, message: "There's no such job." };
  const key = await claim(businessId, "bill", invoiceId, row.job_id);
  if (!key) return { ok: false, message: "That invoice is already in Xero." };
  const inv = row.invoice as {
    installer?: string;
    number?: string;
    date?: string;
    subTotal?: number;
    gst?: number;
    lines?: { description: string; amount: number }[];
  };
  const body = installerBill(
    {
      installer: inv.installer ?? "",
      number: inv.number ?? "",
      date: inv.date ?? "",
      subTotal: inv.subTotal ?? 0,
      gst: inv.gst ?? 0,
      lines: inv.lines ?? [],
    },
    conn.settings,
    `${job.name} · ${defaultReference(row.job_id)}`,
    todayInMarket(),
  );
  const sent = await sendToXero(businessId, "bill", invoiceId, body, key);
  if (!sent.ok) return sent;
  await record(query, businessId, {
    customerId: job.customer_id,
    jobId: row.job_id,
    kind: "invoice",
    text: billLine(inv.number ?? "", inv.installer ?? "the installer"),
    by,
  });
  return { ok: true, number: sent.inv.InvoiceNumber ?? inv.number ?? "" };
}

/**
 * Brings the business up to date with Xero: each customer invoice not yet paid read again (paid ones mark the deal's
 * Customer invoice paid), then each installer invoice that has come to match (or any on a job, by the business's
 * choice) sent as a bill. Answers how many were marked paid and how many bills went.
 */
export async function syncXero(businessId: string): Promise<{ paid: number; bills: number }> {
  const conn = await xeroConnection(businessId);
  if (!conn) return { paid: 0, bills: 0 };
  let paid = 0;
  const open = await query<{ ref: string; job_id: string; xero_id: string; number: string; status: string }>(
    `select ref, job_id, xero_id, number, status from design_xero_links
      where business_id = $1 and kind = 'invoice' and xero_id is not null and status not in ('PAID', 'VOIDED', 'DELETED')
      order by updated_at limit 200`,
    [businessId],
  );
  for (let i = 0; i < open.length; i += 40) {
    const batch = open.slice(i, i + 40);
    const res = await xeroCall<{ Invoices?: XeroInvoice[] }>(businessId, "GET", `Invoices?IDs=${batch.map((b) => b.xero_id).join(",")}`);
    if (!res.ok) break;
    for (const inv of res.body.Invoices ?? []) {
      const link = batch.find((b) => b.xero_id === inv.InvoiceID);
      if (!link || inv.Status === link.status) continue;
      await query(
        `update design_xero_links set status = $3, amount_due = $4, number = coalesce(nullif($5, ''), number), updated_at = now() where business_id = $1 and kind = 'invoice' and ref = $2`,
        [businessId, link.ref, inv.Status, inv.AmountDue ?? null, inv.InvoiceNumber ?? ""],
      );
      const progress = progressFromXero(inv.Status, inv.AmountDue ?? 0);
      if (progress === "paid") {
        await setProgress(businessId, link.job_id, "paid");
        const job = await jobFacts(businessId, link.job_id);
        if (job)
          await record(query, businessId, {
            customerId: job.customer_id,
            jobId: link.job_id,
            kind: "invoice",
            text: paidLine(inv.InvoiceNumber || link.number),
            by: "Xero",
          });
        paid += 1;
      } else if (progress === "pending") {
        const job = await jobFacts(businessId, link.job_id);
        if (job && job.progress !== "paid" && job.progress !== "pending") await setProgress(businessId, link.job_id, "pending");
      }
    }
  }
  const bills = await sendBillsDue(businessId);
  await query(`update design_xero set synced_at = now() where business_id = $1`, [businessId]);
  return { paid, bills };
}

/** Installer invoices that have come to go (they match, or any on a job, by the business's choice), sent as draft bills. Answers how many went. */
export async function sendBillsDue(businessId: string): Promise<number> {
  const conn = await xeroConnection(businessId);
  if (!conn || conn.settings.bills === "off") return 0;
  const sentBills = new Set(
    (
      await query<{ ref: string }>(`select ref from design_xero_links where business_id = $1 and kind = 'bill' and status <> 'failed'`, [
        businessId,
      ])
    ).map((r) => r.ref),
  );
  let bills = 0;
  const view = await invoicesView(businessId);
  for (const row of view.rows)
    if (billGoes(conn.settings.bills, row.status))
      for (const inv of row.invoices) if (!sentBills.has(inv.id) && (await sendInstallerBill(businessId, inv.id, "RENUABL")).ok) bills += 1;
  return bills;
}

/** Businesses with Xero connected not brought up to date in the last hour, for the ten-minute cron. */
export async function xeroBusinessesDue(): Promise<string[]> {
  await xeroTables();
  const rows = await query<{ business_id: string }>(
    `select business_id from design_xero where synced_at is null or synced_at < now() - interval '55 minutes' order by synced_at nulls first limit 50`,
  );
  return rows.map((r) => r.business_id);
}

export interface XeroLinkRow {
  kind: Kind;
  ref: string;
  jobId: string | null;
  xeroId: string | null;
  number: string;
  status: string;
  total: number | null;
  error: string | null;
  customer: string;
  at: string;
}

export interface XeroOverview {
  recent: XeroLinkRow[];
  /** Signed jobs with no invoice in Xero (signed before Xero was connected, or one that failed). */
  toInvoice: { jobId: string; customer: string; title: string; signedAt: string; youPay: number }[];
  /** Installer invoices on a job not yet in Xero. */
  toBill: { id: string; jobId: string; customer: string; installer: string; number: string; subTotal: number; status: string }[];
}

/** What Settings → Xero lists. */
export async function xeroOverview(businessId: string): Promise<XeroOverview> {
  await xeroTables();
  const recent = await query<XeroLinkRow>(
    `select l.kind, l.ref, l.job_id as "jobId", l.xero_id as "xeroId", l.number, l.status, l.total::float8 as total, l.error,
            coalesce(c.name, '') as customer, to_char(l.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at
       from design_xero_links l
       left join design_jobs j on j.business_id = l.business_id and j.id = l.job_id
       left join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where l.business_id = $1 order by l.updated_at desc limit 30`,
    [businessId],
  );
  const signed = await query<{ jobId: string; customer: string; title: string; signedAt: string; youPay: string | null }>(
    `select distinct on (p.job_id) p.job_id as "jobId", c.name as customer, j.title,
            to_char(v.accepted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "signedAt", v.view->'price'->>'youPay' as "youPay"
       from design_proposals p
       join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id and v.accepted_at is not null
       join design_jobs j on j.business_id = p.business_id and j.id = p.job_id and j.stage <> 'lost'
       join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where p.business_id = $1
        and not exists (select 1 from design_xero_links l where l.business_id = p.business_id and l.kind = 'invoice' and l.ref = p.job_id and l.status <> 'failed')
      order by p.job_id, v.version desc`,
    [businessId],
  );
  const toInvoice = signed
    .map((s) => ({ ...s, youPay: Number(s.youPay ?? 0) }))
    .sort((a, b) => b.signedAt.localeCompare(a.signedAt))
    .slice(0, 30);
  const bills = await query<{ ref: string }>(
    `select ref from design_xero_links where business_id = $1 and kind = 'bill' and status <> 'failed'`,
    [businessId],
  );
  const sent = new Set(bills.map((b) => b.ref));
  const view = await invoicesView(businessId);
  const toBill = view.rows.flatMap((r) =>
    r.invoices
      .filter((i) => !sent.has(i.id))
      .map((i) => ({
        id: i.id,
        jobId: r.jobId,
        customer: r.customer,
        installer: i.installer,
        number: i.number,
        subTotal: i.subTotal,
        status: r.status,
      })),
  );
  return { recent, toInvoice, toBill };
}
