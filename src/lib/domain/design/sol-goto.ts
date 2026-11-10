/**
 * Sol taking a member to a page (5 Nov 2026, Martin, as Primero's: "take me to the ordering station", "open Casey's
 * deal", "show me the design"). He names a place from a fixed list (`open_page`); the server builds the address here,
 * checks a deal is one the member may see and that the page is part of their business's kind, and keeps it on his
 * turn; the chat then goes there as the answer comes in. Only RENUABL's own pages, never an address he writes himself.
 * Pure, tested.
 */
import { SETTINGS, settingsPath } from "@/components/design/settings-list";
import { SECTIONS } from "./sections";

/** A page Sol opened, kept on his turn. `design`: it is the designer, which opens as the drawer over the page. */
export interface SolGoTo {
  path: string;
  label: string;
  design?: true;
}

/** A place with no deal in it. */
export interface SolPlace {
  key: string;
  label: string;
  path: string;
}

/** The places of the product besides the sections' own pages: the round icons, Sol, the account. */
const EXTRA_PLACES: readonly SolPlace[] = [
  // Pages folded into Jobs (10 Nov 2026), still pages of their own that Sol can open.
  { key: "deals", label: "Deals board", path: "/design/sales/pipelines" },
  { key: "preapproval", label: "Pre-approvals", path: "/design/procurement/pre-approvals" },
  { key: "solarvic", label: "Solar Victoria", path: "/design/procurement/solar-victoria" },
  { key: "book", label: "Book an installation", path: "/design/procurement/book" },
  { key: "map", label: "Job map", path: "/design/procurement/map" },
  { key: "calendar", label: "Installations calendar", path: "/design/installations" },
  { key: "messages", label: "Messages", path: "/design/messages" },
  { key: "notifications", label: "Notifications", path: "/design/notifications" },
  { key: "inbox", label: "Email inbox", path: "/design/inbox" },
  { key: "team", label: "Team chat", path: "/design/team" },
  { key: "sol", label: "Sol's page", path: "/design/sol" },
  { key: "design-home", label: "the design tool", path: "/design/roof" },
  { key: "updates", label: "Updates", path: "/design/updates" },
  { key: "feedback", label: "Feedback", path: "/design/feedback" },
  { key: "account", label: "Your account", path: "/design/account" },
  { key: "settings", label: "Settings", path: "/design/settings" },
];

/** Every place without a deal: the sections' pages (each once), the extras, and every Settings page but staff ones. */
export const SOL_PLACES: readonly SolPlace[] = (() => {
  const out: SolPlace[] = [];
  const add = (p: SolPlace) => {
    if (!out.some((o) => o.key === p.key || o.path === p.path)) out.push(p);
  };
  for (const s of SECTIONS) for (const p of s.pages) add({ key: p.id, label: p.label, path: p.href });
  for (const p of EXTRA_PLACES) add(p);
  for (const g of SETTINGS)
    for (const i of g.items)
      if (!i.staff && !i.soon) add({ key: `settings:${i.slug}`, label: `Settings, ${i.label}`, path: settingsPath(i.slug) });
  return out;
})();

/** A deal's tabs that an address can open (the deal page's own `?tab=`). */
export const DEAL_TABS = ["overview", "activities", "email", "chat", "sol", "files"] as const;
export type DealTab = (typeof DEAL_TABS)[number];

/** The places that need a deal: its page (and a tab), its design in the designer, its proposal. */
export const DEAL_PLACES = ["deal", "design", "proposal"] as const;

const JOB_ID = /^[A-Za-z0-9_-]{1,64}$/;
const words = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** What Sol is told about the places, for the tool's description. */
export function placesForSol(): string {
  return [
    "deal: a deal's page (needs deal_id; tab may be one of " + DEAL_TABS.join(", ") + ")",
    "design: a deal's roof design in the designer (needs deal_id); with no deal, the design tool's home",
    "proposal: a deal's proposal screen (needs deal_id)",
    ...SOL_PLACES.map((p) => `${p.key}: ${p.label}`),
  ].join("\n");
}

/** The address a deal place is at. */
export function dealPath(place: (typeof DEAL_PLACES)[number], jobId: string, tab?: DealTab): string {
  const id = encodeURIComponent(jobId);
  if (place === "design") return `/design/roof?job=${id}`;
  if (place === "proposal") return `/design/deals/${id}/proposal`;
  return `/design/deals/${id}${tab && tab !== "overview" ? `?tab=${tab}` : ""}`;
}

/**
 * What Sol asked to open, worked out: the address, what to call it, and the deal it needs checking against (null for
 * a place with none), or why it can't be opened. The deal itself and the business's kind are checked on the server.
 */
export function solGoTo(raw: unknown): { ok: true; goTo: SolGoTo; jobId: string | null } | { ok: false; message: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const key = words(r.page, 60).toLowerCase();
  const label = words(r.label, 80);
  const dealId = words(r.deal_id, 64);
  if ((DEAL_PLACES as readonly string[]).includes(key)) {
    const place = key as (typeof DEAL_PLACES)[number];
    if (!dealId) {
      if (place === "design")
        return { ok: true, goTo: { path: "/design/roof", label: label || "the design tool", design: true }, jobId: null };
      return { ok: false, message: "Find the deal first (find_deal), then pass its id as deal_id." };
    }
    if (!JOB_ID.test(dealId)) return { ok: false, message: "That isn't a deal id: find the deal first (find_deal)." };
    const tab = (DEAL_TABS as readonly string[]).includes(words(r.tab, 20).toLowerCase())
      ? (words(r.tab, 20).toLowerCase() as DealTab)
      : undefined;
    const fallback = place === "design" ? "the design" : place === "proposal" ? "the proposal" : "the deal";
    return {
      ok: true,
      goTo: { path: dealPath(place, dealId, tab), label: label || fallback, ...(place === "design" ? { design: true as const } : {}) },
      jobId: dealId,
    };
  }
  const found = SOL_PLACES.find((p) => p.key === key);
  if (!found) return { ok: false, message: `There's no page called "${key || "(none)"}": use one of the pages listed.` };
  return {
    ok: true,
    goTo: { path: found.path, label: label || found.label, ...(found.key === "design-home" ? { design: true as const } : {}) },
    jobId: null,
  };
}

const DEAL_PATH = /^\/design\/deals\/([A-Za-z0-9_-]{1,64})(?:\/proposal|\?tab=([a-z]+))?$/;
const DESIGN_PATH = /^\/design\/roof\?job=([A-Za-z0-9_-]{1,64})$/;

/** Whether an address is one Sol may open: a listed place, or a deal place built as above. */
export function isSolPath(path: string): boolean {
  if (SOL_PLACES.some((p) => p.path === path)) return true;
  if (DESIGN_PATH.test(path)) return true;
  const m = DEAL_PATH.exec(path);
  return Boolean(m && (!m[2] || (DEAL_TABS as readonly string[]).includes(m[2])));
}

/** A page on a kept turn, checked again, or null. */
export function cleanGoTo(raw: unknown): SolGoTo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const path = typeof r.path === "string" ? r.path.trim() : "";
  if (!path || path.length > 200 || !isSolPath(path)) return null;
  const designer = path === "/design/roof" || DESIGN_PATH.test(path);
  return { path, label: words(r.label, 80) || "the page", ...(designer ? { design: true as const } : {}) };
}
