/**
 * Bringing a business's sold jobs across from Pylon (16 Nov 2026, Martin: a retailer's worry about moving off Pylon was
 * that it holds every sold proposal). The business pastes a read-only key from Pylon's API settings; we read its sold
 * projects (`GET /v1/solar_projects?filter[acceptance]=is_accepted`), each one's signed design, and its e-signed PDF,
 * and make a customer and a deal for each. Pure: the addresses we ask, and how a Pylon project becomes a deal. The key
 * is used for the import and never kept.
 *
 * Pylon's API (read 16 Nov 2026 from app.getpylon.com/docs/api; VERIFY against a real key): JSON:API, base
 * https://api.getpylon.com, `Authorization: Bearer <key>`, `Accept: application/vnd.api+json`, 600 requests a minute
 * across the team, pages followed by `links.next`. A project has `customer_details`, `site_address`, `site_location`
 * ([lon, lat]), `site_details`, `acceptance` (`is_accepted`, `latest_esignature`, `latest_esignature_pdf_url`, valid an
 * hour) and `reference_number`; its signed design (`relationships.latest_signed_design`, else `primary_design`) has
 * `summary.dc_output_kw`, `summary.storage_kwh`, `pricing.total` (cents), `*_types[]` (description, quantity) and
 * `summary.pdf_proposal_url`. Pylon gives no date sold and no signer's name: neither is made up.
 */

export const PYLON_API = "https://api.getpylon.com";
/** Where a business makes its key, in Pylon. */
export const PYLON_KEY_PAGE = "https://app.getpylon.com/settings/api";
/** The sold jobs one import reads, at most (a page is 15). */
export const PYLON_MAX_PROJECTS = 3000;
/** How many projects one call to our server brings in (each is two reads at Pylon and a PDF). */
export const PYLON_BATCH = 6;
/** The stages a business may bring its sold jobs in at. */
export const PYLON_STAGES = ["won", "installed"] as const;
export type PylonStage = (typeof PYLON_STAGES)[number];

export const PYLON_WORDS = {
  title: "Bring in your sold jobs from Pylon",
  intro:
    "Every sold job in your Pylon account comes across as a customer and a deal, with its system, price, site details and the signed proposal PDF on the deal. Your Pylon account isn't changed.",
  keyHow: "In Pylon, open Settings → API, create a key with read permission only, and paste it here.",
  keyKept: "The key is used for this import only. RENUABL doesn't keep it.",
  notCarried:
    "Pylon doesn't share the date a job was sold or who signed, so each deal is dated today and the signer's name stays in the signed PDF. Designs come across as figures and the PDF, not as roofs to edit.",
  badKey: "That doesn't look like a Pylon key. Copy the whole key from Pylon's API settings.",
  refused: "Pylon didn't accept that key. Check it was copied whole and hasn't been deleted.",
  noRead: "That key can't read projects. In Pylon, give it read permission and try again.",
  busy: "Pylon asked us to slow down. Wait a minute and press Carry on.",
  down: "Pylon couldn't be reached just now. Try again in a minute.",
} as const;

/** A key as pasted: trimmed, a leading "Bearer " and quotes forgiven; null when it can't be one. */
export function cleanPylonKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw
    .trim()
    .replace(/^bearer\s+/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
  return /^[A-Za-z0-9._~+/=-]{16,400}$/.test(key) ? key : null;
}

/** The first page of sold projects, archived ones too (a sale archived in Pylon is still a sale). */
export function soldProjectsUrl(): string {
  const q = new URLSearchParams({
    "filter[acceptance]": "is_accepted",
    "filter[is_archived]": "any",
    sort: "created_at.asc",
  });
  return `${PYLON_API}/v1/solar_projects?${q.toString()}`;
}

/** A page Pylon gave us to follow: only its own API's project list, never anywhere else. */
export function isPylonPage(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.host === "api.getpylon.com" && u.pathname === "/v1/solar_projects";
  } catch {
    return false;
  }
}

/** A Pylon project or design id as given back to us: short and plain. */
export function cleanPylonId(raw: unknown): string | null {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{4,64}$/.test(raw) ? raw : null;
}

export const projectUrl = (id: string) => `${PYLON_API}/v1/solar_projects/${encodeURIComponent(id)}`;

/** The design's fields we read (Pylon requires `fields[solar_designs]`). */
export function designUrl(id: string): string {
  const fields = "title,summary,pricing,proposal_quote,module_types,inverter_types,storage_types,ev_charger_types,locale";
  return `${PYLON_API}/v1/solar_designs/${encodeURIComponent(id)}?fields[solar_designs]=${fields}`;
}

// ---------------------------------------------------------------------------
// Reading Pylon's answers
// ---------------------------------------------------------------------------

type Bag = Record<string, unknown>;
const bag = (v: unknown): Bag => (v && typeof v === "object" && !Array.isArray(v) ? (v as Bag) : {});
const text = (v: unknown, max = 200) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : typeof v === "number" && Number.isFinite(v)
      ? String(v)
      : "";
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** One sold project in a page of the list: enough to bring it in and to say which is which. */
export interface PylonListed {
  id: string;
  reference: string;
  customer: string;
}

/** A page of sold projects: who they are, and the next page to follow (null at the end). */
export function readProjectPage(raw: unknown): { projects: PylonListed[]; next: string | null } {
  const body = bag(raw);
  const rows = Array.isArray(body.data) ? body.data : [];
  const projects: PylonListed[] = [];
  for (const row of rows) {
    const r = bag(row);
    const id = cleanPylonId(r.id);
    const a = bag(r.attributes);
    if (!id || a.is_example === true) continue;
    projects.push({ id, reference: text(a.reference_number, 60), customer: text(bag(a.customer_details).name, 120) });
  }
  const next = bag(body.links).next;
  return { projects, next: isPylonPage(next) ? next : null };
}

/** The design to read for a project: the one signed, else its primary. */
export function signedDesignId(rawProject: unknown): string | null {
  const rel = bag(bag(bag(rawProject).data).relationships);
  return cleanPylonId(bag(bag(rel.latest_signed_design).data).id) ?? cleanPylonId(bag(bag(rel.primary_design).data).id);
}

/** A product line as Pylon names it: its words and how many. */
interface Kit {
  name: string;
  qty: number;
}
const kitOf = (v: unknown): Kit[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => ({ name: text(bag(x).description, 100), qty: Math.max(0, Math.round(num(bag(x).quantity) ?? 0)) }))
    .filter((k) => k.name);

const pretty = (s: string) => {
  const t = s.replace(/[_-]+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};
const dollars = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Australia, as the CRM places a deal on the map (a point anywhere else is left off). */
const IN_AUSTRALIA = (lat: number, lng: number) => lat <= -9 && lat >= -45 && lng >= 112 && lng <= 155;

/** What a Pylon project and its signed design become in RENUABL. */
export interface PylonDeal {
  /** Pylon's own id for the project: what stops it being brought in twice. */
  pylonId: string;
  reference: string;
  customer: { firstName: string; lastName: string; email: string; phone: string; address: string; source: string };
  job: {
    title: string;
    address: string;
    lat: number | null;
    lng: number | null;
    stage: PylonStage;
    value: number | null;
    installDate: null;
    details: Record<string, string>;
    kw: number | null;
  };
  /** The lines written on the deal's record. */
  note: string;
  /** The e-signed PDF's address (valid an hour), and the design's proposal PDF when there is no signature. */
  signedPdf: string | null;
  proposalPdf: string | null;
}

/**
 * A Pylon project (as `GET /v1/solar_projects/{id}` answers) and its signed design (`GET /v1/solar_designs/{id}`)
 * as a customer and a deal at `stage`. Null when the project can't be read. Only what Pylon says is written: a
 * missing field is left empty, never guessed.
 */
export function dealFromPylon(rawProject: unknown, rawDesign: unknown, stage: PylonStage): PylonDeal | null {
  const p = bag(bag(rawProject).data);
  const id = cleanPylonId(p.id);
  if (!id) return null;
  const a = bag(p.attributes);
  const who = bag(a.customer_details);
  const site = bag(a.site_details);
  const where = bag(a.site_address);
  const accept = bag(a.acceptance);
  const d = bag(bag(bag(rawDesign).data).attributes);
  const summary = bag(d.summary);
  const pricing = bag(d.pricing);
  const reference = text(a.reference_number, 60);

  const address = [text(where.line1), text(where.line2), text(where.city), [text(where.state), text(where.zip)].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const loc = Array.isArray(a.site_location) ? a.site_location : [];
  const lng = num(loc[0]);
  const lat = num(loc[1]);
  const placed = lat !== null && lng !== null && IN_AUSTRALIA(lat, lng);

  const name = text(who.name, 120);
  const [first = "", ...rest] = name.split(" ");
  const kw = num(summary.dc_output_kw);
  const storage = num(summary.storage_kwh);
  const cents = num(pricing.total);
  const value = cents !== null && cents >= 0 ? Math.round(cents) / 100 : null;

  const panels = kitOf(d.module_types);
  const inverters = kitOf(d.inverter_types);
  const batteries = kitOf(d.storage_types);
  const chargers = kitOf(d.ev_charger_types);
  const panelQty = panels.reduce((n, k) => n + k.qty, 0);
  const batteryQty = batteries.reduce((n, k) => n + k.qty, 0);
  const solar = (kw ?? 0) > 0 || panelQty > 0;
  const battery = (storage ?? 0) > 0 || batteries.length > 0;
  const storeys = num(site.number_of_storeys);
  const phases = num(site.power_phases);

  const said: Record<string, string> = {
    systemType: solar ? (battery ? "Solar and battery" : "Solar") : battery ? "Battery" : "",
    systemSize: kw ? `${Math.round(kw * 1000) / 1000} kW` : "",
    propertyType: pretty(text(site.building_classification, 60)),
    storeys: storeys === 1 ? "Single" : storeys === 2 ? "Double" : storeys ? String(storeys) : "",
    roofType: pretty(text(site.roof_type, 60)),
    phases: phases === 1 || phases === 3 ? String(phases) : "",
    panel: panels[0]?.name ?? "",
    panelQty: panelQty ? String(panelQty) : "",
    inverter: inverters[0]?.name ?? "",
    inverterQty: inverters[0]?.qty ? String(inverters[0].qty) : "",
    additionalInverter: inverters
      .slice(1)
      .map((k) => (k.qty > 1 ? `${k.qty} × ${k.name}` : k.name))
      .join(", "),
    battery: batteries[0]?.name ?? "",
    batteryQty: batteryQty ? String(batteryQty) : "",
    batteryStorage: storage ? `${Math.round(storage * 10) / 10} kWh` : "",
    evCharger: chargers.map((k) => k.name).join(", "),
    nmi: text(site.nmi, 30),
    meterNo: text(site.meter_number, 40),
    retailer: text(site.energy_retailer, 80),
    distributor: text(site.energy_distributor, 80),
    preApprovalRef: text(site.dnsp_preapproval_number, 60),
  };
  const details: Record<string, string> = {};
  for (const [k, v] of Object.entries(said)) if (v) details[k] = v.slice(0, 120);

  const quote = bag(d.proposal_quote);
  const au = bag(bag(d.locale).au);
  const stcs = num(au.stc_value);
  const note = [
    `Brought in from Pylon${reference ? ` (reference ${reference})` : ""}.`,
    text(d.title, 120) && `System: ${text(d.title, 120)}.`,
    text(quote.total_price_formatted, 40)
      ? `Price on the Pylon proposal: ${text(quote.total_price_formatted, 40)}${pricing.total_includes_tax === true ? " inc. GST" : ""}.`
      : value !== null
        ? `Price on the Pylon proposal: ${dollars(value)}.`
        : "",
    stcs !== null && stcs > 0 ? `STC value on the proposal: ${dollars(Math.round(stcs) / 100)}.` : "",
    accept.manually_sold === true ? "Marked sold by hand in Pylon." : accept.latest_esignature === true ? "Signed online in Pylon." : "",
    "Pylon doesn't share the date it was sold or who signed: see the signed PDF.",
  ]
    .filter(Boolean)
    .join("\n");

  const pdf = (v: unknown) => (typeof v === "string" && /^https:\/\//.test(v) ? v : null);
  return {
    pylonId: id,
    reference,
    customer: {
      firstName: first || "Pylon customer",
      lastName: first ? rest.join(" ") : reference || id,
      email: text(who.email, 160).toLowerCase(),
      phone: text(who.phone, 40),
      address,
      source: "Pylon",
    },
    job: {
      title: (solar ? (battery ? "Solar and battery" : "Solar") : battery ? "Battery" : "Solar").slice(0, 80),
      address,
      lat: placed ? lat : null,
      lng: placed ? lng : null,
      stage,
      value: value !== null && value <= 10_000_000 ? value : null,
      installDate: null,
      details,
      kw: kw !== null && kw >= 0 && kw <= 10_000 ? Math.round(kw * 1000) / 1000 : null,
    },
    note,
    signedPdf: accept.latest_esignature === true ? pdf(accept.latest_esignature_pdf_url) : null,
    proposalPdf: pdf(summary.pdf_proposal_url),
  };
}

/** What became of one project brought in. */
export type PylonOutcome =
  | { id: string; result: "in"; jobId: string; customer: string; pdf: boolean }
  | { id: string; result: "already" }
  | { id: string; result: "failed"; why: string };

/** What a run has done so far, in words: "142 of 180 sold jobs in · 3 already here". */
export function progressWords(o: { done: number; total: number; already: number; failed: number }): string {
  const parts = [`${o.done} of ${o.total} sold job${o.total === 1 ? "" : "s"} in`];
  if (o.already) parts.push(`${o.already} already here`);
  if (o.failed) parts.push(`${o.failed} couldn't come across`);
  return parts.join(" · ");
}

/** The file name a signed PDF is kept under on its deal. */
export function pdfName(deal: Pick<PylonDeal, "reference" | "customer">, signed: boolean): string {
  const who = `${deal.customer.firstName} ${deal.customer.lastName}`.replace(/[^A-Za-z0-9 .'-]/g, "").trim();
  return (
    `${signed ? "Signed proposal" : "Proposal"} (Pylon${deal.reference ? ` ${deal.reference.replace(/[^A-Za-z0-9-]/g, "")}` : ""}) ${who}`
      .trim()
      .slice(0, 100) + ".pdf"
  );
}

// ---------------------------------------------------------------------------
// Pylon's CSV export (20 Nov 2026, Martin: Pylon exported every Primero project as a CSV). It carries the customer,
// address, sold date, kW, price and STCs, but no system lines, no place on the map and no PDF. Read in the browser
// (the file can be larger than a request may carry), sent in batches of the sold rows only, and read again on the
// server before anything is kept.
// ---------------------------------------------------------------------------

/** The columns an export must have to be read as Pylon's. */
export const PYLON_CSV_COLUMNS = [
  "project_id",
  "project_reference_number",
  "customer_name",
  "customer_email",
  "address_line_1",
  "is_sold",
  "sold_at",
  "layout_size_kwp",
  "quoted_price_total",
] as const;

/** Rows sent a request. */
export const PYLON_CSV_BATCH = 40;
/** Sold within this many weeks of today comes in as Won, else as Installed, unless the business says otherwise. */
export const PYLON_WON_WEEKS = 8;

export const PYLON_CSV_WORDS = {
  title: "Or upload Pylon's export",
  how: "In Pylon, export your projects as a CSV and choose the file here. It's read on this computer, and only the sold jobs are sent.",
  notPylon: "That file doesn't look like Pylon's project export. Choose the CSV Pylon emailed or downloaded.",
  notCarried:
    "The export has the customer, address, sold date, system size, price and STCs. It has no panels or inverter, no signed PDF and no place on the map, so add the address on the map when you design or service one.",
} as const;

/** One sold project from the export, as the browser sends it (every field read again on the server). */
export interface PylonCsvRow {
  id: string;
  reference: string;
  owner: string;
  ownerEmail: string;
  name: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  locality: string;
  postcode: string;
  region: string;
  country: string;
  /** YYYY-MM-DD in Melbourne, or "" when the export has none. */
  soldOn: string;
  kw: number | null;
  price: number | null;
  stcQty: number | null;
  stcValue: number | null;
  proposalLink: string;
}

/** A CSV as rows of cells (RFC 4180: quoted cells, doubled quotes, line breaks inside quotes; a BOM forgiven). */
export function readCsv(raw: string): string[][] {
  const t = raw.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const cellOf = (v: unknown, max = 200) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const figure = (v: unknown, max: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(/[$,\s]/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};

/** "2020-09-04 10:51:54 +10:00" (as Pylon writes it, with its offset) as the day in Melbourne, else "". */
export function soldDay(raw: unknown): string {
  const m = cellOf(raw, 40).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)\s*([+-]\d{2}:?\d{2}|Z)?$/);
  if (!m) return "";
  const zone = !m[3] ? "+10:00" : m[3] === "Z" ? "Z" : m[3].includes(":") ? m[3] : `${m[3].slice(0, 3)}:${m[3].slice(3)}`;
  const at = new Date(`${m[1]}T${m[2]}${zone}`);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** One row as sent and read again: its cells cut to size, figures in range, the id Pylon's own shape. Null when not a row. */
export function cleanCsvRow(raw: unknown): PylonCsvRow | null {
  const r = bag(raw);
  const id = cleanPylonId(r.id);
  if (!id) return null;
  const link = cellOf(r.proposalLink, 200);
  const soldOn = cellOf(r.soldOn, 10);
  return {
    id,
    reference: cellOf(r.reference, 60),
    owner: cellOf(r.owner, 120),
    ownerEmail: cellOf(r.ownerEmail, 200).toLowerCase(),
    name: cellOf(r.name, 120),
    phone: cellOf(r.phone, 40),
    email: cellOf(r.email, 200).toLowerCase(),
    line1: cellOf(r.line1),
    line2: cellOf(r.line2),
    locality: cellOf(r.locality, 80),
    postcode: cellOf(r.postcode, 10),
    region: cellOf(r.region, 60),
    country: cellOf(r.country, 60),
    soldOn: /^\d{4}-\d{2}-\d{2}$/.test(soldOn) ? soldOn : "",
    kw: figure(r.kw, 10_000),
    price: figure(r.price, 10_000_000),
    stcQty: figure(r.stcQty, 1_000_000),
    stcValue: figure(r.stcValue, 10_000_000),
    // Only Pylon's own proposal pages are kept as a link.
    proposalLink: /^https:\/\/app\.getpylon\.com\/proposals\/[A-Za-z0-9_-]+$/.test(link) ? link : "",
  };
}

export interface PylonExport {
  /** The sold projects, oldest sold first. */
  sold: PylonCsvRow[];
  /** Every project in the file, sold or not. */
  all: number;
}

/** Pylon's project export read: its sold rows, or a problem in words when the file isn't Pylon's. */
export function readPylonExport(raw: string): PylonExport | { problem: string } {
  const rows = readCsv(raw);
  const head = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  if (!PYLON_CSV_COLUMNS.every((c) => head.includes(c))) return { problem: PYLON_CSV_WORDS.notPylon };
  const at = (r: string[], k: string) => r[head.indexOf(k)] ?? "";
  const sold: PylonCsvRow[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (at(r, "is_sold").trim().toLowerCase() !== "true") continue;
    const row = cleanCsvRow({
      id: at(r, "project_id"),
      reference: at(r, "project_reference_number"),
      owner: at(r, "owner_name"),
      ownerEmail: at(r, "owner_email"),
      name: at(r, "customer_name"),
      phone: at(r, "customer_phone"),
      email: at(r, "customer_email"),
      line1: at(r, "address_line_1"),
      line2: at(r, "address_line_2"),
      locality: at(r, "locality"),
      postcode: at(r, "postal_code"),
      region: at(r, "region"),
      country: at(r, "country"),
      soldOn: soldDay(at(r, "sold_at")),
      kw: at(r, "layout_size_kwp"),
      price: at(r, "quoted_price_total"),
      stcQty: at(r, "stc_quantity"),
      stcValue: at(r, "stc_value"),
      proposalLink: at(r, "proposal_link"),
    });
    if (row && !seen.has(row.id)) {
      seen.add(row.id);
      sold.push(row);
    }
  }
  sold.sort((a, b) => a.soldOn.localeCompare(b.soldOn));
  return { sold, all: rows.length };
}

/** Won when sold within `wonWeeks` of today (or with no sold date), else Installed. */
export function csvStage(soldOn: string, today: string, wonWeeks = PYLON_WON_WEEKS): PylonStage {
  if (!soldOn) return "won";
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${soldOn}T00:00:00Z`)) / 86_400_000;
  return days > wonWeeks * 7 ? "installed" : "won";
}

/** A placeholder phone Pylon's users typed for no number ("0000 000 000"): left out. */
const realPhone = (p: string) => (/[1-9]/.test(p) ? p : "");

/** A sold row of the export as a customer and a deal. */
export function dealFromCsv(row: PylonCsvRow, stage: PylonStage): PylonDeal {
  // A name the CRM can't take (under two letters) is kept after "Pylon customer" rather than lost.
  const named = row.name.replace(/\s/g, "").length >= 2;
  const [first = "", ...rest] = named ? row.name.split(" ") : [];
  const unnamed = [row.name, row.reference || row.id].filter(Boolean).join(" ");
  const address = [row.line1, row.line2, row.locality, [row.region, row.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const kw = row.kw !== null && row.kw > 0 ? Math.round(row.kw * 1000) / 1000 : null;
  const details: Record<string, string> = {};
  if (kw) {
    details.systemType = "Solar";
    details.systemSize = `${kw} kW`;
  }
  const sold = row.soldOn
    ? new Date(`${row.soldOn}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "";
  const note = [
    `Brought in from Pylon's export${row.reference ? ` (reference ${row.reference})` : ""}.`,
    sold && `Sold in Pylon on ${sold}${row.owner ? ` by ${row.owner}` : ""}.`,
    kw && `System: ${kw} kW.`,
    row.price !== null && `Price on the Pylon proposal: ${dollars(row.price)}.`,
    row.stcValue !== null &&
      row.stcValue > 0 &&
      `STC value on the proposal: ${dollars(row.stcValue)}${row.stcQty ? ` (${row.stcQty} STCs)` : ""}.`,
    row.proposalLink && `Pylon proposal: ${row.proposalLink}`,
    row.country && row.country !== "Australia" && `Country in Pylon: ${row.country}.`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    pylonId: row.id,
    reference: row.reference,
    customer: {
      firstName: first || "Pylon customer",
      lastName: first ? rest.join(" ") : unnamed,
      email: row.email,
      phone: realPhone(row.phone),
      address,
      source: "Pylon",
    },
    job: {
      title: "Solar",
      address,
      lat: null,
      lng: null,
      stage,
      value: row.price,
      installDate: null,
      details,
      kw,
    },
    note,
    signedPdf: null,
    proposalPdf: null,
  };
}
