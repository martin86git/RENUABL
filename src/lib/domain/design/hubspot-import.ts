/**
 * Bringing a business's deals across from HubSpot (23 Nov 2026, Martin: "a way to transfer over deal information from
 * customers in HubSpot"). The business makes a private app in its own HubSpot with read-only scopes and pastes its token;
 * we read its deal pipelines and properties, it matches each HubSpot stage to one of ours and each of our deal fields to
 * a HubSpot property, and each deal comes across as a customer (from its first contact) and a deal, with its notes,
 * emails, calls and meetings as dated lines on the deal's record. Pure: the addresses we ask, the guesses, and how a
 * HubSpot deal becomes ours. The token is used for the import and never kept.
 *
 * HubSpot's API (from developers.hubspot.com, written 23 Nov 2026 without a real account to try: VERIFY): base
 * https://api.hubapi.com, `Authorization: Bearer <token>`; pipelines GET /crm/v3/pipelines/deals (stages carry
 * `metadata.isClosed` and `metadata.probability`); properties GET /crm/v3/properties/deals; deals listed by
 * GET /crm/v3/objects/deals (100 a page, `paging.next.after`) and read by POST /crm/v3/objects/{type}/batch/read
 * (up to 100); a deal's contacts and engagements by POST /crm/v4/associations/deals/{type}/batch/read; owners by
 * GET /crm/v3/owners. Private apps are allowed about 100 requests in 10 seconds; 429 says when to come back.
 */
import { JOB_STAGES, STAGE_LABELS, type ActivityKind, type JobStage } from "./crm";
import { resolveDealFields, type DealFieldsConfig, type FieldKind } from "./deal-sections";

export const HUBSPOT_API = "https://api.hubapi.com";
/** Where a business makes its private app, in HubSpot (Settings → Integrations → Private apps). */
export const HUBSPOT_KEY_HELP = "https://knowledge.hubspot.com/integrations/how-do-i-get-my-hubspot-api-key";
/** The read-only scopes the private app needs. */
export const HUBSPOT_SCOPES = [
  "crm.objects.deals.read",
  "crm.objects.contacts.read",
  "crm.objects.owners.read",
  "crm.schemas.deals.read",
  "sales-email-read",
] as const;
/** The deals one import lists, at most. */
export const HUBSPOT_MAX_DEALS = 20_000;
/** How many deals one call to our server brings in (each batch is a handful of reads at HubSpot). */
export const HUBSPOT_BATCH = 10;
/** The record lines one deal brings across, at most, newest first. */
export const MAX_ENGAGEMENTS = 200;
/** The words one record line keeps. */
const LINE_MAX = 4000;
/** The engagements we bring across, and the kind of line each becomes on the deal's record. */
export const ENGAGEMENT_TYPES = ["notes", "emails", "calls", "meetings"] as const;
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number];

export const HUBSPOT_WORDS = {
  title: "Bring in your deals from HubSpot",
  intro:
    "Each deal in the HubSpot pipelines you choose comes across as a customer and a deal, at the stage you match it to, with its value, owner, the fields you match, and its notes, emails, calls and meetings on the deal's record. Your HubSpot account isn't changed.",
  keyHow:
    "In HubSpot, open Settings → Integrations → Private apps, create an app, tick these read scopes, then copy its access token and paste it here:",
  keyKept: "The token is used for this import only. RENUABL doesn't keep it.",
  notCarried:
    "Attachments, tasks, quotes and marketing history stay in HubSpot. A deal's customer is its first contact; someone already in RENUABL (by email, then mobile) gets the deal and isn't changed.",
  again: "Run it again any time: deals already brought in are passed over, so only new ones come across.",
  badKey: "That doesn't look like a HubSpot private app token. It starts with pat- and is copied whole from the app's Auth tab.",
  refused: "HubSpot didn't accept that token. Check it was copied whole and the private app hasn't been deleted.",
  noRead: "That token can't read deals. In HubSpot, give the private app the read scopes listed here and try again.",
  busy: "HubSpot asked us to slow down. Wait a minute and press Carry on.",
} as const;

/** HubSpot turned a request down for a reason of its own: said with its status and words, so it can be put right. */
export function hubspotSaid(status: number, message: string): string {
  const words = message
    .replace(/[\u0000-\u001f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return `HubSpot turned the request down (${status}${words ? `: ${words}` : ""}).`;
}

/** A token as pasted: trimmed, quotes and a leading "Bearer " forgiven; null unless it reads as a private app token. */
export function cleanHubSpotKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/^bearer\s+/i, "")
    .trim();
  return /^pat-[a-z0-9]{2,8}-[A-Za-z0-9-]{20,200}$/.test(key) ? key : null;
}

/** A HubSpot record id: digits only. */
export function cleanHubSpotId(raw: unknown): string | null {
  const id = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  return /^\d{1,20}$/.test(id) ? id : null;
}

// ---------------------------------------------------------------------------
// What HubSpot tells us
// ---------------------------------------------------------------------------

export interface HsStage {
  id: string;
  label: string;
  /** Closed (won or lost) in HubSpot. */
  closed: boolean;
  /** HubSpot's win probability for the stage, 0 to 1, or null. */
  probability: number | null;
}
export interface HsPipeline {
  id: string;
  label: string;
  stages: HsStage[];
}
export interface HsProperty {
  name: string;
  label: string;
  /** HubSpot's type: string, number, date, datetime, enumeration, bool. */
  type: string;
  /** Made by the business, not HubSpot's own. */
  custom: boolean;
  /** For an enumeration, each choice's value and the label people see. */
  options?: { value: string; label: string }[];
}

const bag = (x: unknown): Record<string, unknown> =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
const text = (x: unknown, max = 200) =>
  typeof x === "string" || typeof x === "number"
    ? String(x)
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
        .trim()
        .slice(0, max)
    : "";

/** GET /crm/v3/pipelines/deals read: each pipeline with its stages, in HubSpot's order; archived ones left out. */
export function readPipelines(raw: unknown): HsPipeline[] {
  const results = Array.isArray(bag(raw).results) ? (bag(raw).results as unknown[]) : [];
  return results
    .map(bag)
    .filter((p) => p.archived !== true && cleanStageId(p.id))
    .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
    .map((p) => ({
      id: cleanStageId(p.id)!,
      label: text(p.label, 80) || "Pipeline",
      stages: (Array.isArray(p.stages) ? (p.stages as unknown[]) : [])
        .map(bag)
        .filter((s) => s.archived !== true && cleanStageId(s.id))
        .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
        .map((s) => {
          const meta = bag(s.metadata);
          const probability = Number(meta.probability);
          return {
            id: cleanStageId(s.id)!,
            label: text(s.label, 80) || "Stage",
            closed: String(meta.isClosed) === "true",
            probability: meta.probability !== undefined && Number.isFinite(probability) ? probability : null,
          };
        }),
    }));
}

/** A pipeline's or stage's id: HubSpot's are digits or words like "default" and "closedwon". */
export function cleanStageId(raw: unknown): string | null {
  const id = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

/** HubSpot's own deal properties worth matching, beside the business's own. The rest of HubSpot's are left out. */
const STANDARD_WORTH = new Set(["description", "closed_lost_reason", "closed_won_reason", "dealtype", "hs_next_step"]);

/** GET /crm/v3/properties/deals read: the properties a field could be matched to, the business's own first. */
export function readProperties(raw: unknown): HsProperty[] {
  const results = Array.isArray(bag(raw).results) ? (bag(raw).results as unknown[]) : [];
  return results
    .map(bag)
    .filter((p) => typeof p.name === "string" && /^[a-z0-9_]{1,100}$/.test(p.name) && p.hidden !== true && p.archived !== true)
    .filter((p) => p.hubspotDefined !== true || STANDARD_WORTH.has(p.name as string))
    .map((p): HsProperty => {
      const options = (Array.isArray(p.options) ? (p.options as unknown[]) : [])
        .map(bag)
        .map((o) => ({ value: text(o.value, 120), label: text(o.label, 120) }))
        .filter((o) => o.value);
      return {
        name: p.name as string,
        label: text(p.label, 100) || (p.name as string),
        type: text(p.type, 20) || "string",
        custom: p.hubspotDefined !== true,
        ...(options.length ? { options: options.slice(0, 200) } : {}),
      };
    })
    .sort((a, b) => Number(b.custom) - Number(a.custom) || a.label.localeCompare(b.label))
    .slice(0, 400);
}

// ---------------------------------------------------------------------------
// Matching stages and fields
// ---------------------------------------------------------------------------

/** Where a HubSpot stage's deals go: one of our stages, or left in HubSpot. */
export type StageChoice = JobStage | "skip";
export interface HubSpotMap {
  /** HubSpot stage id → ours. A stage with no choice is left out. */
  stages: Record<string, StageChoice>;
  /** Our field key → the HubSpot property that fills it. */
  fields: Record<string, string>;
}

/** Our stage for a HubSpot stage, read from whether it is closed, its probability and its name. */
export function guessStage(stage: HsStage): JobStage {
  const label = stage.label.toLowerCase();
  if (stage.closed) {
    if (stage.probability === 0 || /lost|dead|declin|cancel|no sale|unqualif/.test(label)) return "lost";
    if (/install(ed|ation)? ?(complete|done|finish)|installed|complet/.test(label)) return "installed";
    return "won";
  }
  if (/lost|dead|declin|cancel/.test(label)) return "lost";
  if (/grid|connect/.test(label)) return "grid";
  if (/coes|compliance/.test(label)) return "coes";
  if (/inspect/.test(label)) return "inspection";
  if (/installed|install(ation)? complete/.test(label)) return "installed";
  // "Appointment scheduled" (HubSpot's own first stage) is a lead: only an install booked counts.
  if (/install\w* (schedul|book)|(schedul|book)\w* (for )?install|booked in/.test(label)) return "scheduled";
  if (/order|procure|stock/.test(label)) return "ordered";
  if (/won|sold|signed|accepted|deposit|contract/.test(label)) return "won";
  if (/proposal|quote|quoted|sent|negotiat|decision/.test(label)) return "proposal";
  if (/design/.test(label)) return "designed";
  return "lead";
}

/** One of our deal fields a HubSpot property can fill. */
export interface FieldTarget {
  key: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  /** On the deal itself (the install date), not in its details. */
  onDeal?: boolean;
}

/** Every field a HubSpot property can fill under the business's arrangement: the system lines, the typed and its own. */
export function fieldTargets(config: DealFieldsConfig | null | undefined): FieldTarget[] {
  const out: FieldTarget[] = [{ key: "installDate", label: "Installation date", kind: "date", onDeal: true }];
  for (const tab of resolveDealFields(config))
    for (const f of tab.fields) {
      if (f.key === "installDate") continue;
      if (f.source === "known" && f.key !== "installer") continue;
      out.push({ key: f.key, label: f.label, kind: f.kind, ...(f.options ? { options: f.options } : {}) });
    }
  return out;
}

/** Other names solar businesses give these fields in HubSpot, so the first match is usually right. */
const ALSO: Record<string, string[]> = {
  systemSize: ["system size kw", "kw", "pv size", "solar size", "system kw", "pv system size"],
  systemType: ["system", "product", "product type", "type of system"],
  panel: ["panels", "panel", "panel model", "module", "solar panel"],
  panelQty: ["number of panels", "no of panels", "panel count", "panels qty", "qty of panels"],
  inverter: ["inverter model", "inverter brand"],
  battery: ["battery model", "battery brand"],
  batteryStorage: ["battery size", "battery kwh", "storage kwh", "storage"],
  roofType: ["roof", "roof material"],
  storeys: ["stories", "storey", "levels", "number of storeys"],
  phases: ["phase", "supply phase", "number of phases"],
  nmi: ["nmi number"],
  distributor: ["dnsp", "network", "distribution network"],
  retailer: ["energy retailer", "electricity provider"],
  meterNo: ["meter", "meter no"],
  installDate: ["install date", "installation date", "date of install"],
  installer: ["installer name", "install crew"],
  preApprovalRef: ["pre approval number", "preapproval reference"],
  finance: ["finance provider", "payment method"],
};
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Each of our fields with the HubSpot property most likely to fill it (by name), each property used once. */
export function guessFields(targets: readonly FieldTarget[], props: readonly HsProperty[]): Record<string, string> {
  const out: Record<string, string> = {};
  const used = new Set<string>();
  for (const t of targets) {
    const names = new Set([norm(t.label), norm(t.key.replace(/([A-Z])/g, " $1")), ...(ALSO[t.key] ?? []).map(norm)]);
    const hit = props.find((p) => !used.has(p.name) && (names.has(norm(p.label)) || names.has(norm(p.name))));
    if (hit) {
      out[t.key] = hit.name;
      used.add(hit.name);
    }
  }
  return out;
}

/** A match as sent from the browser: only our stages, known field keys and property names that could be HubSpot's. */
export function cleanHubSpotMap(raw: unknown, targets: readonly FieldTarget[]): HubSpotMap {
  const r = bag(raw);
  const stages: Record<string, StageChoice> = {};
  for (const [id, v] of Object.entries(bag(r.stages)).slice(0, 500))
    if (cleanStageId(id) && (v === "skip" || JOB_STAGES.includes(v as JobStage))) stages[id] = v as StageChoice;
  const keys = new Set(targets.map((t) => t.key));
  const fields: Record<string, string> = {};
  for (const [key, v] of Object.entries(bag(r.fields)).slice(0, 200))
    if (keys.has(key) && typeof v === "string" && /^[a-z0-9_]{1,100}$/.test(v)) fields[key] = v;
  return { stages, fields };
}

// ---------------------------------------------------------------------------
// One deal
// ---------------------------------------------------------------------------

/** HubSpot record's id and properties, from any list or batch read. */
export interface HsRecord {
  id: string;
  properties: Record<string, string>;
}
export function readRecords(raw: unknown): HsRecord[] {
  const results = Array.isArray(bag(raw).results) ? (bag(raw).results as unknown[]) : [];
  return results.map(bag).flatMap((x) => {
    const id = cleanHubSpotId(x.id);
    if (!id) return [];
    const properties: Record<string, string> = {};
    for (const [k, v] of Object.entries(bag(x.properties))) if (v !== null && v !== undefined && v !== "") properties[k] = String(v);
    return [{ id, properties }];
  });
}

/** POST /crm/v4/associations/deals/{type}/batch/read read: each deal id → the ids it is joined to, in HubSpot's order. */
export function readAssociations(raw: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const x of (Array.isArray(bag(raw).results) ? (bag(raw).results as unknown[]) : []).map(bag)) {
    const from = cleanHubSpotId(bag(x.from).id);
    if (!from) continue;
    const to = (Array.isArray(x.to) ? (x.to as unknown[]) : []).map((t) => cleanHubSpotId(bag(t).toObjectId)).filter(Boolean) as string[];
    out.set(from, [...(out.get(from) ?? []), ...to]);
  }
  return out;
}

/** The page after this one in a list, or null. */
export function nextAfter(raw: unknown): string | null {
  const after = bag(bag(bag(raw).paging).next).after;
  return typeof after === "string" && /^[A-Za-z0-9_=-]{1,200}$/.test(after) ? after : null;
}

/** A deal as listed for the business to see before bringing it in. */
export interface HsListed {
  id: string;
  name: string;
  pipeline: string;
  stage: string;
}

/** The deal's properties every import reads, beside those matched to a field. */
export const DEAL_PROPERTIES = [
  "dealname",
  "pipeline",
  "dealstage",
  "amount",
  "closedate",
  "createdate",
  "hubspot_owner_id",
  "description",
];
export const CONTACT_PROPERTIES = ["firstname", "lastname", "email", "phone", "mobilephone", "address", "city", "state", "zip"];
export const ENGAGEMENT_PROPERTIES: Record<EngagementType, string[]> = {
  notes: ["hs_note_body", "hs_timestamp", "hubspot_owner_id"],
  emails: [
    "hs_email_subject",
    "hs_email_text",
    "hs_email_html",
    "hs_email_direction",
    "hs_email_to_email",
    "hs_email_from_email",
    "hs_timestamp",
    "hubspot_owner_id",
  ],
  calls: [
    "hs_call_title",
    "hs_call_body",
    "hs_call_duration",
    "hs_call_direction",
    "hs_call_to_number",
    "hs_timestamp",
    "hubspot_owner_id",
  ],
  meetings: ["hs_meeting_title", "hs_meeting_body", "hs_meeting_start_time", "hs_meeting_outcome", "hs_timestamp", "hubspot_owner_id"],
};

/** Words out of HubSpot's HTML (a note's body, an email without text), as plain lines. */
export function plainFromHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const c = Number(n);
      return c > 31 && c < 0x10ffff ? String.fromCodePoint(c) : "";
    })
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n+• /g, "\n• ")
    .trim();
}

/** A HubSpot date or datetime (ISO, or milliseconds) as the day it fell on in Melbourne, YYYY-MM-DD, or "". */
export function hsDay(raw: string | undefined): string {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const at = /^\d{10,14}$/.test(raw) ? new Date(Number(raw)) : new Date(raw);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    at,
  );
}

/** A HubSpot time as an ISO moment, or null. */
export function hsMoment(raw: string | undefined): string | null {
  if (!raw) return null;
  const at = /^\d{10,14}$/.test(raw) ? new Date(Number(raw)) : new Date(raw);
  return Number.isNaN(at.getTime()) || at.getFullYear() < 2000 || at.getTime() > Date.now() + 366 * 86_400_000 ? null : at.toISOString();
}

/** A property's value as people read it: a choice's label, Yes or No, a day. */
export function propertyWords(prop: HsProperty | undefined, raw: string): string {
  if (!prop) return raw;
  if (prop.type === "bool" || prop.type === "booleancheckbox") return raw === "true" ? "Yes" : raw === "false" ? "No" : raw;
  if (prop.type === "date" || prop.type === "datetime") return hsDay(raw) || raw;
  if (prop.type === "enumeration" && prop.options) {
    // A multi-select keeps its values joined by ";".
    return raw
      .split(";")
      .map((v) => prop.options!.find((o) => o.value === v)?.label ?? v)
      .join(", ");
  }
  return raw;
}

/** A matched value as our field keeps it: a choice only when it is one of ours (any case), a date as a day, numbers bare. */
export function valueForField(target: FieldTarget, words: string): string {
  const w = words.trim();
  if (!w) return "";
  if (target.kind === "select") return target.options?.find((o) => o.toLowerCase() === w.toLowerCase()) ?? "";
  if (target.kind === "date") return hsDay(w);
  if (target.kind === "money" || target.kind === "number") {
    const n = Number(w.replace(/[$,\s]|kw|kwh/gi, ""));
    return Number.isFinite(n) ? String(n) : "";
  }
  return w.slice(0, target.kind === "long" ? 2000 : 120);
}

export interface HsOwner {
  id: string;
  email: string;
  name: string;
}
export function readOwners(raw: unknown): HsOwner[] {
  return (Array.isArray(bag(raw).results) ? (bag(raw).results as unknown[]) : []).map(bag).flatMap((o) => {
    const id = cleanHubSpotId(o.id);
    const email = text(o.email, 200).toLowerCase();
    return id ? [{ id, email, name: `${text(o.firstName, 60)} ${text(o.lastName, 60)}`.trim() || email }] : [];
  });
}

/** How one HubSpot deal comes across. */
export interface HsDeal {
  hubspotId: string;
  customer: { firstName: string; lastName: string; email: string; phone: string; address: string; source: string };
  job: {
    title: string;
    address: string;
    stage: JobStage;
    value: number | null;
    installDate: string | null;
    details: Record<string, string>;
  };
  /** The day it was won (its close date), when at a won stage. */
  wonOn: string | null;
  /** When it was made in HubSpot, so it isn't counted as a new lead today. */
  createdAt: string | null;
  owner: string;
  note: string;
}

/** A HubSpot deal, its first contact and the match, as a customer and a deal; null when its stage is left out. */
export function dealFromHubSpot(
  deal: HsRecord,
  contact: HsRecord | null,
  o: {
    map: HubSpotMap;
    targets: readonly FieldTarget[];
    props: readonly HsProperty[];
    pipelines: readonly HsPipeline[];
    owners: readonly HsOwner[];
  },
): HsDeal | null {
  const p = deal.properties;
  const stage = o.map.stages[p.dealstage ?? ""];
  if (!stage || stage === "skip") return null;
  const c = contact?.properties ?? {};
  const pipeline = o.pipelines.find((x) => x.id === p.pipeline);
  const hsStage = pipeline?.stages.find((s) => s.id === p.dealstage);
  const owner = o.owners.find((x) => x.id === p.hubspot_owner_id);
  const propByName = new Map(o.props.map((x) => [x.name, x]));

  const address = [c.address, [c.city, c.state, c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ").slice(0, 200);
  const emailName = (c.email ?? "")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim();
  let firstName = text(c.firstname, 60);
  let lastName = text(c.lastname, 60);
  if (!firstName) {
    const fallback = lastName || emailName || text(p.dealname, 60) || "HubSpot customer";
    [firstName, lastName] = lastName ? [lastName, ""] : [fallback, ""];
  }
  if (firstName.length < 2 && !lastName) firstName = "HubSpot customer";

  const details: Record<string, string> = {};
  let installDate: string | null = null;
  const used = new Set<string>();
  for (const t of o.targets) {
    const name = o.map.fields[t.key];
    const raw = name ? p[name] : undefined;
    if (!name || !raw) continue;
    const value = valueForField(t, propertyWords(propByName.get(name), raw));
    if (!value) continue;
    used.add(name);
    if (t.onDeal) installDate = value;
    else details[t.key] = value;
  }

  const amount = Number(p.amount);
  const value = Number.isFinite(amount) && amount >= 0 && amount <= 10_000_000 ? Math.round(amount * 100) / 100 : null;
  const closed = hsDay(p.closedate);
  const won = stage !== "lead" && stage !== "designed" && stage !== "proposal" && stage !== "lost";

  const lines = [
    `Brought in from HubSpot · deal ${deal.id}`,
    pipeline || hsStage
      ? `HubSpot stage: ${[pipeline?.label, hsStage?.label].filter(Boolean).join(" → ")} (now ${STAGE_LABELS[stage]})`
      : "",
    value !== null ? `Amount: $${value.toLocaleString("en-AU", { maximumFractionDigits: 2 })}` : "",
    closed ? `Close date: ${closed}` : "",
    hsDay(p.createdate) ? `Created in HubSpot: ${hsDay(p.createdate)}` : "",
    owner ? `HubSpot owner: ${owner.name}${owner.email && owner.email !== owner.name ? ` (${owner.email})` : ""}` : "",
  ].filter(Boolean);
  // Every other property with something in it is kept in the note, so nothing typed in HubSpot is lost.
  const others = Object.entries(p)
    .filter(([k, v]) => v && !DEAL_PROPERTIES.includes(k) && !used.has(k) && propByName.has(k))
    .map(([k, v]) => `${propByName.get(k)!.label}: ${propertyWords(propByName.get(k), v).replace(/\s+/g, " ").slice(0, 300)}`)
    .slice(0, 60);
  if (others.length) lines.push("", "Other details in HubSpot:", ...others);
  const description = p.description ? plainFromHtml(p.description).slice(0, 2000) : "";
  if (description) lines.push("", "Description:", description);

  return {
    hubspotId: deal.id,
    customer: {
      firstName,
      lastName,
      email: text(c.email, 200).toLowerCase(),
      phone: text(c.mobilephone || c.phone, 30),
      address,
      source: "HubSpot",
    },
    job: { title: text(p.dealname, 80) || "Solar", address, stage, value, installDate, details },
    wonOn: won ? closed || null : null,
    createdAt: hsMoment(p.createdate),
    owner: owner?.email ?? "",
    note: lines.join("\n").slice(0, 8000),
  };
}

/** A line for the deal's record from one HubSpot note, email, call or meeting. */
export interface HsLine {
  kind: Extract<ActivityKind, "note" | "email" | "call">;
  text: string;
  at: string;
  by: string;
}

const cut = (s: string) => (s.length > LINE_MAX ? `${s.slice(0, LINE_MAX - 1)}…` : s);

/** One engagement as a dated line on the deal's record, by its HubSpot owner when we know them; null when empty or undated. */
export function engagementLine(type: EngagementType, e: HsRecord, owners: readonly HsOwner[]): HsLine | null {
  const p = e.properties;
  const by = owners.find((o) => o.id === p.hubspot_owner_id)?.email || "hubspot";
  if (type === "notes") {
    const body = plainFromHtml(p.hs_note_body ?? "");
    const at = hsMoment(p.hs_timestamp);
    return body && at ? { kind: "note", text: cut(body), at, by } : null;
  }
  if (type === "emails") {
    const at = hsMoment(p.hs_timestamp);
    const subject = text(p.hs_email_subject, 200) || "(no subject)";
    const body = (p.hs_email_text ?? "").trim() || plainFromHtml(p.hs_email_html ?? "");
    if (!at) return null;
    const incoming = /INCOMING/i.test(p.hs_email_direction ?? "");
    const other =
      text(incoming ? p.hs_email_from_email : p.hs_email_to_email, 200)
        .split(/[;,]/)[0]
        ?.trim() || "the customer";
    const head = incoming ? `Email from ${other}: ${subject}` : `Email to ${other}: ${subject}`;
    return { kind: "email", text: cut(`${head}\n\n${body}`.trim()), at, by };
  }
  if (type === "calls") {
    const at = hsMoment(p.hs_timestamp);
    if (!at) return null;
    const ms = Number(p.hs_call_duration);
    const minutes = Number.isFinite(ms) && ms > 0 ? Math.max(1, Math.round(ms / 60_000)) : 0;
    const head = [
      text(p.hs_call_title, 160) || "Call",
      minutes ? `${minutes} min` : "",
      /INBOUND/i.test(p.hs_call_direction ?? "") ? "they rang" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const body = plainFromHtml(p.hs_call_body ?? "");
    return { kind: "call", text: cut(body ? `${head}\n${body}` : head), at, by };
  }
  const at = hsMoment(p.hs_meeting_start_time) ?? hsMoment(p.hs_timestamp);
  if (!at) return null;
  const head = `Meeting: ${text(p.hs_meeting_title, 160) || "Meeting"}${p.hs_meeting_outcome ? ` · ${text(p.hs_meeting_outcome, 40).toLowerCase()}` : ""}`;
  const body = plainFromHtml(p.hs_meeting_body ?? "");
  return { kind: "note", text: cut(body ? `${head}\n${body}` : head), at, by };
}

/** What became of one deal. */
export type HsOutcome =
  | { id: string; result: "in"; customer: string; lines: number }
  | { id: string; result: "already" }
  | { id: string; result: "skipped" }
  | { id: string; result: "failed"; why: string };

/** The run so far, in a line. */
export function hubspotProgress(o: { done: number; total: number; already: number; failed: number; skipped: number }): string {
  const parts = [`${o.done} of ${o.total} deal${o.total === 1 ? "" : "s"} in`];
  if (o.already) parts.push(`${o.already} already here`);
  if (o.skipped) parts.push(`${o.skipped} left in HubSpot`);
  if (o.failed) parts.push(`${o.failed} couldn't come across`);
  return parts.join(" · ");
}
