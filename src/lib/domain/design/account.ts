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

export type MemberRole = "owner" | "member" | "designer";

/**
 * The roles the owner gives others (1 Nov 2026, Martin: Primero's Designer role, so dedicated designers are fed every
 * deal waiting for a design). A **designer** opens every deal to design it, publishes its proposal and talks to its
 * customer, and lands on the design tool; they never change prices or settings. Whether they see costs is the owner's
 * "Sees costs and margin" as for anyone.
 */
export const ROLES: { role: Exclude<MemberRole, "owner">; label: string; about: string }[] = [
  { role: "member", label: "Member", about: "Works with customers and deals and designs roofs; the rest as set below." },
  {
    role: "designer",
    label: "Designer",
    about: "Opens every deal to design it, publishes its proposal and talks to its customer. Lands on the design tool. No settings.",
  },
];

/** A role as sent: only a designer or a member (the owner is never given or taken away). */
export const cleanRole = (raw: unknown): Exclude<MemberRole, "owner"> | null => (raw === "designer" || raw === "member" ? raw : null);

/** The things a member's role is checked for. */
export type MemberAction = "design" | "costs" | "prices" | "publish" | "members";

/**
 * What the owner can switch on or off for each other person in the business.
 * Everything else a member does (customers, deals, designing roofs) is open
 * to every member.
 */
export interface MemberPermissions {
  /** Sees what things cost the business: price lists, cost lines, margin, commission. */
  costs: boolean;
  /** Changes prices and settings: price lists, rates, margin, and the proposal's branding and terms. Needs `costs`. */
  prices: boolean;
  /** Publishes and withdraws proposals. */
  publish: boolean;
  /** Sees every deal. Without it, only the deals they own, those no one owns, and those they are mentioned on. */
  allDeals: boolean;
}

export const PERMISSIONS: { key: keyof MemberPermissions; label: string; about: string }[] = [
  {
    key: "costs",
    label: "Sees costs and margin",
    about: "Price lists, the quote's cost lines, margin and commission. Without it they design and see the customer's price only.",
  },
  {
    key: "prices",
    label: "Changes prices and settings",
    about: 'Price lists, rates and margin, and the proposal\'s branding, terms and blocks. Needs "Sees costs and margin".',
  },
  { key: "publish", label: "Publishes proposals", about: "Publishes a proposal to its private link, and takes one back." },
  {
    key: "allDeals",
    label: "Sees every deal",
    about: "Without it they see the deals they own, the deals no one owns yet, and any deal they are mentioned on.",
  },
];

/** What a member starts with: everything, as it was before permissions could be set. */
export const ALL_PERMISSIONS: MemberPermissions = { costs: true, prices: true, publish: true, allDeals: true };

/**
 * A member's permissions as sent or as saved: only an explicit false switches
 * one off, and someone who can't see costs can't change prices either (they
 * would be saving over figures they were never shown).
 */
export function cleanPermissions(raw: unknown): MemberPermissions {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const costs = r.costs !== false;
  return { costs, prices: costs && r.prices !== false, publish: r.publish !== false, allDeals: r.allDeals !== false };
}

/**
 * Who may do what, in one place, and the only place it is decided. The owner
 * may do everything, and only the owner adds or removes people or sets what
 * they may do. A member designs, and does the rest as their permissions say.
 */
export function can(role: MemberRole, action: MemberAction, permissions: MemberPermissions = ALL_PERMISSIONS): boolean {
  if (role === "owner") return true;
  if (role === "designer") {
    if (action === "design" || action === "publish") return true;
    return action === "costs" && cleanPermissions(permissions).costs;
  }
  if (role !== "member") return false;
  if (action === "design") return true;
  if (action === "members") return false;
  return cleanPermissions(permissions)[action];
}

/** What someone is told when they may not do something. */
export function refusal(action: MemberAction): string {
  if (action === "members") return "Only the owner of the business can do this.";
  if (action === "costs")
    return "You don't have access to costs and margin. The owner of the business can change that under Users and permissions.";
  if (action === "prices")
    return "You don't have access to change prices and settings. The owner of the business can change that under Users and permissions.";
  if (action === "publish")
    return "You don't have access to publish proposals. The owner of the business can change that under Users and permissions.";
  return "You can't do this.";
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

/** Whose deals someone sees: everyone's, or (`all` false) their own, no one's, and those they are mentioned on. */
export interface DealViewer {
  email: string;
  all: boolean;
}

/** Whether this member sees every deal: the owner always; a member unless the owner has switched it off. */
export function seesAllDeals(role: MemberRole, permissions: MemberPermissions = ALL_PERMISSIONS): boolean {
  return role === "owner" || role === "designer" || (role === "member" && cleanPermissions(permissions).allDeals);
}

/** Whether a viewer sees a deal, by its owner and whether they are mentioned on it. The server's queries say the same. */
export function seesDeal(viewer: DealViewer, owner: string | null, mentioned = false): boolean {
  return viewer.all || !owner || owner === viewer.email.toLowerCase() || mentioned;
}
