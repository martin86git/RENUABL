/**
 * The /partners pitch for installers: what RENUABL does for a partner, in
 * tradie words. Every line must be true of the platform today (tested): no
 * job numbers, earnings or ratings we can't back up, and the terms come from
 * the same constants the portal uses.
 */
import { OFFER_HOURS } from "./offers";
import { PAYOUT_DAYS_AFTER_INSTALL } from "./payouts";

export const PITCH = {
  eyebrow: "For solar installers in Victoria",
  headline: "Stop buying leads. Install jobs that are already sold.",
  intro:
    "Homeowners come to RENUABL, upload their power bill and book a system and an install date. We match each job with an accredited local installer. You install it, at your rates, and get paid.",
  promise: ["No lead fees", "Your own rates", "Accept or pass on every job"],
} as const;

export const PITCH_STEPS = [
  {
    title: "A job lands on your phone",
    detail: `Suburb, system and install date. You've got ${OFFER_HOURS} hours to accept or pass. No quoting, no chasing.`,
  },
  {
    title: "Everything's ready before you roll up",
    detail: "The roof from above, the install-day weather, the materials list and the customer's details once you accept.",
  },
  {
    title: "Install, hand over, get paid",
    detail: `Tick off the photos and serials on your phone. You're paid for your installation work ${PAYOUT_DAYS_AFTER_INSTALL} days after install.`,
  },
] as const;

export const PITCH_HANDLED = [
  { title: "Finding and selling the job", detail: "Ads, quotes, follow-ups and the customer's questions." },
  { title: "Sizing and pricing", detail: "The system is sized from the customer's bill and priced before it reaches you." },
  { title: "The confirmation call", detail: "Roof, switchboard and access are checked with the customer before the job reaches you." },
  { title: "Equipment", detail: "RENUABL supplies the panels, inverter and battery. You get the materials list for each job." },
  { title: "Rebates and paperwork", detail: "STCs and Solar Victoria are handled by RENUABL. You tick off your own grid steps." },
  { title: "Invoicing", detail: "We issue the tax invoice for your work for you. No chasing the customer for money." },
] as const;

export const PITCH_TOOLS = [
  "Job offers with suburb, system and date",
  "Satellite roof view and a roof obstruction check",
  "Install-day weather alerts",
  "Materials list per job, and for the next 7, 14 or 30 days",
  "Panel layout designer on the roof photo",
  "Handover checklist: photos and serials",
  "Extra work priced on site, approved by the customer in the app",
  "Payouts and invoices in one place",
] as const;

export const PITCH_MONEY = [
  {
    title: "Your rates",
    detail: "You set your installation rates when you join. Our suggested rates are there if you'd rather not work them out.",
  },
  { title: "No lead fees", detail: "You never pay for leads, enquiries or a listing. You're only offered real, booked jobs." },
  {
    title: `Paid ${PAYOUT_DAYS_AFTER_INSTALL} days after install`,
    detail: "For your installation work plus any extra work the customer approved. The customer pays RENUABL, not you.",
  },
] as const;

export const PITCH_FAQ = [
  {
    q: "Do I have to take every job?",
    a: `No. Each job is offered to one partner at a time, and you've got ${OFFER_HOURS} hours to accept or pass. Pass and it goes to the next partner.`,
  },
  { q: "Is there a sign-up fee or a lock-in?", a: "No sign-up fee, no monthly fee, no lead fees and no lock-in." },
  {
    q: "What if the job isn't what was described?",
    a: "Price the extra work on site in the app. The customer approves it on their phone, and approved work is added to your payout.",
  },
  {
    q: "Where do the jobs come from?",
    a: "Homeowners who've found RENUABL, uploaded their bill and reserved an install date. You're only offered jobs within the area you choose.",
  },
  {
    q: "What do I need to join?",
    a: "Your ABN, solar accreditation number, electrical licence and a certificate of currency for at least $10 million public liability. It takes about 10 minutes on your phone.",
  },
  {
    q: "I run my own sales. Can I still join?",
    a: "Yes. Join as a retailer partner: you sell, supply, install and connect, with your own product costs and margin.",
  },
] as const;

/** All customer-visible pitch text, for checks. */
export function pitchText(): string {
  return [
    ...Object.values(PITCH).flat(),
    ...PITCH_STEPS.flatMap((s) => [s.title, s.detail]),
    ...PITCH_HANDLED.flatMap((s) => [s.title, s.detail]),
    ...PITCH_TOOLS,
    ...PITCH_MONEY.flatMap((s) => [s.title, s.detail]),
    ...PITCH_FAQ.flatMap((f) => [f.q, f.a]),
  ].join("\n");
}
