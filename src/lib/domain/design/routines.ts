/**
 * Routines (20 Nov 2026, Martin: "the routines page itself, shows all agents Voice and Text (sol) and what they have
 * programmed into them… a really basic zapier / shopify flow type view, where you can see what action the agent is
 * being engaged on, and you can see any loops or what he does. adjusting here should adjust actions").
 *
 * Each agent's routine as a flow, read from what really drives it: the business's routine settings (sol-agents.ts:
 * which of Sol's agents send themselves, when, the follow-up days, how long an email waits, how often a new lead is
 * rung) and each voice agent's call setup and script. Nothing here is a second copy of a rule: a step that can be
 * changed names the setting it changes, and a step that can't says why (the law's calling hours, a rule every call
 * keeps). Pure: no I/O.
 */
import { MAX_ASKED_ATTEMPTS, RETRY_AFTER_HOURS, VOICE_HOURS } from "../voice-agent";
import { reasonWords, type CallAudience } from "./call-setup";
import { AGENTS, SEND_HOURS, type AgentSettings, type AgentStage } from "./sol-agents";

/** What a step can change, when it can. */
export type RoutineSetting =
  | { key: "on"; stage: AgentStage }
  | { key: "hours" }
  | { key: "followUpDays" }
  | { key: "reviewMinutes" }
  | { key: "helloMinutes" }
  | { key: "callAttempts" }
  | { key: "audience"; agent: string }
  | { key: "script"; agent: string };

export type StepKind = "trigger" | "wait" | "check" | "action" | "handoff" | "end";

export interface RoutineStep {
  id: string;
  kind: StepKind;
  title: string;
  /** One more line, plainly. */
  detail?: string;
  /** For a check: what happens when it doesn't hold. */
  otherwise?: string;
  /** What changing this step changes. */
  setting?: RoutineSetting;
  /** Why it can't be changed here, when it can't. */
  fixed?: string;
}

/** Steps that repeat, with what decides how often. */
export interface RoutineLoop {
  id: string;
  kind: "loop";
  title: string;
  detail?: string;
  setting?: RoutineSetting;
  /** Why how often can't be changed here, when it can't. */
  fixed?: string;
  steps: RoutineStep[];
  /** What happens once the repeats are done. */
  after: string;
}

export type RoutineNode = RoutineStep | RoutineLoop;

export interface Routine {
  id: string;
  /** Sol writes; a voice agent rings. */
  medium: "text" | "voice";
  agent: string;
  /** The voice agent's key, for its face and its own settings. */
  agentKey?: string;
  title: string;
  what: string;
  /** On, off, or null where it always runs when it is set up (a voice agent's calls follow the business's calls). */
  on: boolean | null;
  /** The switch, when there is one. */
  onSetting?: RoutineSetting;
  /** For one not built yet: what is coming. */
  soon?: string;
  /** Why it isn't running, when it can't (calls not switched on). */
  standing?: string;
  nodes: RoutineNode[];
}

export interface VoiceAgentFacts {
  key: string;
  name: string;
  role: "sales" | "admin";
  /** The first sales agent rings new leads by itself; the others when a call is handed to them. */
  first: boolean;
  audience: CallAudience;
  reason: string;
  /** How its name is said, kept as it is when the audience changes here. */
  saidAs?: string;
  script: string;
  scripts: { id: string | null; name: string }[];
}

export interface RoutineFacts {
  settings: AgentSettings;
  /** Sol answers customers in their proposal chat and on their lead page. */
  solAnswers: boolean;
  /** The business's calls are switched on, and why not when they aren't. */
  callsOn: boolean;
  callsWhy?: string;
  voice: VoiceAgentFacts[];
}

const minutesWords = (m: number) => (m < 60 ? `${m} minutes` : m === 60 ? "an hour" : `${m / 60} hours`);
const timesWords = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const clock = (h: number) => {
  const whole = Math.floor(h);
  const half = h % 1 ? ":30" : "";
  const twelve = whole > 12 ? whole - 12 : whole;
  return `${twelve}${half} ${whole >= 12 ? "pm" : "am"}`;
};

/** "2, 7 and 14 days". */
export function daysWords(days: readonly number[]): string {
  if (!days.length) return "";
  const list = days.length === 1 ? `${days[0]}` : `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`;
  return `${list} ${days.length === 1 && days[0] === 1 ? "day" : "days"}`;
}

/** The hours calls may start, as the law and the product allow. */
export const CALL_HOURS_WORDS = `Weekdays ${clock(VOICE_HOURS.weekday.from)} to ${clock(VOICE_HOURS.weekday.to)}, Saturdays ${clock(VOICE_HOURS.saturday.from)} to ${clock(VOICE_HOURS.saturday.to)}. Never Sundays or public holidays.`;

const hoursStep = (id: string, s: AgentSettings): RoutineStep => ({
  id,
  kind: "check",
  title: `Inside ${SEND_HOURS[s.hours].label.toLowerCase()}?`,
  detail: `${SEND_HOURS[s.hours].words}, never weekends or public holidays`,
  otherwise: "Waits for the hours to open",
  setting: { key: "hours" },
});

const sendStep = (id: string, s: AgentSettings, stage: AgentStage, what: string): RoutineStep => ({
  id,
  kind: "action",
  title: s.on.includes(stage) ? `Sends ${what}` : `Waits for your press to send ${what}`,
  detail: s.on.includes(stage)
    ? "From your business's name, written on the deal"
    : "Switched off: Sol drafts it and you send it from the card",
  setting: { key: "on", stage },
});

function leads(f: RoutineFacts): Routine {
  const s = f.settings;
  return {
    id: "sol-lead",
    medium: "text",
    agent: AGENTS.lead.name,
    title: "A new lead hears back in minutes",
    what: AGENTS.lead.job,
    on: s.on.includes("lead"),
    onSetting: { key: "on", stage: "lead" },
    nodes: [
      {
        id: "lead-in",
        kind: "trigger",
        title: "A new lead comes in",
        detail: "With an email and a place on the map, in the last two days",
      },
      {
        id: "lead-new",
        kind: "check",
        title: "Nobody from the team in touch yet?",
        detail: "No email, call, message or proposal on the deal",
        otherwise: "Stops: the team has it",
      },
      {
        id: "lead-write",
        kind: "action",
        title: "Writes a short hello",
        detail: "With a link to their own page: their home from above and a chat",
      },
      {
        id: "lead-wait",
        kind: "wait",
        title: `Waits ${minutesWords(s.helloMinutes)}`,
        detail: "So you can read it, change it or stop it",
        setting: { key: "helloMinutes" },
      },
      hoursStep("lead-hours", s),
      sendStep("lead-send", s, "lead", "the hello"),
      f.solAnswers
        ? {
            id: "lead-chat",
            kind: "action",
            title: "Answers them in the chat on their page",
            detail: "Never a price or a promise; asks for the bill or a call",
          }
        : {
            id: "lead-chat",
            kind: "action",
            title: "Their messages come to you",
            detail: "Sol answering customers is off (Settings → Emails for proposals and chat)",
          },
      {
        id: "lead-hand",
        kind: "handoff",
        title: "Anything to agree goes to the team",
        detail: "Bookings, prices, anything Sol can't answer",
      },
    ],
  };
}

function proposals(f: RoutineFacts): Routine {
  const s = f.settings;
  const n = s.followUpDays.length;
  return {
    id: "sol-proposal",
    medium: "text",
    agent: AGENTS.proposal.name,
    title: "A quiet proposal is followed up",
    what: AGENTS.proposal.job.replace(/\(2, 7 and 14 days after it's sent\)/, `(${daysWords(s.followUpDays)} after it's sent)`),
    on: s.on.includes("proposal"),
    onSetting: { key: "on", stage: "proposal" },
    nodes: [
      {
        id: "prop-in",
        kind: "trigger",
        title: "Your proposal reaches the customer",
        detail: "Opened, or written to since you published it",
      },
      {
        id: "prop-loop",
        kind: "loop",
        title: `Repeats on day ${s.followUpDays.join(", ")}`,
        detail: `${n === 1 ? "One follow-up" : `${n} follow-ups`} after it goes out`,
        setting: { key: "followUpDays" },
        steps: [
          {
            id: "prop-quiet",
            kind: "check",
            title: "Gone quiet?",
            detail: "Not signed, they haven't written, and nobody has emailed or replied since",
            otherwise: "Skips this one",
          },
          {
            id: "prop-write",
            kind: "action",
            title: "Writes a friendly follow-up",
            detail: "Their questions first, one easy next step, no figures",
          },
          {
            id: "prop-wait",
            kind: "wait",
            title: `Waits ${minutesWords(s.reviewMinutes)}`,
            detail: "So you can read it, change it or stop it",
            setting: { key: "reviewMinutes" },
          },
          hoursStep("prop-hours", s),
          sendStep("prop-send", s, "proposal", "the follow-up"),
        ],
        after: "After the last one, it's over to you",
      },
      {
        id: "prop-stop",
        kind: "end",
        title: "Stops when they sign or write back",
        detail: "Their reply comes to you, with the deal lit as Needs you",
      },
    ],
  };
}

function soon(stage: AgentStage): Routine {
  const a = AGENTS[stage];
  return { id: `sol-${stage}`, medium: "text", agent: a.name, title: a.what, what: a.job, on: null, soon: a.soon, nodes: [] };
}

function salesCalls(f: RoutineFacts, v: VoiceAgentFacts): Routine {
  const s = f.settings;
  const cold = v.audience === "cold";
  const ring: RoutineStep = {
    id: `${v.key}-ring`,
    kind: "action",
    title: `Rings them ${reasonWords({ audience: v.audience, reason: v.reason })}`,
    detail: `${cold ? "Cold calls" : "People who enquired"} · script "${v.script}"`,
    setting: { key: "script", agent: v.key },
  };
  const hours: RoutineStep = {
    id: `${v.key}-hours`,
    kind: "check",
    title: "Inside calling hours?",
    detail: CALL_HOURS_WORDS,
    otherwise: "Waits for the next calling window",
    fixed: "Set by the rules for calling people at home: it can't be changed here.",
  };
  const answered: RoutineStep = {
    id: `${v.key}-answer`,
    kind: "check",
    title: "Did they answer?",
    detail: "Answers questions, meets worries and books the 15-minute call",
    otherwise: "Tries again",
  };
  const nodes: RoutineNode[] = v.first
    ? [
        {
          id: `${v.key}-in`,
          kind: "trigger",
          title: "A new lead comes in with a mobile",
          detail: "Who agreed to be phoned",
          setting: { key: "audience", agent: v.key },
        },
        {
          id: `${v.key}-loop`,
          kind: "loop",
          title: `Up to ${timesWords(s.callAttempts)}`,
          detail: s.callAttempts > 1 ? `Then ${RETRY_AFTER_HOURS[0]} hours later, then the next day` : "One call only",
          setting: { key: "callAttempts" },
          steps: [hours, ring, answered],
          after: "Still no answer: over to the team, written on the deal",
        },
        { id: `${v.key}-done`, kind: "end", title: "Writes the call on the deal", detail: "What it came to, with the transcript" },
      ]
    : [
        { id: `${v.key}-in`, kind: "trigger", title: "You hand it a call", detail: "From a deal's Call menu, with what the call is about" },
        {
          id: `${v.key}-loop`,
          kind: "loop",
          title: `Up to ${timesWords(MAX_ASKED_ATTEMPTS)}`,
          detail: "A call you handed over is tried twice",
          fixed: "A handed-over call is always tried twice.",
          steps: [hours, ring, answered],
          after: "Still no answer: back to you, written on the deal",
        },
        { id: `${v.key}-done`, kind: "end", title: "Writes the call on the deal", detail: "What it came to, with the transcript" },
      ];
  return {
    id: `voice-${v.key}`,
    medium: "voice",
    agent: v.name,
    agentKey: v.key,
    title: v.first ? (cold ? "New numbers are cold called" : "New leads are rung") : "Calls you hand it",
    what: v.first ? "Rings each new lead by itself, then hands them to the team." : "Rings the customer you hand it, about what you say.",
    on: f.callsOn ? true : null,
    standing: f.callsOn ? undefined : f.callsWhy,
    nodes,
  };
}

function bookings(f: RoutineFacts, v: VoiceAgentFacts): Routine {
  return {
    id: `voice-${v.key}`,
    medium: "voice",
    agent: v.name,
    agentKey: v.key,
    title: "Installs are booked",
    what: "Rings a sold customer to pencil in an installation day.",
    on: f.callsOn ? true : null,
    standing: f.callsOn ? undefined : f.callsWhy,
    nodes: [
      { id: `${v.key}-in`, kind: "trigger", title: "You hand it a sold deal", detail: "Approvals through, no install date yet" },
      {
        id: `${v.key}-hours`,
        kind: "check",
        title: "Inside calling hours?",
        detail: CALL_HOURS_WORDS,
        otherwise: "Waits for the next calling window",
        fixed: "Set by the rules for calling people at home: it can't be changed here.",
      },
      {
        id: `${v.key}-offer`,
        kind: "action",
        title: "Offers the days you have room for",
        detail: "From your install calendar's capacity, never a day taken",
      },
      {
        id: `${v.key}-pencil`,
        kind: "action",
        title: "Pencils their day in",
        detail: "As a tentative install, never the deal's install date",
      },
      { id: `${v.key}-team`, kind: "handoff", title: "You confirm the day", detail: "Your team is emailed" },
    ],
  };
}

/** Every routine the business has: Sol's, then each voice agent's. */
export function routinesFor(f: RoutineFacts): Routine[] {
  const voice = f.voice.map((v) => (v.role === "admin" ? bookings(f, v) : salesCalls(f, v)));
  return [leads(f), proposals(f), ...voice, soon("designed"), soon("won")];
}

/** Every step in a routine, loops opened, for finding one by its id. */
export const stepsOf = (r: Routine): RoutineStep[] => r.nodes.flatMap((n) => (n.kind === "loop" ? n.steps : [n]));

/** How many routines are running now, for the round on the bar. */
export const runningCount = (routines: readonly Routine[]): number => routines.filter((r) => r.on === true).length;
