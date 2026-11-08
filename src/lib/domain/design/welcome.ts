import type { MemberPermissions } from "./account";

/**
 * The welcome on Today (5 Nov 2026, Martin: the first sign-in shouldn't start on Show me my day; Sol should type a
 * greeting and say how to get started: connect email and calendar, then, for the owner, add the team with a permission
 * level, then a short spotlight tour of Today, the designer, Sol and the Marketplace). Shown to each person once, until
 * they finish or skip it (`business_members.welcomed_at`).
 */
export type WelcomeStep = "connect" | "team" | "tour";

/** The steps for this person: adding people is the owner's alone. */
export function welcomeSteps(owner: boolean): WelcomeStep[] {
  return owner ? ["connect", "team", "tour"] : ["connect", "tour"];
}

/** The two levels offered when adding someone, as permissions the server already enforces (`can`). */
export type TeamLevel = "admin" | "user";

export const TEAM_LEVELS: { level: TeamLevel; label: string; about: string; permissions: MemberPermissions }[] = [
  {
    level: "admin",
    label: "Admin",
    about: "Everything: every deal, costs and margin, prices and settings, publishing proposals.",
    permissions: { costs: true, prices: true, publish: true, allDeals: true },
  },
  {
    level: "user",
    label: "User",
    about: "Their own deals and sending proposals. No costs, margin, prices or settings.",
    permissions: { costs: false, prices: false, publish: true, allDeals: false },
  },
];

export const levelPermissions = (level: TeamLevel): MemberPermissions =>
  (TEAM_LEVELS.find((l) => l.level === level) ?? TEAM_LEVELS[1]).permissions;

/** What Sol types as each step comes up. No figure, promise or claim. */
export function welcomeLines(firstName: string | null, business: string): Record<"hello" | WelcomeStep | "done", string> {
  const hi = firstName ? `Hi ${firstName}, welcome to RENUABL.` : "Hi, welcome to RENUABL.";
  return {
    hello: `${hi} I'm Sol, ${business ? `${business}'s` : "your"} assistant. Let's get you set up. It only takes a minute.`,
    connect:
      "First, connect your email and calendar. Your customers' emails then sit beside their deals, and your day is all in one place. Only you see them.",
    team: "Next, who else works with you? Add them here and choose what each can see. You can change it any time in Settings.",
    tour: "Last, a quick look around, so you know where everything is.",
    done: "You're all set. Ask me anything, or press Show me my day when you're ready.",
  };
}

/** The spotlight tour after the welcome: each place on the page, in order. A place not on screen is passed over. */
export const WELCOME_TOUR: { what: string; now: string; at: string }[] = [
  {
    what: "Today",
    now: "is your home screen. Inbox, Calendar and Pipeline sit beside it, and Your day shows what's left to clear before sunset.",
    at: 'nav[aria-label="Today"]',
  },
  {
    what: "Ask Sol",
    now: "anything about your deals here, or press Show me my day and he'll write up what needs you.",
    at: '[data-tour="today-sol"]',
  },
  {
    what: "The designer",
    now: "opens from the orange pen button. Draw a roof and the quote builds as you go.",
    at: 'a[aria-label="Design tool"]',
  },
  {
    what: "The menu",
    now: "is the layers button. Rest on it to open your CRM, procurement, installations and service; the pin keeps them open.",
    at: 'nav[aria-label="Sections"]',
  },
  {
    what: "Sol",
    now: "opens from the dark button with the sun, beside whatever page you're on. He can see what's on your screen.",
    at: 'button[title="Sol, your assistant"]',
  },
  {
    what: "RENUABL Marketplace",
    now: "is the blue button. It's where solar businesses will list jobs, bid on installations and trade equipment. Coming soon.",
    at: 'a[aria-label^="RENUABL Marketplace"]',
  },
  { what: "The buttons down the right", now: "hold team chat, your notifications and email.", at: ".sol-rail" },
];
