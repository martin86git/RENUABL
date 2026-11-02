/**
 * What kind of business an account is (1 Nov 2026, Martin: installers and electrical inspectors join RENUABL too, free;
 * an installer's login has no CRM or procurement, and an installer may use the design tool, which charges them by the
 * design job as anyone's does). A **retailer** sells, designs and runs the whole job: everything RENUABL has. An
 * **installer** installs for retailers: Today, its jobs, the design tool (a design job bought in packs, no user fee),
 * the Marketplace and its connections. An **inspector** inspects installations: Today, its inspections and its
 * connections. The kind is chosen when the business is named and decides the sections on show and, on the server,
 * which of the designer's addresses a member may use (`apiAllowed`, checked in requireMember). Pure, tested.
 */

export const BUSINESS_KINDS = [
  {
    kind: "retailer",
    label: "Solar retailer",
    about: "You sell and run the whole job: leads, designs, proposals, ordering and installation.",
    price: "From $29 a user a month, with a 14-day free trial.",
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
  inspector: [...COMMON_PAGES, "/design/inspections"],
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
  "sign-in",
  "view-as",
  "team",
  "updates",
  "feedback",
  "weather",
  "marketplace-launch",
  "standards",
  "connections",
];
const API: Record<Exclude<BusinessKind, "retailer">, readonly string[]> = {
  installer: [
    ...COMMON_API,
    "installer-jobs",
    "roof",
    "projects",
    "workspace",
    "price-list",
    "datasheets",
    "design-home",
    "import",
    "billing",
    "marketplace",
    "trade",
  ],
  inspector: [...COMMON_API],
};

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Whether a member of this kind may open this page. The front page is exact; the rest hold their sub-pages. */
export function pageAllowed(kind: BusinessKind, path: string): boolean {
  if (kind === "retailer") return true;
  if (path === "/design") return true;
  if (under(path, "/design/settings")) {
    const slug = path.split("/")[3];
    return !slug || SETTINGS[kind].includes(slug);
  }
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
