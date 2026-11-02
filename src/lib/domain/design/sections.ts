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
  id: "today" | "crm" | "procurement" | "installation" | "service" | "marketplace" | "jobs" | "inspections" | "connections";
  label: string;
  pages: readonly SectionPage[];
}

/** The Marketplace's pages once it opens; until then it is one page, the launch (marketplace-launch.ts). */
export const MARKETPLACE_PAGES: readonly SectionPage[] = [
  { id: "listings", label: "Job listings", href: "/design/marketplace" },
  { id: "my-listings", label: "My listings", href: "/design/marketplace/mine" },
  { id: "my-bids", label: "My bids", href: "/design/marketplace/bids" },
  { id: "equipment", label: "Equipment", href: "/design/marketplace/equipment" },
  { id: "my-equipment", label: "My equipment", href: "/design/marketplace/equipment/mine" },
];

export const SECTIONS: readonly Section[] = [
  { id: "today", label: "Today", pages: [{ id: "home", label: "Today", href: "/design" }] },
  {
    id: "crm",
    label: "CRM",
    pages: [
      { id: "deals", label: "Deals", href: "/design/sales/pipelines", also: ["/design/deals", "/design/sales"] },
      { id: "customers", label: "Customers", href: "/design/customers" },
      { id: "sent", label: "Proposals sent", href: "/design/sales/proposals" },
      { id: "signed", label: "Proposals signed", href: "/design/sales/signed" },
    ],
  },
  {
    id: "procurement",
    label: "Procurement",
    pages: [
      { id: "preapproval", label: "Pre-approvals", href: "/design/procurement/pre-approvals" },
      { id: "solarvic", label: "Solar Victoria", href: "/design/procurement/solar-victoria" },
      { id: "book", label: "Book an installation", href: "/design/procurement/book" },
      { id: "orders", label: "Ordering station", href: "/design/procurement/orders" },
      { id: "map", label: "Job map", href: "/design/procurement/map" },
    ],
  },
  {
    id: "installation",
    label: "Installation",
    pages: [
      { id: "calendar", label: "Install calendar", href: "/design/procurement/scheduler" },
      { id: "upcoming", label: "Upcoming", href: "/design/installations" },
      { id: "works", label: "In the works", href: "/design/installations/underway" },
      { id: "completed", label: "Completed", href: "/design/installations/completed" },
      { id: "invoices", label: "Installer invoices", href: "/design/installations/invoices" },
      // The installers and inspectors this retailer works with (connections.ts).
      { id: "connections", label: "Connections", href: "/design/connections" },
    ],
  },
  { id: "service", label: "Service", pages: [{ id: "service", label: "Service pipeline", href: "/design/service" }] },
  {
    id: "marketplace",
    label: "Marketplace",
    pages: marketplaceOpen() ? MARKETPLACE_PAGES : [{ id: "launch", label: "Coming soon", href: "/design/marketplace" }],
  },
];

const TODAY = SECTIONS[0];
const MARKETPLACE = SECTIONS.find((s) => s.id === "marketplace")!;
/** A kind's Marketplace once open: an installer bids and trades but lists nothing; an inspector trades. */
const marketplaceFor = (keep: (id: string) => boolean): Section =>
  marketplaceOpen() ? { ...MARKETPLACE, pages: MARKETPLACE.pages.filter((p) => keep(p.id)) } : MARKETPLACE;
const CONNECTIONS: Section = {
  id: "connections",
  label: "Connections",
  pages: [{ id: "connections", label: "Connections", href: "/design/connections" }],
};

/**
 * The sections each kind of business has (business-kind.ts): a retailer all of the above; an installer its jobs, the
 * Marketplace and its connections (the design tool is the orange round, as for everyone who designs); an inspector its
 * inspections, the Marketplace's equipment and its connections.
 */
export const KIND_SECTIONS: Record<BusinessKind, readonly Section[]> = {
  retailer: SECTIONS,
  installer: [
    TODAY,
    { id: "jobs", label: "Jobs", pages: [{ id: "jobs", label: "Jobs", href: "/design/jobs" }] },
    marketplaceFor((id) => id !== "my-listings"),
    CONNECTIONS,
  ],
  inspector: [
    TODAY,
    { id: "inspections", label: "Inspections", pages: [{ id: "inspections", label: "Inspections", href: "/design/inspections" }] },
    marketplaceFor((id) => id === "equipment" || id === "my-equipment"),
    CONNECTIONS,
  ],
};

/** Whether this kind of business designs roofs (the design tool's round in the nav). */
export const designsRoofs = (kind: BusinessKind) => kind !== "inspector";

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/**
 * The page an address is: the one whose address (or one of its others) holds it most closely, so
 * /design/installations/underway is In the works, not Upcoming. The overview itself only on its own address.
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
