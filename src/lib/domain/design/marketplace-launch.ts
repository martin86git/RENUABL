/**
 * The Marketplace before it opens (1 Nov 2026, Martin: "there's really not going to be any activity until we get a
 * decent amount of users", so pressing Marketplace shows a page that explains it and signs businesses up for the
 * launch). The Marketplace itself (job listings and equipment trading) stays built and switched off until
 * `NEXT_PUBLIC_MARKETPLACE_OPEN=true`: its pages show this page, its addresses answer as if it weren't there, and a
 * deal has no "List on the marketplace". The copy is here so it can be tested: nothing unprovable (no "first", "best",
 * "leading", no counts we don't have), no fees promised, nothing about payments passing through RENUABL. Pure, tested.
 */

/** Whether the Marketplace is open. Read the same on the server and in the browser (a NEXT_PUBLIC name is built in). */
export function marketplaceOpen(
  env: { NEXT_PUBLIC_MARKETPLACE_OPEN?: string } = { NEXT_PUBLIC_MARKETPLACE_OPEN: process.env.NEXT_PUBLIC_MARKETPLACE_OPEN },
): boolean {
  return env.NEXT_PUBLIC_MARKETPLACE_OPEN?.trim().toLowerCase() === "true";
}

/** The answer every Marketplace address gives until it opens: as if it weren't there. */
export const marketClosed = () => Response.json({ ok: false, message: "The Marketplace isn't open yet." }, { status: 404 });

/** What a business wants from the Marketplace, asked when it saves its place: tells us who to bring on first. */
export const WAITLIST_ROLES = [
  { id: "post", label: "Find installers for my jobs" },
  { id: "bid", label: "Win installation work" },
  { id: "trade", label: "Buy and sell spare equipment" },
] as const;
export type WaitlistRole = (typeof WAITLIST_ROLES)[number]["id"];

/** The roles ticked, known ones only, in order; none ticked is all three (they'll want to hear either way). */
export function cleanRoles(raw: unknown): WaitlistRole[] {
  const ids = WAITLIST_ROLES.map((r) => r.id);
  const picked = Array.isArray(raw) ? ids.filter((id) => raw.includes(id)) : [];
  return picked.length ? picked : [...ids];
}

/** The roles as kept on the lead, in words for staff. */
export const rolesNote = (roles: readonly WaitlistRole[]) =>
  roles.map((id) => WAITLIST_ROLES.find((r) => r.id === id)?.label ?? id).join("; ");

/** The waiting list is shown as a number only once it says something (a small number tells a visitor to wait). */
export const SHOW_COUNT_FROM = 20;
export const countLine = (n: number) => (n >= SHOW_COUNT_FROM ? `${n.toLocaleString("en-AU")} solar businesses are on the list.` : null);

export const LAUNCH = {
  eyebrow: "RENUABL Marketplace · Coming soon",
  headline: "The solar industry, connected.",
  sub: "One place where solar businesses find installers, win installation work and trade spare stock with each other. Open to every business on RENUABL.",
  save: "Save my place",
  saved: "You're on the list. We'll email you the day it opens.",
  why: "Opening once enough businesses are on board for there to be work and stock near you. Every business that joins brings that day closer.",

  jobsEyebrow: "Job listings",
  jobsHeadline: "Sold it? Find the crew to install it.",
  jobsSub:
    "A job listing is how a business that sells solar finds an installation partner, and how an installer finds work. One side posts the job, the other bids to install it.",
  poster: {
    who: "If you sell the job",
    title: "Find an installation partner",
    steps: [
      "List a sold job from its deal: the roof design, the system and the dates go up in one press.",
      "Installers near the job bid their price for the installation and the first day they could start.",
      "Choose a bid. Only then do you both see the address and each other's contact.",
    ],
  },
  installer: {
    who: "If you install",
    title: "Win installation work",
    steps: [
      "Browse jobs near your base, each with its roof design and everything you need to price it.",
      "Bid your price, ex GST, and the day you could start. Change it or take it back while the listing is open.",
      "Win it, and the address, the poster's contact and the job are yours.",
    ],
  },

  privacyEyebrow: "What's shown",
  privacyHeadline: "Everything to price the job. Nothing about the customer.",
  shown: [
    "The roof design, with everything around the roof blurred",
    "The suburb, and how far it is from you",
    "Panels, inverter, battery, EV charger and switchboard upgrade",
    "Storeys, roof, phase, arrays, strings and tilt frames",
    "The dates, and a guide price if the seller gives one",
  ],
  hidden: [
    "The customer's name, phone or email",
    "The street address, until a bid is chosen",
    "The seller's costs and margin",
    "Anything that would point to the home",
  ],

  tradeEyebrow: "Equipment",
  tradeHeadline: "Spare stock, sold to the business down the road.",
  tradeSub:
    "Ten panels left over from a job, an inverter swapped out, a pallet of rail. Put it up with photos and a price, and businesses near you can message you about it. You agree the sale between you: RENUABL takes no part in the payment.",
  tradePoints: ["Photos, a price each or offers", "Pick up or delivery", "Message the seller in the app", "Marked pending, then sold"],

  feedEyebrow: "Your feed",
  feedHeadline: "Work near you, as it comes up.",
  feedSub:
    "Installers get the jobs near their base as a feed, the ones closing soonest at the top: the roof, the system, the dates and how long is left. Watch the ones you're weighing up, bid in a few seconds, and turn on alerts to hear about new jobs near you as they're listed.",
  feedTry: "Try it: place a bid on a job below.",
  feedRules: [
    "The jobs closing soonest at the top, within the distance you choose",
    "Bids are sealed: only the seller sees your price",
    "The address and the seller's contact once your bid is chosen",
  ],
  feedNote: "An example feed, with made-up businesses and jobs.",

  networkEyebrow: "Why it matters",
  networkHeadline: "Every business that joins makes it worth more to the rest.",
  networkPoints: [
    { title: "More work for installers", body: "Every business that sells solar on RENUABL can send its jobs to the installers on it." },
    { title: "Faster crews for retailers", body: "Every installer on RENUABL is one more crew that can take your next job." },
    { title: "Stock that moves", body: "Every business is a buyer for what's sitting in your shed." },
  ],
  invite: "Know a business that should be on it?",
  inviteButton: "Tell them about it",
} as const;

/**
 * How long a listing has left, the way an auction says it: days and hours, then hours and minutes on its last day,
 * "Closing now" in its last minute, "Closed" after. `soon` marks the last 24 hours.
 */
export function closesIn(minutes: number): { words: string; soon: boolean } {
  if (minutes <= 0) return { words: "Closed", soon: false };
  if (minutes < 1) return { words: "Closing now", soon: true };
  const m = Math.floor(minutes);
  const days = Math.floor(m / 1440);
  const hours = Math.floor((m % 1440) / 60);
  if (days > 0) return { words: `${days}d ${hours}h left`, soon: false };
  return { words: hours > 0 ? `${hours}h ${m % 60}m left` : `${m % 60}m left`, soon: true };
}

/** A feed is served soonest closing first, within the distance chosen (null is anywhere), as the Marketplace's own is. */
export function servedFeed<T extends { km: number; minutesLeft: number }>(items: readonly T[], withinKm: number | null): T[] {
  return items.filter((i) => i.minutesLeft > 0 && (withinKm === null || i.km <= withinKm)).sort((a, b) => a.minutesLeft - b.minutesLeft);
}

/** The email a business sends from its own mail app to another (we send nothing ourselves): plain words, the link. */
export function inviteMail(site: string, from: string | null): string {
  const subject = "The RENUABL Marketplace";
  const body = [
    "I thought you'd want to see this.",
    "",
    "RENUABL is opening a marketplace for solar businesses: retailers list sold jobs and installers bid to install them, and businesses trade spare panels, inverters and batteries with each other.",
    "",
    `Have a look: ${site.replace(/\/$/, "")}/design`,
    ...(from ? ["", from] : []),
  ].join("\n");
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Every customer-facing line on the page, for the tests. */
export const launchWords = (): string[] => {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(LAUNCH);
  WAITLIST_ROLES.forEach((r) => out.push(r.label));
  return out;
};
