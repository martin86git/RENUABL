/**
 * The product's sections, as toggles across the top (31 Oct 2026, Martin: bring Primero's layout across: no bar down the
 * left; the sections in one pill across the middle of the top, the section on show's own pages as quiet toggles under
 * it, everything else as icons top right). One section is always on: the one holding the page you are on, else Today.
 * Pure, tested: which section and which of its pages an address lights.
 */

import type { BusinessKind } from "./business-kind";
import { marketplaceOpen } from "./marketplace-launch";

export interface SectionPage {
  id: string;
  label: string;
  href: string;
  /** Other addresses that are this page (a deal's own page belongs to Deals). */
  also?: readonly string[];
}

export interface Section {
  id: "today" | "work" | "customers" | "service" | "marketplace" | "jobs" | "inspections" | "connections";
  label: string;
  pages: readonly SectionPage[];
}

/** The Marketplace's pages once it opens; until then it is one page, the launch (marketplace-launch.ts). */
export const MARKETPLACE_PAGES: readonly SectionPage[] = [
  { id: "listings", label: "Job listings", href: "/design/marketplace" },
  { id: "my-listings", label: "My listings", href: "/design/marketplace/mine" },
  { id: "my-bids", label: "My bids", href: "/design/marketplace/bids" },
  // Equipment trading, named Buy & sell (2 Nov 2026, Martin).
  { id: "equipment", label: "Buy & sell", href: "/design/marketplace/equipment" },
  { id: "my-equipment", label: "My equipment", href: "/design/marketplace/equipment/mine" },
  // Jobs and equipment a person is watching (market-alerts.ts).
  { id: "watching", label: "Watching", href: "/design/marketplace/watching" },
  // Conversations between businesses on the Marketplace (2 Nov 2026, Martin).
  { id: "messages", label: "Messages", href: "/design/marketplace/messages" },
];

export const SECTIONS: readonly Section[] = [
  { id: "today", label: "Today", pages: [{ id: "home", label: "Today", href: "/design" }] },
  // CRM, Procurement and Installation folded into one, Jobs (10 Nov 2026, Martin): every job by where it is in its
  // life (jobs-view.ts). The pages they held are views and filters of it now, or the few pages of their own below.
  {
    id: "work",
    label: "Jobs",
    pages: [
      {
        id: "jobs",
        label: "Jobs",
        href: "/design/work",
        also: [
          "/design/deals",
          "/design/sales",
          "/design/procurement/pre-approvals",
          "/design/procurement/solar-victoria",
          "/design/procurement/book",
          "/design/procurement/map",
          "/design/procurement/scheduler",
          "/design/installations",
        ],
      },
      { id: "sent", label: "Proposals sent", href: "/design/sales/proposals" },
      { id: "signed", label: "Proposals signed", href: "/design/sales/signed" },
      { id: "orders", label: "Ordering station", href: "/design/procurement/orders" },
      { id: "invoices", label: "Installer invoices", href: "/design/installations/invoices" },
      // The call log (8 Nov 2026), a tab on Today until Today became one page (10 Nov 2026, Martin).
      { id: "calls", label: "Calls", href: "/design/calls" },
      // The installers and inspectors this retailer works with (connections.ts).
      { id: "connections", label: "Connections", href: "/design/connections" },
    ],
  },
  // People are looked up by name, not by job, so they keep a word of their own.
  { id: "customers", label: "Customers", pages: [{ id: "customers", label: "Customers", href: "/design/customers" }] },
  { id: "service", label: "Service", pages: [{ id: "service", label: "Service pipeline", href: "/design/service" }] },
  {
    id: "marketplace",
    label: "Marketplace",
    pages: marketplaceOpen() ? MARKETPLACE_PAGES : [{ id: "launch", label: "Coming soon", href: "/design/marketplace" }],
  },
];

const TODAY = SECTIONS[0];
const MARKETPLACE = SECTIONS.find((s) => s.id === "marketplace")!;
const MARKETPLACE_KEEP: Record<BusinessKind, (id: string) => boolean> = {
  retailer: () => true,
  installer: (id) => id === "listings" || id === "equipment" || id === "watching" || id === "messages",
  inspector: (id) => id === "equipment" || id === "my-equipment" || id === "watching" || id === "messages",
};
/**
 * The Marketplace's menu a kind has once it opens, open yet or not (3 Nov 2026, Martin: the launch page shows what it
 * will look like signed in, given each kind's access): an installer bids and trades but lists nothing; an inspector
 * trades.
 */
export const marketplacePagesFor = (kind: BusinessKind): readonly SectionPage[] =>
  MARKETPLACE_PAGES.filter((p) => MARKETPLACE_KEEP[kind](p.id));
const marketplaceFor = (kind: BusinessKind): Section =>
  marketplaceOpen() ? { ...MARKETPLACE, pages: marketplacePagesFor(kind) } : MARKETPLACE;
const CONNECTIONS: Section = {
  id: "connections",
  label: "Connections",
  pages: [{ id: "connections", label: "Connections", href: "/design/connections" }],
};

/**
 * An installer's home (2 Nov 2026, Martin: My Jobs / the designer / Marketplace): its jobs at /design, each job's card
 * under /design/jobs. Its connections are in the gear menu.
 */
const MY_JOBS: Section = {
  id: "jobs",
  label: "My Jobs",
  pages: [{ id: "jobs", label: "My Jobs", href: "/design", also: ["/design/jobs"] }],
};

/**
 * The sections each kind of business has (business-kind.ts): a retailer all of the above; an installer My Jobs and
 * the Marketplace (the design tool is the orange round between them, as for everyone who designs; Connections in the
 * gear menu), whose toggles are Job listings, Buy & sell and Messages (My bids and My equipment are links inside
 * them); an inspector its inspections, the Marketplace's Buy & sell and Messages, and its connections.
 */
export const KIND_SECTIONS: Record<BusinessKind, readonly Section[]> = {
  retailer: SECTIONS,
  installer: [MY_JOBS, marketplaceFor("installer")],
  inspector: [
    TODAY,
    { id: "inspections", label: "Inspections", pages: [{ id: "inspections", label: "Inspections", href: "/design/inspections" }] },
    marketplaceFor("inspector"),
    CONNECTIONS,
  ],
};

/** Whether this kind of business designs roofs (the design tool's round in the nav). */
export const designsRoofs = (kind: BusinessKind) => kind !== "inspector";

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/**
 * The page an address is: the one whose address (or one of its others) holds it most closely, so
 * /design/installations/completed is After install, not Installations. The overview itself only on its own address.
 */
export function pageAt(path: string, kind: BusinessKind = "retailer"): { section: Section; page: SectionPage } | null {
  let best: { section: Section; page: SectionPage; length: number } | null = null;
  for (const section of KIND_SECTIONS[kind])
    for (const page of section.pages)
      for (const href of [page.href, ...(page.also ?? [])]) {
        const hit = href === "/design" ? path === href : under(path, href);
        if (hit && (!best || href.length > best.length)) best = { section, page, length: href.length };
      }
  return best && { section: best.section, page: best.page };
}

/** The section on show: the one holding the page, else Today (messages, notifications, settings, the design tool). */
export const sectionAt = (path: string, kind: BusinessKind = "retailer"): Section => pageAt(path, kind)?.section ?? TODAY;
