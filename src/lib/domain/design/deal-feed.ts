import type { Heat } from "./deal-heat";
import { countdownWords, type OutboxState } from "./sol-agents";
import { LAUNCH_MARKET, marketDateTime, todayInMarket } from "../market";
import { nextWorkingDay } from "./today-pad";
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
  /** The deal's address as kept on it, for the heading of its chat. */
  address?: string;
  /** Who owns the deal (a member's email), or null: for "Mine". */
  owner?: string | null;
  /** Where the customer came from ("Website", "Referral"), as kept on them. */
  source?: string;
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
  /**
   * What Sol has lined up on it, when anything: the outbox item, its words, when it goes and where it stands
   * (counting down while its agent is on; waiting for a press while it is off; held).
   */
  sol: {
    id?: string;
    subject: string;
    body?: string;
    to?: string;
    firesAt: string;
    readyAt?: string;
    held: boolean;
    state?: OutboxState;
  } | null;
  canCall: boolean;
  canEmail: boolean;
  /** The customer's phone as kept on their record, for the member to ring themselves. */
  phone: string | null;
  /** Where the home is, for the roof picture; null when it has no place on the map. */
  place: { lat: number; lng: number } | null;
  /** The deal's team chat (deal-team.ts): the pad's lines, oldest first, and the requests still waiting for a person. */
  team?: { lines: DealLine[]; openAsks: { id: string; type: AskType }[] };
  /** Done or Later, pressed on the card (FeedMark): it holds until something new happens on the deal. */
  mark?: FeedMark | null;
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
  if (markHolds(d, now)) return null;
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

/** What the card's lit button does. */
export type MoveKind = "reply" | "review" | "design" | "proposal" | "call" | "book" | "deal";

export interface NextMove {
  kind: MoveKind;
  /** The button's words: "Design the roof", "Review", "Call Alex". */
  label: string;
  /** Why, in a sentence, as Sol says it on the card. */
  why: string;
}

/**
 * The one thing to do on a deal now, or null when Sol and the record have it in hand (8 Nov 2026, Martin: four
 * buttons that all look the same don't say what to do; light the one that's needed). Most pressing first: a customer
 * waiting on a reply, something Sol has written to check, a design Sol asked for or a lead with no roof, a priced
 * design with no proposal, a lead nobody has spoken to or a hot deal not called lately, a sale with no install day.
 * By rule from the record, so it is free and instant.
 */
export function nextMove(d: FeedDeal, now = new Date()): NextMove | null {
  if (markHolds(d, now)) return null;
  const name = first(d.customer);
  if (d.events[0]?.kind === "message")
    return { kind: "reply", label: `Reply to ${name}`, why: `${name} asked something and is waiting on a reply.` };
  if (d.sol) {
    const state = d.sol.state ?? (d.sol.held ? "held" : "counting");
    const what = d.sol.subject ? `: "${d.sol.subject}"` : "";
    const why =
      state === "counting"
        ? `Sol has written to ${name}${what}. It goes ${countdownWords(d.sol.firesAt, now)} unless you change it.`
        : state === "held"
          ? `Sol's email to ${name} is held${what}. Yours to send.`
          : `Sol has written to ${name}${what}. It waits for you to send it.`;
    return { kind: "review", label: "Review", why };
  }
  const ask = d.team?.openAsks[0];
  if (ask?.type === "design" || (d.stage === "lead" && !d.projectId))
    return {
      kind: "design",
      label: d.projectId ? "Open the design" : "Design the roof",
      why: ask ? "Sol has asked for a design. The brief is in the deal's chat." : `New lead. ${name}'s roof isn't designed yet.`,
    };
  if (ask) return { kind: "deal", label: "See what Sol needs", why: `${askNeedWords(ask)}. It's in the deal's chat.` };
  if ((d.stage === "designed" || (d.stage === "lead" && d.projectId)) && !d.proposal)
    return { kind: "proposal", label: "Send the proposal", why: "Designed and priced. The proposal hasn't gone yet." };
  const called = d.events.some((e) => e.kind === "call" && now.getTime() - Date.parse(e.at) < 3 * DAY);
  if (d.stage === "lead" && !d.events.some((e) => e.kind === "call" || e.kind === "email" || e.kind === "reply"))
    return d.phone
      ? { kind: "call", label: `Call ${name}`, why: `Nobody has been in touch with ${name} yet.` }
      : { kind: "deal", label: "Get in touch", why: `Nobody has been in touch with ${name} yet, and there's no phone on file.` };
  if (d.heat === "hot" && !called && d.phone && OPEN.includes(d.stage))
    return { kind: "call", label: `Call ${name}`, why: `${name} is warm to it and hasn't had a call in three days.` };
  if (d.stage === "won" && !d.installDate) return { kind: "book", label: "Book the install", why: "Signed. It needs an installation day." };
  return null;
}

const OPEN: readonly JobStage[] = ["lead", "designed", "proposal"];

/** "All deals", or a pipeline's id (one of the set ones or one the business saved). */
export type FeedPipeline = string;

/**
 * The deals a person has chosen to see on the feed (8 Nov 2026, Martin: an admin sees every deal, so filter by
 * pipeline): those at a stage of the pipeline picked (every deal for "all", or for a pipeline no longer there), and
 * only their own when Mine is on.
 */
export function feedFilter(
  deals: readonly FeedDeal[],
  pick: { pipeline: FeedPipeline; stages: readonly JobStage[] | null; mine: boolean; me: string },
): FeedDeal[] {
  const me = pick.me.toLowerCase();
  return deals.filter(
    (d) =>
      (pick.pipeline === "all" || !pick.stages || pick.stages.includes(d.stage)) && (!pick.mine || (d.owner ?? "").toLowerCase() === me),
  );
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

/**
 * Done and Later on a card (9 Nov 2026, Martin: nothing on the feed felt finished; docs/plans/needs-you-sign-offs.md).
 * The deal isn't what is done, the thing it needs from you now is. **Done** takes it out of Needs you (it was handled
 * somewhere the record can't see: a call from your own phone, a word in the office); **Later** takes it out until a time
 * or until they reply. Either way it comes back the moment anything new happens on the deal, so clearing a card can
 * never bury a deal. One mark a deal, shared by the team, written on the deal's record.
 */
export type MarkKind = "done" | "later";
export type LaterChoice = "tomorrow" | "week" | "reply";
export interface FeedMark {
  kind: MarkKind;
  /** When Later runs out (ISO), or null: Done, or Later until they reply. */
  until: string | null;
  /** What it needed, in words, as it was cleared. */
  need: string;
  by: string;
  /** ISO time it was pressed. */
  at: string;
}

export const LATER_CHOICES: { id: LaterChoice; label: string }[] = [
  { id: "tomorrow", label: "Tomorrow 9am" },
  { id: "week", label: "Next week" },
  { id: "reply", label: "Until they reply" },
];

/** Whether the deal's mark still holds: nothing has happened on it since, and a Later hasn't run out. */
export function markHolds(d: Pick<FeedDeal, "mark" | "events" | "createdAt">, now = new Date()): boolean {
  const m = d.mark;
  if (!m) return false;
  if (m.at < lastAt(d as FeedDeal)) return false;
  return m.until === null || Date.parse(m.until) > now.getTime();
}

/** When a Later runs out, as an ISO time: 9am on the next working day, 9am next Monday, or never (until they reply). */
export function laterUntil(choice: LaterChoice, now = new Date()): string | null {
  if (choice === "reply") return null;
  const today = todayInMarket(now);
  if (choice === "tomorrow") return marketDateTime(nextWorkingDay(today), 9);
  // Next Monday (a week on, when today is Monday), at 9am, passing over a holiday.
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const ahead = (8 - weekday) % 7 || 7;
  const monday = new Date(Date.parse(`${today}T12:00:00Z`) + (ahead - 1) * DAY).toISOString().slice(0, 10);
  return marketDateTime(nextWorkingDay(monday as typeof today), 9);
}

/**
 * Whether a line on the record is one Done or Later wrote. It stays on the record but isn't news on the card: were it, a
 * Later pressed on "waiting on a reply" would make the reply look sent.
 */
export const isMarkLine = (text: string) => /^(Marked done|Put off) on Today[ :.]/.test(text.trim());

/** The line written on the deal's record when Done or Later is pressed. */
export function markRecordLine(kind: MarkKind, need: string, until: string | null): string {
  const what = need.trim() ? `: ${need.trim()}` : "";
  if (kind === "done") return `Marked done on Today${what}.`;
  if (!until) return `Put off on Today until they reply${what}.`;
  const when = new Date(until).toLocaleString("en-AU", {
    timeZone: LAUNCH_MARKET.timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    hourCycle: "h12",
  });
  return `Put off on Today until ${when}${what}.`;
}

/** What a held mark says on the card: "Done by Sam", "Back Tue 9am", "Back when they reply". */
export function markWords(m: FeedMark, now = new Date()): string {
  const who = m.by.split("@")[0] || "someone";
  if (m.kind === "done") return `Done by ${who}`;
  if (!m.until) return "Back when they reply";
  return `Back ${countdownWords(m.until, now)}`;
}

/** How a day's work reads beside All clear: "7 done today", "Sol sent 4". */
export interface DayDone {
  /** Things this member did on deals today: calls, emails, replies, proposals, moves, Done pressed. */
  mine: number;
  /** Emails and replies Sol sent today. */
  sol: number;
}
export function allClearWords(done: DayDone | null): string {
  if (!done) return "All clear.";
  const parts = [done.mine > 0 ? `${done.mine} done today` : null, done.sol > 0 ? `Sol sent ${done.sol}` : null].filter(Boolean);
  return parts.length ? `All clear. ${parts.join(". ")}.` : "All clear.";
}

/**
 * Today as one page (10 Nov 2026, Martin: no tabs; what needs me, what Sol is about to do, what's in hand, what's done).
 * **Needs you**: the deals a person must act on. **Coming up**: what Sol has lined up on the others, soonest first.
 * **In hand**: the rest, newest happening first.
 */
export interface TodayParts {
  /** Arrived in the last week, newest first (New in). */
  fresh: FeedDeal[];
  needs: FeedDeal[];
  coming: FeedDeal[];
  inHand: FeedDeal[];
}
export function todayParts(deals: readonly FeedDeal[], now = new Date()): TodayParts {
  const fresh = newIn(deals, now);
  const isFresh = new Set(fresh.map((d) => d.jobId));
  // A new arrival is in New in; it is also in Needs you only for something more than a first call (a customer waiting).
  const needs = feedOf(deals, "needs", now).filter((d) => !(isFresh.has(d.jobId) && onlyNeedsContact(d, now)));
  const needing = new Set(needs.map((d) => d.jobId));
  const rest = deals.filter((d) => !needing.has(d.jobId) && !isFresh.has(d.jobId));
  const coming = rest.filter((d) => d.sol).sort((a, b) => a.sol!.firesAt.localeCompare(b.sol!.firesAt));
  const inHand = feedOf(
    rest.filter((d) => !d.sol),
    "all",
    now,
  );
  return { fresh, needs, coming, inHand };
}

/** The open request of Sol's on the deal, as its line in the team chat (its words carry the brief), when there is one. */
export function openAskLine(d: Pick<FeedDeal, "team">): DealLine | null {
  const open = new Set(d.team?.openAsks.map((a) => a.id) ?? []);
  return d.team?.lines.find((l) => open.has(l.id)) ?? null;
}

/**
 * Sol's one line on a card (10 Nov 2026, Martin: a card said the same thing four times). An open request of his reads in
 * his own words (the brief); else why the next move is the next move; else what it needs; else where it is at.
 */
export function solLine(d: FeedDeal, now = new Date()): string {
  const ask = openAskLine(d);
  if (ask) return ask.text;
  return nextMove(d, now)?.why ?? needsYou(d, now) ?? caption(d, now);
}

/** The deal's team chat lines worth a pad of their own: not Sol's open request, which the card already says. */
export function padLines(d: Pick<FeedDeal, "team">): DealLine[] {
  const open = new Set(d.team?.openAsks.map((a) => a.id) ?? []);
  return (d.team?.lines ?? []).filter((l) => !open.has(l.id));
}

/** Sol's line at the top of Today: "2 need you. Sol emails Sam in 1h 52m. 3 done today, Sol sent 4." */
export function todaySummary(parts: TodayParts, done: DayDone | null, now = new Date()): string {
  const n = parts.needs.length;
  const first = n === 0 ? "Nothing needs you right now." : `${n === 1 ? "One deal needs" : `${n} deals need`} you.`;
  const fresh = parts.fresh.filter((d) => onlyNeedsContact(d, now)).length;
  const toContact = fresh ? `${fresh === 1 ? "One new lead" : `${fresh} new leads`} to get in touch with.` : null;
  const next = parts.coming.find((d) => d.sol && (d.sol.state ?? (d.sol.held ? "held" : "counting")) === "counting");
  const coming = next?.sol ? `I email ${first_(next.customer)} ${countdownWords(next.sol.firesAt, now)}.` : null;
  const did = [done && done.mine > 0 ? `${done.mine} done by you today` : null, done && done.sol > 0 ? `I sent ${done.sol}` : null]
    .filter(Boolean)
    .join(", ");
  return [toContact, first, coming, did ? `${did[0].toUpperCase()}${did.slice(1)}.` : null].filter(Boolean).join(" ");
}
const first_ = (name: string) => name.trim().split(/\s+/)[0] || "them";

/**
 * New in (10 Nov 2026, Martin: with the CRM folded away you couldn't see the flow of new people coming in): every deal
 * that arrived in the last `NEW_IN_DAYS`, newest first, at the top of Today. A lead nobody has been in touch with is
 * shown here with its button, and so isn't in Needs you as well.
 */
export const NEW_IN_DAYS = 7;
export function newIn(deals: readonly FeedDeal[], now = new Date()): FeedDeal[] {
  const from = now.getTime() - NEW_IN_DAYS * DAY;
  // New leads only (12 Nov 2026, Martin): a deal already won has left New in, whenever it arrived.
  return deals
    .filter((d) => OPEN.includes(d.stage) && Date.parse(d.createdAt) >= from)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Whether anyone has been in touch with the deal's customer: a call, an email or a reply on record. */
export const contacted = (d: Pick<FeedDeal, "events">) =>
  d.events.some((e) => e.kind === "call" || e.kind === "email" || e.kind === "reply");

/** Where a new arrival has got to, in words: "Not called yet", "Sam called", "Designed", "Proposal sent". */
export function arrivalWords(d: FeedDeal): { words: string; waiting: boolean } {
  if (d.stage !== "lead") return { words: STAGE_LABELS[d.stage], waiting: false };
  const touch = d.events.find((e) => e.kind === "call" || e.kind === "email" || e.kind === "reply");
  if (!touch) return { words: "Not contacted yet", waiting: true };
  const who = touch.by && touch.by !== "Sol" ? `${touch.by} ` : "";
  return { words: `${who}${touch.kind === "call" ? "called" : "emailed"}`.replace(/^./, (c) => c.toUpperCase()), waiting: false };
}

/** Whether a deal's only call on a person is that nobody has been in touch: New in shows it, so Needs you needn't. */
export const onlyNeedsContact = (d: FeedDeal, now = new Date()) => {
  const need = needsYou(d, now);
  return need === "New lead: nobody has been in touch yet" || need === "Lead with no contact yet";
};

/**
 * Whose deals a person sees when they haven't chosen (10 Nov 2026, Martin: the experience follows the team): alone,
 * there is only theirs; the owner sees everyone's; anyone else in a team sees their own.
 */
export const opensOnMine = (role: "owner" | "member" | "designer", teamSize: number) => teamSize > 1 && role !== "owner";

/**
 * Who a new lead belongs to (10 Nov 2026, Martin): the person who made it, except that a lead the owner adds goes to
 * the business's one salesperson when there is exactly one (the owner can give it back). Designers aren't salespeople.
 */
export function leadOwnerFor(
  by: string,
  members: readonly { email: string; role: string }[],
  rule: LeadRule = "adder",
  lastGiven: Readonly<Record<string, string>> = {},
): string {
  const who = by.toLowerCase();
  if (members.find((m) => m.email.toLowerCase() === who)?.role !== "owner") return who;
  const sellers = members.filter((m) => m.role === "member").map((m) => m.email.toLowerCase());
  if (sellers.length === 1) return sellers[0];
  if (rule !== "turns" || sellers.length === 0) return who;
  // Taking turns: the salesperson given a lead longest ago (never, first), then by email so it is always the same.
  return [...sellers].sort((x, y) => (lastGiven[x] ?? "").localeCompare(lastGiven[y] ?? "") || x.localeCompare(y))[0];
}

/**
 * Who the owner's new leads go to once there is more than one salesperson (Settings, from New in; 10 Nov 2026): kept by
 * whoever adds them, or shared out in turns. Leads a salesperson adds are always theirs.
 */
export type LeadRule = "adder" | "turns";
export const LEAD_RULES: { id: LeadRule; label: string }[] = [
  { id: "adder", label: "Whoever adds them" },
  { id: "turns", label: "The salespeople in turn" },
];
export const cleanLeadRule = (v: unknown): LeadRule => (v === "turns" ? "turns" : "adder");

/** One line a salesperson for the owner (10 Nov 2026): new this week, not yet contacted, and what they have in play. */
export interface PersonLine {
  email: string;
  name: string;
  fresh: number;
  waiting: number;
  inPlay: number;
  value: number;
}
export function teamLines(deals: readonly FeedDeal[], people: readonly { email: string; name: string }[], now = new Date()): PersonLine[] {
  const fresh = new Set(newIn(deals, now).map((d) => d.jobId));
  return people.map((p) => {
    const mine = deals.filter((d) => (d.owner ?? "").toLowerCase() === p.email.toLowerCase());
    const open = mine.filter((d) => OPEN.includes(d.stage));
    return {
      email: p.email,
      name: p.name,
      fresh: mine.filter((d) => fresh.has(d.jobId)).length,
      waiting: mine.filter((d) => fresh.has(d.jobId) && !contacted(d) && d.stage === "lead").length,
      inPlay: open.length,
      value: open.reduce((sum, d) => sum + (d.value ?? 0), 0),
    };
  });
}
