import type { Heat } from "./deal-heat";
import { STAGE_LABELS, type JobStage } from "./crm";
import { askNeedWords, type AskType, type DealLine } from "./deal-team";

/**
 * The deal feed on Today (6 Nov 2026, Martin: Sol runs the deals, the feed is the controls, and the owner's judgement
 * decides where to step in; "a hybrid of an email and a social feed"). One card a deal, rising to the top whenever
 * something happens on it (a customer writes, a proposal is opened, Sol sends or lines up an email, the deal moves),
 * each showing what is there without going anywhere: the roof, the system and price, where it stands, how warm it is,
 * the latest of the conversation and what Sol does next. Built from the business's own record only.
 */
export type FeedEventKind = "message" | "reply" | "email" | "opened" | "call" | "note" | "proposal" | "stage" | "sol";

export interface FeedEvent {
  kind: FeedEventKind;
  text: string;
  /** ISO time. */
  at: string;
  /** Who: the customer's first name, a member's handle, or "Sol". */
  by?: string;
}

export interface FeedDeal {
  jobId: string;
  customer: string;
  suburb: string;
  title: string;
  stage: JobStage;
  value: number | null;
  kw: number | null;
  batteryKwh: number | null;
  /** The roof design's id, once there is one. */
  projectId: string | null;
  /** A made-up deal (the examples), drawn with an illustrated roof. */
  sample: boolean;
  createdAt: string;
  installDate: string | null;
  heat: Heat | null;
  /** Why it is that warm, strongest first. */
  heatWhy: string[];
  /** "12 days left", "3 days over". */
  clock: string | null;
  proposal: { opened: boolean } | null;
  /** Newest first. */
  events: FeedEvent[];
  /** What Sol has lined up on it, when anything. */
  sol: { subject: string; firesAt: string; held: boolean } | null;
  canCall: boolean;
  canEmail: boolean;
  /** The customer's phone as kept on their record, for the member to ring themselves. */
  phone: string | null;
  /** Where the home is, for the roof picture; null when it has no place on the map. */
  place: { lat: number; lng: number } | null;
  /** The deal's team chat (deal-team.ts): the pad's lines, oldest first, and the requests still waiting for a person. */
  team?: { lines: DealLine[]; openAsks: { id: string; type: AskType }[] };
}

export type FeedView = "needs" | "all" | "sol";

export const FEED_VIEWS: { id: FeedView; label: string }[] = [
  { id: "needs", label: "Needs you" },
  { id: "all", label: "All activity" },
  { id: "sol", label: "Sol's work" },
];

/** How many of the latest things on a deal its card shows. */
export const CARD_EVENTS = 3;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const first = (name: string) => name.trim().split(/\s+/)[0] || "They";

/** When something last happened on the deal: the card's place in the feed. */
export function lastAt(d: FeedDeal): string {
  return d.events[0]?.at ?? d.createdAt;
}

/** Why this deal needs a person now, in words, or null when Sol and the record have it in hand. */
export function needsYou(d: FeedDeal, now = new Date()): string | null {
  const latest = d.events[0];
  const name = first(d.customer);
  if (latest?.kind === "message") return `${name} is waiting on a reply`;
  // A request Sol left in the deal's team chat, still open.
  const ask = d.team?.openAsks[0];
  if (ask) return askNeedWords(ask);
  if (d.stage === "lead" && !d.events.some((e) => e.kind === "call" || e.kind === "email" || e.kind === "reply")) {
    const age = now.getTime() - Date.parse(d.createdAt);
    return age < 3 * DAY ? "New lead: nobody has been in touch yet" : "Lead with no contact yet";
  }
  if (d.heat === "hot" && !d.events.some((e) => e.kind === "call" && now.getTime() - Date.parse(e.at) < 3 * DAY))
    return "Hot: worth a call today";
  if (d.stage === "won" && !d.installDate) return "Sold: needs an install date";
  return null;
}

/** Where the deal is at, in one sentence, as Sol would say it. */
export function caption(d: FeedDeal, now = new Date()): string {
  const name = first(d.customer);
  const need = needsYou(d, now);
  if (need?.endsWith("waiting on a reply")) return `${name} asked something and hasn't heard back.`;
  const ask = d.team?.openAsks[0];
  if (ask) return ask.type === "design" ? "Sol has asked the team for a design." : "Sol has asked the team for a hand.";
  if (d.sol && !d.sol.held) return `Sol has a follow-up lined up${d.sol.subject ? `: "${d.sol.subject}"` : ""}.`;
  switch (d.stage) {
    case "lead":
      return d.projectId ? "Roof designed, no proposal sent yet." : "New lead. No roof design yet.";
    case "designed":
      return "Designed and priced. Ready to send a proposal.";
    case "proposal":
      if (d.heat === "hot") return `${name} is engaged with the proposal. Close to a decision.`;
      if (d.heat === "cold") return `Gone quiet on the proposal${d.clock ? ` (${d.clock})` : ""}.`;
      return d.proposal?.opened ? "Proposal opened. Waiting on a decision." : "Proposal sent, not opened yet.";
    case "won":
      return d.installDate ? "Signed. Install booked." : "Signed. Needs an install date.";
    default:
      return STAGE_LABELS[d.stage];
  }
}

/** The cards for a view, the most recent activity first. */
export function feedOf(deals: readonly FeedDeal[], view: FeedView, now = new Date()): FeedDeal[] {
  const shown = deals.filter((d) => (view === "needs" ? needsYou(d, now) !== null : view === "sol" ? d.sol !== null : true));
  return [...shown].sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
}

/** "4 min ago", "3 h ago", "Yesterday", "Tue", "4 Nov": how long ago, short. */
export function agoWords(iso: string, now = new Date()): string {
  const ms = now.getTime() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 60_000) return "Just now";
  if (ms < HOUR) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ago`;
  if (ms < 2 * DAY) return "Yesterday";
  const at = new Date(iso);
  if (ms < 6 * DAY) return at.toLocaleDateString("en-AU", { weekday: "short", timeZone: "Australia/Melbourne" });
  return at.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" });
}

/** The system in one line: "6.6 kW · 13.5 kWh battery · $14,890". */
export function systemLine(d: Pick<FeedDeal, "kw" | "batteryKwh" | "value">): string {
  return [
    d.kw ? `${d.kw.toFixed(1)} kW` : null,
    d.batteryKwh ? `${d.batteryKwh} kWh battery` : null,
    d.value ? `$${Math.round(d.value).toLocaleString("en-AU")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The suburb from an address: the part before the state and postcode. */
export function suburbOfAddress(address: string): string {
  const parts = address
    .split(",")
    .map((p) =>
      p
        .replace(/\b(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\b/gi, "")
        .replace(/\b\d{4}\b/g, "")
        .replace(/\bAustralia\b/gi, "")
        .trim(),
    )
    .filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : "";
}

/** The battery size typed on a deal ("13.5", "13.5 kWh", "16kWh"), as a number. */
export function batteryOf(details: Record<string, string>): number | null {
  const raw = details.batteryStorage || details.battery || "";
  const m = /(\d+(?:\.\d+)?)\s*kwh/i.exec(raw) ?? /^\s*(\d+(?:\.\d+)?)\s*$/.exec(raw);
  return m ? Number(m[1]) : null;
}
