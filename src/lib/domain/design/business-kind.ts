/**
 * What kind of business an account is (1 Nov 2026, Martin: installers and electrical inspectors join RENUABL too, free;
 * an installer's login has no CRM or procurement, and an installer may use the design tool, which charges them by the
 * design job as anyone's does). A **retailer** sells, designs and runs the whole job: everything RENUABL has. An
 * **installer** installs for retailers: Today, its jobs, the design tool (a design job bought in packs, no user fee),
 * the Marketplace (bidding on job listings and trading equipment, never listing jobs of its own: it has no deals) and
 * its connections. An **inspector** inspects installations: Today, its inspections, the Marketplace's equipment trading
 * and its connections. The kind is chosen when the business is named and decides the sections on show and, on the server,
 * which of the designer's addresses a member may use (`apiAllowed`, checked in requireMember). Pure, tested.
 */
import { marketplaceOpen } from "./marketplace-launch";
import { FIRST_MONTH_CENTS, SEAT_MONTHLY_CENTS, dollars } from "./plans";

export const BUSINESS_KINDS = [
  {
    kind: "retailer",
    label: "Solar retailer",
    about: "You sell and run the whole job: leads, designs, proposals, ordering and installation.",
    // 5 Nov 2026, Martin: "From $29" read as the price; it is only the first month.
    price: `${dollars(SEAT_MONTHLY_CENTS)} a user a month. Your first month, ${dollars(FIRST_MONTH_CENTS)} a user. Cancel any time.`,
  },
  {
    kind: "installer",
    label: "Installer",
    about: "You install for retailers. Get their jobs, win work on the Marketplace, and use the design tool when you need it.",
    price: "Free to join. Design jobs are $3 each, bought in packs.",
  },
  {
    kind: "inspector",
    label: "Electrical inspector",
    about: "You inspect solar and battery installations. Installers send you their jobs, with the design and their photos.",
    price: "Free to join.",
  },
] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number]["kind"];

/** A kind as sent or as saved; anything else is a retailer (every business made before kinds existed). */
export const cleanKind = (raw: unknown): BusinessKind => (raw === "installer" || raw === "inspector" ? raw : "retailer");

/** Installers and inspectors pay no user fee. */
export const joinsFree = (kind: BusinessKind) => kind !== "retailer";

/** The kind in words, for the account and the directory. */
export const kindLabel = (kind: BusinessKind) => BUSINESS_KINDS.find((k) => k.kind === kind)!.label;

// What each kind may open. A retailer may open everything; the lists are for the other two.
const COMMON_PAGES = [
  "/design",
  "/design/account",
  "/design/team",
  "/design/updates",
  "/design/feedback",
  "/design/terms",
  "/design/sign-in",
  "/design/welcome",
  "/design/connections",
];
const PAGES: Record<Exclude<BusinessKind, "retailer">, readonly string[]> = {
  installer: [...COMMON_PAGES, "/design/jobs", "/design/roof", "/design/marketplace"],
  inspector: [...COMMON_PAGES, "/design/inspections", "/design/marketplace/equipment", "/design/marketplace/watching"],
};
/** Pages under those above that a kind still doesn't have: an installer lists no jobs (it has no deals to list). */
const NOT_PAGES: Record<Exclude<BusinessKind, "retailer">, readonly string[]> = {
  installer: ["/design/marketplace/mine"],
  inspector: [],
};

/** Settings each kind has (by slug, settings-list.ts). */
const SETTINGS: Record<Exclude<BusinessKind, "retailer">, readonly string[]> = {
  installer: ["price-lists", "datasheets", "parts", "installation-rates", "margin", "standards", "users", "billing"],
  inspector: ["standards", "users"],
};

// The designer's API, by its first part after /api/design/. Account, people and the team are everyone's.
const COMMON_API = [
  "me",
  "business",
  "members",
  "password",
  "profile",
  "sign-in",
  "view-as",
  "team",
  "updates",
  "feedback",
  "weather",
  "calendar",
  "marketplace-launch",
  "standards",
  "connections",
  "base",
];
const API: Record<Exclude<BusinessKind, "retailer">, readonly string[]> = {
  installer: [
    ...COMMON_API,
    "installer-jobs",
    "inspections",
    "roof",
    "projects",
    "workspace",
    "price-list",
    "datasheets",
    "design-home",
    // The design tool's own helpers: Ask Sol to change it, a bill or switchboard photo, and designing live with the customer.
    "command",
    "bill",
    "switchboard",
    "live",
    "import",
    "billing",
    "marketplace",
    "trade",
  ],
  inspector: [...COMMON_API, "inspections", "trade"],
};

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Whether a member of this kind may open this page. The front page is exact; the rest hold their sub-pages. */
export function pageAllowed(kind: BusinessKind, path: string): boolean {
  if (kind === "retailer") return true;
  if (path === "/design") return true;
  if (under(path, "/design/settings")) {
    const slug = path.split("/")[3];
    // View as is open to every kind: it shows nothing but to RENUABL staff (staff-view.ts).
    return !slug || slug === "view-as" || SETTINGS[kind].includes(slug);
  }
  // The Marketplace's own address is its launch page while it is closed, for everyone; once open, an inspector's
  // Marketplace starts at its equipment.
  if (path === "/design/marketplace" && kind === "inspector") return !marketplaceOpen();
  if (NOT_PAGES[kind].some((p) => under(path, p))) return false;
  return PAGES[kind].some((p) => p !== "/design" && under(path, p));
}

/** Whether a member of this kind may use this address of the designer's API (/api/design/<area>/…). */
export function apiAllowed(kind: BusinessKind, path: string): boolean {
  if (kind === "retailer") return true;
  const area = path.match(/^\/api\/design\/([^/?#]+)/)?.[1];
  return Boolean(area && API[kind].includes(area));
}

/** Settings a kind has, by slug; null for a retailer (every one). */
export const settingsFor = (kind: BusinessKind): readonly string[] | null => (kind === "retailer" ? null : SETTINGS[kind]);

/** The header the proxy sets on every /api/design request with the address asked for (it replaces any sent). */
export const PATH_HEADER = "x-renuabl-design-path";

/** What a member is told when their kind of business doesn't use something. */
export const KIND_REFUSAL = "That isn't part of your RENUABL account.";

/**
 * What a kind's Billing holds (2 Nov 2026): a retailer has its plan (users, trial, Stripe's page for the card and
 * cancelling), Sol credits and design-job packs; an installer, which pays no user fee and has no Sol, only design-job
 * packs; an inspector nothing (it has no Billing). Read by the Billing page and enforced by its route and sign-up.
 */
export type BillingPart = "plan" | "sol" | "packs";
const BILLING: Record<BusinessKind, readonly BillingPart[]> = {
  retailer: ["plan", "sol", "packs"],
  installer: ["packs"],
  inspector: [],
};
export const billingParts = (kind: BusinessKind): readonly BillingPart[] => BILLING[kind];
export const billsFor = (kind: BusinessKind, part: BillingPart) => BILLING[kind].includes(part);

/** Said when a business that pays no user fee (an installer or inspector) tries to start a plan. */
export const NO_PLAN_FOR_KIND =
  "Your business joined RENUABL free, so there's no plan to sign up for. Buy design jobs under Settings, Billing.";

/** How many businesses there are of each kind, every kind listed (staff's list on /admin). */
export function countByKind(businesses: readonly { kind: BusinessKind }[]): Record<BusinessKind, number> {
  const counts = Object.fromEntries(BUSINESS_KINDS.map((k) => [k.kind, 0])) as Record<BusinessKind, number>;
  for (const b of businesses) counts[b.kind] += 1;
  return counts;
}

/** A plan that has stopped: as good as none, so the business is asked to choose one again. */
const ENDED = new Set(["canceled", "incomplete_expired"]);

/**
 * Whether signing in should stop at choosing a plan and paying (5 Nov 2026, Martin: a new retailer named the business
 * and went straight in, never shown the pricing or asked for a card). Only a retailer pays a user fee, only its owner
 * chooses the plan, and never one with a plan that hasn't ended. RENUABL's own business and the sample businesses
 * staff look through are left out by the caller.
 */
export function needsPlan(kind: BusinessKind, role: string, planStatus: string | null): boolean {
  return billsFor(kind, "plan") && role === "owner" && (planStatus === null || ENDED.has(planStatus));
}
