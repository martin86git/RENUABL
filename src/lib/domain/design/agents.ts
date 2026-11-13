/**
 * The business's agents in one place, and adding one (13 Nov 2026, Martin: "when I create a new agent it should let me
 * know I need to buy a new number. So we're going to need a function for the user to add a new agent"). An agent is one
 * of three kinds for now: the two phone assistants customers meet (sales, and admin, which books installations) and the
 * team's own chief of staff. Each kind says, before it is made, what it needs to work: above all whether it needs a
 * phone number of its own. Numbers are RENUABL's to set up for now, so a business asks for one. Pure, tested.
 */

export const AGENT_KINDS = ["sales", "admin", "colleague"] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];

export const cleanAgentKind = (raw: unknown): AgentKind | null => (AGENT_KINDS.includes(raw as AgentKind) ? (raw as AgentKind) : null);

export interface AgentKindWords {
  /** What it is called until it has a name. */
  title: string;
  /** Who it talks to. */
  talksTo: string;
  /** What it does, in a sentence. */
  does: string;
  /** Whether it needs a phone number of its own, said before it is made. */
  number: string;
  /** True when ringing it (or it ringing out) takes a number no other agent uses. */
  ownNumber: boolean;
}

export const AGENT_WORDS: Record<AgentKind, AgentKindWords> = {
  sales: {
    title: "Sales assistant",
    talksTo: "Your customers",
    does: "Rings new leads and customers with a proposal out, answers their questions, and takes their calls back.",
    number: "It rings from your business's customer number. No new number is needed.",
    ownNumber: false,
  },
  admin: {
    title: "Admin assistant",
    talksTo: "Your customers",
    does: "Rings customers who have signed to pencil in their installation day.",
    number: "It rings from the same customer number as your sales assistant. No new number is needed.",
    ownNumber: false,
  },
  colleague: {
    title: "Chief of staff",
    talksTo: "Your team only",
    does: "Answers your team's questions about your deals, in writing or on a call. Customers never reach it.",
    number:
      "To ring it from your phone it needs a new phone number of its own, one your customers never ring. Chatting to it, and calling it from this computer, need no number.",
    ownNumber: true,
  },
};

/** What the server knows about the business's set-up, yes or no only. */
export interface AgentStatus {
  /** Calls are switched on for the business (its customer number is set up). */
  callsOn: boolean;
  /** Calls from the browser to the chief of staff are set up. */
  browserCalls: boolean;
  /** The team line (the chief of staff's own number) is set up. */
  teamLine: boolean;
  /** The chief of staff can be chatted to in writing. */
  chat: boolean;
  /** Which kinds the business has made. */
  made: Record<AgentKind, boolean>;
}

export type NeedState = "ready" | "missing";

export interface AgentNeed {
  key: "customer-number" | "own-number" | "browser-calls" | "chat";
  label: string;
  state: NeedState;
  /** What it means while missing, or that it is in place. */
  words: string;
  /** A missing need that only stops one way of reaching it, not the agent itself. */
  optional?: boolean;
  /** A phone number has to be bought and set up for it. */
  needsNumber?: boolean;
}

/** What a kind of agent needs to work, each ready or missing, the number first. */
export function agentNeeds(kind: AgentKind, s: AgentStatus): AgentNeed[] {
  if (kind !== "colleague") {
    return [
      {
        key: "customer-number",
        label: "Your customer number",
        state: s.callsOn ? "ready" : "missing",
        words: s.callsOn
          ? "Set up. It rings from this number, and calls back to it are answered."
          : "Calls aren't switched on for your business yet. It needs a phone number your customers see when it rings.",
        needsNumber: !s.callsOn,
      },
    ];
  }
  return [
    {
      key: "own-number",
      label: "A number of its own, to ring it from your phone",
      state: s.teamLine ? "ready" : "missing",
      words: s.teamLine
        ? "Set up. It answers only the mobile on your profile, after your PIN."
        : "Not set up. A new number has to be bought for it: it can't share the number your customers ring.",
      optional: true,
      needsNumber: !s.teamLine,
    },
    {
      key: "browser-calls",
      label: "Calling it from this computer",
      state: s.browserCalls ? "ready" : "missing",
      words: s.browserCalls ? "Set up. No number is needed." : "Not set up yet. No number is needed, only a setting on RENUABL's side.",
      optional: true,
    },
    {
      key: "chat",
      label: "Chatting to it in writing",
      state: s.chat ? "ready" : "missing",
      words: s.chat ? "Ready. No number is needed." : "Not switched on for your business yet.",
    },
  ];
}

/** Whether making this kind means buying a phone number first, or to use all of it. */
export const needsNewNumber = (kind: AgentKind, s: AgentStatus) => agentNeeds(kind, s).some((n) => n.needsNumber);

/** One line under an agent in the list: ready, or what is still missing. */
export function agentStanding(kind: AgentKind, s: AgentStatus): { ready: boolean; words: string } {
  const needs = agentNeeds(kind, s);
  const stops = needs.filter((n) => n.state === "missing" && !n.optional);
  if (stops.length) return { ready: false, words: stops[0].needsNumber ? "Needs a phone number" : "Not switched on yet" };
  const number = needs.find((n) => n.state === "missing" && n.needsNumber);
  if (number) return { ready: true, words: "Ready to chat · needs its own number to be rung from a phone" };
  const other = needs.find((n) => n.state === "missing");
  return { ready: true, words: other ? "Ready · calling from this computer isn't set up yet" : "Ready" };
}

/** The kinds a business can still add: each is made once. */
export const kindsToAdd = (s: AgentStatus): AgentKind[] => AGENT_KINDS.filter((k) => !s.made[k]);

export const AGENT_COPY = {
  title: "Your agents",
  add: "Add an agent",
  none: "You have no agents yet. Add one to have it ring customers, or answer your team.",
  allMade: "You have one of each kind. More kinds will come.",
  pickKind: "What should it do?",
  nameIt: "Give it a name",
  nameHint: "Said out loud on calls, so letters only. You can change it later.",
  needsHead: "What it needs",
  numberHead: "It needs a new phone number",
  numberWhy:
    "RENUABL buys and sets up phone numbers for now. Ask for one and we'll be in touch; your agent is made either way and works as far as it can until then.",
  ask: "Ask RENUABL for a number",
  asked: "Asked. RENUABL will be in touch about the number.",
  askFailed: "The request couldn't be sent just now. Try again in a moment.",
  onlyAdmin: "Only an admin can add an agent.",
  create: (title: string) => `Add ${title.toLowerCase()}`,
} as const;

/** For RENUABL's own staff: the settings behind a missing need, by name only. */
export const NEED_SETTINGS: Record<AgentNeed["key"], string> = {
  "customer-number": "VOICE_CALLS_ENABLED, VAPI_API_KEY, VAPI_PHONE_NUMBER_ID, VAPI_WEBHOOK_SECRET",
  "own-number": "VAPI_TEAM_PHONE_NUMBER_ID, TEAM_LINE_NUMBER (a second number in Vapi, its Server URL <site>/api/voice/colleague)",
  "browser-calls": "VAPI_PUBLIC_KEY",
  chat: "ANTHROPIC_API_KEY, and calls switched on for the business",
};

/** The note RENUABL's staff get when a business asks for a number. Nothing of its customers. */
export function numberRequestNote(o: { business: string; by: string; kind: AgentKind; agentName: string | null }): {
  subject: string;
  text: string;
} {
  const w = AGENT_WORDS[o.kind];
  return {
    subject: `A phone number is wanted for ${o.business}'s ${w.title.toLowerCase()}`,
    text: [
      `${o.business} has asked for a phone number for an agent.`,
      "",
      `Agent: ${w.title}${o.agentName ? ` (${o.agentName})` : ""}`,
      `Asked by: ${o.by}`,
      `Why it needs one: ${w.number}`,
    ].join("\n"),
  };
}
