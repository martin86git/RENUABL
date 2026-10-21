/**
 * The roof designer's CRM, first slice: a business's customers, the jobs it
 * is doing for them, and a running record of what happened (notes, calls,
 * emails, and each move from one stage to the next). Pure: the shapes, the
 * stages, the checks on everything a browser sends before the server keeps
 * it, and the made-up customers a new business starts with.
 *
 * These are a solar business's own customers. They have nothing to do with
 * RENUABL's homeowners, reservations or installation partners.
 */
import { cleanSectionDetails, type SectionField } from "./deal-sections";

// ---------------------------------------------------------------------------
// Stages and sources
// ---------------------------------------------------------------------------

/**
 * The stages a job moves through, in order, with "lost" to one side: being
 * sold (lead to proposal), sold and being got ready (won, stock ordered,
 * installation scheduled), then installed and being finished off
 * (inspection, the certificate of electrical safety, the grid connection,
 * and the STCs and rebates claimed). The same for every business for now;
 * the pipelines (`deal.ts`) are runs of them.
 */
export const JOB_STAGES = [
  "lead",
  "designed",
  "proposal",
  "won",
  "ordered",
  "scheduled",
  "installed",
  "inspection",
  "coes",
  "grid",
  "claimed",
  "lost",
] as const;
export type JobStage = (typeof JOB_STAGES)[number];

export const STAGE_LABELS: Record<JobStage, string> = {
  lead: "Lead",
  designed: "Designed",
  proposal: "Proposal sent",
  won: "Won",
  ordered: "Stock ordered",
  scheduled: "Installation scheduled",
  installed: "Installed",
  inspection: "Inspection booked",
  coes: "CoES received",
  grid: "Grid connection",
  claimed: "STCs and rebates claimed",
  lost: "Lost",
};

/** Still being sold: what the "open" value on the overview adds up. */
export const OPEN_STAGES: readonly JobStage[] = ["lead", "designed", "proposal"];
/** Sold: what the "won" value on the overview adds up (an installed job was won first). */
export const WON_STAGES: readonly JobStage[] = ["won", "ordered", "scheduled", "installed", "inspection", "coes", "grid", "claimed"];
/** Sold and not yet on the roof: the installations in the works. */
export const PRE_INSTALL_STAGES: readonly JobStage[] = ["won", "ordered", "scheduled"];
/** On the roof: installed, and whatever is still being finished off after. */
export const INSTALLED_STAGES: readonly JobStage[] = ["installed", "inspection", "coes", "grid", "claimed"];

/** Where a customer came from: the choices offered. Any short text is kept, so a business can type its own. */
export const LEAD_SOURCES = ["Referral", "Website", "Phone call", "Walk-in", "Advertising", "Other"] as const;

export const ACTIVITY_KINDS = ["note", "call", "email", "stage", "proposal", "message", "order", "invoice", "reminder", "service"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
/** The kinds a person writes. "stage" is written by the server when a job moves. */
export const WRITTEN_KINDS = ["note", "call", "email"] as const;

// ---------------------------------------------------------------------------
// The records
// ---------------------------------------------------------------------------

export interface Customer {
  id: string;
  /** The whole name, as it is shown: the first and last names together. */
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  lat: number | null;
  lng: number | null;
  source: string;
  notes: string;
  /** One of the made-up customers a new business starts with. */
  sample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  customerId: string;
  title: string;
  address: string;
  lat: number | null;
  lng: number | null;
  stage: JobStage;
  /** The roof design this job is for, once there is one at its address. */
  projectId: string | null;
  /** The price including GST, in dollars. */
  value: number | null;
  /** YYYY-MM-DD. */
  installDate: string | null;
  /** The size of the solar on the job's design, in kW, as last saved from the designer. Null until it is designed. */
  kw: number | null;
  /** When it was sold: when it first reached a won stage. Null while it is still being sold, or lost. */
  wonAt: string | null;
  /** When it was installed: when it first reached an installed stage. */
  installedAt: string | null;
  /** System details typed in by hand, by their key (`DETAIL_KEYS`): each stands in place of what the design says. */
  details: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  customerId: string;
  jobId: string | null;
  kind: ActivityKind;
  text: string;
  /** The email of the member who wrote it ("Sample" on the made-up customers). */
  by: string;
  at: string;
}

/** The most customers one business keeps, and jobs one customer has, for now. */
export const MAX_CUSTOMERS = 20_000;
export const MAX_JOBS_PER_CUSTOMER = 50;
export const CUSTOMERS_FULL = `A business can keep up to ${MAX_CUSTOMERS.toLocaleString("en-AU")} customers for now.`;
export const JOBS_FULL = `A customer can have up to ${MAX_JOBS_PER_CUSTOMER} jobs for now.`;

/** What a move between stages is recorded as: "Moved to Proposal sent". */
export function stageMoveText(stage: JobStage): string {
  return `Moved to ${STAGE_LABELS[stage]}`;
}

/**
 * The one stage shown beside a customer: of their jobs that aren't lost, the
 * one furthest along; when every job is lost, the newest job's stage; null
 * with no jobs. `stages` is oldest job first.
 */
export function customerStage(stages: readonly JobStage[]): JobStage | null {
  if (!stages.length) return null;
  const live = stages.filter((s) => s !== "lost");
  if (!live.length) return stages[stages.length - 1];
  return live.reduce((furthest, s) => (JOB_STAGES.indexOf(s) > JOB_STAGES.indexOf(furthest) ? s : furthest));
}

// ---------------------------------------------------------------------------
// Checks on what a browser sends
// ---------------------------------------------------------------------------

export type Cleaned<T> = { ok: true; value: T } | { ok: false; message: string };

type Bag = Record<string, unknown>;
const bag = (raw: unknown): Bag => (raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Bag) : {});

/** One tidy line: control characters and angle brackets out, runs of spaces closed up, cut to a length. */
function line(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Longer text that may run over several lines: control characters out (line breaks stay), cut to a length. */
function paragraphs(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Roughly the box around Australia, Tasmania included: a place outside it is a slip of the map, not a customer. */
const AUSTRALIA = { south: -44.5, north: -9, west: 112, east: 154.5 };

/**
 * A place on the map as sent: both figures or neither, and inside Australia.
 * `undefined` when what was sent can't be a place.
 */
function place(lat: unknown, lng: unknown): { lat: number | null; lng: number | null } | undefined {
  const none = (v: unknown) => v === null || v === undefined || v === "";
  if (none(lat) && none(lng)) return { lat: null, lng: null };
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < AUSTRALIA.south || lat > AUSTRALIA.north || lng < AUSTRALIA.west || lng > AUSTRALIA.east) return undefined;
  return { lat, lng };
}

const PLACE_WRONG = "That address couldn't be placed on the map in Australia. Pick it from the list as you type, or leave the map out.";

export type CustomerInput = Pick<Customer, "name" | "phone" | "email" | "address" | "lat" | "lng" | "source" | "notes"> & {
  /** The name in its two parts, when it was given that way. Without them the whole name is split at its first space. */
  firstName?: string;
  lastName?: string;
};

/** A whole name in two parts: the first word, and the rest. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const [first = "", ...rest] = name.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}

export const CUSTOMER_NAME_MISSING = "Enter the customer's first name (their name needs 2 to 120 characters in all).";
export const CUSTOMER_EMAIL_WRONG = "That email address doesn't look right. Check it, or leave it empty.";

/**
 * A customer as sent. With `current` (an edit), anything not sent stays as it
 * is, so a screen that changes one thing doesn't have to send the rest.
 */
export function cleanCustomerInput(raw: unknown, current?: CustomerInput): Cleaned<CustomerInput> {
  const r = bag(raw);
  const sent = (key: string) => key in r;
  // A name given as first and last is kept in its two parts, and the whole name is the two together.
  const parts = sent("firstName") || sent("lastName") ? { firstName: line(r.firstName, 60), lastName: line(r.lastName, 60) } : null;
  const name = parts ? `${parts.firstName} ${parts.lastName}`.trim() : sent("name") || !current ? line(r.name, 120) : current.name;
  if (name.length < 2 || (parts && !parts.firstName)) return { ok: false, message: CUSTOMER_NAME_MISSING };
  const email = sent("email") || !current ? line(r.email, 200).toLowerCase() : current.email;
  if (email && !EMAIL.test(email)) return { ok: false, message: CUSTOMER_EMAIL_WRONG };
  const at = sent("lat") || sent("lng") || !current ? place(r.lat, r.lng) : { lat: current.lat, lng: current.lng };
  if (!at) return { ok: false, message: PLACE_WRONG };
  return {
    ok: true,
    value: {
      name,
      ...(parts ?? {}),
      phone: sent("phone") || !current ? line(r.phone, 30) : current.phone,
      email,
      address: sent("address") || !current ? line(r.address, 200) : current.address,
      ...at,
      source: sent("source") || !current ? line(r.source, 40) : current.source,
      notes: sent("notes") || !current ? paragraphs(r.notes, 4000) : current.notes,
    },
  };
}

export type JobInput = Pick<Job, "title" | "address" | "lat" | "lng" | "stage" | "value" | "installDate" | "details"> & {
  /** Sent by the designer with the price when a design is saved. */
  kw?: number | null;
};

/**
 * The system details a deal can carry, in the order they are shown. Most can
 * be read from the design; the rest only a person knows.
 */
export const DETAIL_KEYS = [
  "systemType",
  "systemSize",
  "propertyType",
  "storeys",
  "roofType",
  "phases",
  "panel",
  "panelQty",
  "inverter",
  "inverterQty",
  "additionalInverter",
  "inverterCapacity",
  "optimisers",
  "battery",
  "batteryQty",
  "batteryStorage",
  "evCharger",
  "arrays",
  "strings",
  "tiltFrames",
  "switchboard",
  "distributor",
  "nmi",
  "siteAccess",
] as const;
export type DetailKey = (typeof DETAIL_KEYS)[number];

/**
 * How a sold job is getting on, kept beside its details (and sent with them): who is installing it, and after the
 * install the customer's invoice, the STC claim and the grid connection. Each is set by hand from the Installations
 * lists; the pipeline stages are left as they are.
 */
export const PROGRESS = {
  customerInvoice: ["not-issued", "pending", "paid"],
  stcClaim: ["not-claimed", "claimed"],
  gridConnection: ["pending", "underway", "completed"],
} as const;
export type ProgressKey = keyof typeof PROGRESS;
export const PROGRESS_LABELS: { [K in ProgressKey]: Record<(typeof PROGRESS)[K][number], string> } = {
  customerInvoice: { "not-issued": "Not issued", pending: "Pending", paid: "Paid" },
  stcClaim: { "not-claimed": "Not claimed", claimed: "Claimed" },
  gridConnection: { pending: "Pending", underway: "Underway", completed: "Completed" },
};
/** Who is installing a job, as the business writes it. */
export const INSTALLER_KEY = "installer";

/** System details as typed: known keys only, each one tidy line of up to 120 characters; an empty one is dropped. */
export function cleanJobDetails(raw: unknown, fields?: readonly SectionField[]): Record<string, string> {
  const r = bag(raw);
  const kept: Record<string, string> = {};
  for (const key of DETAIL_KEYS) {
    const text = line(r[key], 120);
    if (text) kept[key] = text;
  }
  const installer = line(r[INSTALLER_KEY], 80);
  if (installer) kept[INSTALLER_KEY] = installer;
  for (const key of Object.keys(PROGRESS) as ProgressKey[])
    if ((PROGRESS[key] as readonly string[]).includes(r[key] as string)) kept[key] = r[key] as string;
  // The Installation, Network and Financials tabs' fields, each in range for its kind.
  return { ...kept, ...cleanSectionDetails(r, fields) };
}

/** What a job is called when nothing was typed. */
export const DEFAULT_JOB_TITLE = "Solar";
export const JOB_STAGE_WRONG = "That isn't one of the stages a job can be at.";
export const JOB_VALUE_WRONG = "The price must be a dollar amount from 0 to 10,000,000, or left empty.";
export const JOB_DATE_WRONG = "That installation date isn't a real date. Use the calendar, or leave it empty.";

/** A real calendar day written YYYY-MM-DD (so 2026-02-30 is refused), in a sensible span of years. */
function realDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return null;
  const year = date.getUTCFullYear();
  return year >= 2000 && year <= 2100 ? raw : null;
}

/**
 * A job as sent. A new job starts as a lead with no price or date; with
 * `current` (an edit), anything not sent stays as it is.
 */
export function cleanJobInput(raw: unknown, current?: JobInput, fields?: readonly SectionField[]): Cleaned<JobInput> {
  const r = bag(raw);
  const sent = (key: string) => key in r;
  const start: JobInput = current ?? {
    title: DEFAULT_JOB_TITLE,
    address: "",
    lat: null,
    lng: null,
    stage: "lead",
    value: null,
    installDate: null,
    details: {},
  };

  const at = sent("lat") || sent("lng") ? place(r.lat, r.lng) : { lat: start.lat, lng: start.lng };
  if (!at) return { ok: false, message: PLACE_WRONG };

  let stage = start.stage;
  if (sent("stage")) {
    if (!JOB_STAGES.includes(r.stage as JobStage)) return { ok: false, message: JOB_STAGE_WRONG };
    stage = r.stage as JobStage;
  }

  let value = start.value;
  if (sent("value")) {
    if (r.value === null || r.value === "") value = null;
    else if (typeof r.value === "number" && Number.isFinite(r.value) && r.value >= 0 && r.value <= 10_000_000)
      value = Math.round(r.value * 100) / 100;
    else return { ok: false, message: JOB_VALUE_WRONG };
  }

  let installDate = start.installDate;
  if (sent("installDate")) {
    if (r.installDate === null || r.installDate === "") installDate = null;
    else {
      installDate = realDate(r.installDate);
      if (!installDate) return { ok: false, message: JOB_DATE_WRONG };
    }
  }

  return {
    ok: true,
    value: {
      title: sent("title") ? line(r.title, 80) || DEFAULT_JOB_TITLE : start.title,
      address: sent("address") ? line(r.address, 200) : start.address,
      ...at,
      stage,
      value,
      installDate,
      ...(sent("kw")
        ? { kw: typeof r.kw === "number" && Number.isFinite(r.kw) && r.kw >= 0 && r.kw <= 10_000 ? Math.round(r.kw * 1000) / 1000 : null }
        : {}),
      // The details are sent whole: the ones typed in by hand, as they now stand.
      details: sent("details") ? cleanJobDetails(r.details, fields) : start.details,
    },
  };
}

// ---------------------------------------------------------------------------
// Saved pipelines
// ---------------------------------------------------------------------------

/** A pipeline a business has saved: a name for a run of stages, shared by everyone in the business. */
export interface SavedPipeline {
  id: string;
  name: string;
  stages: JobStage[];
}

export const MAX_PIPELINES = 20;
export const PIPELINES_FULL = `A business can save up to ${MAX_PIPELINES} pipelines for now.`;
export const PIPELINE_NAME_MISSING = "Give the pipeline a name (up to 40 characters).";
export const PIPELINE_STAGES_MISSING = "A pipeline shows at least one stage.";

/** A pipeline as sent: a name, and its stages in their own order with anything unknown left out. */
export function cleanPipelineInput(raw: unknown): Cleaned<Pick<SavedPipeline, "name" | "stages">> {
  const r = bag(raw);
  const name = line(r.name, 40);
  if (!name) return { ok: false, message: PIPELINE_NAME_MISSING };
  const sent = Array.isArray(r.stages) ? r.stages : [];
  const stages = JOB_STAGES.filter((s) => sent.includes(s));
  if (!stages.length) return { ok: false, message: PIPELINE_STAGES_MISSING };
  return { ok: true, value: { name, stages } };
}

export interface ActivityInput {
  kind: (typeof WRITTEN_KINDS)[number];
  text: string;
  /** The job it is about, when it is about one. Checked against the customer's jobs on the server. */
  jobId: string | null;
}

export const ACTIVITY_TEXT_MISSING = "Write something to save.";
export const ACTIVITY_KIND_WRONG = "That can be a note, a call or an email.";

/** A note, call or email as written. A stage move can't be sent: only the server records those. */
export function cleanActivityInput(raw: unknown): Cleaned<ActivityInput> {
  const r = bag(raw);
  if (!WRITTEN_KINDS.includes(r.kind as ActivityInput["kind"])) return { ok: false, message: ACTIVITY_KIND_WRONG };
  const text = paragraphs(r.text, 2000);
  if (!text) return { ok: false, message: ACTIVITY_TEXT_MISSING };
  return {
    ok: true,
    value: { kind: r.kind as ActivityInput["kind"], text, jobId: typeof r.jobId === "string" && r.jobId ? r.jobId.slice(0, 80) : null },
  };
}

// ---------------------------------------------------------------------------
// The customers a new business starts with
// ---------------------------------------------------------------------------

export interface SampleCustomer extends CustomerInput {
  job: { title: string; stage: JobStage; value: number | null };
  activity: { kind: (typeof WRITTEN_KINDS)[number]; text: string };
}

/** Who wrote the activity on a sample customer. */
export const SAMPLE_AUTHOR = "Sample";

/**
 * Five made-up customers, so a new business has something to look at and
 * click through. Nobody real: the names are plainly examples, the streets
 * are "Sample Street" and the like with no place on the map, the emails are
 * on example.com and the mobiles are from the range set aside for fiction.
 * Added once for each business, marked `sample`, and gone for good once deleted.
 */
export const SAMPLE_CUSTOMERS: readonly SampleCustomer[] = [
  {
    name: "Alex Example",
    phone: "0491 570 006",
    email: "alex@example.com",
    address: "12 Sample Street, Glen Waverley VIC 3150",
    lat: null,
    lng: null,
    source: "Website",
    notes: "Sample customer. Asked about solar for a single-storey home with a tiled roof.",
    job: { title: "Solar", stage: "lead", value: null },
    activity: { kind: "note", text: "Enquiry came in through the website. Wants a call back after 4pm." },
  },
  {
    name: "Sam Sample",
    phone: "0491 570 156",
    email: "sam@example.com",
    address: "4 Example Court, Berwick VIC 3806",
    lat: null,
    lng: null,
    source: "Referral",
    notes: "Sample customer. Referred by a neighbour. Has an electric car on order.",
    job: { title: "Solar and battery", stage: "lead", value: null },
    activity: { kind: "call", text: "Spoke briefly. Asked for a design with a battery. Will send a recent power bill." },
  },
  {
    name: "Jordan Placeholder",
    phone: "0491 570 157",
    email: "jordan@example.com",
    address: "27 Demo Avenue, Werribee VIC 3030",
    lat: null,
    lng: null,
    source: "Phone call",
    notes: "Sample customer. Double-storey home, tin roof, three-phase power.",
    job: { title: "Solar", stage: "designed", value: 9800 },
    activity: { kind: "note", text: "Design drawn. Two roof faces, north and west. Ready to price." },
  },
  {
    name: "Taylor Test",
    phone: "0491 570 158",
    email: "taylor@example.com",
    address: "9 Specimen Road, Bendigo VIC 3550",
    lat: null,
    lng: null,
    source: "Advertising",
    notes: "Sample customer. Comparing two quotes. Cares most about the battery.",
    job: { title: "Solar and battery", stage: "proposal", value: 18400 },
    activity: { kind: "email", text: "Proposal emailed. Follow up early next week." },
  },
  {
    name: "Casey Demo",
    phone: "0491 570 159",
    email: "casey@example.com",
    address: "31 Mock Lane, Geelong VIC 3220",
    lat: null,
    lng: null,
    source: "Walk-in",
    notes: "Sample customer. Accepted the proposal. Prefers a morning installation.",
    job: { title: "Solar", stage: "won", value: 8600 },
    activity: { kind: "call", text: "Accepted over the phone. Installation date to be booked." },
  },
];
