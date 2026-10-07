/**
 * The ad landing page (/quote): four one-tap questions, then a first name and
 * mobile, so a visitor from an ad becomes a lead in under a minute, before the
 * bill upload. Then an indicative first estimate from what they spend, and the
 * full plan one tap away. Copy and rules here; pure and tested.
 * No "exact", "guaranteed", "best" or "first"; no rebate amounts.
 */
import { ASSUMPTIONS, recommendSystem } from "./recommendation";
import { roundDownSavings } from "./savings-preview";
import { savingsFor } from "./recommendation";
import { billFromSpend, spendBandLabel, spendDescription, type BillingPeriod, type SpendBandId } from "./spend-estimate";
import type { EnergyProfile } from "./types";

export type QuoteInterest = "solar-battery" | "battery-existing" | "solar-only" | "unsure";

export interface QuoteAnswers {
  interest?: QuoteInterest;
  period?: BillingPeriod;
  band?: SpendBandId;
  owner?: boolean;
}

export const QUOTE_COPY = {
  title: "Solar and battery prices for your home",
  description:
    "Four quick questions and we'll show you an indicative estimate for your Victorian home, with the rebates worked out. Free, no obligation.",
  eyebrow: "Victoria · Free · No obligation",
  headline: "See what solar and a battery could save your home.",
  sub: "Four quick questions. About a minute.",
  progress: (step: number, of: number) => `Question ${step} of ${of}`,
  interest: "What are you looking for?",
  bill: "About how much is your power bill?",
  owner: "Do you own your home?",
  ownerNo: "We install for homeowners. If you're renting, your landlord can get in touch with us too.",
  address: "What's your address?",
  addressNote: "So we can check your roof and the rebates for your area.",
  contact: "Where should we send your estimate?",
  contactNote: "Someone from our team will give you a quick call to help. No pushy sales, no obligation.",
  submit: "Show my estimate",
  trust: ["Free, no obligation", "Rebates worked out for you", "Sized from what your home uses"],
  resultHeading: (name: string) => `Thanks, ${name}. Here's a first idea.`,
  resultSaving: "Solar and a battery could save you about",
  resultSavingSolar: "Solar could save you about",
  perYear: "a year",
  resultNote:
    "Indicative, from what you spend. Your bill gives the most accurate figures, and we confirm everything on a free 15-minute call.",
  resultBattery: "We'll size your battery from your bill: it shows how much of your solar goes to the grid.",
  continue: "See my full plan and price",
  continueNote: "About 2 minutes: your latest bill, a few questions, and your price after rebates.",
  call: "Rather talk it through? Book a 15-minute call",
  emailed: "We've emailed you a copy.",
} as const;

export const INTEREST_OPTIONS: { value: QuoteInterest; label: string; hint: string }[] = [
  { value: "solar-battery", label: "Solar and a battery", hint: "Use your own power day and night" },
  { value: "battery-existing", label: "A battery for my solar", hint: "I already have panels" },
  { value: "solar-only", label: "Solar panels", hint: "Lower daytime bills" },
  { value: "unsure", label: "Not sure yet", hint: "Help me work it out" },
];

export const PERIOD_OPTIONS: { value: BillingPeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

export const bandOptions = (period: BillingPeriod) =>
  (["low", "medium", "high", "very-high"] as const).map((id) => ({ value: id, label: spendBandLabel(id, period) }));

/** The four tap questions, then address, then contact. */
export const QUOTE_STEPS = ["interest", "bill", "owner", "address", "contact"] as const;
export type QuoteStep = (typeof QUOTE_STEPS)[number];

export const wantsBattery = (interest: QuoteInterest | undefined) => interest !== "solar-only";

/** Profile answers the plan starts with. */
export function profileFromQuote(a: QuoteAnswers): Partial<EnergyProfile> {
  return { wantsBattery: wantsBattery(a.interest) };
}

/**
 * The indicative yearly saving shown after they leave their details, from the spend range and our usual sizing
 * at average sunshine. Null for a battery on existing solar (that needs the bill's exports) or without a range.
 */
export function quickEstimate(a: QuoteAnswers): { amount: number; withBattery: boolean } | null {
  if (!a.band || !a.period || a.interest === "battery-existing") return null;
  const battery = wantsBattery(a.interest);
  const rec = recommendSystem(
    { ev: false, evPlanned: false, wantsBattery: battery, backup: false },
    { storeys: "single", roof: "To be confirmed", orientation: "To be confirmed", maxPanels: ASSUMPTIONS.maxPanels },
    billFromSpend(a.period, a.band),
  );
  const config = battery ? rec.tiers.recommended.config : rec.tiers.essential.config;
  const amount = roundDownSavings(savingsFor(config, rec.usage).annualSavings);
  return amount > 0 ? { amount, withBattery: battery } : null;
}

const INTEREST_LABEL = Object.fromEntries(INTEREST_OPTIONS.map((o) => [o.value, o.label])) as Record<QuoteInterest, string>;

/** Server-side: only known answers survive (anything else from the browser is dropped). */
export function cleanQuoteAnswers(raw: unknown): QuoteAnswers {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: QuoteAnswers = {};
  if (INTEREST_OPTIONS.some((o) => o.value === r.interest)) out.interest = r.interest as QuoteInterest;
  if (r.period === "monthly" || r.period === "two-monthly" || r.period === "quarterly") out.period = r.period;
  if (r.band === "low" || r.band === "medium" || r.band === "high" || r.band === "very-high") out.band = r.band;
  if (typeof r.owner === "boolean") out.owner = r.owner;
  return out;
}

/** The lines for the HubSpot note and staff email. */
export function quoteAnswerLines(a: QuoteAnswers): Record<string, string | undefined> {
  const est = quickEstimate(a);
  return {
    "Looking for": a.interest ? INTEREST_LABEL[a.interest] : undefined,
    "Power bill": a.period && a.band ? spendDescription(a.period, a.band) : undefined,
    "Owns the home": a.owner === undefined ? undefined : a.owner ? "yes" : "NO (renting)",
    "Shown on screen": est
      ? `about $${est.amount.toLocaleString("en-AU")} a year (${est.withBattery ? "solar + battery" : "solar"}), INDICATIVE from the spend range`
      : undefined,
  };
}
