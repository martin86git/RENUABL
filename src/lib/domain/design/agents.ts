/**
 * The business's agents in one place, and adding one (13 Nov 2026, Martin: "when I create a new agent it should let me
 * know I need to buy a new number. So we're going to need a function for the user to add a new agent"). An agent is one
 * of three kinds for now: the two phone assistants customers meet (sales, and admin, which books installations) and the
 * team's own chief of staff. Each kind says, before it is made, what it needs to work: above all whether it needs the
 * business's phone number.
 *
 * **One phone number a business** (14 Nov 2026, Martin: "let's keep it down to the one phone number… a user will need to
 * buy this phone number as an additional charge on their plan"): both phone assistants ring from it and it takes their
 * calls back. The chief of staff is chatted to in writing only for now, so it needs no number. The number is an extra
 * on the business's plan; its price isn't set yet (`NUMBER_MONTHLY_CENTS`), so nothing is charged from here: a business
 * asks for it and RENUABL confirms the price and sets it up. Pure, tested.
 */

export const AGENT_KINDS = ["sales", "admin", "colleague"] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];

export const cleanAgentKind = (raw: unknown): AgentKind | null => (AGENT_KINDS.includes(raw as AgentKind) ? (raw as AgentKind) : null);

/**
 * What the business's phone number adds to its plan each month, in cents including GST. Null until Martin sets it:
 * while it is null no price is shown and nothing is charged.
 */
export const NUMBER_MONTHLY_CENTS: number | null = null;

/** The price of the number in words, or that it will be confirmed first. */
export function numberPriceWords(cents: number | null = NUMBER_MONTHLY_CENTS): string {
  if (cents === null) return "It is an extra charge on your plan. RENUABL will confirm the price with you before anything is charged.";
  const dollars = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return `It adds $${dollars} a month to your plan, including GST.`;
}

export interface AgentKindWords {
  /** What it is called until it has a name. */
  title: string;
  /** Who it talks to. */
  talksTo: string;
  /** What it does, in a sentence. */
  does: string;
  /** Whether it needs the business's phone number, said before it is made. */
  number: string;
  /** True when it makes and takes calls, so it needs the business's number. */
  usesNumber: boolean;
}

export const AGENT_WORDS: Record<AgentKind, AgentKindWords> = {
  sales: {
    title: "Sales assistant",
    talksTo: "Your customers",
    does: "Rings new leads and customers with a proposal out, answers their questions, and takes their calls back.",
    number: "It rings from your business phone number, the one number all your agents share.",
    usesNumber: true,
  },
  admin: {
    title: "Admin assistant",
    talksTo: "Your customers",
    does: "Rings customers who have signed to pencil in their installation day.",
    number: "It rings from your business phone number, the same one your sales assistant uses.",
    usesNumber: true,
  },
  colleague: {
    title: "Chief of staff",
    talksTo: "Your team only",
    does: "Answers your team's questions about your deals in writing. Customers never reach it.",
    number: "You chat to it in writing, so it needs no phone number.",
    usesNumber: false,
  },
};

/** What the server knows about the business's set-up, yes or no only. */
export interface AgentStatus {
  /** The business's phone number is set up, so its phone assistants can call. */
  callsOn: boolean;
  /** The chief of staff can be chatted to in writing. */
  chat: boolean;
  /** Which kinds the business has made. */
  made: Record<AgentKind, boolean>;
}

export type NeedState = "ready" | "missing";

export interface AgentNeed {
  key: "business-number" | "chat";
  label: string;
  state: NeedState;
  /** What it means while missing, or that it is in place. */
  words: string;
  /** The business's phone number has to be bought and set up for it. */
  needsNumber?: boolean;
}

/** What a kind of agent needs to work, each ready or missing. */
export function agentNeeds(kind: AgentKind, s: AgentStatus): AgentNeed[] {
  if (AGENT_WORDS[kind].usesNumber) {
    return [
      {
        key: "business-number",
        label: "Your business phone number",
        state: s.callsOn ? "ready" : "missing",
        words: s.callsOn
          ? "Set up. Your agents ring from it, and calls back to it are answered."
          : "Not on your plan yet. Your agents can't ring anyone until your business has its number.",
        needsNumber: !s.callsOn,
      },
    ];
  }
  return [
    {
      key: "chat",
      label: "Chatting to it in writing",
      state: s.chat ? "ready" : "missing",
      words: s.chat ? "Ready. No phone number is needed." : "Not switched on for your business yet.",
    },
  ];
}

/** Whether this kind can't work until the business has bought its phone number. */
export const needsNewNumber = (kind: AgentKind, s: AgentStatus) => agentNeeds(kind, s).some((n) => n.needsNumber);

/** One line under an agent in the list: ready, or what is still missing. */
export function agentStanding(kind: AgentKind, s: AgentStatus): { ready: boolean; words: string } {
  const missing = agentNeeds(kind, s).find((n) => n.state === "missing");
  if (!missing) return { ready: true, words: AGENT_WORDS[kind].usesNumber ? "Ready" : "Ready to chat" };
  return { ready: false, words: missing.needsNumber ? "Needs your business phone number" : "Not switched on yet" };
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
  nameHint: "Letters only, since a phone agent says it out loud. You can change it later.",
  needsHead: "What it needs",
  numberHead: "It needs your business phone number",
  numberWhy:
    "One number for your whole business: every phone agent rings from it, so you only ever buy one. Your agent is made either way and starts calling once the number is set up.",
  ask: "Ask for my business number",
  asked: "Asked. RENUABL will be in touch about your business number.",
  askFailed: "The request couldn't be sent just now. Try again in a moment.",
  onlyAdmin: "Only an admin can add an agent.",
  create: (title: string) => `Add ${title.toLowerCase()}`,
} as const;

/** For RENUABL's own staff: the settings behind a missing need, by name only. */
export const NEED_SETTINGS: Record<AgentNeed["key"], string> = {
  "business-number": "VOICE_CALLS_ENABLED, VAPI_API_KEY, VAPI_PHONE_NUMBER_ID, VAPI_WEBHOOK_SECRET",
  chat: "ANTHROPIC_API_KEY, and calls switched on for the business",
};

/** The note RENUABL's staff get when a business asks for its number. Nothing of its customers. */
export function numberRequestNote(o: { business: string; by: string; kind: AgentKind; agentName: string | null }): {
  subject: string;
  text: string;
} {
  const w = AGENT_WORDS[o.kind];
  return {
    subject: `${o.business} wants its business phone number`,
    text: [
      `${o.business} has asked for its business phone number, an extra on its plan.`,
      "",
      `Asked while adding: ${w.title}${o.agentName ? ` (${o.agentName})` : ""}`,
      `Asked by: ${o.by}`,
      "Confirm the price with them before anything is charged, then set the number up.",
    ].join("\n"),
  };
}
