/**
 * The Healthy Home message: home page copy, the two packages and the example
 * plan. Healthy home products have no prices yet (they're quoted), and the
 * wording describes what products do, never a health outcome. Tested.
 */

export const HOME_HERO = {
  eyebrow: "One platform. One journey.",
  headline: "A healthier home, powered by the sun.",
  sub: "Solar and a battery sized to your bill, plus cleaner air, filtered water and lighting designed for better sleep. Planned together, installed by accredited local partners.",
  steps: ["Upload your bill", "Pick your install date", "Make your home healthier"],
  label: "Your home plan, priced in about two minutes.",
  healthLink: "Healthy home? Take the check",
} as const;

/** The example card beside the hero (always labelled "Example"). */
export const EXAMPLE_PLAN = [
  {
    name: "Renewable package",
    items: [
      { label: "Solar", value: "6.6 kW" },
      { label: "Battery", value: "16 kWh" },
    ],
  },
  {
    name: "Healthy home package",
    items: [
      { label: "Air purification", value: "Bedrooms" },
      { label: "Whole-house water filtration", value: "Added" },
      { label: "Circadian lighting", value: "Main bedroom" },
    ],
  },
] as const;

export const PACKAGES = {
  heading: "Two packages. One healthier home.",
  intro: "You're investing in the home you'll live in for years. We plan the energy and the environment inside it together.",
  cards: [
    {
      name: "Renewable package",
      line: "Make and store your own clean power.",
      image: {
        src: "/brand/package-renewable.webp",
        alt: "A street at night during a blackout, with one home lit up by its solar and battery",
      },
      chips: ["Solar", "Battery", "EV charger", "Heat-pump hot water", "Induction cooking", "Blackout backup"],
    },
    {
      name: "Healthy home package",
      line: "Cleaner air, better water, better sleep.",
      image: null,
      chips: [
        "Air purification",
        "Air-quality monitoring",
        "Water filtration",
        "Circadian lighting",
        "Fresh-air ventilation",
        "Leak detection",
      ],
    },
  ],
} as const;

export const HOW_IT_WORKS = [
  { title: "Upload your bill", detail: "We size your solar and battery from how your home actually uses power." },
  { title: "Pick your install date", detail: "Accredited local partners install everything. We handle rebates and paperwork." },
  {
    title: "Make your home healthier",
    detail: "After you reserve, a quick Home Health check shows what would help most. Upgrades can go in on the same visit.",
  },
] as const;

export const HEALTH_TEASER = {
  heading: "How healthy is your home?",
  copy: "Answer a few quick questions about your air, water, comfort and sleep. We'll show you what would make the biggest difference, including free fixes.",
  button: "Take the Home Health check",
  chips: [
    "Do you cook on gas?",
    "Does your bedroom feel stuffy in the morning?",
    "Do you filter your drinking water?",
    "Is your bedroom too hot at night?",
    "Do you wake up feeling rested?",
    "Any mould or condensation?",
  ],
} as const;

/** The optional, unticked checkbox near the end of the quote flow. */
export const HEALTHY_INTEREST_LABEL = "I'm interested in healthy home upgrades (air, water, lighting).";

/** All customer-visible home page text, for checks. */
export function healthyHomeText(): string {
  return [
    ...Object.values(HOME_HERO).flat(),
    ...EXAMPLE_PLAN.flatMap((g) => [g.name, ...g.items.flatMap((i) => [i.label, i.value])]),
    PACKAGES.heading,
    PACKAGES.intro,
    ...PACKAGES.cards.flatMap((c) => [c.name, c.line, ...c.chips]),
    ...HOW_IT_WORKS.flatMap((s) => [s.title, s.detail]),
    ...Object.values(HEALTH_TEASER).flat(),
    HEALTHY_INTEREST_LABEL,
  ].join("\n");
}
