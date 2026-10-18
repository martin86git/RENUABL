/**
 * The roof designer's front page: what it says about the product, in one
 * place so it can be checked. Each automation says whether it is in the
 * product today (`live`) or still being built (`soon`): the page marks the
 * second "Coming soon", so it never promises what the product can't do yet.
 * Pure, tested (`landing.test.ts`: no claim the product can't prove).
 */

export type FeatureStatus = "live" | "soon";

export const LANDING_HERO = {
  /**
   * The punchline (Martin, 18 Oct 2026): what the businesses we sell to want is sales, revenue, less complication and
   * speed. A roof becomes revenue; the line beneath shows how fast and how simply, without saying it.
   */
  /** What RENUABL is, in black and white, above the punchline. */
  what: "The all-in-one platform for solar businesses",
  headline: "From roof to revenue.",
  /** What it covers, in one line under the phrases. */
  covers: "Design, quotes, proposals, customers, ordering, installs and invoices. In one place.",
  /** Under the buttons: speed, said only as far as it is true today. */
  speed: "Roof to signed proposal, in one sitting.",
  /** What follows, a phrase at a time, each replacing the last. */
  follows: ["It's quoted.", "It's sent.", "It's signed.", "It's ordered.", "It's booked."],
} as const;

/** The page after the reveal: a sentence a screen, each something the product does today, in the order a job happens. */
export interface Chapter {
  key: "prices" | "three" | "proposal" | "after";
  line: string;
  sub: string;
  /** Shown only once the product does it. */
  live: boolean;
}

export const CHAPTERS: readonly Chapter[] = [
  {
    key: "prices",
    line: "It prices as you draw.",
    sub: "No spreadsheets. No guessing. Rails, brackets, inverter, battery and every fee, worked out for you.",
    live: true,
  },
  {
    key: "three",
    line: "Three designs. One click.",
    sub: "Quickest payback, maximum return, maximum independence. Each priced and strung, ready to send.",
    // Shown once the designer's three-designs button is in the product.
    live: false,
  },
  {
    key: "proposal",
    line: "Send it before you leave the driveway.",
    sub: "Your brand, your note, and a chat for their questions.",
    live: true,
  },
  {
    key: "after",
    line: "Signed. Then it runs itself.",
    sub: "The parts ordered, the install booked, the invoice checked.",
    live: true,
  },
];

/** The close. */
export const CLOSE = { line: "Draw once.", sub: "The hard part's done." } as const;

/** One thing the designer does by itself, in the order the demo shows it. */
export interface Automation {
  key: string;
  title: string;
  body: string;
  status: FeatureStatus;
}

export const AUTOMATIONS: readonly Automation[] = [
  {
    key: "site",
    title: "The site from your lead",
    body: "Open a deal and its roof is already there, from the address on the lead. Nothing to type in twice.",
    status: "live",
  },
  {
    key: "arrays",
    title: "Split arrays priced in",
    body: "Add another array and its installation cost joins the quote, at the rate you set.",
    status: "live",
  },
  {
    key: "tilt",
    title: "Tilt frames on flat roofs",
    body: "Tilt the panels on a flat roof and the tilt kits and frame installation are added.",
    status: "live",
  },
  {
    key: "inverter",
    title: "The inverter suggested",
    body: "From the kW of panels on the roof, the inverter that suits, with the reason beside it.",
    status: "live",
  },
  {
    key: "phase",
    title: "Three-phase fees added",
    body: "Choose a three-phase inverter and its installation fee and meter come with it.",
    status: "live",
  },
  {
    key: "battery",
    title: "The battery recommended",
    body: "From the panels' output and the customer's bill, how much storage the home needs.",
    status: "live",
  },
  {
    key: "strings",
    title: "Strings drawn for you",
    body: "The panels strung automatically and checked against the inverter's inputs.",
    status: "live",
  },
] as const;

export interface AfterStep {
  key: string;
  title: string;
  body: string;
  status: FeatureStatus;
}

export const AFTER_STEPS: readonly AfterStep[] = [
  {
    key: "signed",
    title: "Signed proposals",
    body: "The customer signs on their proposal and the deal moves to Won.",
    status: "live",
  },
  {
    key: "order",
    title: "Ordering Station",
    body: "The bill of materials from the design itself: panels, rails, splices, roof brackets, counted by rule.",
    status: "live",
  },
  {
    key: "send-order",
    title: "Order sent to your supplier",
    body: "Send the order straight from the platform.",
    status: "live",
  },
  {
    key: "scheduler",
    title: "Install Scheduler",
    body: "Every booked install in one calendar, with reminders sent to the customer to get ready.",
    status: "live",
  },
  {
    key: "invoices",
    title: "Installer Invoices",
    body: "After the install, upload the installer's invoice and it is checked against what the quote allowed, with the differences shown.",
    status: "live",
  },
] as const;

export const COMING_SOON_LABEL = "Coming soon";

/** Every line of copy on the page, for the test that checks it. */
export function landingCopy(): string[] {
  return [
    LANDING_HERO.what,
    LANDING_HERO.headline,
    LANDING_HERO.covers,
    LANDING_HERO.speed,
    ...LANDING_HERO.follows,
    ...CHAPTERS.flatMap((c) => [c.line, c.sub]),
    ...Object.values(CLOSE),
    ...AUTOMATIONS.flatMap((a) => [a.title, a.body]),
    ...AFTER_STEPS.flatMap((s) => [s.title, s.body]),
  ];
}
