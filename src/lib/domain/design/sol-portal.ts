/**
 * Sol opening a network's pre-approval portal (26 Nov 2026, Martin: "how can i have sol open up for me a pre approval
 * portal, so i can quickly get underway. it would be amazing if it could open it as a window inside of renuabl").
 *
 * The networks' portals refuse to be shown inside another site (each answers with X-Frame-Options, read 26 Nov 2026),
 * so the portal opens as a window of its own beside RENUABL, and a card under Sol's answer keeps the deal's details
 * (NMI, address, the system) to copy across. Sol names a network from the fixed list, or a deal whose network is read
 * from its NMI or address; the address opened is always ours (networks.ts), never one he writes. Pure, tested.
 */
import { VIC_DISTRIBUTORS, distributorNamed, type Distributor } from "./networks";
import type { PreApprovalChange } from "./preapproval";

/** One line of the deal to copy into the portal. */
export interface PortalFact {
  label: string;
  value: string;
}

/** What is kept on Sol's turn: the network by its id, and the deal's lines when he opened it for a deal. */
export interface SolPortal {
  network: string;
  /** The deal it was opened for, to link back to. */
  jobId?: string;
  /** Who the deal is for, as the card's heading. */
  customer?: string;
  /** The network was read from the postcode alone: the NMI settles it. */
  guessed?: boolean;
  facts: PortalFact[];
  /**
   * What Sol took from the member's own words (an NMI, that it was submitted, a reference, an export limit): shown filled
   * in on the card and saved only on their press (preapproval.ts). Cleaned where the turn is (sol.ts).
   */
  suggest?: PreApprovalChange;
}

export const PORTAL_LIMITS = { facts: 16, label: 40, value: 160, customer: 80 } as const;

const JOB_ID = /^[A-Za-z0-9_-]{1,64}$/;
const line = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** The network a tool input names: its id, or any usual spelling of its name. */
export function networkNamed(v: unknown): Distributor | null {
  const t = line(v, 60);
  if (!t) return null;
  return VIC_DISTRIBUTORS.find((d) => d.id === t.toLowerCase()) ?? distributorNamed(t);
}

/** What the card opens for a network: its portal when we know one, else its own site. */
export function portalOf(networkId: string): { network: string; name: string; url: string; known: boolean } | null {
  const d = VIC_DISTRIBUTORS.find((x) => x.id === networkId);
  if (!d) return null;
  return d.portal
    ? { network: d.name, name: d.portal.name, url: d.portal.url, known: true }
    : { network: d.name, name: `${d.name}'s website`, url: d.url, known: false };
}

/** What the deal knows, as the card's lines: only those with something in them, in the order a portal asks. */
export function portalFacts(deal: {
  customer?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  kw?: number | null;
  details: Record<string, string | null | undefined>;
}): PortalFact[] {
  const d = deal.details;
  const count = (qty: string | null | undefined, what: string | null | undefined) =>
    what ? (qty && qty !== "1" ? `${qty} × ${what}` : what) : "";
  const rows: [string, string | null | undefined][] = [
    ["NMI", d.nmi],
    ["Customer", deal.customer],
    ["Site address", deal.address],
    ["Phone", deal.phone],
    ["Email", deal.email],
    ["Meter number", d.meterNo],
    ["Electricity retailer", d.retailer],
    ["Phases", d.phases],
    ["System", d.systemType],
    ["Solar size", d.systemSize || (deal.kw ? `${deal.kw.toFixed(2)} kW` : "")],
    ["Panels", count(d.panelQty, d.panel)],
    ["Inverter", count(d.inverterQty, d.inverter)],
    ["Second inverter", d.additionalInverter],
    ["Inverter capacity", d.inverterCapacity],
    ["Battery", count(d.batteryQty, d.battery)],
    ["Battery storage", d.batteryStorage],
    ["EV charger", d.evCharger],
  ];
  return rows
    .map(([label, value]) => ({ label, value: line(value, PORTAL_LIMITS.value) }))
    .filter((f) => f.value)
    .slice(0, PORTAL_LIMITS.facts);
}

/** A portal on a kept turn, checked again: a network of ours, and tidy lines. Null when it isn't one. */
export function cleanPortal(raw: unknown): SolPortal | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const network = line(r.network, 40);
  if (!portalOf(network)) return null;
  const jobId = line(r.jobId, 64);
  const customer = line(r.customer, PORTAL_LIMITS.customer);
  const facts = (Array.isArray(r.facts) ? r.facts : [])
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === "object")
    .map((f) => ({ label: line(f.label, PORTAL_LIMITS.label), value: line(f.value, PORTAL_LIMITS.value) }))
    .filter((f) => f.label && f.value)
    .slice(0, PORTAL_LIMITS.facts);
  return {
    network,
    ...(JOB_ID.test(jobId) ? { jobId } : {}),
    ...(customer ? { customer } : {}),
    ...(r.guessed === true ? { guessed: true as const } : {}),
    facts,
  };
}

/** The networks Sol may name, for the tool's description. */
export const networksForSol = (): string => VIC_DISTRIBUTORS.map((d) => `${d.id} (${d.name})`).join(", ");

/** What Sol is told once the card is up. */
export function portalNote(p: SolPortal): string {
  const o = portalOf(p.network)!;
  const what = o.known ? `${o.network}'s pre-approval portal (${o.name})` : `${o.network}'s website (we don't hold its portal's address)`;
  return [
    `A card is now under your answer with a button that opens ${what} in a window of its own beside RENUABL${p.facts.length ? `, and the deal's details ready to copy across (${p.facts.map((f) => f.label).join(", ")})` : ""}.`,
    p.guessed ? "The network was read from the postcode, which is a guess near a boundary: say to check the NMI on the bill." : "",
    p.jobId && !p.facts.some((f) => f.label === "NMI") && !p.suggest?.nmi
      ? "The deal has no NMI yet: say so, the card has a box for it and the portal will ask for it."
      : "",
    p.jobId
      ? "The card also records where the application stands (submitted with its reference, approved, export limited, declined) on the deal."
      : "",
    p.suggest ? "What they told you is filled in on the card, saved when they press Save: say so, and never say it is saved." : "",
    "Say so in one or two short sentences. Don't repeat the details or the address in your words, and never say you can't open the portal.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * The portal's own window: down the right of the screen, RENUABL staying in view on the left. `popup` asks the browser
 * for a window, not a tab; nothing of RENUABL is handed to the portal (no opener, no referrer).
 */
export function portalWindow(screen: { width: number; height: number; left?: number; top?: number }): string {
  const width = Math.round(Math.min(960, Math.max(480, screen.width * 0.46)));
  const height = Math.round(Math.max(480, screen.height));
  const left = Math.round((screen.left ?? 0) + Math.max(0, screen.width - width));
  const top = Math.round(screen.top ?? 0);
  return `popup=yes,noopener,noreferrer,width=${width},height=${height},left=${left},top=${top}`;
}
