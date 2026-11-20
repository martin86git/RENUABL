/**
 * Today's Business and My month (21 Nov 2026, Martin: the Chat page wasn't a plus, chat is everywhere already; what
 * nobody answered was "how is my business going, and what should I change?"; one for the owner and admins, one for a
 * salesperson about their own selling). Read by rule from the business's own deals, never market data and never a
 * guess: where the month stands against its goal, and up to three things worth changing, each with one action.
 *
 * The business view reads every deal the viewer may see; "me" only the deals they own. Nobody is named or ranked
 * against anyone else. Pure, tested.
 */
import { todayInMarket } from "../market";
import type { ISODate } from "../types";
import { WON_STAGES, type Job } from "./crm";
import { jobHas } from "./customers";
import { gateOf } from "./approvals";
import { monthRings, monthlyHistory, NO_TARGETS, type SalesTargets } from "./sales-rings";

/** A deal as the insights read it: the job, when the business first got in touch, and its proposal's life. */
export interface InsightDeal extends Pick<
  Job,
  "id" | "stage" | "value" | "kw" | "title" | "details" | "createdAt" | "wonAt" | "installedAt" | "owner" | "installDate"
> {
  customerName: string;
  /** The first call or email from the business on the deal (a person, an agent or Sol). */
  firstTouch: string | null;
  /** The first final proposal published, first opened, signed (indicative ones don't count). */
  sentAt: string | null;
  openedAt: string | null;
  signedAt: string | null;
  /** Calls logged on the deal, any time. */
  calls: string[];
}

export type InsightScope = "business" | "me";

export interface InsightInput {
  deals: readonly InsightDeal[];
  scope: InsightScope;
  /** The viewer's email: "me" reads only the deals they own. */
  me: string;
  today: ISODate;
  now: Date;
  /** The business's monthly targets (business scope only; "me" aims at its own average). */
  targets?: SalesTargets;
  /** Whether Sol · Leads sends the first hello by itself. */
  leadsAgentOn?: boolean;
}

export interface MonthView {
  day: number;
  days: number;
  /** Dollars signed this month, at the prices quoted. */
  sold: number;
  /** Deals signed this month. */
  signed: number;
  /** The month's goal in dollars (business) or deals (me); null with nothing to aim at yet. */
  goal: number | null;
  goalIs: "target" | "average" | "none";
  /** What is likely by the month's end: signed so far, and the open proposals at this business's own signing rate. */
  likely: number;
  /** Deals likely to sign from those open. */
  likelyDeals: number;
  /** More deals to sign to reach the goal (business), at the average deal; 0 once reached; null with no goal. */
  needed: number | null;
  /** Signed so far against the share of the month gone. */
  pace: "ahead" | "behind" | "none";
}

export interface InsightDealRef {
  id: string;
  name: string;
}

export interface Insight {
  key: "speed" | "opened" | "battery" | "approvals";
  tone: "act" | "warn" | "good";
  title: string;
  why: string;
  action: { label: string; href: string };
  deals: InsightDealRef[];
}

export interface InsightsView {
  scope: InsightScope;
  month: MonthView;
  insights: Insight[];
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** How far back the rates are read. */
export const LOOKBACK_DAYS = 180;
/** The fewest deals on each side before a rate is compared. */
export const MIN_EACH = 4;
/** How much better one side has to do before it is said. */
const BETTER = 1.5;
/** A signing rate when the business has too few proposals to have one. */
const DEFAULT_RATE = 0.25;
/** Most shown at once. */
export const MAX_INSIGHTS = 3;

const deal = (j: InsightDeal): InsightDealRef => ({ id: j.id, name: j.customerName.split(" ")[0] || j.customerName });
const dealHref = (id: string, tab?: string) => `/design/deals/${id}${tab ? `?tab=${tab}` : ""}`;
const ms = (iso: string | null) => (iso ? Date.parse(iso) : NaN);
const isWon = (j: InsightDeal) => WON_STAGES.includes(j.stage);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const names = (list: InsightDealRef[]) =>
  list.length <= 1
    ? (list[0]?.name ?? "")
    : `${list
        .slice(0, -1)
        .map((d) => d.name)
        .join(", ")} and ${list[list.length - 1].name}`;
const times = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10) / 10 : 0);
const timesWords = (x: number) => (x >= 2 ? `${Math.round(x)} times as often` : `${x} times as often`);

/** The deals this view reads: the viewer's own for "me". */
export function dealsFor(input: Pick<InsightInput, "deals" | "scope" | "me">): InsightDeal[] {
  const me = input.me.toLowerCase();
  return input.scope === "me" ? input.deals.filter((j) => (j.owner ?? "").toLowerCase() === me) : [...input.deals];
}

/** This business's (or person's) own signing rate on final proposals sent in the lookback, else a default. */
export function signingRate(deals: readonly InsightDeal[], now: Date): number {
  const sent = deals.filter((j) => j.sentAt && now.getTime() - ms(j.sentAt) < LOOKBACK_DAYS * DAY);
  if (sent.length < MIN_EACH) return DEFAULT_RATE;
  return sent.filter((j) => j.signedAt).length / sent.length;
}

/** Where the month stands. */
export function monthView(input: InsightInput): MonthView {
  const deals = dealsFor(input);
  const [y, m, d] = input.today.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const month = input.today.slice(0, 7);
  const won = deals.filter((j) => isWon(j) && j.wonAt && todayInMarket(new Date(j.wonAt)).slice(0, 7) === month);
  const sold = won.reduce((n, j) => n + (j.value ?? 0), 0);
  const signed = won.length;
  const rate = signingRate(deals, input.now);
  const open = deals.filter((j) => j.stage === "proposal" && j.sentAt && !j.signedAt);
  const likelyDeals = Math.round(open.length * rate);
  const likely = Math.round(sold + open.reduce((n, j) => n + (j.value ?? 0), 0) * rate);
  const history = monthlyHistory(deals, input.today);
  const rings = monthRings(history, input.scope === "business" ? (input.targets ?? NO_TARGETS) : NO_TARGETS);
  const ring = rings.find((r) => r.key === (input.scope === "business" ? "sales" : "deals"))!;
  const goal = ring.goal;
  const done = input.scope === "business" ? sold : signed;
  const pace = !goal ? "none" : done / goal >= d / days ? "ahead" : "behind";
  let needed: number | null = null;
  if (goal && input.scope === "business") {
    const average = won.length ? sold / won.length : average6(history);
    needed = sold >= goal ? 0 : average > 0 ? Math.ceil((goal - sold) / average) : null;
  } else if (goal) needed = Math.max(0, Math.ceil(goal - signed));
  return { day: d, days, sold, signed, goal, goalIs: ring.basis, likely, likelyDeals, needed, pace };
}

const average6 = (history: ReturnType<typeof monthlyHistory>) => {
  const deals = history.reduce((n, m) => n + m.deals, 0);
  return deals ? history.reduce((n, m) => n + m.sales, 0) / deals : 0;
};

/** Speed to lead: how much more often leads touched within the hour signed, and who is waiting now. */
export function speedInsight(input: InsightInput): Insight | null {
  const deals = dealsFor(input);
  const now = input.now.getTime();
  const recent = deals.filter((j) => now - ms(j.createdAt) < LOOKBACK_DAYS * DAY && now - ms(j.createdAt) > 7 * DAY);
  const gap = (j: InsightDeal) => (j.firstTouch ? ms(j.firstTouch) - ms(j.createdAt) : Infinity);
  const fast = recent.filter((j) => gap(j) <= HOUR);
  const slow = recent.filter((j) => gap(j) > 3 * HOUR);
  const fastRate = fast.length ? fast.filter(isWon).length / fast.length : 0;
  const slowRate = slow.length ? slow.filter(isWon).length / slow.length : 0;
  const compared = fast.length >= MIN_EACH && slow.length >= MIN_EACH && fastRate >= slowRate * BETTER && fastRate > 0;
  const waiting = deals
    .filter((j) => j.stage === "lead" && !j.firstTouch && now - ms(j.createdAt) > HOUR && now - ms(j.createdAt) < 14 * DAY)
    .sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
  if (!waiting.length) return null;
  const refs = waiting.map(deal);
  const oldest = Math.floor((now - ms(waiting[0].createdAt)) / HOUR);
  const wait = oldest >= 24 ? `${Math.floor(oldest / 24)} day${oldest >= 48 ? "s" : ""}` : `${oldest} hour${oldest === 1 ? "" : "s"}`;
  const yours = input.scope === "me" ? "Your leads" : "Leads";
  const waitingWords =
    refs.length === 1
      ? `${refs[0].name} has heard nothing in ${wait}.`
      : `${names(refs.slice(0, 3))} have heard nothing yet, the longest for ${wait}.`;
  const why = compared
    ? `${yours} contacted within the hour signed ${timesWords(times(fastRate, slowRate))} (${pct(fastRate)} against ${pct(slowRate)}). ${waitingWords}`
    : waitingWords;
  const title = refs.length === 1 ? `A new lead has waited ${wait}` : `${refs.length} new leads are waiting, the longest ${wait}`;
  const action =
    input.scope === "business" && input.leadsAgentOn === false
      ? { label: "Switch on Sol · Leads", href: "/design/routines" }
      : { label: `Contact ${refs[0].name}`, href: dealHref(waiting[0].id) };
  return { key: "speed", tone: "act", title, why, action, deals: refs };
}

/** Proposals opened that nobody has rung about since, and how much a call within 2 days helps. */
export function openedInsight(input: InsightInput): Insight | null {
  const deals = dealsFor(input);
  const now = input.now.getTime();
  const calledSoon = (j: InsightDeal) => {
    const open = ms(j.openedAt);
    return j.calls.some((c) => ms(c) >= open && ms(c) - open <= 2 * DAY);
  };
  const opened = deals.filter((j) => j.openedAt && now - ms(j.openedAt) < LOOKBACK_DAYS * DAY && now - ms(j.openedAt) > 2 * DAY);
  const withCall = opened.filter(calledSoon);
  const without = opened.filter((j) => !calledSoon(j));
  const rateWith = withCall.length ? withCall.filter((j) => j.signedAt).length / withCall.length : 0;
  const rateWithout = without.length ? without.filter((j) => j.signedAt).length / without.length : 0;
  const compared = withCall.length >= MIN_EACH && without.length >= MIN_EACH && rateWith >= rateWithout * BETTER && rateWith > 0;
  const quiet = deals
    .filter(
      (j) =>
        j.stage === "proposal" &&
        j.openedAt &&
        !j.signedAt &&
        now - ms(j.openedAt) > 2 * DAY &&
        now - ms(j.openedAt) < 30 * DAY &&
        !j.calls.some((c) => ms(c) >= ms(j.openedAt)),
    )
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  if (!quiet.length) return null;
  const refs = quiet.map(deal);
  const yours = input.scope === "me" ? "Your proposals" : "Proposals";
  const why = compared
    ? `${yours} with a call within 2 days of opening signed ${timesWords(times(rateWith, rateWithout))}. ${names(refs.slice(0, 3))} ${refs.length === 1 ? "is" : "are"} past that.`
    : `${names(refs.slice(0, 3))} opened ${refs.length === 1 ? "their proposal" : "their proposals"} more than 2 days ago and nobody has called since.`;
  const title = refs.length === 1 ? "A proposal was opened, with no call since" : `${refs.length} proposals opened, with no call since`;
  return { key: "opened", tone: "act", title, why, action: { label: `Call ${refs[0].name}`, href: dealHref(quiet[0].id) }, deals: refs };
}

/** Batteries against solar alone: which signs more often, and the open solar-only proposals a battery might suit. */
export function batteryInsight(input: InsightInput): Insight | null {
  const deals = dealsFor(input);
  const now = input.now.getTime();
  const sent = deals.filter((j) => j.sentAt && now - ms(j.sentAt) < LOOKBACK_DAYS * DAY && now - ms(j.sentAt) > 7 * DAY);
  const battery = sent.filter((j) => jobHas(j).battery);
  const solar = sent.filter((j) => !jobHas(j).battery);
  if (battery.length < MIN_EACH || solar.length < MIN_EACH) return null;
  const bRate = battery.filter((j) => j.signedAt).length / battery.length;
  const sRate = solar.filter((j) => j.signedAt).length / solar.length;
  if (!(bRate >= sRate * BETTER && bRate > 0)) return null;
  const open = deals.filter((j) => j.stage === "proposal" && !j.signedAt && !jobHas(j).battery && jobHas(j).solar);
  const refs = open.map(deal);
  const why = `${pct(bRate)} of battery proposals sign, against ${pct(sRate)} for solar alone.${
    refs.length
      ? ` ${refs.length === 1 ? `${refs[0].name}'s solar-only deal` : `${refs.length} solar-only deals`} could be offered one.`
      : ""
  }`;
  return {
    key: "battery",
    tone: "good",
    title: input.scope === "me" ? "You close batteries well" : "Batteries close well",
    why,
    action: refs.length
      ? {
          label: refs.length === 1 ? `Open ${refs[0].name}` : `See the ${refs.length}`,
          href: refs.length === 1 ? dealHref(open[0].id) : "/design/sales/proposals",
        }
      : { label: "Proposals sent", href: "/design/sales/proposals" },
    deals: refs,
  };
}

/** Sold deals stuck at the network's pre-approval more than 10 days: installs at risk (the business view). */
export function approvalsInsight(input: InsightInput): Insight | null {
  if (input.scope !== "business") return null;
  const now = input.now.getTime();
  const stuck = dealsFor(input)
    .filter((j) => isWon(j) && j.wonAt && gateOf(j) === "preapproval" && now - ms(j.wonAt) > 10 * DAY)
    .sort((a, b) => ms(a.wonAt) - ms(b.wonAt));
  if (!stuck.length) return null;
  const refs = stuck.map(deal);
  const longest = Math.floor((now - ms(stuck[0].wonAt)) / DAY);
  return {
    key: "approvals",
    tone: "warn",
    title: stuck.length === 1 ? "A sold deal is stuck at pre-approval" : `${stuck.length} sold deals are stuck at pre-approval`,
    why: `${names(refs.slice(0, 3))} ${refs.length === 1 ? "has" : "have"} waited on the network, the longest ${longest} days since signing. Their installs can't be booked until it's through.`,
    action: {
      label: refs.length === 1 ? `Open ${refs[0].name}` : `See the ${refs.length}`,
      href: refs.length === 1 ? dealHref(stuck[0].id) : "/design/procurement/pre-approvals",
    },
    deals: refs,
  };
}

/** The month, and up to three insights: what to act on first, then what's going wrong, then a strength. */
export function insightsView(input: InsightInput): InsightsView {
  const found = [speedInsight(input), openedInsight(input), approvalsInsight(input), batteryInsight(input)].filter(
    (x): x is Insight => x !== null,
  );
  const order = { act: 0, warn: 1, good: 2 } as const;
  return {
    scope: input.scope,
    month: monthView(input),
    insights: found.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, MAX_INSIGHTS),
  };
}

/** The line under the heading when nothing is worth changing. */
export const ALL_GOOD = "Nothing stands out today. Every lead has heard from you and every opened proposal has had a call.";

/** Which view a member sees: the business for anyone who may change settings, their own month for everyone else. */
export const scopeFor = (maySeeBusiness: boolean): InsightScope => (maySeeBusiness ? "business" : "me");
