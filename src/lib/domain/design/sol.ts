/**
 * Sol, the business's assistant in RENUABL (31 Oct 2026, Martin: copy Primero's Lance across and call him Sol). Each
 * member has a conversation of their own; Sol answers from the business's own deals as that member may see them, and
 * acts only through tools: he finds deals, reads one, lists those at a stage, looks up a price (for those who see
 * costs), writes an email as a draft card for the member to send from the deal (he never sends one himself), keeps the
 * member's own preferences and reminders, and draws charts and diagrams under his answer. Pure, tested.
 */
import { LAUNCH_MARKET, marketDateTime, todayInMarket } from "../market";
import { cleanCharts, MORE_DETAIL, type SolChart } from "./sol-charts";
import { cleanDiagrams, type SolDiagram } from "./sol-diagrams";
import { STAGE_LABELS, JOB_STAGES, type Job, type JobStage } from "./crm";
import { matches } from "./find";
import { SECTIONS } from "./sections";
import { SOL_REGULATIONS } from "./standards";

export const SOL_NAME = "Sol";
/** Turns kept in a member's conversation, and how many of the latest are sent with a question. */
export const CHAT_KEPT = 80;
export const HISTORY_SENT = 20;
/** The longest message a member may send. */
export const MAX_SAID = 4000;
/** Files with a message: PDFs and pictures, up to three, about 3 MB together. */
export const SOL_FILE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const MAX_FILES = 3;
export const MAX_FILE_CHARS = 4_200_000;
/** Drafts one answer may carry. */
export const DRAFTS_PER_TURN = 3;

/** An email Sol wrote on a deal, for the member to check, change and send from the deal's Email tab. */
export interface SolDraft {
  jobId: string;
  customer: string;
  to: string;
  subject: string;
  body: string;
}

/** The reminder Sol has just taken, carried on his turn so the times are offered under his answer. */
export interface SolReminderAsk {
  id: string;
  what: string;
  /** Set once a time is chosen, so the card then says when. */
  dueAt?: string;
}

export interface SolTurn {
  role: "you" | "sol";
  text: string;
  at: string;
  charts?: SolChart[];
  diagrams?: SolDiagram[];
  drafts?: SolDraft[];
  reminder?: SolReminderAsk;
  /** Pinned by the member: shown in the Pinned strip, kept past the history trim, and kept through Clear. */
  pinned?: boolean;
}

/** The turns kept: the latest `CHAT_KEPT`, and any pinned before them (1 Nov 2026, Martin: as Primero's). */
export function keptTurns(turns: readonly SolTurn[]): SolTurn[] {
  const from = Math.max(0, turns.length - CHAT_KEPT);
  return turns.filter((t, i) => i >= from || t.pinned);
}

/** Pins or unpins the turn said at that moment by that side; nothing else changes. */
export function withPin(turns: readonly SolTurn[], at: string, role: SolTurn["role"], pinned: boolean): SolTurn[] {
  return turns.map((t) => {
    if (t.at !== at || t.role !== role) return t;
    if (pinned) return { ...t, pinned: true };
    const rest = { ...t };
    delete rest.pinned;
    return rest;
  });
}

export interface SolPref {
  id: string;
  text: string;
  at: string;
}

export interface SolReminder {
  id: string;
  what: string;
  createdAt: string;
  dueAt?: string;
  /** When Sol said it in the member's chat. */
  firedAt?: string;
}

/** What the browser is sent: the conversation, the reminders to come and how many of Sol's lines are unread. */
export interface SolState {
  turns: SolTurn[];
  reminders: SolReminder[];
  prefs: SolPref[];
  unread: number;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isTime = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

function cleanDraft(raw: unknown): SolDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const d = {
    jobId: str(r.jobId, 60),
    customer: str(r.customer, 120),
    to: str(r.to, 200),
    subject: str(r.subject, 200),
    body: str(r.body, 6000),
  };
  return d.jobId && (d.subject || d.body) ? d : null;
}

export function cleanDrafts(raw: unknown): SolDraft[] {
  return (Array.isArray(raw) ? raw : [])
    .map(cleanDraft)
    .filter((d): d is SolDraft => d !== null)
    .slice(0, DRAFTS_PER_TURN);
}

/** A conversation as kept: every turn checked again, the latest `CHAT_KEPT`. */
export function cleanTurns(raw: unknown): SolTurn[] {
  const turns = (Array.isArray(raw) ? raw : [])
    .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === "object")
    .map((t): SolTurn | null => {
      const role = t.role === "you" ? "you" : t.role === "sol" ? "sol" : null;
      const text = str(t.text, 12_000);
      if (!role || !isTime(t.at)) return null;
      const charts = cleanCharts(t.charts);
      const diagrams = cleanDiagrams(t.diagrams);
      const drafts = cleanDrafts(t.drafts);
      const r = t.reminder as Record<string, unknown> | undefined;
      const reminder =
        r && typeof r === "object" && str(r.id, 40) && str(r.what, 500)
          ? { id: str(r.id, 40), what: str(r.what, 500), ...(isTime(r.dueAt) ? { dueAt: r.dueAt } : {}) }
          : undefined;
      if (!text && !charts.length && !diagrams.length && !drafts.length) return null;
      return {
        role,
        text,
        at: t.at as string,
        ...(charts.length ? { charts } : {}),
        ...(diagrams.length ? { diagrams } : {}),
        ...(drafts.length ? { drafts } : {}),
        ...(reminder ? { reminder } : {}),
        ...(t.pinned === true ? { pinned: true } : {}),
      };
    })
    .filter((t): t is SolTurn => t !== null);
  return keptTurns(turns);
}

/** How many of Sol's lines came after the member last saw the conversation. */
export function unreadOf(turns: readonly SolTurn[], seenAt: string | null): number {
  const seen = seenAt ? Date.parse(seenAt) : 0;
  return turns.filter((t) => t.role === "sol" && Date.parse(t.at) > seen).length;
}

// ── The member's own preferences ────────────────────────────────────────────────────────────────────────────────

export const MAX_PREFS = 20;

export function cleanPrefs(raw: unknown): SolPref[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === "object")
    .map((p) => ({ id: str(p.id, 40), text: str(p.text, 300), at: isTime(p.at) ? (p.at as string) : new Date(0).toISOString() }))
    .filter((p) => p.id && p.text)
    .slice(0, MAX_PREFS);
}

export function withPref(list: readonly SolPref[], text: string, id: string, now: Date): SolPref[] {
  const said = text.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!said) throw new Error("Say what to keep.");
  if (list.some((p) => p.text.toLowerCase() === said.toLowerCase())) return [...list];
  if (list.length >= MAX_PREFS) throw new Error("That's a lot of preferences: take one off first.");
  return [...list, { id, text: said, at: now.toISOString() }];
}

export const withoutPref = (list: readonly SolPref[], id: string): SolPref[] => list.filter((p) => p.id !== id);

// ── Reminders, in the market's time ─────────────────────────────────────────────────────────────────────────────

export const MAX_REMINDERS = 60;
/** The hour "end of day" and "tomorrow" mean, in the market's time. */
export const END_OF_DAY = [17, 0] as const;
export const TOMORROW_AT = [9, 0] as const;

export type WhenChoice = "1h" | "4h" | "eod" | "tomorrow";
export const WHEN_LABELS: Record<WhenChoice, string> = {
  "1h": "In 1 hour",
  "4h": "In 4 hours",
  eod: "End of day",
  tomorrow: "Tomorrow",
};

const nextDay = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** The instant a choice means from now, or null when it no longer can (end of day once it has passed). */
export function dueFor(choice: WhenChoice, now = new Date()): Date | null {
  if (choice === "1h") return new Date(now.getTime() + 3_600_000);
  if (choice === "4h") return new Date(now.getTime() + 4 * 3_600_000);
  const today = todayInMarket(now);
  if (choice === "eod") {
    const at = Date.parse(marketDateTime(today, ...END_OF_DAY));
    return at > now.getTime() + 10 * 60_000 ? new Date(at) : null;
  }
  return new Date(marketDateTime(nextDay(today), ...TOMORROW_AT));
}

/** The choices still open now: end of day goes once it has passed. */
export const whenChoices = (now = new Date()): WhenChoice[] => (Object.keys(WHEN_LABELS) as WhenChoice[]).filter((c) => dueFor(c, now));

/** The market's local time as Sol writes it ("2026-11-02 14:00" or "2026-11-02T14:00") as an instant, or null. */
export function fromLocal(text: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})/.exec(text.trim());
  if (!m || Number(m[2]) > 23 || Number(m[3]) > 59) return null;
  return new Date(marketDateTime(m[1], Number(m[2]), Number(m[3])));
}

/** When a reminder is due, said plainly: "today at 3:15 pm", "tomorrow at 9 am", "Thu 5 Nov at 2 pm". */
export function dueWords(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat("en-AU", { timeZone: LAUNCH_MARKET.timeZone, hour: "numeric", minute: "2-digit" })
    .format(at)
    .replace(":00", "")
    .replace(/\s?([ap])m/i, " $1m")
    .toLowerCase();
  const day = todayInMarket(at);
  const today = todayInMarket(now);
  if (day === today) return `today at ${time}`;
  if (day === nextDay(today)) return `tomorrow at ${time}`;
  const date = new Intl.DateTimeFormat("en-AU", {
    timeZone: LAUNCH_MARKET.timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(at);
  return `${date} at ${time}`;
}

/** The market's time now, for Sol to work "Thursday at 2" out from. */
export function nowWords(now = new Date()): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: LAUNCH_MARKET.timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
}

export function cleanReminders(raw: unknown): SolReminder[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
    .map((r) => ({
      id: str(r.id, 40),
      what: str(r.what, 500),
      createdAt: isTime(r.createdAt) ? (r.createdAt as string) : new Date(0).toISOString(),
      ...(isTime(r.dueAt) ? { dueAt: r.dueAt as string } : {}),
      ...(isTime(r.firedAt) ? { firedAt: r.firedAt as string } : {}),
    }))
    .filter((r) => r.id && r.what);
}

/** Reminders still to come (and those waiting for a time), soonest first, waiting ones last. */
export function upcoming(all: readonly SolReminder[]): SolReminder[] {
  return all
    .filter((r) => !r.firedAt)
    .sort((a, b) => ((a.dueAt ?? "~") < (b.dueAt ?? "~") ? -1 : (a.dueAt ?? "~") > (b.dueAt ?? "~") ? 1 : 0));
}

/** Reminders now due and not yet said. */
export const dueNow = (all: readonly SolReminder[], now = new Date()): SolReminder[] =>
  all.filter((r) => !r.firedAt && r.dueAt && Date.parse(r.dueAt) <= now.getTime());

/** The list with one added, keeping at most `MAX_REMINDERS` to come and the latest 40 said. */
export function withReminder(all: readonly SolReminder[], r: SolReminder): SolReminder[] {
  if (upcoming(all).length >= MAX_REMINDERS) throw new Error("That's a lot of reminders: clear some first.");
  const said = all
    .filter((x) => x.firedAt)
    .sort((a, b) => (b.firedAt ?? "").localeCompare(a.firedAt ?? ""))
    .slice(0, 40);
  return [...all.filter((x) => !x.firedAt), ...said, r];
}

/** What Sol says in the chat when one falls due. */
export const reminderNote = (r: SolReminder) => `Reminder: ${r.what}`;

// ── What a member sends ─────────────────────────────────────────────────────────────────────────────────────────

export interface SolFile {
  name: string;
  type: (typeof SOL_FILE_TYPES)[number];
  /** Base64, no data: prefix. */
  data: string;
}

/** A message from the browser: its words (to `MAX_SAID`) and up to three files, or null when there is nothing. */
export function cleanSolInput(raw: unknown): { text: string; files: SolFile[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = typeof r.text === "string" ? r.text.trim().slice(0, MAX_SAID) : "";
  const files = (Array.isArray(r.files) ? r.files : [])
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === "object")
    .map((f) => ({
      name: str(f.name, 120).replace(/[\r\n]/g, " ") || "file",
      type: f.type as SolFile["type"],
      data: typeof f.data === "string" ? f.data : "",
    }))
    .filter((f) => (SOL_FILE_TYPES as readonly string[]).includes(f.type) && /^[A-Za-z0-9+/=]+$/.test(f.data))
    .slice(0, MAX_FILES);
  if (files.reduce((n, f) => n + f.data.length, 0) > MAX_FILE_CHARS) return null;
  if (!text && !files.length) return null;
  return { text, files };
}

/** "#" in the box finds a deal, as in Primero: the "#" and what follows it, up to the caret, or null. */
export function typingDeal(text: string, caret: number): { start: number; query: string } | null {
  const m = text.slice(0, caret).match(/(^|\s)#([^#\n]{0,60})$/);
  if (!m) return null;
  return { start: caret - m[2].length - 1, query: m[2] };
}

/** What a deal picked with "#" is written as in the box; Sol reads the deal from its id. */
export const dealMention = (label: string, id: string) => `#${label} (deal ${id}) `;

// ── What Sol's tools answer ─────────────────────────────────────────────────────────────────────────────────────

export type SolJob = Job & { customerName: string };

const money = (n: number | null) => (n == null ? "no value yet" : `$${Math.round(n).toLocaleString("en-AU")}`);

/** One deal in a line, as Sol's tools give it: id, customer, title, stage, value, kW, install date, address. */
export function dealLine(j: SolJob): string {
  return [
    `deal ${j.id}`,
    j.customerName,
    j.title,
    STAGE_LABELS[j.stage],
    money(j.value),
    j.kw ? `${j.kw} kW` : "",
    j.installDate ? `installs ${j.installDate}` : "",
    j.address,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Deals found by a customer's name, the address, the title, a phone number or the deal's id. */
export function findDeals(jobs: readonly SolJob[], q: string, phoneOf: (customerId: string) => string = () => ""): SolJob[] {
  const typed = q.trim();
  const byId = jobs.filter((j) => j.id === typed);
  if (byId.length) return byId;
  return jobs.filter((j) => matches({ words: [j.customerName, j.title, j.address], phone: phoneOf(j.customerId) }, typed)).slice(0, 12);
}

/** The stage a name means: its key or any part of its label ("proposal", "Proposal sent"), or null. */
export function stageNamed(name: string): JobStage | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  return (
    JOB_STAGES.find((s) => s === n) ??
    JOB_STAGES.find((s) => STAGE_LABELS[s].toLowerCase() === n) ??
    JOB_STAGES.find((s) => STAGE_LABELS[s].toLowerCase().includes(n)) ??
    null
  );
}

/** The deals at a stage, with how long since each last changed; with no stage, every stage and its count. */
export function dealsAtStage(jobs: readonly SolJob[], stage: string, today: string): string {
  if (!stage.trim()) {
    return JOB_STAGES.map((s) => `${STAGE_LABELS[s]}: ${jobs.filter((j) => j.stage === s).length}`).join("\n");
  }
  const s = stageNamed(stage);
  if (!s) return `There's no stage called "${stage}". The stages are: ${JOB_STAGES.map((x) => STAGE_LABELS[x]).join(", ")}.`;
  const at = jobs.filter((j) => j.stage === s).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  if (!at.length) return `No deals are at ${STAGE_LABELS[s]}.`;
  const days = (iso: string) => Math.max(0, Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(iso)) / 86_400_000));
  return [
    `${at.length} at ${STAGE_LABELS[s]}, longest unchanged first:`,
    ...at.slice(0, 40).map((j) => `- ${dealLine(j)} · unchanged ${days(j.updatedAt)} days`),
  ].join("\n");
}

/** Where things are in RENUABL, from the sections across the top, for "where do I…" questions. */
export function whereThingsAre(): string {
  return SECTIONS.map((s) => `- ${s.label}: ${s.pages.map((p) => p.label).join(", ")}`).join("\n");
}

/** How Sol answers, and what he is. Every figure he gives comes from the facts below or a tool. */
export function solSystem(input: {
  business: string;
  member: string;
  /** Whether this member may see costs and margin (the price lookup). */
  costs: boolean;
  facts: string;
  prefs: readonly SolPref[];
  now: Date;
}): string {
  const prefs = input.prefs.length ? input.prefs.map((p) => `- ${p.id}: ${p.text}`).join("\n") : "- none";
  return `You are ${SOL_NAME}, the assistant in RENUABL, the software ${input.business} runs its solar business on. You are talking with ${input.member}, a member of ${input.business}'s team, in their own conversation (no one else sees it). Help them with their customers and their work: their deals, what to say to a customer, where things are in RENUABL, and general knowledge about solar, batteries and power bills where it helps.

How you answer: the answer first, compressed to what they need, in one to four short lines with the key figures, plain Australian English, plain text only (no markdown headings, asterisks or bold; a short "- " list is fine). Leave out the working and the long lists. When there is more worth telling, end with "${MORE_DETAIL}" on its own line, and give the fuller answer only when they say yes. When a picture says it quicker (a comparison, a breakdown, a trend), draw it with show_chart from figures the facts or a tool gave you, and don't repeat its figures in words. For a labelled picture of a real case (a battery's clearances, a roof's setbacks, how strings run), draw it with show_diagram, and say it is an illustration to check against the rules and the site.

Deals: find one with find_deal when only a name, address or phone is given; read it with deal_details before advising on or writing to a customer. A deal written as "#Name (deal ID)" was picked from the search: read that deal straight away. For deals at a stage, use deals_at_stage. Never invent deals, customers, figures, dates or prices: use the facts and the tools. ${input.costs ? "price_lookup gives supplier costs from the business's own price lists." : "This person can't see costs or margin: don't give any, and say the owner can change that under Users and permissions if they ask."}

Emails: to write to a customer, use draft_email; it is shown as a card they check, change and send themselves from the deal's Email tab. You never send anything yourself. Never write an email in your answer's text, and don't repeat the card's words: say in a line what you wrote and anything to check. Write as the business ("we"), never promise a price, date or outcome the deal doesn't show, and use their preferences below.

${SOL_REGULATIONS}

Preferences: when they ask for something to apply from now on (a sign-off, their name, a tone), keep it with remember_my_preference; take one off with forget_my_preference.

Reminders: when they ask you to remind them of something, keep it with add_reminder. If they gave a time, pass it and say in a line when you'll remind them. If not, say "I'll add that to your reminders. When would you like me to remind you?" and nothing more: the times are offered as buttons under your answer. When it is due you'll say it in their chat. It is now ${nowWords(input.now)} in ${LAUNCH_MARKET.capital}; work times out from that.

Where things are in RENUABL (the sections across the top, each with its pages under it; Search is top left, or Ctrl K; Messages, Notifications, the design tool and Settings are the round icons top right):
${whereThingsAre()}
If RENUABL doesn't do something, say so plainly in a line.

Their preferences now:
${prefs}

The business's facts now (only these deals: the ones this person may see):
${input.facts}`;
}
