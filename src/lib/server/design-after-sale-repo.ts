/**
 * Server only. What happens to a business's jobs after a sale: the proposals
 * sent and signed, the Ordering Station (each signed job's order), Installer
 * Invoices (the installation allowed for at signing against what the
 * installer billed), the Install Scheduler, and the business's after-sale
 * settings. Under the designer's tenant rule: every function takes the
 * business id first and filters by it, and that id only ever comes from the
 * signed-in member (or, for what a signature sets going, from the proposal's
 * own record).
 */
import { INSTALLED_STAGES, type JobStage } from "@/lib/domain/design/crm";
import { materialsOrder } from "@/lib/domain/design/deal";
import { todayInMarket } from "@/lib/domain/market";
import { depositAsked } from "@/lib/domain/design/deposit";
import {
  installCostOf,
  matchScore,
  varianceOf,
  LIKELY_MATCH,
  type InstallCost,
  type InstallerInvoice,
} from "@/lib/domain/design/installer-invoices";
import {
  EMPTY_ORDER,
  bySupplier,
  cleanOrder,
  offersFor,
  orderItems,
  orderTotals,
  readOrder,
  type OrderItem,
  type OrderState,
  type OrderStatus,
  type OrderTotals,
} from "@/lib/domain/design/orders";
import { DEFAULT_PREFS, cleanPrefs, type BusinessPrefs } from "@/lib/domain/design/prefs";
import {
  internalForChoice,
  proposalPath,
  proposalState,
  viewForChoice,
  type ProposalInternal,
  type ProposalState,
  type ProposalView,
} from "@/lib/domain/design/proposal";
import type { DesignGoal } from "@/lib/domain/design/roof-design";
import type { CostLine } from "@/lib/domain/design/quote";
import { readiness, type Check } from "@/lib/domain/design/schedule";
import type { ISODate } from "@/lib/domain/types";
import { newId, query, transaction } from "./db";
import { record } from "./design-crm-repo";
import { FOLLOW_UP_DAYS, FOLLOW_UP_WORDS } from "@/lib/domain/design/proposal-lists";
import { loadLists } from "./design-repo";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const day = (column: string) => `to_char(${column}, 'YYYY-MM-DD')`;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function loadPrefs(businessId: string): Promise<BusinessPrefs> {
  const rows = await query<{ prefs: unknown }>(`select prefs from design_prefs where business_id = $1`, [businessId]);
  return rows[0] ? cleanPrefs(rows[0].prefs) : DEFAULT_PREFS;
}

export async function savePrefs(businessId: string, raw: unknown, by: string): Promise<BusinessPrefs> {
  const prefs = cleanPrefs(raw);
  await query(
    `insert into design_prefs (business_id, prefs, updated_by) values ($1, $2, $3)
     on conflict (business_id) do update set prefs = excluded.prefs, updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, JSON.stringify(prefs), by],
  );
  return prefs;
}

// ---------------------------------------------------------------------------
// Proposals sent and signed
// ---------------------------------------------------------------------------

export interface ProposalLine {
  jobId: string;
  customerId: string;
  customer: string;
  title: string;
  address: string;
  version: number;
  state: ProposalState;
  path: string;
  youPay: number;
  system: string;
  publishedAt: string;
  openedAt: string | null;
  acceptedAt: string | null;
  acceptedName: string | null;
  /** The member who published it (their email: shown to the business only). */
  by: string;
  /** How many systems it offers (1 without a choice). */
  options: number;
  kw: number;
  batteryKwh: number;
  /** The signed copy's PDF, for the business. */
  pdf: string;
  /** Follow-ups marked done: the day each fell due on, how and when. */
  followUps: { day: number; how: "call" | "email"; at: string }[];
  /** When the customer last wrote in the chat, if ever. */
  lastWord: string | null;
  /** The deposit marked received (dollars), else 0; and whether the customer says they paid. */
  depositReceived: number;
  depositSaid: boolean;
}

/** Each job's newest proposal, newest first: what was sent, whether it was opened, and whether it was signed. */
export async function listProposals(businessId: string, today: ISODate): Promise<ProposalLine[]> {
  const rows = await query<{
    jobId: string;
    customerId: string;
    customer: string;
    title: string;
    address: string;
    version: number;
    view: ProposalView;
    option: DesignGoal | null;
    token: string;
    withdrawn: boolean;
    publishedAt: string;
    openedAt: string | null;
    acceptedAt: string | null;
    acceptedName: string | null;
    by: string;
    received: boolean;
    said: boolean;
    followUps: { day: number; how: "call" | "email"; at: string }[] | null;
    lastWord: string | null;
  }>(
    `select distinct on (p.job_id) p.job_id as "jobId", c.id as "customerId", c.name as customer, j.title, j.address, v.version, v.view, v.accepted_option as option,
            p.token, p.withdrawn_at is not null as withdrawn, ${moment("v.published_at")} as "publishedAt",
            ${moment("v.opened_at")} as "openedAt", ${moment("v.accepted_at")} as "acceptedAt", v.accepted_name as "acceptedName",
            v.published_by as by, v.deposit_received_at is not null as received, v.deposit_said_at is not null as said,
            (select json_agg(json_build_object('day', f.day, 'how', f.how, 'at', f.at) order by f.day) from design_followups f
              where f.business_id = p.business_id and f.job_id = p.job_id) as "followUps",
            (select ${moment("max(m.at)")} from design_messages m
              where m.business_id = p.business_id and m.job_id = p.job_id and m.from_customer) as "lastWord"
       from design_proposals p
       join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id
       join design_jobs j on j.business_id = p.business_id and j.id = p.job_id
       join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where p.business_id = $1
      order by p.job_id, v.version desc`,
    [businessId],
  );
  return rows
    .map((r) => {
      const agreed = viewForChoice(r.view, r.option);
      return {
        jobId: r.jobId,
        customerId: r.customerId,
        customer: r.customer,
        title: r.title,
        address: r.address,
        version: r.version,
        state: proposalState({ withdrawn: r.withdrawn, accepted: Boolean(r.acceptedAt), validUntil: r.view.validUntil }, today),
        path: proposalPath(r.token),
        // Once signed, the system the customer chose.
        youPay: agreed.price.youPay,
        system: systemLine(agreed),
        publishedAt: r.publishedAt,
        openedAt: r.openedAt,
        acceptedAt: r.acceptedAt,
        acceptedName: r.acceptedName,
        by: r.by,
        options: r.view.options?.length || 1,
        kw: agreed.system.kw,
        batteryKwh: agreed.system.batteryKwh,
        pdf: `/api/proposal/${r.token}/pdf`,
        followUps: r.followUps ?? [],
        lastWord: r.lastWord,
        depositReceived: r.received ? (agreed.terms?.deposit ?? 0) : 0,
        depositSaid: r.said,
      };
    })
    .sort((a, b) => (b.acceptedAt ?? b.publishedAt).localeCompare(a.acceptedAt ?? a.publishedAt));
}

/** "8.55 kW + 16 kWh". */
function systemLine(view: ProposalView): string {
  const { kw, batteryKwh } = view.system;
  return [`${kw.toFixed(2)} kW`, batteryKwh > 0 ? `${batteryKwh} kWh` : ""].filter(Boolean).join(" + ");
}

// ---------------------------------------------------------------------------
// The version a customer signed
// ---------------------------------------------------------------------------

interface Signed {
  internal: ProposalInternal;
  view: ProposalView;
  acceptedAt: string;
  version: number;
  depositReceived: boolean | null;
}

/** A job's newest accepted version, or null when none has been signed. */
async function signedVersion(businessId: string, jobId: string): Promise<Signed | null> {
  const rows = await query<{
    internal: ProposalInternal;
    view: ProposalView;
    acceptedAt: string;
    version: number;
    received: boolean;
    option: DesignGoal | null;
  }>(
    `select v.internal, v.view, ${moment("v.accepted_at")} as "acceptedAt", v.version, v.deposit_received_at is not null as received,
            v.accepted_option as option
       from design_proposal_versions v join design_proposals p on p.business_id = v.business_id and p.id = v.proposal_id
      where v.business_id = $1 and p.job_id = $2 and v.accepted_at is not null
      order by v.version desc limit 1`,
    [businessId, jobId],
  );
  const found = rows[0];
  if (!found) return null;
  // The system the customer chose, when there was a choice: its price, its lines for the order and the installation.
  const { option, ...r } = found;
  const view = viewForChoice(r.view, option);
  return { ...r, view, internal: internalForChoice(r.internal, option), depositReceived: depositAsked(view) === null ? null : r.received };
}

/** The hardware the customer signed for, line by line, as the order is made from it. */
const signedMaterials = (signed: Signed) => materialsOrder(signed.internal.lines as CostLine[]);

// ---------------------------------------------------------------------------
// What a signature sets going
// ---------------------------------------------------------------------------

/**
 * When a customer signs: the job's order is opened in the Ordering Station
 * and its installation allowance fixed for Installer Invoices. Each on its
 * own, so one failing never stops the other; neither ever undoes the
 * signature (this runs after the customer has had their answer).
 */
export async function afterSigning(businessId: string, jobId: string): Promise<void> {
  await openOrder(businessId, jobId, "signing").catch((e) =>
    console.error("an order couldn't be opened", e instanceof Error ? e.message : e),
  );
  await keepInstallCost(businessId, jobId, "signing").catch((e) =>
    console.error("an installation allowance couldn't be kept", e instanceof Error ? e.message : e),
  );
}

async function openOrder(businessId: string, jobId: string, by: string): Promise<boolean> {
  return transaction(async (q) => {
    const made = await q<{ job_id: string }>(
      `insert into design_orders (business_id, job_id, status, data, created_by) values ($1, $2, 'open', $3, $4)
       on conflict do nothing returning job_id`,
      [businessId, jobId, JSON.stringify(EMPTY_ORDER), by],
    );
    if (!made.length) return false;
    const job = await q<{ customer_id: string }>(`select customer_id from design_jobs where business_id = $1 and id = $2`, [
      businessId,
      jobId,
    ]);
    if (job[0])
      await record(q, businessId, {
        customerId: job[0].customer_id,
        jobId,
        kind: "order",
        text: "Order opened in the Ordering Station from the signed proposal",
        by: "RENUABL",
      });
    return true;
  });
}

async function keepInstallCost(businessId: string, jobId: string, from: InstallCost["from"], again = false): Promise<InstallCost | null> {
  const signed = await signedVersion(businessId, jobId);
  if (!signed) return null;
  const cost = installCostOf(signed.internal.lines, new Date().toISOString(), from);
  await query(
    `insert into design_install_costs (business_id, job_id, cost) values ($1, $2, $3)
     on conflict (business_id, job_id) do ${again ? "update set cost = excluded.cost, at = now()" : "nothing"}`,
    [businessId, jobId, JSON.stringify(cost)],
  );
  return cost;
}

// ---------------------------------------------------------------------------
// The Ordering Station
// ---------------------------------------------------------------------------

export interface OrderRow {
  jobId: string;
  customer: string;
  address: string;
  status: OrderStatus;
  reference: string;
  wanted: string;
  installDate: string | null;
  signedAt: string | null;
  totals: OrderTotals;
  suppliers: string[];
  updatedAt: string;
}

export interface JobOrder {
  jobId: string;
  customerId: string;
  customer: string;
  address: string;
  installDate: string | null;
  signedAt: string | null;
  order: OrderState;
  items: OrderItem[];
  totals: OrderTotals;
  groups: ReturnType<typeof bySupplier>;
  /** Each supplier's order address, by price list name. */
  emails: Record<string, string>;
  updatedAt: string | null;
}

const NOT_SIGNED = "The order opens once the customer has signed their proposal.";
export { NOT_SIGNED };

/** A job's order with everything worked out, or a reason there isn't one. Opens the order of a signed job that hasn't one yet. */
export async function jobOrder(businessId: string, jobId: string): Promise<JobOrder | "missing" | "unsigned"> {
  const jobs = await query<{ customerId: string; customer: string; address: string; installDate: string | null }>(
    `select c.id as "customerId", c.name as customer, j.address, ${day("j.install_date")} as "installDate"
       from design_jobs j join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where j.business_id = $1 and j.id = $2`,
    [businessId, jobId],
  );
  if (!jobs[0]) return "missing";
  const signed = await signedVersion(businessId, jobId);
  let rows = await query<{ data: unknown; updatedAt: string }>(
    `select data, ${moment("updated_at")} as "updatedAt" from design_orders where business_id = $1 and job_id = $2`,
    [businessId, jobId],
  );
  if (!rows[0]) {
    if (!signed) return "unsigned";
    await openOrder(businessId, jobId, "RENUABL");
    rows = await query(`select data, ${moment("updated_at")} as "updatedAt" from design_orders where business_id = $1 and job_id = $2`, [
      businessId,
      jobId,
    ]);
  }
  const order = readOrder(rows[0]?.data);
  const [lists, prefs] = await Promise.all([loadLists(businessId), loadPrefs(businessId)]);
  const materials = signed ? signedMaterials(signed) : [];
  const skus = [...materials.map((m) => m.sku), ...order.added.map((a) => a.sku)].filter(Boolean);
  const items = orderItems(materials, order, offersFor(lists, prefs, skus));
  const emails: Record<string, string> = {};
  for (const [name, c] of Object.entries(prefs.suppliers)) if (c.email) emails[name] = c.email;
  return {
    jobId,
    ...jobs[0],
    signedAt: signed?.acceptedAt ?? null,
    order: { ...order, reference: order.reference || defaultReference(jobId) },
    items,
    totals: orderTotals(items),
    groups: bySupplier(items),
    emails,
    updatedAt: rows[0]?.updatedAt ?? null,
  };
}

/** A purchase order's reference when none is typed: short and the business's own (never the private link's token). */
export const defaultReference = (jobId: string) =>
  `PO-${jobId
    .replace(/^job_?/, "")
    .slice(-6)
    .toUpperCase()}`;

/** Keeps a member's changes to an order. Refused for a job never signed (and with no order already). */
export async function saveOrder(businessId: string, jobId: string, raw: unknown, by: string): Promise<JobOrder | "missing" | "unsigned"> {
  const before = await jobOrder(businessId, jobId);
  if (typeof before === "string") return before;
  const next = cleanOrder(raw, before.order, by, new Date().toISOString());
  await transaction(async (q) => {
    await q(`update design_orders set data = $3, status = $4, updated_by = $5, updated_at = now() where business_id = $1 and job_id = $2`, [
      businessId,
      jobId,
      JSON.stringify(next),
      next.status,
      by,
    ]);
    if (next.status !== before.order.status)
      await record(q, businessId, {
        customerId: before.customerId,
        jobId,
        kind: "order",
        text: next.status === "open" ? "Order set back to To order" : `Order marked ${next.status === "ordered" ? "ordered" : "delivered"}`,
        by,
      });
  });
  const after = await jobOrder(businessId, jobId);
  return after;
}

/** Writes on the job's record that a purchase order was emailed. Never the supplier's prices. */
export async function noteOrderSent(businessId: string, jobId: string, customerId: string, supplier: string, to: string, by: string) {
  await transaction((q) =>
    record(q, businessId, { customerId, jobId, kind: "order", text: `Purchase order emailed to ${supplier} (${to})`, by }),
  );
}

/** Every signed job's order, the ones still to order first, then ordered, then delivered; opening any a signed job is missing. */
export async function listOrders(businessId: string): Promise<OrderRow[]> {
  const unopened = await query<{ jobId: string }>(
    `select distinct p.job_id as "jobId" from design_proposals p
       join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id and v.accepted_at is not null
      where p.business_id = $1 and not exists (select 1 from design_orders o where o.business_id = p.business_id and o.job_id = p.job_id)`,
    [businessId],
  );
  for (const u of unopened) await openOrder(businessId, u.jobId, "RENUABL");
  const ids = await query<{ jobId: string }>(`select job_id as "jobId" from design_orders where business_id = $1`, [businessId]);
  const rows: OrderRow[] = [];
  for (const { jobId } of ids) {
    const o = await jobOrder(businessId, jobId);
    if (typeof o === "string") continue;
    rows.push({
      jobId,
      customer: o.customer,
      address: o.address,
      status: o.order.status,
      reference: o.order.reference,
      wanted: o.order.wanted,
      installDate: o.installDate,
      signedAt: o.signedAt,
      totals: o.totals,
      suppliers: o.groups.map((g) => g.supplier ?? "No supplier on file"),
      updatedAt: o.updatedAt ?? "",
    });
  }
  const rank: Record<OrderStatus, number> = { open: 0, ordered: 1, delivered: 2 };
  return rows.sort((a, b) => rank[a.status] - rank[b.status] || (a.installDate ?? "9999").localeCompare(b.installDate ?? "9999"));
}

// ---------------------------------------------------------------------------
// Installer Invoices
// ---------------------------------------------------------------------------

export interface InvoiceRow {
  jobId: string;
  customer: string;
  address: string;
  signedAt: string | null;
  installDate: string | null;
  cost: InstallCost | null;
  invoices: InstallerInvoice[];
  billed: number | null;
  difference: number | null;
  status: ReturnType<typeof varianceOf>["status"];
}

export interface InvoicesView {
  rows: InvoiceRow[];
  waiting: (InstallerInvoice & { suggestions: { jobId: string; customer: string; score: number }[] })[];
  tolerance: number;
}

const INVOICE = `id, job_id as "jobId", invoice, uploaded_by as "uploadedBy", ${moment("at")} as at`;
const asInvoice = (r: { id: string; jobId: string | null; invoice: Record<string, unknown>; uploadedBy: string; at: string }) =>
  ({ ...(r.invoice as object), id: r.id, jobId: r.jobId, uploadedBy: r.uploadedBy, at: r.at }) as InstallerInvoice;

/** Every signed job with what its installation was allowed and billed, and the invoices still waiting to be put against a job. */
export async function invoicesView(businessId: string): Promise<InvoicesView> {
  const jobs = await query<{
    jobId: string;
    customer: string;
    address: string;
    installDate: string | null;
    signedAt: string;
    reference: string;
    stage: JobStage;
  }>(
    `select distinct on (p.job_id) p.job_id as "jobId", c.name as customer, j.address, ${day("j.install_date")} as "installDate",
            ${moment("v.accepted_at")} as "signedAt", coalesce(o.data->>'reference', '') as reference, j.stage
       from design_proposals p
       join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id and v.accepted_at is not null
       join design_jobs j on j.business_id = p.business_id and j.id = p.job_id
       join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
       left join design_orders o on o.business_id = p.business_id and o.job_id = p.job_id
      where p.business_id = $1 order by p.job_id, v.version desc`,
    [businessId],
  );
  const costs = new Map(
    (
      await query<{ jobId: string; cost: InstallCost }>(`select job_id as "jobId", cost from design_install_costs where business_id = $1`, [
        businessId,
      ])
    ).map((r) => [r.jobId, r.cost]),
  );
  // A job signed before allowances were kept has its allowance worked out now, from the version signed.
  for (const j of jobs) if (!costs.has(j.jobId)) costs.set(j.jobId, (await keepInstallCost(businessId, j.jobId, "later")) as InstallCost);
  const invoices = (
    await query<Parameters<typeof asInvoice>[0]>(`select ${INVOICE} from design_installer_invoices where business_id = $1 order by at`, [
      businessId,
    ])
  ).map(asInvoice);
  const { invoiceTolerance: tolerance } = await loadPrefs(businessId);
  const rows: InvoiceRow[] = jobs.map((j) => {
    const cost = costs.get(j.jobId) ?? null;
    const mine = invoices.filter((i) => i.jobId === j.jobId);
    const v = varianceOf(cost, mine, tolerance);
    // The installer bills once the job is done: before it is installed (by its stage, or a date that has come), none is expected.
    const installed = INSTALLED_STAGES.includes(j.stage) || (j.installDate !== null && j.installDate <= todayInMarket());
    return {
      jobId: j.jobId,
      customer: j.customer,
      address: j.address,
      signedAt: j.signedAt,
      installDate: j.installDate,
      cost,
      invoices: mine,
      ...v,
      status: v.status === "awaiting" && !installed ? ("upcoming" as const) : v.status,
    };
  });
  const waiting = invoices
    .filter((i) => !i.jobId)
    .map((i) => ({
      ...i,
      suggestions: jobs
        .map((j) => ({
          jobId: j.jobId,
          customer: j.customer,
          score: matchScore(
            { reference: j.reference || defaultReference(j.jobId), address: j.address, surname: j.customer.split(" ").at(-1) ?? "" },
            i,
          ),
        }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3),
    }));
  const order = { over: 0, awaiting: 1, under: 2, match: 3, upcoming: 4 } as const;
  rows.sort((a, b) => order[a.status] - order[b.status] || b.signedAt!.localeCompare(a.signedAt!));
  return { rows, waiting, tolerance };
}

export { LIKELY_MATCH };

async function customerOf(businessId: string, jobId: string): Promise<string | null> {
  const r = await query<{ c: string }>(`select customer_id as c from design_jobs where business_id = $1 and id = $2`, [businessId, jobId]);
  return r[0]?.c ?? null;
}

/** Keeps an installer's invoice (its figures only), against a job of this business or waiting for one. */
export async function addInvoice(
  businessId: string,
  jobId: string | null,
  figures: Omit<InstallerInvoice, "id" | "jobId" | "uploadedBy" | "at">,
  by: string,
): Promise<InstallerInvoice | "missing"> {
  const customerId = jobId ? await customerOf(businessId, jobId) : null;
  if (jobId && !customerId) return "missing";
  const id = newId("inv");
  return transaction(async (q) => {
    const rows = await q<Parameters<typeof asInvoice>[0]>(
      `insert into design_installer_invoices (id, business_id, job_id, invoice, uploaded_by) values ($1, $2, $3, $4, $5) returning ${INVOICE}`,
      [id, businessId, jobId, JSON.stringify(figures), by],
    );
    if (jobId && customerId)
      await record(q, businessId, {
        customerId,
        jobId,
        kind: "invoice",
        text: `Installer's invoice ${figures.number || ""} added: $${figures.subTotal.toLocaleString("en-AU")} ex GST`.replace("  ", " "),
        by,
      });
    return asInvoice(rows[0]);
  });
}

/** Puts an invoice against one of the business's jobs, or back to waiting (null). */
export async function assignInvoice(businessId: string, id: string, jobId: string | null, by: string): Promise<boolean> {
  const customerId = jobId ? await customerOf(businessId, jobId) : null;
  if (jobId && !customerId) return false;
  return transaction(async (q) => {
    const rows = await q<{ invoice: { number?: string } }>(
      `update design_installer_invoices set job_id = $3 where business_id = $1 and id = $2 returning invoice`,
      [businessId, id, jobId],
    );
    if (!rows[0]) return false;
    if (jobId && customerId)
      await record(q, businessId, {
        customerId,
        jobId,
        kind: "invoice",
        text: `Installer's invoice ${rows[0].invoice.number ?? ""} put against this job`,
        by,
      });
    return true;
  });
}

export async function deleteInvoice(businessId: string, id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(`delete from design_installer_invoices where business_id = $1 and id = $2 returning id`, [
    businessId,
    id,
  ]);
  return rows.length > 0;
}

/** Works a job's allowance out again from the version signed (after a correction by hand to the quote it was sold with). */
export async function workOutAgain(businessId: string, jobId: string): Promise<InstallCost | null> {
  return keepInstallCost(businessId, jobId, "later", true);
}

// ---------------------------------------------------------------------------
// The Install Scheduler
// ---------------------------------------------------------------------------

export interface BookedJob {
  jobId: string;
  customer: string;
  address: string;
  title: string;
  date: ISODate;
  stage: string;
  kw: number | null;
  checks: Check[];
  state: "ready" | "partly" | "not";
}

/** The business's installations booked between two days (inclusive), with whether each is ready to go. */
export async function bookedJobs(businessId: string, from: ISODate, to: ISODate): Promise<BookedJob[]> {
  const rows = await query<{
    jobId: string;
    customer: string;
    address: string;
    title: string;
    date: ISODate;
    stage: string;
    kw: number | null;
    order: OrderStatus | null;
    view: ProposalView | null;
    option: DesignGoal | null;
    received: boolean | null;
  }>(
    `select j.id as "jobId", c.name as customer, j.address, j.title, ${day("j.install_date")} as date, j.stage, j.kw::float8 as kw,
            o.status as "order", s.view, s.received
       from design_jobs j
       join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
       left join design_orders o on o.business_id = j.business_id and o.job_id = j.id
       left join lateral (
         select v.view, v.accepted_option as option, v.deposit_received_at is not null as received
           from design_proposals p join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id
          where p.business_id = j.business_id and p.job_id = j.id and v.accepted_at is not null
          order by v.version desc limit 1) s on true
      where j.business_id = $1 and j.install_date between $2 and $3 and j.stage <> 'lost'
      order by j.install_date, c.name`,
    [businessId, from, to],
  );
  return rows.map((r) => {
    const agreed = r.view ? viewForChoice(r.view, r.option) : null;
    const ready = readiness({ order: r.order, depositReceived: agreed && depositAsked(agreed) !== null ? Boolean(r.received) : null });
    return { jobId: r.jobId, customer: r.customer, address: r.address, title: r.title, date: r.date, stage: r.stage, kw: r.kw, ...ready };
  });
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export interface ReminderToSend {
  businessId: string;
  businessName: string;
  jobId: string;
  customerId: string;
  firstName: string;
  email: string;
  date: ISODate;
}

/** Every customer whose installation reminder is due today, across the businesses that have reminders switched on. */
export async function remindersDue(today: ISODate): Promise<ReminderToSend[]> {
  const rows = await query<ReminderToSend & { days: number; name: string }>(
    `select b.id as "businessId", b.name as "businessName", j.id as "jobId", c.id as "customerId", c.name, c.email,
            ${day("j.install_date")} as date, (pr.prefs->>'reminderDaysBefore')::int as days
       from design_prefs pr
       join businesses b on b.id = pr.business_id
       join design_jobs j on j.business_id = pr.business_id
       join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where (pr.prefs->'automations'->>'installReminders') = 'true'
        and j.install_date is not null and j.stage in ('won', 'ordered', 'scheduled')
        and c.email <> '' and not c.sample
        and j.install_date = ($1::date + ((pr.prefs->>'reminderDaysBefore')::int))
        and not exists (select 1 from design_reminders_sent r
                         where r.business_id = j.business_id and r.job_id = j.id and r.kind = 'install' and r.install_date = j.install_date)`,
    [today],
  );
  return rows.map((r) => ({ ...r, firstName: r.name.split(" ")[0] ?? "" }));
}

/** Marks a reminder sent, before it goes, so a second run never sends it twice. False when it was already marked. */
export async function claimReminder(r: ReminderToSend): Promise<boolean> {
  const rows = await query<{ job_id: string }>(
    `insert into design_reminders_sent (business_id, job_id, kind, install_date) values ($1, $2, 'install', $3)
     on conflict do nothing returning job_id`,
    [r.businessId, r.jobId, r.date],
  );
  if (!rows.length) return false;
  await transaction((q) =>
    record(q, r.businessId, {
      customerId: r.customerId,
      jobId: r.jobId,
      kind: "reminder",
      text: `Installation reminder emailed to the customer for ${r.date}`,
      by: "RENUABL",
    }),
  );
  return true;
}

// ---------------------------------------------------------------------------
// The Installations lists on the overview
// ---------------------------------------------------------------------------

export interface InstallExtra {
  jobId: string;
  /** The battery on the system the customer signed for, kWh: 0 with none. */
  batteryKwh: number;
  /** What the customer pays on the signed system, after the federal rebate. */
  youPay: number;
  /** The deposit the business has marked received, dollars; 0 when none has been. */
  depositReceived: number;
  /** Whether its order has gone to the suppliers (ordered or delivered). */
  ordered: boolean;
  /** The signed system's price with GST, the STCs taken off, the deposit asked, and the Solar Victoria rebate and loan on it. */
  incGst?: number;
  stc?: number;
  depositAsked?: number | null;
  solarVicRebate?: number | null;
  solarVicLoan?: number | null;
}

/** For each signed job: its battery, what is payable, the deposit received and whether its parts are ordered. */
export async function installExtras(businessId: string): Promise<InstallExtra[]> {
  const rows = await query<{ jobId: string; view: ProposalView; option: DesignGoal | null; received: boolean; status: string | null }>(
    `select distinct on (p.job_id) p.job_id as "jobId", v.view, v.accepted_option as option,
            v.deposit_received_at is not null as received, o.status
       from design_proposals p
       join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id and v.accepted_at is not null
       left join design_orders o on o.business_id = p.business_id and o.job_id = p.job_id
      where p.business_id = $1 order by p.job_id, v.version desc`,
    [businessId],
  );
  return rows.map((r) => {
    const agreed = viewForChoice(r.view, r.option);
    return {
      jobId: r.jobId,
      batteryKwh: agreed.system.batteryKwh,
      youPay: agreed.price.youPay,
      depositReceived: r.received ? (agreed.terms?.deposit ?? 0) : 0,
      ordered: r.status === "ordered" || r.status === "delivered",
      incGst: agreed.price.incGst,
      stc: agreed.price.stc,
      depositAsked: agreed.terms?.deposit ?? null,
      solarVicRebate: agreed.price.solarVic?.rebate ?? null,
      solarVicLoan: agreed.price.solarVic?.loan ?? null,
    };
  });
}

/**
 * Marks a proposal's follow-up done: which follow-up day, called or emailed, by whom, kept once, and written on the
 * deal's record as a call or an email. "missing" for a job the business hasn't.
 */
export async function markFollowUp(
  businessId: string,
  jobId: string,
  day: number,
  how: "call" | "email",
  by: string,
): Promise<"done" | "missing"> {
  return transaction(async (q) => {
    const jobs = await q<{ customerId: string }>(`select customer_id as "customerId" from design_jobs where business_id = $1 and id = $2`, [
      businessId,
      jobId,
    ]);
    if (!jobs[0]) return "missing";
    const added = await q(
      `insert into design_followups (business_id, job_id, day, how, by_email) values ($1, $2, $3, $4, $5)
       on conflict (business_id, job_id, day) do nothing returning day`,
      [businessId, jobId, day, how, by.toLowerCase()],
    );
    if (added.length) {
      const step = FOLLOW_UP_DAYS.indexOf(day as (typeof FOLLOW_UP_DAYS)[number]);
      await record(q, businessId, {
        customerId: jobs[0].customerId,
        jobId,
        kind: how,
        text: `${FOLLOW_UP_WORDS[step] ?? "A"} follow-up on the proposal: ${how === "call" ? "called" : "emailed"}`,
        by: by.toLowerCase(),
      });
    }
    return "done";
  });
}
