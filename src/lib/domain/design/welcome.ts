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

/**
 * The spotlight tour after the welcome: each place on the page, in order. `go` turns Today to the view the place is on
 * (the first view or Feed) before it is lit. A place still not on screen is passed over.
 * 20 Nov 2026, Martin: the tour "didnt show me the feed, deals pipeline". It now takes in the feed (Needs you, a deal's
 * card and its next move, the deals beside it) and Sales' pipeline, and says the menu and the bar as they are today.
 */
export const WELCOME_TOUR: { what: string; now: string; at: string; go?: "chat" | "feed" }[] = [
  {
    what: "Today",
    now: "is your home screen, in two views. The first is how the month is going and what's worth changing; Feed is your deals as they happen.",
    at: '[data-tour="today-switch"] [role="tablist"]',
    go: "chat",
  },
  {
    what: "Ask Sol",
    now: "about the business here: why a month is down, which leads are worth chasing, what to say to a customer.",
    at: '[data-tour="today-sol"]',
    go: "chat",
  },
  {
    what: "Needs you",
    now: "is the top of the feed: the work only a person can do, most pressing first. Clear it and the count goes down.",
    at: '[data-tour="feed-needs"]',
    go: "feed",
  },
  {
    what: "Each card",
    now: "is one deal: what just happened, what Sol has lined up, and one lit button for the next move. Done or Later takes it off your list until something new happens.",
    at: '[data-tour="feed-card"]',
    go: "feed",
  },
  {
    what: "Your deals",
    now: "sit beside the feed: new ones, those in progress, or all of them. Pick one to bring up its card.",
    at: 'aside[aria-label="Deals"]',
    go: "feed",
  },
  {
    what: "The designer",
    now: "is the orange round in the menu. Draw a roof and the quote builds as you go. Proposals slides out beside it.",
    at: 'a[aria-label="Design tool"]',
  },
  {
    what: "Sales",
    now: "holds your pipeline: every deal as a card in a column for its stage, dragged along as it moves. Proposals open and closed, and your calls, sit beside it.",
    at: '[data-tour="section-proposals"]',
  },
  {
    what: "The rest of the menu",
    now: "takes the work on after a sale. Jobs runs approvals, ordering and installs; Customers holds everyone you deal with; Service is for anything to put right after the install.",
    at: 'nav[aria-label="Sections"]',
  },
  {
    what: "Sol",
    now: "heads the bar on the right. He opens beside whatever page you're on and can see what's on your screen.",
    at: 'button[title="Sol, your assistant"]',
  },
  {
    what: "The bar",
    now: "also holds your phone agents and the + to add one, with team chat at its foot and your routines under it.",
    at: ".sol-rail",
  },
  {
    what: "RENUABL Marketplace",
    now: "is the blue round at the end of the menu. It's where solar businesses will list jobs, bid on installations and trade equipment. Coming soon.",
    at: 'a[aria-label^="RENUABL Marketplace"]',
  },
];
