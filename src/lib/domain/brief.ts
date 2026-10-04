/**
 * The guided brief: a private link staff text to a lead we already have
 * (/brief/<key>). One question a screen, each paying the person back (a date,
 * their home's power picture, their price), ending in a booked 15-minute call.
 * The answers become a Hot / Warm / Cold score with flags, for staff only: the
 * customer never sees it. Pure, tested.
 */
import { BATTERY_RANGE, PANEL_RANGE } from "./catalogue";
import { solarDay } from "./recommendation";
import type { EnergyProfile } from "./types";

export interface BriefChoice {
  value: string;
  label: string;
  hint?: string;
  /** Short facts, the same kind in the same order on every choice (products). */
  facts?: string[];
}

export interface BriefQuestion {
  id: string;
  /** solar-vic: Victorian owner-occupiers only; products: only for those who want to choose. */
  group?: "solar-vic" | "products";
  eyebrow?: string;
  title: string;
  help?: string;
  choices: BriefChoice[];
  /** Short label for the staff note and email. */
  crmLabel: string;
}

const LEAVE_IT: BriefChoice = { value: "leave", label: "Leave it to RENUABL", hint: "We pick what suits your home." };
const SOMETHING_ELSE: BriefChoice = { value: "other", label: "Something else", hint: "Tell us on your call." };

export const BRIEF_QUESTIONS: BriefQuestion[] = [
  {
    id: "timeframe",
    title: "When would you ideally like your system installed?",
    choices: [
      { value: "asap", label: "As soon as possible" },
      { value: "1_3_months", label: "Within the next 1–3 months" },
      { value: "3_6_months", label: "In 3–6 months" },
    ],
    crmLabel: "Timeframe",
  },
  {
    id: "interest",
    title: "What are you looking for?",
    choices: [
      { value: "solar", label: "Solar panels" },
      { value: "solar_battery", label: "Solar and a battery" },
      { value: "battery", label: "A battery for my existing solar" },
      { value: "unsure", label: "Not sure yet", hint: "We'll talk you through it" },
    ],
    crmLabel: "Looking for",
  },
  {
    id: "ownership",
    title: "Do you own the home?",
    choices: [
      { value: "owner_occupier", label: "Yes, and I live there" },
      { value: "landlord", label: "Yes, it's a rental property" },
      { value: "renting", label: "No, I'm renting" },
      { value: "buying", label: "I'm buying or building" },
    ],
    crmLabel: "Ownership",
  },
  {
    id: "sv_income",
    group: "solar-vic",
    eyebrow: "Solar Victoria rebate",
    // Solar Victoria's criteria, as on solar.vic.gov.au (saved 21 Sep 2026): re-check when the page changes.
    title: "Is your household's combined taxable income under $150,000 a year?",
    help: "That's everyone who owns the home, together. A yes or no is all we need: no figures.",
    choices: [
      { value: "yes", label: "Yes, under $150,000" },
      { value: "no", label: "No, it's more" },
      { value: "unsure", label: "Not sure" },
    ],
    crmLabel: "Household income under the cap",
  },
  {
    id: "sv_value",
    group: "solar-vic",
    eyebrow: "Solar Victoria rebate",
    title: "Is your home valued under $3 million?",
    choices: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No, it's more" },
      { value: "unsure", label: "Not sure" },
    ],
    crmLabel: "Home under $3m",
  },
  {
    id: "sv_history",
    group: "solar-vic",
    eyebrow: "Solar Victoria rebate",
    title: "Has this address had solar panels installed in the last 10 years, or a Solar Victoria rebate before?",
    choices: [
      { value: "no", label: "No, neither" },
      { value: "yes", label: "Yes" },
      { value: "unsure", label: "Not sure" },
    ],
    crmLabel: "Solar in last 10 yrs or rebate before",
  },
  {
    id: "roof",
    title: "What's your roof made of?",
    choices: [
      { value: "tile", label: "Tiles" },
      { value: "tin", label: "Tin or Colorbond" },
      { value: "flat", label: "Flat (Kliplok)" },
      { value: "unsure", label: "Not sure" },
    ],
    crmLabel: "Roof",
  },
  {
    id: "storeys",
    title: "How many storeys is the home?",
    choices: [
      { value: "single", label: "Single storey" },
      { value: "double", label: "Double storey" },
      { value: "more", label: "Three or more" },
    ],
    crmLabel: "Storeys",
  },
  {
    id: "phase",
    title: "Is your power single or three phase?",
    help: "Three phase usually means three big switches side by side on your switchboard. Not sure is fine: we'll check.",
    choices: [
      { value: "single", label: "Single phase" },
      { value: "three", label: "Three phase" },
      { value: "unsure", label: "Not sure" },
    ],
    crmLabel: "Phase",
  },
  {
    id: "shade",
    title: "Is there shade on the roof during the day?",
    choices: [
      { value: "none", label: "No, it's clear" },
      { value: "some", label: "Some, part of the day" },
      { value: "lots", label: "A lot of shade" },
      { value: "unsure", label: "Not sure" },
    ],
    crmLabel: "Shade",
  },
  {
    id: "daytime",
    title: "Is someone usually home on weekdays?",
    help: "Solar is used as it's made, so a home that's busy by day uses more of it.",
    choices: [
      { value: "out", label: "Out most days" },
      { value: "some", label: "Some days" },
      { value: "home", label: "Home most days" },
    ],
    crmLabel: "Home on weekdays",
  },
  {
    id: "priority",
    title: "What matters most to you?",
    choices: [
      { value: "savings", label: "The biggest savings on my bills" },
      { value: "quality", label: "Quality products and a long warranty" },
      { value: "price", label: "The lowest upfront price" },
      { value: "backup", label: "Keeping the power on in a blackout" },
    ],
    crmLabel: "Priority",
  },
  {
    id: "products",
    title: "Would you like to choose the products, or leave it to us?",
    help: "Either way, we show you what's going on your roof on your call.",
    choices: [LEAVE_IT, { value: "choose", label: "I'd like to choose", hint: "See what we install, with warranties." }],
    crmLabel: "Products",
  },
  {
    id: "pref_panels",
    group: "products",
    eyebrow: "Your products",
    title: "Which solar panels would you prefer?",
    choices: [
      ...PANEL_RANGE.map((p) => ({
        value: p.manufacturer.toLowerCase(),
        label: p.manufacturer,
        facts: [`${p.watts} W panels`, `${p.warrantyYears}-year product warranty`],
      })),
      LEAVE_IT,
      SOMETHING_ELSE,
    ],
    crmLabel: "Panels",
  },
  {
    id: "pref_battery",
    group: "products",
    eyebrow: "Your products",
    title: "Which battery would you prefer?",
    help: "A battery comes with the inverter made to run it, so this is one choice.",
    choices: [
      ...BATTERY_RANGE.map((b) => ({
        value: b.manufacturer.toLowerCase(),
        label: `${b.manufacturer} ${b.model}`,
        facts: [`${b.moduleKwh} kWh modules`, `${b.warrantyYears}-year warranty`],
      })),
      LEAVE_IT,
      SOMETHING_ELSE,
    ],
    crmLabel: "Battery",
  },
  {
    id: "budget",
    title: "Is there a figure you'd like to stay within?",
    help: "Optional. It helps us shape the design around you.",
    choices: [
      { value: "under_10k", label: "Under $10,000" },
      { value: "10_15k", label: "$10,000–$15,000" },
      { value: "15_20k", label: "$15,000–$20,000" },
      { value: "20_30k", label: "$20,000–$30,000" },
      { value: "over_30k", label: "Over $30,000" },
      { value: "none", label: "No set figure" },
    ],
    crmLabel: "Budget",
  },
];

export type BriefAnswers = Partial<Record<string, string>>;

export const questionById = (id: string) => BRIEF_QUESTIONS.find((q) => q.id === id);

export function choiceLabel(id: string, value: string | undefined): string | undefined {
  return questionById(id)?.choices.find((c) => c.value === value)?.label;
}

/** Keeps only known questions with valid choices, plus a short free-text note. */
export function cleanBriefAnswers(raw: unknown): BriefAnswers {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: BriefAnswers = {};
  for (const q of BRIEF_QUESTIONS) {
    const v = r[q.id];
    if (typeof v === "string" && q.choices.some((c) => c.value === v)) out[q.id] = v;
  }
  if (typeof r.notes === "string" && r.notes.trim())
    out.notes = r.notes
      .replace(/[\u0000-\u001f<>]/g, " ")
      .trim()
      .slice(0, 1000);
  return out;
}

const wantsBattery = (a: BriefAnswers) => a.interest === "solar_battery" || a.interest === "battery";

/** Whether a question is asked, given the answers so far and the home's state. */
export function asksQuestion(q: BriefQuestion, answers: BriefAnswers, homeState: string | null): boolean {
  if (q.group === "solar-vic") return homeState === "VIC" && answers.ownership === "owner_occupier" && answers.interest !== "battery";
  if (q.group === "products") {
    if (answers.products !== "choose") return false;
    if (q.id === "pref_panels") return answers.interest !== "battery";
    if (q.id === "pref_battery") return answers.interest !== "solar";
  }
  return true;
}

/** What the answers mean for sizing and pricing (the same profile the main flow uses). */
export function profileFromBrief(a: BriefAnswers): Partial<EnergyProfile> {
  const out: Partial<EnergyProfile> = {};
  if (a.roof) out.roofType = a.roof as EnergyProfile["roofType"];
  if (a.storeys) out.storeys = a.storeys === "single" ? "single" : "double";
  if (a.phase) out.phase = a.phase as EnergyProfile["phase"];
  if (a.interest) out.wantsBattery = a.interest !== "solar";
  if (a.priority === "backup") out.backup = true;
  // A battery for existing solar keeps the panels they have.
  if (a.interest === "battery") out.existingPlan = "expand";
  return out;
}

export type SolarVicLook = "likely" | "unlikely" | "check";

/** "You look eligible" only when every answer says so; Solar Victoria decides. */
export function solarVicLook(a: BriefAnswers): SolarVicLook {
  const v = [a.sv_income, a.sv_value];
  if (v.includes("no") || a.sv_history === "yes") return "unlikely";
  if (v.every((x) => x === "yes") && a.sv_history === "no") return "likely";
  return "check";
}

export type StepKind =
  | { kind: "welcome" }
  | { kind: "address" }
  | { kind: "question"; id: string }
  | { kind: "date" }
  | { kind: "bill" }
  | { kind: "house" }
  | { kind: "price" }
  | { kind: "notes" }
  | { kind: "booking" }
  | { kind: "done" };

/** Smallest ask first: timeframe and a date, then the bill (and their home's power picture), the home, the price, a call. */
export function briefSteps(answers: BriefAnswers, homeState: string | null): StepKind[] {
  const q = (id: string): StepKind[] => {
    const question = questionById(id);
    return question && asksQuestion(question, answers, homeState) ? [{ kind: "question", id }] : [];
  };
  return [
    { kind: "welcome" },
    { kind: "address" },
    ...q("timeframe"),
    { kind: "date" },
    { kind: "bill" },
    ...q("interest"),
    { kind: "house" },
    ...["daytime", "ownership", "sv_income", "sv_value", "sv_history", "roof", "storeys", "phase", "shade", "priority"].flatMap(q),
    ...["products", "pref_panels", "pref_battery"].flatMap(q),
    { kind: "price" },
    ...q("budget"),
    { kind: "notes" },
    { kind: "booking" },
    { kind: "done" },
  ];
}

export type BriefScore = "hot" | "warm" | "cold";
export const SCORE_LABELS: Record<BriefScore, string> = { hot: "Hot", warm: "Warm", cold: "Cold" };

const TIMEFRAME_POINTS: Record<string, number> = { asap: 4, "1_3_months": 3, "3_6_months": 1 };

/** Staff only: points and the reasons behind them. Never shown to the customer. */
export function scoreBrief(input: { answers: BriefAnswers; billRead: boolean; booked: boolean }): {
  score: BriefScore;
  points: number;
  flags: string[];
} {
  const { answers: a } = input;
  const flags: string[] = [];
  let points = TIMEFRAME_POINTS[a.timeframe ?? ""] ?? 1;
  if (a.ownership === "owner_occupier" || a.ownership === "buying") points += 2;
  if (a.ownership === "landlord") points += 1;
  if (a.ownership === "renting") {
    points -= 4;
    flags.push("Renting: needs the owner's approval");
  }
  if (input.billRead) points += 2;
  else flags.push("No bill yet: the plan is indicative, get the bill on the call");
  if (wantsBattery(a)) points += 1;
  if (a.shade === "lots") flags.push("Heavy shade: check the roof before pricing");
  if (a.storeys === "more") flags.push("Three or more storeys: check access");
  if (solarVicLook(a) === "likely") points += 1;
  if (a.products === "choose" && (a.pref_panels === "other" || a.pref_battery === "other"))
    flags.push("Wants products we don't list: ask which");
  if (a.notes) points += 1;
  if (input.booked) points += 3;
  const score: BriefScore = input.booked || points >= 8 ? "hot" : points >= 5 ? "warm" : "cold";
  return { score, points, flags };
}

/** "Timeframe: As soon as possible" lines for the staff note, in question order. */
export function briefAnswerLines(a: BriefAnswers): string[] {
  const lines = BRIEF_QUESTIONS.filter((q) => a[q.id]).map((q) => `${q.crmLabel}: ${choiceLabel(q.id, a[q.id])}`);
  return a.notes ? [...lines, `Their questions or notes: ${a.notes}`] : lines;
}

export type HouseScenario = "grid" | "solar" | "battery";

/** The least grid power ever shown: some is always needed over a year. */
export const MIN_GRID_SHARE = 0.05;

/**
 * Where a day's power comes from, as shares of the day that add up to 1, from
 * the same rule of thumb as the savings (`solarDay`): solar used as it's made,
 * the battery's stored solar after dark, the rest from the grid.
 */
export function houseShares(
  o: { dailyKwh: number; solarKw: number; yieldKwhPerKw: number; batteryUsableKwh: number },
  scenario: HouseScenario,
): { solar: number; battery: number; grid: number; kwh: { made: number; usedAsMade: number; stored: number } } {
  const day = solarDay(o.solarKw, o.yieldKwhPerKw, o.dailyKwh, o.batteryUsableKwh);
  const d = o.dailyKwh || 1;
  const solar = scenario === "grid" ? 0 : Math.min(1 - MIN_GRID_SHARE, day.usedAsMade / d);
  const battery = scenario === "battery" ? Math.max(0, Math.min(1 - MIN_GRID_SHARE - solar, day.stored / d)) : 0;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    solar,
    battery,
    grid: Math.max(MIN_GRID_SHARE, 1 - solar - battery),
    kwh: { made: round1(day.made), usedAsMade: round1(day.usedAsMade), stored: round1(scenario === "battery" ? day.stored : 0) },
  };
}

/** What happens after the call, RENUABL's own steps in order. Times only where they're always true. */
export const BRIEF_NEXT_STEPS: { title: string; detail: string }[] = [
  { title: "Your 15-minute call", detail: "We confirm your roof, switchboard and design, and answer your questions." },
  { title: "Your price, confirmed", detail: "Nothing is final, and nothing is charged, until you're happy." },
  { title: "Rebates", detail: "If you may be eligible for Solar Victoria's rebate, you apply on their site and we help you through it." },
  { title: "Installation", detail: "An accredited local installation partner fits your system. Most installs take a day." },
  { title: "Switched on", detail: "Your network connects the system and your meter is set up." },
];

export const BRIEF_COPY = {
  welcomeLead: "Let's plan your home's solar.",
  welcomeSteps: [
    "A few quick taps about your home",
    "See where your power would come from",
    "Your price after rebates, then a 15-minute call",
  ],
  welcomeTime: "About 5 minutes. You can stop and come back to this link any time.",
  shortcut: "Don't have time to finish? Book a call",
  dateTitle: "Pick a day to hold for your installation.",
  dateNote: "A provisional date with no obligation: we confirm it on your call.",
  billTitle: "Your latest electricity bill.",
  houseTitle: "Where your power would come from.",
  priceTitle: "Your price, after rebates.",
  priceNote:
    "Your price is confirmed on your 15-minute call, once we've checked your roof and switchboard. Nothing is final until you're happy.",
  productsNote: "Prices shown use the products we'd normally choose. If your choice changes the price, we'll tell you on your call.",
  notesTitle: "Anything you'd like us to know or ask?",
  notesHelp: "Optional. We'll answer it on your call.",
  bookingTitle: "Book your 15-minute call.",
  doneTitle: "You're booked in.",
} as const;

/** Private brief links: 40 hex characters (20 random bytes). */
export function isBriefKey(key: string): boolean {
  return /^[a-f0-9]{40}$/.test(key);
}

/** The text staff send from their phone. Names RENUABL and has Reply STOP. */
export function briefSms(o: { firstName: string; link: string; from?: string }): string {
  const first = o.firstName.trim().split(/\s+/)[0] || "there";
  const from = o.from?.trim() ? `${o.from.trim()} from RENUABL` : "RENUABL";
  return `Hi ${first}, it's ${from}. Here's your home solar plan: a few quick taps, about 5 minutes. ${o.link} Reply STOP to opt out.`;
}
