/**
 * The roof designer's front page: what it says about the product, in one
 * place so it can be checked. Each automation says whether it is in the
 * product today (`live`) or still being built (`soon`): the page marks the
 * second "Coming soon", so it never promises what the product can't do yet.
 * Pure, tested (`landing.test.ts`: no claim the product can't prove).
 */

export type FeatureStatus = "live" | "soon";

export const LANDING_HERO = {
  eyebrow: "For solar installers and retailers",
  headline: "Design it. Quote it. Win the job.",
  body: "One place for your solar business: the roof opens from your lead's address, the quote builds itself as you draw, and the proposal, the order and the install follow on their own.",
} as const;

/** The second screen: the quote that builds itself as the roof is designed. */
export const AUTOMATION = {
  eyebrow: "Smart automation",
  headline: "Draw the panels. The quote does the rest.",
  body: "Every array, frame and fee is worked out by rule as you design, from your own prices. No hunting for the right inverter, no adding up rails by hand.",
} as const;

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
    status: "soon",
  },
  {
    key: "strings",
    title: "Strings drawn for you",
    body: "The panels strung automatically and checked against the inverter's inputs.",
    status: "soon",
  },
] as const;

/** The third screen: from the designer to the customer and back, without leaving it. */
export const CONVERSATION = {
  eyebrow: "Send it from the designer",
  headline: "Write a note, send the proposal, keep talking.",
  body: "No copying a link into an email. Write to your customer beside the design and send the proposal from the same place. They answer on the proposal, like a text message, and every word is kept on the deal.",
  steps: [
    { title: "In the designer", body: "Write your note and send the proposal in one go." },
    { title: "On their proposal", body: "Your brand, your colours, and a chat they can answer." },
    { title: "In your CRM", body: "Sent, opened, every message and the signature, on the record." },
  ],
} as const;

/** The fourth screen: what happens once a customer signs. */
export const AFTER_SIGNING = {
  eyebrow: "Once it's signed",
  headline: "A signature starts the job.",
  body: "The parts in the design itself become the order, the installation is costed from the quote, and the install goes in the calendar.",
} as const;

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
    status: "soon",
  },
  {
    key: "invoices",
    title: "Installer Invoices",
    body: "The installer's invoice costed from the quote; upload theirs and the differences are shown.",
    status: "soon",
  },
  {
    key: "scheduler",
    title: "Install Scheduler",
    body: "Every booked install in one calendar, with reminders sent to the customer to get ready.",
    status: "soon",
  },
] as const;

/** The usual way against this one, a line each. Names no other product. */
export const COMPARISON: readonly { usual: string; here: string }[] = [
  { usual: "Type the address in again for every design", here: "The roof opens from the lead's address" },
  { usual: "Choose each inverter and battery yourself", here: "The inverter suggested from the system's size" },
  { usual: "Add up rails, splices and brackets by hand", here: "The order counted from the design" },
  { usual: "Copy the proposal link into an email", here: "Send it, with your note, from the designer" },
  { usual: "Back-and-forth emails with the customer", here: "A chat on the proposal, kept on the deal" },
  { usual: "A plain proposal that looks like everyone's", here: "Your logo, colours and words on every page" },
] as const;

export const COMING_SOON_LABEL = "Coming soon";

/** Every line of copy on the page, for the test that checks it. */
export function landingCopy(): string[] {
  return [
    ...Object.values(LANDING_HERO),
    ...Object.values(AUTOMATION),
    ...AUTOMATIONS.flatMap((a) => [a.title, a.body]),
    CONVERSATION.eyebrow,
    CONVERSATION.headline,
    CONVERSATION.body,
    ...CONVERSATION.steps.flatMap((s) => [s.title, s.body]),
    ...Object.values(AFTER_SIGNING),
    ...AFTER_STEPS.flatMap((s) => [s.title, s.body]),
    ...COMPARISON.flatMap((c) => [c.usual, c.here]),
  ];
}
