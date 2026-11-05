/**
 * Next up (25 Oct 2026, Martin: looking at the pad, he didn't know what to do, so something has to appear in it). The
 * pad opens on the few things that need the business now, most pressing first, each saying who, why, and the one thing
 * to press: today's installs, customers waiting on a reply, new enquiries, proposals due a follow-up, equipment to
 * order before an install, sold deals with no install date, and approvals not yet moving. Pure, tested.
 */
import { todayInMarket } from "../market";
import type { ISODate } from "../types";
import type { Job } from "./crm";
import { approvalsOpen } from "./journey";
import { PRE_INSTALL_STAGES } from "./crm";

export type NextKind = "install" | "message" | "lead" | "follow-up" | "order" | "date" | "approvals";

export interface NextItem {
  /** Unique on the list. */
  key: string;
  kind: NextKind;
  title: string;
  why: string;
  /** The one thing to press, and where it goes. */
  action: string;
  href: string;
  /** Higher is more pressing. */
  weight: number;
}

type NextJob = Pick<Job, "id" | "stage" | "address" | "kw" | "installDate" | "wonAt" | "createdAt" | "details"> & {
  customerName: string;
};

export interface NextInput {
  jobs: readonly NextJob[];
  /** Conversations with lines from the customer nobody has seen. */
  threads: readonly { jobId: string; customerName: string; last: string; at: string; unread: number }[];
  /** Proposals due a follow-up: who, and days since it was sent. */
  followUps: readonly { jobId: string; customer: string; age: number }[];
  /** Orders not yet placed, with their install day. */
  orders: readonly { jobId: string; customer: string; installDate: string | null; status: string }[];
  today: ISODate;
  now: Date;
  paths: { deal: (id: string) => string; chat: (id: string) => string; design: (id: string) => string; orders: string };
}

/** The suburb from an address ("2 Hanwell Court, Glen Waverley, VIC, 3150" → "Glen Waverley"). */
export const suburbIn = (address: string) => address.split(",")[1]?.trim() || address.split(",")[0]?.trim() || "";

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

const daysBetween = (from: ISODate, to: ISODate) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const ago = (iso: string, now: Date) => {
  const mins = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (mins < 60) return mins <= 1 ? "just now" : `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
};

const clip = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text);

/** Everything that needs the business now, most pressing first. */
export function nextUp(input: NextInput): NextItem[] {
  const { jobs, today, now, paths } = input;
  const items: NextItem[] = [];

  for (const j of jobs) {
    if (j.stage === "lost") continue;
    const who = j.customerName;
    if (j.installDate === today && PRE_INSTALL_STAGES.includes(j.stage)) {
      items.push({
        key: `install:${j.id}`,
        kind: "install",
        title: `Installing for ${who} today`,
        why: [suburbIn(j.address), j.kw ? `${j.kw} kW` : null, j.details.installer || "no installer named yet"].filter(Boolean).join(" · "),
        action: "Open the job",
        href: paths.deal(j.id),
        weight: 100,
      });
    }
    // A new enquiry: still a lead, made in the last three days.
    const age = daysBetween(todayInMarket(new Date(j.createdAt)), today);
    if (j.stage === "lead" && age <= 3) {
      items.push({
        key: `lead:${j.id}`,
        kind: "lead",
        title: `New enquiry from ${who}`,
        why: [suburbIn(j.address), `came in ${ago(j.createdAt, now)}`].filter(Boolean).join(" · "),
        action: "Design their roof",
        href: paths.design(j.id),
        weight: 80 - age * 5,
      });
    }
    if (PRE_INSTALL_STAGES.includes(j.stage)) {
      const sold = j.wonAt ? todayInMarket(new Date(j.wonAt)) : today;
      const waiting = daysBetween(sold, today);
      if (approvalsOpen(j)) {
        const grid = j.details.preApproval || "not submitted";
        items.push({
          key: `approvals:${j.id}`,
          kind: "approvals",
          title: `Get ${firstName(who)}'s approvals moving`,
          why: `Grid pre-approval ${grid.toLowerCase()} · sold ${waiting === 0 ? "today" : `${waiting} ${waiting === 1 ? "day" : "days"} ago`}`,
          action: "Open the deal",
          href: paths.deal(j.id),
          weight: 40 + Math.min(waiting, 20),
        });
      } else if (!j.installDate) {
        items.push({
          key: `date:${j.id}`,
          kind: "date",
          title: `Book an install date for ${who}`,
          why: `Approved and sold ${waiting === 0 ? "today" : `${waiting} ${waiting === 1 ? "day" : "days"} ago`}, no date yet`,
          action: "Open the deal",
          href: paths.deal(j.id),
          weight: 50 + Math.min(waiting, 20),
        });
      }
    }
  }

  for (const t of input.threads) {
    if (t.unread <= 0) continue;
    items.push({
      key: `message:${t.jobId}`,
      kind: "message",
      title: `${firstName(t.customerName)} wrote: “${clip(t.last, 70)}”`,
      why: `${t.unread} unread · ${ago(t.at, now)}`,
      action: "Reply",
      href: paths.chat(t.jobId),
      weight: 90 + Math.min(t.unread, 5),
    });
  }

  for (const f of input.followUps) {
    items.push({
      key: `follow-up:${f.jobId}`,
      kind: "follow-up",
      title: `Follow up ${f.customer}`,
      why: `Proposal sent ${f.age} ${f.age === 1 ? "day" : "days"} ago, not signed yet`,
      action: "Open the deal",
      href: paths.deal(f.jobId),
      weight: 70 + Math.min(f.age, 20) / 2,
    });
  }

  for (const o of input.orders) {
    if (o.status !== "open" || !o.installDate) continue;
    const until = daysBetween(today, o.installDate);
    if (until > 14) continue;
    items.push({
      key: `order:${o.jobId}`,
      kind: "order",
      title: `Order the equipment for ${o.customer}`,
      why:
        until < 0
          ? "The install date has passed"
          : until === 0
            ? "Installing today"
            : `Installing in ${until} ${until === 1 ? "day" : "days"}`,
      action: "Ordering Station",
      href: paths.orders,
      weight: 60 + (14 - Math.max(until, 0)),
    });
  }

  return items.sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));
}

const NUMBERS = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things", "Six things"];

/** The pad's opening line: how many things need the business, and the part of the day. */
export function nextHeadline(count: number, hour: number): string {
  const when = hour < 12 ? "this morning" : hour < 17 ? "this afternoon" : "this evening";
  if (count === 0) return "Nothing needs you right now.";
  const n = NUMBERS[count] ?? `${count} things`;
  return `${n} ${count === 1 ? "needs" : "need"} you ${when}.`;
}

/**
 * Each kind's pill on To action (5 Nov 2026, Martin, from Primero's: "a pill to identify proposal follow up vs say a new
 * lead... different colors"): a word each, drawn in that kind's own colour (`--kind-*` tokens), so a run of follow-ups
 * reads apart from a new lead at a glance.
 */
export const NEXT_KIND_WORDS: Record<NextKind, string> = {
  install: "Install",
  message: "Message",
  lead: "New lead",
  "follow-up": "Follow-up",
  order: "Order",
  date: "Book a date",
  approvals: "Approval",
};

/** The words of a search over To action: lower case, one each. */
export const searchWords = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

/**
 * To action searched for a customer who has just come to mind (5 Nov 2026, from Primero's): every word must be in the
 * item's title, its line or its kind. No words, everything.
 */
export function searchNext(items: readonly NextItem[], q: string): NextItem[] {
  const words = searchWords(q);
  if (!words.length) return [...items];
  return items.filter((i) => {
    const hay = `${i.title} ${i.why} ${NEXT_KIND_WORDS[i.kind]}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Where "Work through" stands: the item at `at` of `total`, and what to say beside it. */
export function workThroughAt(at: number, total: number): { at: number; count: string; after: string } {
  const i = Math.max(0, Math.min(at, Math.max(total - 1, 0)));
  const left = total - i - 1;
  return { at: i, count: `${total ? i + 1 : 0} of ${total}`, after: left > 0 ? `${left} after this` : "The last one" };
}
