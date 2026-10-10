/**
 * Accounts for the roof designer: a business (a solar installer or retailer)
 * and the people in it who sign in. Pure: what a member may do, what a
 * business is called, the terms they accept, and the checks on everything a
 * browser sends before the server keeps it. These businesses are the
 * designer's own customers, not RENUABL's installation partners.
 */
import { DEFAULT_WORKSPACE, cleanWorkspace, type SupplierList, type Workspace } from "./pricing";
import { cleanExtras, defaultBill, postcodeIn, type DesignExtras } from "./quote";
import { cleanDesignSet, packDesignSet } from "./roof-design";

// ---------------------------------------------------------------------------
// Members and what they may do
// ---------------------------------------------------------------------------

export type MemberRole = "owner" | "member";

/** The things a member's role is checked for. */
export type MemberAction = "design" | "prices" | "members";

/**
 * Who may do what, in one place. Today every member designs and sees and sets
 * prices and margin, and only the owner adds or removes people. A role that
 * can't see costs is one more line here.
 */
const ALLOWED: Record<MemberRole, readonly MemberAction[]> = {
  owner: ["design", "prices", "members"],
  member: ["design", "prices"],
};

export function can(role: MemberRole, action: MemberAction): boolean {
  return ALLOWED[role]?.includes(action) ?? false;
}

/** The most people in one business, for now. */
export const MAX_MEMBERS = 25;

/** A business's name as typed: trimmed, on one line, 2 to 80 characters. Null when it isn't a name. */
export function cleanBusinessName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name.length >= 2 && name.length <= 80 ? name : null;
}

export const BUSINESS_NAME_MISSING = "Enter your business's name (2 to 80 characters).";

// ---------------------------------------------------------------------------
// The terms a member accepts
// ---------------------------------------------------------------------------

/**
 * The wording a member ticks before their work is kept on our servers. Bump
 * the version whenever the wording or the terms page changes: the version and
 * the server's time are saved with each acceptance as the record.
 */
export const BUSINESS_TERMS_VERSION = "2026-10-10-draft";
export const BUSINESS_TERMS_PATH = "/design/terms";
export const BUSINESS_TERMS_MISSING = "Please tick the box to accept the roof designer's terms.";
/** Shown on the terms page until a lawyer has reviewed it. */
export const BUSINESS_TERMS_DRAFT_NOTE =
  "Draft for legal review. This wording is a placeholder written for development: it has not been reviewed by a lawyer and must be replaced before the roof designer is offered to businesses.";

/** The terms page, section by section. DRAFT PLACEHOLDER TEXT: every paragraph is for legal review. */
export const BUSINESS_TERMS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "What the roof designer is",
    paragraphs: [
      "The roof designer is a tool for solar installers and retailers to lay out panels on a roof and build a quote from their own prices. It is a design aid: its output figures, string checks and quotes are estimates worked out from what you enter, and they don't replace a site inspection, your own design check or the manufacturer's sizing tools.",
    ],
  },
  {
    heading: "Your account",
    paragraphs: [
      "You sign in with a one-time link sent to your email. The person who sets up a business is its owner and may add or remove other people. Everyone in a business can see and change its designs, price lists, rates and margin.",
    ],
  },
  {
    heading: "What we keep",
    paragraphs: [
      "When you are signed in, we keep your business's name, the email addresses of its members, your price lists and settings, and each roof you design with its address. This is kept for your business only: other businesses can't see it.",
      "The addresses you enter may be your own customers' homes. You are responsible for having the right to enter them.",
    ],
  },
  {
    heading: "Your prices and your quotes",
    paragraphs: [
      "The prices, rates and margin are yours. You are responsible for every quote you give a customer, and for checking it before you rely on it.",
    ],
  },
  {
    heading: "Leaving",
    paragraphs: ["You can ask us to delete your business's account and everything kept for it at any time."],
  },
];

/** The server's reading of the tick: only an explicit true counts. */
export function readTermsTick(raw: unknown): boolean {
  return raw === true;
}

// ---------------------------------------------------------------------------
// Roofs: what a browser sends, checked before it is kept
// ---------------------------------------------------------------------------

export interface RoofPlace {
  address: string;
  lat: number;
  lng: number;
}

/** One roof for one business: the same rounding the designer has always used to tell two roofs apart (about a metre). */
export function roofKey(roof: Pick<RoofPlace, "lat" | "lng">): string {
  return `${roof.lat.toFixed(5)},${roof.lng.toFixed(5)}`;
}

const coordinate = (v: unknown, limit: number) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit ? v : null);

/** Where a roof is, as sent. Null when it isn't a place on the map. */
export function cleanRoofPlace(raw: unknown): RoofPlace | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lat = coordinate(r.lat, 90);
  const lng = coordinate(r.lng, 180);
  if (lat === null || lng === null) return null;
  const address = typeof r.address === "string" ? r.address.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  return { address, lat, lng };
}

/** The largest roof (its designs, bill and quotes) taken in one request, in characters. */
export const MAX_PROJECT_BYTES = 1_500_000;
/** The largest price list or batch of device work taken in one request: under the host's own limit on a request's size. */
export const MAX_LIST_BYTES = 3_500_000;

/** What someone is told when their save lost to a newer one. */
export const PROJECT_CONFLICT =
  "This roof was changed somewhere else since you opened it (another tab, or someone in your business). Reload the page to see the latest before saving.";

/** A roof's work as it is kept: the designs packed the way the designer saves them, and the bill and quotes. */
export interface RoofWork {
  design: Record<string, unknown>;
  extras: DesignExtras;
}

/**
 * A roof's designs, bill and quotes as sent by a browser, put through the
 * designer's own checks. The designs always sit at the roof's own place on
 * the map, whatever was sent. Null when there's no design to read.
 */
export function cleanRoofWork(roof: RoofPlace, design: unknown, extras: unknown): RoofWork | null {
  if (!design || typeof design !== "object") return null;
  const set = cleanDesignSet({ ...design, lat: roof.lat, lng: roof.lng });
  if (!set) return null;
  const defaults = { bill: defaultBill(DEFAULT_WORKSPACE.settings.bill), postcode: postcodeIn(roof.address) };
  return { design: packDesignSet(set), extras: cleanExtras(extras, set.designs.length, defaults) };
}

// ---------------------------------------------------------------------------
// Settings and price lists: kept and sent apart, since a list can be thousands of rows
// ---------------------------------------------------------------------------

/** A business's settings without its price lists: the part that changes with every figure typed. */
export type WorkspaceSettings = Omit<Workspace, "lists">;

export function cleanWorkspaceSettings(raw: unknown): WorkspaceSettings {
  const { components, install, settings } = cleanWorkspace({ ...(raw && typeof raw === "object" ? raw : {}), lists: [] });
  return { components, install, settings };
}

/** One supplier price list as sent. Null when it has no name or no priced rows. */
export function cleanSupplierList(raw: unknown): SupplierList | null {
  const list = cleanWorkspace({ lists: [raw] }).lists[0];
  return list && list.items.length ? list : null;
}

// ---------------------------------------------------------------------------
// Bringing a device's work into an account, once
// ---------------------------------------------------------------------------

/** The most roofs brought across from one device. */
export const MAX_IMPORT_ROOFS = 100;
/** The most roofs one business keeps, for now. */
export const MAX_PROJECTS = 5000;

export interface ImportRoof extends RoofPlace, RoofWork {}

/** The roofs a device sends to bring across: each checked like any other save, unreadable ones left out, one per roof. */
export function cleanImportRoofs(raw: unknown): ImportRoof[] {
  const seen = new Set<string>();
  const out: ImportRoof[] = [];
  for (const entry of Array.isArray(raw) ? raw.slice(0, MAX_IMPORT_ROOFS) : []) {
    const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const roof = cleanRoofPlace(e);
    const work = roof && cleanRoofWork(roof, e.design, e.extras);
    if (!roof || !work || seen.has(roofKey(roof))) continue;
    seen.add(roofKey(roof));
    out.push({ ...roof, ...work });
  }
  return out;
}
