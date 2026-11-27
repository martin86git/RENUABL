/**
 * Pages put aside (26 Nov 2026, Martin: "i think we could add the ability to minimise other pages too", as Sol's panel,
 * the designer and the voice agent's window minimise). A page minimised is kept as a chip at the foot of the screen, with
 * where it was scrolled to, and the person goes back to where they were before it; pressing the chip opens it again
 * where they left it. Kept for the tab only. Pure, tested.
 */

export interface MinimisedPage {
  /** The page's address, query included. */
  href: string;
  /** What the chip says: the page's own heading, else its name in the menu. */
  title: string;
  /** Where it was scrolled to. */
  scrollY: number;
}

/** The most kept at once; the oldest goes first. */
export const MAX_MINIMISED = 8;
export const MINIMISED_KEY = "renuabl.design.minimised";

/** Today is where a person lands; it isn't put aside. */
export const mayMinimise = (path: string) => path.startsWith("/design/") && !path.startsWith("/design/roof");

const pathOf = (href: string) => href.split(/[?#]/)[0];

/** The list with this page put aside: newest last, the same page only once, never past the most. */
export function withMinimised(list: readonly MinimisedPage[], page: MinimisedPage): MinimisedPage[] {
  const rest = list.filter((p) => pathOf(p.href) !== pathOf(page.href));
  return [...rest, page].slice(-MAX_MINIMISED);
}

/** The list without a page (opened again, or closed). */
export const withoutMinimised = (list: readonly MinimisedPage[], href: string) => list.filter((p) => pathOf(p.href) !== pathOf(href));

/** A chip's words, cut short. */
export const chipTitle = (title: string) => {
  const t = title.replace(/\s+/g, " ").trim() || "Page";
  return t.length > 28 ? `${t.slice(0, 27).trimEnd()}…` : t;
};

/** As read back from the tab: only well-formed entries on our own pages. */
export function cleanMinimised(raw: unknown): MinimisedPage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((r) => {
      const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      if (typeof o.href !== "string" || !o.href.startsWith("/design/") || o.href.startsWith("//")) return [];
      const scrollY = typeof o.scrollY === "number" && Number.isFinite(o.scrollY) ? Math.max(0, Math.round(o.scrollY)) : 0;
      return [{ href: o.href.slice(0, 400), title: typeof o.title === "string" ? o.title.slice(0, 120) : "Page", scrollY }];
    })
    .slice(-MAX_MINIMISED);
}

/** Where to go once a page is put aside: the page before it, unless that was itself, else Today. */
export const afterMinimise = (current: string, previous: string | null) =>
  previous && pathOf(previous) !== pathOf(current) ? previous : "/design";

/**
 * The headings minimised pages sit under on the left, beside Sol's chats (26 Nov 2026, Martin: "minimize on the left
 * hand side under chat… headers only appear if somethings been minimized that correspond"). In order; a page under none
 * of them goes under Other.
 */
export const MINIMISED_GROUPS: readonly { label: string; starts: readonly string[] }[] = [
  { label: "Deals", starts: ["/design/deals", "/design/sales", "/design/calls"] },
  { label: "Customers", starts: ["/design/customers"] },
  { label: "Service", starts: ["/design/service"] },
  { label: "Installations", starts: ["/design/installations", "/design/procurement", "/design/jobs", "/design/inspections"] },
  { label: "Marketing", starts: ["/design/marketing"] },
  { label: "Marketplace", starts: ["/design/marketplace"] },
  { label: "Messages", starts: ["/design/messages", "/design/inbox", "/design/team", "/design/notifications"] },
  { label: "Calendar", starts: ["/design/calendar"] },
  { label: "Settings", starts: ["/design/settings", "/design/account"] },
];
const OTHER = "Other";

/** The heading a minimised page sits under. */
export function minimisedGroup(href: string): string {
  const path = pathOf(href);
  const hit = MINIMISED_GROUPS.find((g) => g.starts.some((s) => path === s || path.startsWith(`${s}/`)));
  return hit?.label ?? OTHER;
}

/** Minimised pages under their headings, in the headings' order, newest first in each; empty headings left out. */
export function groupMinimised(list: readonly MinimisedPage[]): { label: string; pages: MinimisedPage[] }[] {
  const order = [...MINIMISED_GROUPS.map((g) => g.label), OTHER];
  return order
    .map((label) => ({ label, pages: [...list].reverse().filter((p) => minimisedGroup(p.href) === label) }))
    .filter((g) => g.pages.length > 0);
}
