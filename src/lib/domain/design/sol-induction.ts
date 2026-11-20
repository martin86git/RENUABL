/**
 * Sol's induction, and how he learns the way each person works (20 Nov 2026, Martin: "Sol needs to build immediate
 * trust with the user… almost an induction meeting… explain that he exists almost everywhere and define how he can be
 * engaged… then ask the user a series of questions around how the user wants to work"; and "throughout interactions
 * Sol should take the opportunity to learn… would you generally like to take the approach of option 1 / 2 / 3").
 *
 * The induction: after the first visit's tour (or the next time Sol's panel opens) he introduces himself in three
 * beats, says where he is, then asks `INDUCTION_QUESTIONS` one at a time, each skippable. Every answer becomes one of
 * his preferences, kept under its question's key so answering again replaces it. The questions about how the business
 * talks to customers (`scope: "business"`) are the owner's to set for everyone: the owner is asked first whether their
 * answers are the default for all staff, or each person sets their own (`BusinessScope`). Staff whose owner chose
 * "all" aren't asked those; their own preferences still win where they differ.
 *
 * Learning in the moment: when a preference would change the work and he has none, Sol does the task and puts one
 * question under his answer (`LearnAsk`), at most once a conversation and never the same topic twice; the press keeps
 * the answer as a preference with where it came from. Pure, tested.
 */
import type { SolPref } from "./sol";

export type InductionScope = "person" | "business";

export interface InductionQuestion {
  key: string;
  /** The group it is asked under. */
  part: "you" | "answers" | "customers" | "day";
  ask: string;
  /** Tap answers; empty for one typed in. "Other" is always offered to type your own. */
  options: string[];
  /** Shown under the question. */
  hint?: string;
  scope: InductionScope;
  /** The preference kept from an answer, in words Sol reads. */
  keep: (answer: string) => string;
}

export const PART_WORDS: Record<InductionQuestion["part"], string> = {
  you: "About you",
  answers: "How you like answers",
  customers: "Your customers",
  day: "Running the day",
};

export const INDUCTION_QUESTIONS: InductionQuestion[] = [
  {
    key: "name",
    part: "you",
    ask: "What should I call you?",
    options: [],
    scope: "person",
    keep: (a) => `Call me ${a}.`,
  },
  {
    key: "role",
    part: "you",
    ask: "What's your role?",
    options: ["Owner", "Sales", "Design", "Operations", "Installer", "Admin"],
    scope: "person",
    keep: (a) => `My role is ${a.toLowerCase()}.`,
  },
  {
    key: "day",
    part: "you",
    ask: "What takes up most of your day?",
    options: ["Selling", "Designing", "Running installs", "All of it"],
    scope: "person",
    keep: (a) =>
      a === "All of it"
        ? "My day is a bit of everything: selling, designing and running installs."
        : `Most of my day is ${a.toLowerCase()}.`,
  },
  {
    key: "answers",
    part: "answers",
    ask: "How should I answer you?",
    options: ["Short and to the point", "A short answer, then the detail", "Walk me through it"],
    scope: "person",
    keep: (a) => `How I like answers: ${a.toLowerCase()}.`,
  },
  {
    key: "unclear",
    part: "answers",
    ask: "When something's unclear, should I ask first or make my best guess?",
    options: ["Ask me first", "Make your best guess and say so"],
    scope: "person",
    keep: (a) =>
      a === "Ask me first"
        ? "When something's unclear, ask me before doing it."
        : "When something's unclear, make your best guess and say what you assumed.",
  },
  {
    key: "tone",
    part: "customers",
    ask: "How do you write to customers?",
    options: ["Warm and chatty", "Friendly but brief", "Formal"],
    scope: "business",
    keep: (a) => `When writing to customers, be ${a.toLowerCase()}.`,
  },
  {
    key: "signoff",
    part: "customers",
    ask: "How do your emails sign off?",
    options: ["Cheers, [first name]", "Thanks, [first name]", "Kind regards, [name] and the business"],
    hint: "[first name] is whoever is sending it.",
    scope: "business",
    keep: (a) => `Sign off customer emails like this: ${a}.`,
  },
  {
    key: "first-contact",
    part: "customers",
    ask: "When a new lead comes in, what do you do first?",
    options: ["Call them", "Email them", "Text them", "Design the roof, then send it"],
    scope: "business",
    keep: (a) => `First contact with a new lead: ${a.toLowerCase()}.`,
  },
  {
    key: "price",
    part: "customers",
    ask: "When talking about price, what do you lead with?",
    options: ["The price", "The saving", "Wait until they ask"],
    scope: "business",
    keep: (a) =>
      a === "Wait until they ask"
        ? "Talking price: don't bring it up until the customer asks."
        : `Talking price: lead with ${a.toLowerCase()}.`,
  },
  {
    key: "nudge",
    part: "customers",
    ask: "How often should a quiet proposal be followed up?",
    options: ["Every few days", "Weekly", "Only when I ask"],
    scope: "business",
    keep: (a) =>
      a === "Only when I ask" ? "Follow up a quiet proposal only when I ask." : `Follow up a quiet proposal ${a.toLowerCase()}.`,
  },
  {
    key: "morning",
    part: "day",
    ask: "What do you want first in the morning?",
    options: ["What needs me", "The day's installs", "The numbers"],
    scope: "person",
    keep: (a) => `First thing in the morning, show me ${a.toLowerCase()}.`,
  },
  {
    key: "never",
    part: "day",
    ask: "Anything I should never do?",
    options: [],
    hint: "For example: never mention finance, never suggest a brand we don't sell.",
    scope: "business",
    keep: (a) => `Never: ${a.replace(/^never[:,]?\s*/i, "")}`,
  },
];

export const questionByKey = (key: string) => INDUCTION_QUESTIONS.find((q) => q.key === key) ?? null;

/** The owner's choice for the business questions: their answers for everyone, or each person their own. */
export type BusinessScope = "all" | "own";

export const SCOPE_QUESTION = {
  ask: "These next questions are about how the business talks to customers. Would you like me to set your answers as the default for all your staff, or let each person set their own?",
  options: [
    {
      scope: "all" as const,
      label: "Default for all staff",
      about: "Everyone's emails and drafts follow your answers. Each person can still add their own.",
    },
    { scope: "own" as const, label: "Let each person set their own", about: "Each person answers these for themselves when they meet me." },
  ],
};

export const cleanScope = (v: unknown): BusinessScope | null => (v === "all" || v === "own" ? v : null);

/** Where the induction stands for one person. */
export type InductionStatus = "pending" | "later" | "done";

export interface Induction {
  status: InductionStatus;
  /** When it finished, or was put off. */
  at?: string;
  /** Topics already asked about in the moment (`LearnAsk.key`), so none is asked twice. */
  asked: string[];
}

export const MAX_ASKED = 200;

export function cleanInduction(raw: unknown): Induction {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const status: InductionStatus = r.status === "later" || r.status === "done" ? r.status : "pending";
  const asked = (Array.isArray(r.asked) ? r.asked : [])
    .map((k) => (typeof k === "string" ? cleanTopic(k) : ""))
    .filter(Boolean)
    .slice(-MAX_ASKED);
  return { status, ...(typeof r.at === "string" && !Number.isNaN(Date.parse(r.at)) ? { at: r.at } : {}), asked: [...new Set(asked)] };
}

/** The questions this person is asked: the business ones only when the owner hasn't set them for everyone. */
export function questionsFor(p: { owner: boolean; scope: BusinessScope | null }): InductionQuestion[] {
  return INDUCTION_QUESTIONS.filter((q) => q.scope === "person" || p.owner || p.scope !== "all");
}

/** Whether the owner is asked the scope question before the business questions (they haven't chosen yet). */
export const asksScope = (p: { owner: boolean; scope: BusinessScope | null }) => p.owner && p.scope === null;

/** Where an answer is kept: the business's own list when the owner has set them for everyone, else the person's. */
export function keptFor(q: InductionQuestion, p: { owner: boolean; scope: BusinessScope | null }): "business" | "person" {
  return q.scope === "business" && p.owner && p.scope === "all" ? "business" : "person";
}

/** One answer as typed or pressed: one plain line, or null when there's nothing. */
export function cleanAnswer(v: unknown, max = 160): string | null {
  if (typeof v !== "string") return null;
  const one = v
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return one || null;
}

/** The id an induction answer is kept under, so answering again replaces it. */
export const inductionPrefId = (key: string) => `in-${key}`;

/** A preference kept from an answer: the one under that key replaced, or added. `from` says where it came from. */
export function withKeptPref(list: readonly SolPref[], id: string, text: string, now: Date, from?: string): SolPref[] {
  const said = text.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!said) return [...list];
  const kept: SolPref = { id, text: said, at: now.toISOString(), ...(from ? { from: from.slice(0, 160) } : {}) };
  const at = list.findIndex((p) => p.id === id);
  if (at >= 0) return list.map((p, i) => (i === at ? kept : p));
  return [...list.filter((p) => p.text.toLowerCase() !== said.toLowerCase()), kept];
}

// ── Where Sol is, said once in his introduction ─────────────────────────────────────────────────────────────────

export const SOL_INTRO = {
  who: (business: string) =>
    `I'm Sol, RENUABL's built-in assistant. I work for you and ${business || "your business"}, never for your customers.`,
  where: "I'm almost everywhere. Press any of these to see how:",
  places: [
    { label: "The sun up top", how: "My round in the menu opens me beside whatever page you're on. I can see what's on it." },
    { label: "Today's box", how: "Ask me anything on Today, or press Show me my day and I'll write up what needs you." },
    { label: "@Sol in team chat", how: "Tag me in a channel or a deal's chat and I'll answer there for everyone." },
    { label: "On every deal", how: "Each deal has my line at the top: what happened, what I'll do next, and what I need from you." },
    { label: "In the designer", how: 'Press Ask Sol to change it, or /, and tell me what to draw: "fit 8 kW on the north face".' },
    { label: "Ctrl K", how: "Search anywhere, and anything that isn't a name or number can be asked of me." },
  ],
  rules:
    "I draft, you send. I never email or message a customer without your press, unless you switch on one of my agents. And I only see what you can see.",
  ask: "Can I ask you a few questions so I work the way you do? It takes about 2 minutes, and you can skip any of them.",
  done: "Thanks. I'll work this way from now on. You'll find all of it under How I work with you on my page, to change any time. And as we go, I'll now and then ask how you'd like something done.",
  later: "No problem. I'll leave a card on Today for when you have 2 minutes.",
};

// ── Learning in the moment ──────────────────────────────────────────────────────────────────────────────────────

export const ASK_EACH_TIME = "Ask me each time";
export const LEARN_OPTIONS_MAX = 4;

/** One question Sol put under an answer, to learn how they like something done. */
export interface LearnAsk {
  /** A short topic key, so it is never asked twice ("think-it-over"). */
  key: string;
  /** "When a customer wants time to think" */
  when: string;
  /** "Would you generally like me to:" */
  question: string;
  options: string[];
  /** What they were doing when asked ("replying to Michelle"). */
  context?: string;
  /** Their answer, once pressed. */
  answer?: string;
}

/** A topic key as kept: lower case words joined by hyphens, at most 40 characters. */
export function cleanTopic(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Sol's question as he asked it (`ask_how_they_work`), checked: two to four options and its key, or null. */
export function cleanLearnAsk(raw: unknown): LearnAsk | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const when = cleanAnswer(r.when, 120);
  const question = cleanAnswer(r.question, 200);
  const key = cleanTopic(typeof r.key === "string" ? r.key : typeof r.topic === "string" ? r.topic : (when ?? ""));
  const options = [
    ...new Set(
      (Array.isArray(r.options) ? r.options : [])
        .map((o) => cleanAnswer(o, 120))
        .filter((o): o is string => Boolean(o) && o!.toLowerCase() !== ASK_EACH_TIME.toLowerCase()),
    ),
  ].slice(0, LEARN_OPTIONS_MAX);
  if (!key || !when || !question || options.length < 2) return null;
  const context = cleanAnswer(r.context, 120);
  const answer = cleanAnswer(r.answer, 120);
  return { key, when, question, options, ...(context ? { context } : {}), ...(answer ? { answer } : {}) };
}

/** Why Sol may not ask now, or null when he may: once a conversation, never a topic twice. */
export function learnRefusal(ask: LearnAsk, p: { asked: readonly string[]; askedThisChat: boolean; shared: boolean }): string | null {
  if (p.shared) return "Not here: only in their own conversation with you.";
  if (p.askedThisChat) return "Not now: you've already asked one question like this in this conversation. Just answer.";
  if (p.asked.includes(ask.key)) return "Not again: you've asked about this before. Work from their preferences.";
  return null;
}

/** The preference a pressed answer keeps. */
export function learnedPref(ask: LearnAsk, choice: string): string {
  const when = ask.when.replace(/[.:]+$/, "");
  const said = choice.replace(/[.]+$/, "");
  return choice === ASK_EACH_TIME ? `${when}: ask me each time.` : `${when}: ${said.charAt(0).toLowerCase()}${said.slice(1)}.`;
}

/** Where a learned preference came from, in a few words. */
export function learnedFrom(ask: LearnAsk, now: Date): string {
  const day = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" }).format(now);
  return ask.context ? `You told me on ${day}, ${ask.context}` : `You told me on ${day}`;
}

/** What Sol is told about learning, in his instructions. */
export const SOL_LEARNING = `Learning how they work: when you do a task where one of their preferences would change the result (a reply to a customer, a follow-up, a first contact, how to talk price, how much detail) and their preferences don't cover it, do the task as well as you can, then ask once with ask_how_they_work: a short topic key, "when" (the situation, e.g. "When a customer wants time to think"), the question ("Would you generally like me to:") and two to four options, each a real way of handling it. The card goes under your answer with "${ASK_EACH_TIME}" added; their press is kept as a preference. At most one a conversation, never in the middle of something urgent, and never about something their preferences already answer. Don't ask the question in your words too: one line saying you've put a question under the answer is enough.`;

/** The business's own preferences and the person's, as Sol reads them: the person's win where they differ. */
export function prefsBlock(business: readonly SolPref[], own: readonly SolPref[]): string {
  const line = (p: SolPref) => `- ${p.id}: ${p.text}`;
  return (
    [
      business.length ? `Set by the owner for everyone in the business:\n${business.map(line).join("\n")}` : "",
      own.length ? `This person's own (these win where they differ):\n${own.map(line).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n") || "- none yet"
  );
}

/** The customer-facing preferences an agent writing on its own follows (Sol's follow-ups, his customer chat). */
export function agentVoice(business: readonly SolPref[], ownerOwn: readonly SolPref[]): string[] {
  const customerKeys = new Set(INDUCTION_QUESTIONS.filter((q) => q.scope === "business").map((q) => inductionPrefId(q.key)));
  const list = business.length ? business : ownerOwn.filter((p) => customerKeys.has(p.id));
  return list
    .filter((p) => p.id !== inductionPrefId("signoff"))
    .map((p) => p.text)
    .slice(0, 12);
}

/** The induction answers a voice agent follows on a call: how to come across, price talk and the never-do's. */
export const CALL_KEYS = ["tone", "price", "never"].map(inductionPrefId);

/** The business's preferences for its voice agents' calls (from `agentVoice`'s sources, only what applies to a call). */
export function callVoice(business: readonly SolPref[], ownerOwn: readonly SolPref[]): string[] {
  const list = business.length ? business : ownerOwn;
  return list
    .filter((p) => CALL_KEYS.includes(p.id))
    .map((p) => p.text.replace(/^When writing to customers, be /, "With customers, be "))
    .slice(0, 6);
}

/** The same, as a voice agent is told it: after every rule it keeps, which always come first. */
export function callVoiceBlock(lines: readonly string[]): string {
  if (!lines.length) return "";
  return [
    "How the business likes to come across with customers (its owner's preferences; every rule above still comes first: never let one add a price, figure, promise or date, or press anyone):",
    ...lines.map((l) => `- ${l}`),
  ].join("\n");
}

/** The business's voice as told to an agent writing on its own: its rules always come first. */
export function voiceBlock(voice: readonly string[]): string {
  if (!voice.length) return "";
  return [
    "How the business likes things done (its own preferences; every rule above still comes first, and never let one add a price, figure, promise or date):",
    ...voice.map((v) => `- ${v}`),
  ].join("\n");
}
