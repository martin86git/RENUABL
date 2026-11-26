/**
 * A deal's network pre-approval, worked through in RENUABL (26 Nov 2026, Martin: "ensure as much is done to make grid
 * connections as accomplishable as possible within the portal. i need sol to be able to assist in completing them").
 *
 * The application itself is made in the network's own portal, which only the business can sign in to and which can't
 * be shown inside another site. Everything round it is here: which network and where its portal is, the deal's details
 * to copy across, what the portal will ask for that the deal doesn't know yet (filled in on the spot), and where the
 * application stands (submitted with its reference, approved, export limited to so many kW, declined), each written to
 * the deal's own Network fields so Pre-approvals, the deal and Book an installation follow. Pure, tested.
 */
import { PRE_APPROVAL_REQUESTED, networkOf, preApprovalOf, type Tone } from "./approvals";
import { PRE_APPROVAL } from "./deal-sections";
import { networkNamed, portalFacts, portalOf, type PortalFact } from "./sol-portal";

/** Where an application stands, as the card's steps. */
export type PreApprovalStep = "to-submit" | "waiting" | "through" | "declined";

/** The deal's own Network fields a person may fill in from the card. */
export const PRE_APPROVAL_FIELDS = ["nmi", "meterNo", "retailer", "phases"] as const;
export type PreApprovalField = (typeof PRE_APPROVAL_FIELDS)[number];
export const FIELD_WORDS: Record<PreApprovalField, { label: string; hint: string }> = {
  nmi: { label: "NMI", hint: "10 or 11 characters, on the customer's bill" },
  meterNo: { label: "Meter number", hint: "On the meter or the bill" },
  retailer: { label: "Electricity retailer", hint: "Who the customer's bill is from" },
  phases: { label: "Phases", hint: "Single phase or Three phase" },
};

/** Everything the card shows for one deal. */
export interface PreApprovalView {
  jobId: string;
  customer: string;
  /** The network, as named on the deal or read from its NMI or address; null when it can't be told. */
  network: { name: string; guessed: boolean } | null;
  /** Its portal (or its own site when we hold no portal's address); null for a network we don't know. */
  portal: { id: string; name: string; url: string; known: boolean } | null;
  facts: PortalFact[];
  /** What the portal will ask for that the deal doesn't know yet: fields to fill in here, then things to do elsewhere. */
  missing: { fields: PreApprovalField[]; other: string[] };
  /** The typed values of the fields, to change in place. */
  fields: Record<PreApprovalField, string>;
  status: string;
  tone: Tone;
  step: PreApprovalStep;
  reference: string;
  exportLimit: string;
}

type Details = Record<string, string | null | undefined>;

/** Which step a status is at. */
export function stepOf(status: string): PreApprovalStep {
  if (status === "Submitted") return "waiting";
  if (status === "Declined") return "declined";
  if (status === "Approved" || status === "Approved, export limited" || status === "Not required") return "through";
  return "to-submit";
}

/** The view, from the deal, its customer and its details with the design's filled in (typed ones winning). */
export function preApprovalView(deal: {
  jobId: string;
  customer: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  kw?: number | null;
  /** What was typed on the deal. */
  typed: Details;
  /** Typed, else the design's. */
  details: Details;
}): PreApprovalView {
  const net = networkOf({ details: deal.typed as Record<string, string>, address: deal.address });
  const named = net ? networkNamed(net.name) : null;
  const open = named ? portalOf(named.id) : null;
  const d = deal.details;
  const has = (k: string) => Boolean(d[k]?.trim());
  const other: string[] = [];
  if (!deal.address.trim()) other.push("The site address");
  if (!has("inverter")) other.push("The inverter's make and model (design the system, or type it on the deal)");
  if (!has("inverterCapacity") && has("inverter")) other.push("The inverter's capacity in kW");
  if (!has("systemSize") && !deal.kw) other.push("The solar size in kW");
  const status = (deal.typed.preApproval ?? "").trim() || "Not submitted";
  return {
    jobId: deal.jobId,
    customer: deal.customer,
    network: net,
    portal: named && open ? { id: named.id, name: open.name, url: open.url, known: open.known } : null,
    facts: portalFacts({ customer: deal.customer, address: deal.address, phone: deal.phone, email: deal.email, kw: deal.kw, details: d }),
    missing: { fields: (["nmi", "phases"] as const).filter((k) => !has(k)), other },
    fields: Object.fromEntries(PRE_APPROVAL_FIELDS.map((k) => [k, (d[k] ?? "").trim()])) as Record<PreApprovalField, string>,
    status,
    tone: preApprovalOf({ details: { preApproval: status } }).tone,
    step: stepOf(status),
    reference: (deal.typed.preApprovalRef ?? "").trim(),
    exportLimit: (deal.typed.exportLimit ?? "").trim(),
  };
}

/** A change from the card (or one Sol proposes): fields filled in, and where the application stands. */
export interface PreApprovalChange {
  nmi?: string;
  meterNo?: string;
  retailer?: string;
  phases?: string;
  status?: string;
  reference?: string;
  /** kW a phase the export is limited to. */
  exportLimit?: string;
}

const one = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** An NMI as typed: letters and digits, 10 or 11 of them (the eleventh is its checksum). "" when it isn't one. */
export function cleanNmi(v: unknown): string {
  const n = one(v, 30).replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{10,11}$/.test(n) ? n : "";
}

/** A limit in kW as typed ("5", "5kW", "1.5 kW"): the number alone, 0 to 100. "" when it isn't one. */
export function cleanKw(v: unknown): string {
  const m = /^(\d{1,3}(?:\.\d{1,2})?)\s*(?:kw)?$/i.exec(typeof v === "number" ? String(v) : one(v, 20));
  if (!m) return "";
  const n = Number(m[1]);
  return n >= 0 && n <= 100 ? String(n) : "";
}

export const NMI_WRONG = "An NMI is 10 or 11 letters and digits, as on the customer's bill.";
export const STATUS_WRONG = "That isn't a pre-approval status.";
export const LIMIT_WRONG = "Give the export limit as a number of kW, e.g. 5.";
export const NOTHING_TO_SAVE = "There's nothing to save.";

/** A change, checked. Only what was sent is kept; a status brings its own fields with it. */
export function cleanPreApprovalChange(raw: unknown): { ok: true; change: PreApprovalChange } | { ok: false; message: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const change: PreApprovalChange = {};
  if (typeof r.nmi === "string" && r.nmi.trim()) {
    const nmi = cleanNmi(r.nmi);
    if (!nmi) return { ok: false, message: NMI_WRONG };
    change.nmi = nmi;
  }
  for (const k of ["meterNo", "retailer", "phases"] as const) {
    const v = one(r[k], 120);
    if (v) change[k] = v;
  }
  if (r.status !== undefined && r.status !== null && r.status !== "") {
    const status = one(r.status, 40);
    if (!PRE_APPROVAL.includes(status)) return { ok: false, message: STATUS_WRONG };
    change.status = status;
  }
  const reference = one(r.reference, 120);
  if (reference) change.reference = reference;
  if (r.exportLimit !== undefined && r.exportLimit !== null && r.exportLimit !== "") {
    const kw = cleanKw(r.exportLimit);
    if (!kw) return { ok: false, message: LIMIT_WRONG };
    change.exportLimit = kw;
  }
  return Object.keys(change).length ? { ok: true, change } : { ok: false, message: NOTHING_TO_SAVE };
}

/** The deal's details with a change put in. The network is filled in when nothing was typed, as asking for one does. */
export function withPreApprovalChange(
  current: { details: Record<string, string>; address: string },
  c: PreApprovalChange,
): Record<string, string> {
  const next: Record<string, string> = { ...current.details };
  for (const k of PRE_APPROVAL_FIELDS) if (c[k]) next[k] = c[k]!;
  if (c.reference) next.preApprovalRef = c.reference;
  if (c.status) {
    next.preApproval = c.status;
    if (c.status === "Approved, export limited") next.exportLimiting = "Yes";
    if (c.status === "Approved") next.exportLimiting = "No";
  }
  if (c.exportLimit) {
    next.exportLimit = c.exportLimit;
    next.exportLimiting = "Yes";
  }
  if (c.status && !next.distributor?.trim()) {
    const net = networkOf({ details: next, address: current.address });
    if (net) next.distributor = net.name;
  }
  return next;
}

/** The change as the deal's record says it; "" when only fields were filled in quietly. */
export function changeRecordLine(c: PreApprovalChange, network: string | null): string {
  const filled = PRE_APPROVAL_FIELDS.filter((k) => c[k]).map((k) => `${FIELD_WORDS[k].label} ${c[k]}`);
  const to = network ? ` (${network})` : "";
  const ref = c.reference ? ` · reference ${c.reference}` : "";
  const limit = c.exportLimit ? ` · export limited to ${c.exportLimit} kW` : "";
  const said =
    c.status === "Submitted"
      ? `Network pre-approval submitted${to}${ref}.`
      : c.status === "Approved"
        ? `Network pre-approval approved${to}${ref}.`
        : c.status === "Approved, export limited"
          ? `Network pre-approval approved${to}${limit || " · export limited"}${ref}.`
          : c.status === "Declined"
            ? `Network pre-approval declined${to}${ref}.`
            : c.status === PRE_APPROVAL_REQUESTED
              ? `Network pre-approval requested${to}. It waits in Pre-approvals to be submitted.`
              : c.status
                ? `Network pre-approval set to ${c.status}${to}.`
                : c.reference || c.exportLimit
                  ? `Network pre-approval${to}${ref}${limit}.`
                  : "";
  return [said, filled.length ? `Filled in for the application: ${filled.join(", ")}.` : ""].filter(Boolean).join(" ");
}

/** What Sol may propose from the member's own words, kept on his turn: shown filled in on the card, saved on a press. */
export function cleanSuggestion(raw: unknown): PreApprovalChange | null {
  const got = cleanPreApprovalChange(raw);
  if (got.ok) return got.change;
  // A bad NMI or limit shouldn't lose the rest: keep what does read.
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rest = cleanPreApprovalChange({
    ...r,
    nmi: cleanNmi(r.nmi) || undefined,
    exportLimit: cleanKw(r.exportLimit) || undefined,
    status: PRE_APPROVAL.includes(one(r.status, 40)) ? r.status : undefined,
  });
  return rest.ok ? rest.change : null;
}
