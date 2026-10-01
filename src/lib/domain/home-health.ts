/**
 * The Home Health check: optional questions about a home's air, water,
 * comfort, sleep and light, and simple rules that turn the answers into a
 * short plan (top recommendations plus at least one free fix). For now it's
 * research: we don't sell healthy home products yet, so nothing can be added
 * or quoted, and the interest questions tell us what to offer first
 * (`interestSummary`, on /admin). No score, no
 * medical claims: recommendations describe what a product does, not a health
 * outcome. The allergies answer is sensitive information: it's only kept with
 * the customer's consent and never goes into HubSpot or staff emails. Pure, tested.
 */

export type HealthSection = "Air" | "Water" | "Climate and comfort" | "Sleep" | "Light" | "Household";

export interface HealthQuestion {
  id: string;
  section: HealthSection;
  prompt: string;
  options: { id: string; label: string }[];
  multi?: boolean;
  /** Sensitive health information: needs consent before it's answered. */
  sensitive?: boolean;
}

const o = (...labels: string[]) => labels.map((label) => ({ id: slug(label), label }));
function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const HEALTH_QUESTIONS: HealthQuestion[] = [
  { id: "gas-cooking", section: "Air", prompt: "Do you cook on gas?", options: o("Yes", "No", "Not sure") },
  { id: "stuffy", section: "Air", prompt: "Does any room feel stuffy when you wake up?", options: o("Often", "Sometimes", "Rarely") },
  { id: "purifier", section: "Air", prompt: "Do you have an air purifier?", options: o("Yes", "No") },
  {
    id: "air-interest",
    section: "Air",
    prompt: "Would you be interested in air purification for your home?",
    options: o("Yes, for the bedrooms", "Yes, for the whole home", "Maybe", "No"),
  },
  {
    id: "ac-filter",
    section: "Air",
    prompt: "Does your air conditioning have a filter, and when was it last cleaned?",
    options: o("In the last 6 months", "Longer ago", "Don't know", "No AC"),
  },
  { id: "mould", section: "Air", prompt: "Any condensation or mould on windows or walls?", options: o("Yes", "No") },
  { id: "drinking-filter", section: "Water", prompt: "Do you filter your drinking water?", options: o("Yes", "No") },
  { id: "shower-filter", section: "Water", prompt: "Do you filter your shower water?", options: o("Yes", "No") },
  {
    id: "water-interest",
    section: "Water",
    prompt: "Would you be interested in water filtration for your home?",
    options: o("Yes, at the kitchen tap", "Yes, for the whole house", "Maybe", "No"),
  },
  { id: "leak", section: "Water", prompt: "Have you ever had a leak or burst pipe?", options: o("Yes", "No") },
  {
    id: "rooms",
    section: "Climate and comfort",
    prompt: "Which rooms are too hot in summer or too cold in winter?",
    options: o("Living room", "Kitchen", "Main bedroom", "Other bedrooms", "Home office", "None"),
    multi: true,
  },
  {
    id: "heating",
    section: "Climate and comfort",
    prompt: "How do you heat your home?",
    options: o("Gas", "Electric", "Reverse-cycle", "Wood", "Other"),
  },
  { id: "ac-overnight", section: "Climate and comfort", prompt: "Do you run the AC overnight?", options: o("Often", "Sometimes", "Never") },
  { id: "bedroom-temp", section: "Sleep", prompt: "At night your bedroom is…", options: o("Too hot", "Too cold", "About right") },
  { id: "wake-night", section: "Sleep", prompt: "Do you wake up during the night?", options: o("Often", "Sometimes", "Rarely") },
  { id: "rested", section: "Sleep", prompt: "Do you wake up feeling rested?", options: o("Usually", "Sometimes", "Rarely") },
  {
    id: "light-in",
    section: "Sleep",
    prompt: "Does light get into your bedroom (streetlights, early sunrise)?",
    options: o("Yes", "No"),
  },
  { id: "window-open", section: "Sleep", prompt: "Do you sleep with a window open?", options: o("Yes", "No") },
  { id: "screens", section: "Sleep", prompt: "Are there screens or chargers in the bedroom?", options: o("Yes", "No") },
  {
    id: "wake-light",
    section: "Light",
    prompt: "How do you usually wake up?",
    options: o("Alarm in a dark room", "Natural light", "Other"),
  },
  { id: "harsh-lights", section: "Light", prompt: "Do your evening lights feel harsh or too bright?", options: o("Yes", "No") },
  {
    id: "gentle-light",
    section: "Light",
    prompt: "Would you like lights that brighten gently in the morning?",
    options: o("Yes", "Maybe", "No"),
  },
  {
    id: "household",
    section: "Household",
    prompt: "Who lives in the home?",
    options: o("Adults", "Kids", "Older family members", "Pets"),
    multi: true,
  },
  {
    id: "allergies",
    section: "Household",
    prompt: "Does anyone have allergies or sensitive breathing?",
    options: o("Yes", "No", "Prefer not to say"),
    sensitive: true,
  },
  {
    id: "priority",
    section: "Household",
    prompt: "What would you most like help with at home?",
    options: o("Air", "Water", "Temperature", "Sleep", "Lighting", "Nothing right now"),
    multi: true,
  },
  {
    id: "budget",
    section: "Household",
    prompt: "If it made a real difference, what would you consider spending on healthy home upgrades?",
    options: o("Under $500", "$500 to $2,000", "$2,000 to $5,000", "Over $5,000", "Not sure"),
  },
  {
    id: "stay",
    section: "Household",
    prompt: "How long do you plan to stay in this home?",
    options: o("Under 3 years", "3–10 years", "10+ years"),
  },
];

export const SENSITIVE_CONSENT = "I agree RENUABL can use this answer only to tailor my recommendations. It isn't shared with anyone else.";

export type HealthAnswers = Record<string, string | string[]>;

/** Results page copy. We don't offer these products yet, so nothing here offers, adds or quotes them. */
export const HEALTH_RESULTS_COPY = {
  heading: "Here's what could help.",
  headingNone: "Your home is in good shape.",
  intro: "Ideas based on your answers, so you know what's worth looking into.",
  introNone: "Nothing stood out from your answers. Here's a free tip anyway.",
  notYet:
    "We don't offer healthy home products yet. Your answers help us decide which ones to offer first, and we'll only be in touch about them if you've said we can.",
  save: "Save your answers",
  saveWhy: "So you can come back to them, and so they count towards what we offer next.",
  saved: "Saved. Thanks, your answers help us decide what to offer next.",
  savedLinked: "Saved with your order. Thanks, your answers help us decide what to offer next.",
} as const;

/** Healthy home product types we recommend (not sold yet: information only). */
export const HEALTH_ITEMS = {
  "aq-monitor": "Air-quality monitor",
  ventilation: "Fresh-air ventilation",
  dehumidifier: "Dehumidifier",
  purifiers: "Air purifiers for bedrooms",
  "ac-filter": "AC filter upgrade",
  "drinking-filter": "Drinking-water filtration",
  "whole-house-filter": "Whole-house water filtration",
  "leak-detection": "Smart leak detection",
  "smart-ac": "Smart AC control using solar",
  blinds: "Blackout or smart blinds",
  circadian: "Circadian lighting",
} as const;

export type HealthItemId = keyof typeof HEALTH_ITEMS;

export function isHealthItem(id: unknown): id is HealthItemId {
  return typeof id === "string" && id in HEALTH_ITEMS;
}

export interface Recommendation {
  item: HealthItemId;
  title: string;
  why: string;
}

export interface FreeFix {
  title: string;
  why: string;
}

export interface HealthPlan {
  recommendations: Recommendation[];
  freeFixes: FreeFix[];
  /** Staying 10+ years: show the whole healthy home package as a longer-term plan. */
  longTerm: boolean;
}

export const TOP_RECOMMENDATIONS = 3;

const is = (a: HealthAnswers, id: string, ...values: string[]) => {
  const v = a[id];
  return Array.isArray(v) ? v.some((x) => values.includes(x)) : typeof v === "string" && values.includes(v);
};

/** The plan for these answers: the first matching recommendations in the brief's order, and the free fixes. */
export function healthPlan(a: HealthAnswers): HealthPlan {
  const recs: Recommendation[] = [];
  const fixes: FreeFix[] = [];
  const add = (item: HealthItemId, why: string) => {
    if (!recs.some((r) => r.item === item)) recs.push({ item, title: HEALTH_ITEMS[item], why });
  };

  if (is(a, "gas-cooking", "yes")) {
    fixes.push({
      title: "Use the rangehood every time you cook",
      why: "It draws cooking fumes out of the kitchen. Leave it on for a few minutes after.",
    });
  }
  const stuffy = is(a, "stuffy", "often", "sometimes");
  if (stuffy || is(a, "window-open", "no")) {
    add("aq-monitor", "A monitor shows when the air in a room gets stale, so you know when to let fresh air in.");
    add("ventilation", "Brings in filtered fresh air without opening windows, day and night.");
    fixes.push({ title: "Open a window or door a little overnight", why: "Even a small gap lets stale air out while you sleep." });
  }
  if (is(a, "mould", "yes")) {
    add("ventilation", "Condensation and mould usually mean moist air isn't getting out. Fresh-air ventilation keeps it moving.");
    add("dehumidifier", "Takes moisture out of the air in the rooms where condensation builds up.");
  }
  if (is(a, "purifier", "no") && is(a, "allergies", "yes")) {
    add("purifiers", "A purifier in each bedroom filters dust and pollen from the air while you sleep.");
  }
  if (is(a, "air-interest", "yes-for-the-bedrooms", "yes-for-the-whole-home")) {
    add("purifiers", "You said you'd be interested. A purifier filters dust and pollen from the air in the rooms you choose.");
  }
  if (is(a, "ac-filter", "longer-ago", "don-t-know")) {
    add("ac-filter", "A cleaner or better filter means the air your AC blows around the house is filtered too.");
    fixes.push({
      title: "Clean your AC filter",
      why: "Most split systems have a filter that slides out and rinses under the tap. Check your manual.",
    });
  }
  if (is(a, "drinking-filter", "no")) add("drinking-filter", "Filters the water you drink and cook with at the kitchen tap.");
  if (is(a, "water-interest", "yes-at-the-kitchen-tap"))
    add("drinking-filter", "Filters the water you drink and cook with at the kitchen tap.");
  if (is(a, "water-interest", "yes-for-the-whole-house"))
    add("whole-house-filter", "Filters the water at every tap and shower in the house, not just the kitchen.");
  if (is(a, "shower-filter", "no"))
    add("whole-house-filter", "Filters the water at every tap and shower in the house, not just the kitchen.");
  if (is(a, "leak", "yes")) add("leak-detection", "Sensors alert your phone the moment water appears where it shouldn't.");
  if (is(a, "bedroom-temp", "too-hot") && is(a, "ac-overnight", "often", "sometimes")) {
    add("smart-ac", "Pre-cools the house in the afternoon with your own solar, so the AC does less work overnight.");
  }
  if (is(a, "light-in", "yes")) add("blinds", "Keeps streetlights and early sunrise out of the bedroom.");
  if (is(a, "gentle-light", "yes", "maybe") || is(a, "harsh-lights", "yes")) {
    add("circadian", "Lights that brighten gently in the morning and turn warm and soft in the evening.");
  }
  if (is(a, "screens", "yes")) {
    fixes.push({ title: "Charge phones outside the bedroom", why: "Fewer lights and notifications in the room at night." });
  }
  if (!fixes.length) {
    fixes.push({
      title: "Air out the house for ten minutes each morning",
      why: "Open windows on opposite sides for a quick change of air.",
    });
  }

  return { recommendations: recs.slice(0, TOP_RECOMMENDATIONS), freeFixes: fixes, longTerm: is(a, "stay", "10-years") };
}

/** Only known questions and options; the sensitive answer only with consent. */
export function cleanAnswers(raw: unknown, consentSensitive: boolean): HealthAnswers {
  const out: HealthAnswers = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const q of HEALTH_QUESTIONS) {
    if (q.sensitive && !consentSensitive) continue;
    const ids = new Set(q.options.map((x) => x.id));
    const v = r[q.id];
    if (q.multi && Array.isArray(v)) {
      const picked = v.filter((x): x is string => typeof x === "string" && ids.has(x));
      if (picked.length) out[q.id] = [...new Set(picked)];
    } else if (typeof v === "string" && ids.has(v)) out[q.id] = v;
  }
  return out;
}

/** Answers for HubSpot notes and staff emails: never the sensitive ones. */
export function shareableAnswers(a: HealthAnswers): HealthAnswers {
  const sensitive = new Set(HEALTH_QUESTIONS.filter((q) => q.sensitive).map((q) => q.id));
  return Object.fromEntries(Object.entries(a).filter(([k]) => !sensitive.has(k)));
}

/** The questions that tell us which healthy home products to offer first. */
export const RESEARCH_QUESTIONS = [
  "air-interest",
  "purifier",
  "water-interest",
  "drinking-filter",
  "shower-filter",
  "gentle-light",
  "priority",
  "budget",
] as const;

export interface AnswerTally {
  id: string;
  prompt: string;
  /** How many checks answered it (skips don't count). */
  answered: number;
  counts: { label: string; count: number }[];
}

/** Adds up the research answers across saved checks, for staff. Never includes the sensitive answer. */
export function interestSummary(all: HealthAnswers[]): AnswerTally[] {
  return RESEARCH_QUESTIONS.map((id) => {
    const q = HEALTH_QUESTIONS.find((x) => x.id === id)!;
    const counts = q.options.map((opt) => ({ label: opt.label, count: 0 }));
    let answered = 0;
    for (const a of all) {
      const v = a[id];
      const picked = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
      if (!picked.length) continue;
      answered++;
      for (const p of picked) {
        const i = q.options.findIndex((x) => x.id === p);
        if (i >= 0) counts[i].count++;
      }
    }
    return { id, prompt: q.prompt, answered, counts };
  });
}
