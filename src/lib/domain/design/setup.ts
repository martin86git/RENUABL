/**
 * Sol's setup wizard (21 Nov 2026, Martin: "i feel there are vital steps that im not aware of - i feel there should be a
 * Sol driven onboarding wizard - surplus to the welcome tours"). Seven steps a new business needs before the product
 * works for it, each read from what is really set up (never a tick kept by itself), each with Sol's line on why it
 * matters and one button to where it is done. A step can be skipped; the wizard can be put away and comes back from
 * the cog's menu. Pure, tested.
 */

export const SETUP_STEPS = ["email", "calendar", "pricing", "lead-inbox", "import", "proposal", "team"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export const cleanSetupStep = (raw: unknown): SetupStep | null => (SETUP_STEPS.includes(raw as SetupStep) ? (raw as SetupStep) : null);

/** What is really set up, read on the server. */
export interface SetupFacts {
  /** This person has a mailbox connected. */
  email: boolean;
  /** This person has a calendar connected. */
  calendar: boolean;
  /** The business has a supplier price list uploaded. */
  pricing: boolean;
  /** The business's lead inbox is switched on. */
  leadInbox: boolean;
  /** The business has customers of its own (not the sample). */
  imported: boolean;
  /** The business has saved its proposal details (its brand kit). */
  proposal: boolean;
  /** The business has more than one person. */
  team: boolean;
}

/** Who this is: some steps are the business's settings, and inviting people is the owner's. */
export interface SetupWho {
  /** May change the business's settings. */
  settings: boolean;
  owner: boolean;
}

export interface SetupStepWords {
  title: string;
  /** Sol's line: what it is and why it matters, in a sentence or two. No figure or promise. */
  sol: string;
  /** The button that does it. */
  action: string;
  /** Said once it is done. */
  done: string;
}

export const SETUP_WORDS: Record<SetupStep, SetupStepWords> = {
  email: {
    title: "Connect your email",
    sol: "Connect your mailbox and your customers' emails sit beside their deals. I can summarise them and draft replies, and you can send from your own address. Only you see your mailbox.",
    action: "Connect email",
    done: "Your email is connected.",
  },
  calendar: {
    title: "Connect your calendar",
    sol: "Connect your calendar and your day shows from the date at the top right. I can book a meeting into it when you ask me to.",
    action: "Connect calendar",
    done: "Your calendar is connected.",
  },
  pricing: {
    title: "Set your pricing",
    sol: "The designer prices a system as you draw it, from your own costs. Upload your wholesaler's price list, then check your installation rates and margin. Until you do, a quote has products with no cost and can't be sent.",
    action: "Upload a price list",
    done: "Your price list is in. Check your installation rates and margin too.",
  },
  "lead-inbox": {
    title: "Set up your lead inbox",
    sol: "Tell me which mailbox your enquiries arrive in. I read each new one, and a real lead becomes a deal with the customer's details, ready for you. It needs your email connected first.",
    action: "Set up the lead inbox",
    done: "Your lead inbox is on.",
  },
  import: {
    title: "Bring in your contacts and deals",
    sol: "Bring across what you already have, so your history is here from day one. Upload the export sheet from your old CRM, contacts or deals, and I match its columns for you to check. Nobody already here is changed.",
    action: "Bring them in",
    done: "Your customers are in.",
  },
  proposal: {
    title: "Set your proposal defaults",
    sol: "Your proposals go out in your name, not ours. Add your logo, colours and company details, then your payment terms and warranty. Every proposal uses them from then on.",
    action: "Set up your proposals",
    done: "Your proposal details are saved.",
  },
  team: {
    title: "Invite your team",
    sol: "Add the people you work with and choose what each can see: everything, or just their own deals without costs. Each one is a user on your plan.",
    action: "Add people",
    done: "Your team is in.",
  },
};

/** Where each step is done. Email and calendar connect in a small window over the page (`connect`). */
export const SETUP_PLACES: Record<SetupStep, { href: string; connect?: "email" | "calendar"; also?: { label: string; href: string }[] }> = {
  email: { href: "/design/inbox", connect: "email" },
  calendar: { href: "/design", connect: "calendar" },
  pricing: {
    href: "/design/settings/price-lists",
    also: [
      { label: "Installation rates", href: "/design/settings/installation-rates" },
      { label: "Margin", href: "/design/settings/margin" },
    ],
  },
  "lead-inbox": { href: "/design/settings/lead-inbox" },
  import: { href: "/design/settings/import", also: [{ label: "Sold jobs from Pylon", href: "/design/settings/pylon" }] },
  proposal: {
    href: "/design/settings/company",
    also: [
      { label: "Logo and colours", href: "/design/settings/theme" },
      { label: "Payment terms", href: "/design/settings/payment" },
      { label: "Warranty", href: "/design/settings/warranty" },
    ],
  },
  team: { href: "/design/settings/users" },
};

export type SetupState = "done" | "todo" | "skipped";

export interface SetupStepView {
  step: SetupStep;
  state: SetupState;
  words: SetupStepWords;
  /** Why it can't be done yet, when something comes first. */
  waits?: string;
}

export interface SetupView {
  steps: SetupStepView[];
  done: number;
  total: number;
  /** The step to open on: the first still to do, else the first skipped, else none. */
  next: SetupStep | null;
  /** Nothing left to do or come back to. */
  finished: boolean;
}

const FACT_OF: Record<SetupStep, keyof SetupFacts> = {
  email: "email",
  calendar: "calendar",
  pricing: "pricing",
  "lead-inbox": "leadInbox",
  import: "imported",
  proposal: "proposal",
  team: "team",
};

/** The steps for this person: their own email and calendar; the business's settings for who may change them; people for the owner. */
export function setupStepsFor(who: SetupWho): SetupStep[] {
  return SETUP_STEPS.filter((s) => (s === "email" || s === "calendar" ? true : s === "team" ? who.owner : who.settings));
}

export function cleanSkipped(raw: unknown): SetupStep[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(cleanSetupStep).filter((s): s is SetupStep => s !== null))];
}

/** Where setup stands. A step that is really done is done whether or not it was skipped before. */
export function setupView(facts: SetupFacts, skipped: readonly SetupStep[], who: SetupWho): SetupView {
  const steps = setupStepsFor(who).map((step): SetupStepView => {
    const state: SetupState = facts[FACT_OF[step]] ? "done" : skipped.includes(step) ? "skipped" : "todo";
    const waits =
      step === "lead-inbox" && state !== "done" && !facts.email
        ? "Connect your email first: the lead inbox reads one of your mailboxes."
        : undefined;
    return { step, state, words: SETUP_WORDS[step], ...(waits ? { waits } : {}) };
  });
  const done = steps.filter((s) => s.state === "done").length;
  const next = (steps.find((s) => s.state === "todo") ?? steps.find((s) => s.state === "skipped"))?.step ?? null;
  return { steps, done, total: steps.length, next, finished: steps.every((s) => s.state === "done") };
}

/** Whether the pill offering the wizard shows: something still to do that wasn't skipped, and it hasn't been put away. */
export function setupOffered(view: SetupView, putAway: boolean): boolean {
  return !putAway && view.steps.some((s) => s.state === "todo");
}

/** Sol's opening line on the wizard. */
export function setupHello(firstName: string | null, view: SetupView): string {
  const hi = firstName ? `${firstName}, ` : "";
  if (view.finished) return `${hi}everything here is set up. You can change any of it in Settings.`;
  const left = view.total - view.done;
  return view.done === 0
    ? `${hi}there are ${view.total} things to set up before RENUABL really works for you. I'll take you through them one at a time. Skip any you want to come back to.`
    : `${hi}${view.done} of ${view.total} done. ${left === 1 ? "One to go." : `${left} to go.`}`;
}
