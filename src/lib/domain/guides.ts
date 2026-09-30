/**
 * Revo's energy guides (/learn): plain-language articles that explain how
 * solar, batteries and rebates work and how RENUABL sizes a system. They're
 * written for search as much as for customers, so every claim must be true
 * and checkable: no invented figures, no "exact / precise / guaranteed", no
 * "AI", and rebate amounts link to the official sources rather than being
 * quoted (they change). Customers never see the word "installer" here.
 * Pure data, tested in guides.test.ts.
 */
import { ASSUMPTIONS } from "./recommendation";
import { SOLAR_VIC_LEAD_DAYS } from "./scheduling";

export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "note"; text: string }
  | { type: "link"; text: string; href: string };

export interface Guide {
  slug: string;
  title: string;
  /** A short title for tight spaces (the home page pop-up). */
  short?: string;
  /** One or two sentences: the meta description and the card text on /learn. */
  summary: string;
  /** Short label shown above the title. */
  topic: "Sizing" | "Rebates" | "Batteries" | "Your bill" | "The process" | "Choosing";
  /** When the facts were last checked (ISO date). */
  updated: string;
  minutes: number;
  body: GuideBlock[];
}

/** How RENUABL describes itself in search results. Not "the first": that can't be proven (Australian Consumer Law). */
export const GUIDES_TAGLINE =
  "RENUABL is an Australian energy intelligence platform: we size one system from your electricity bill and connect you directly with an accredited local installation partner.";

const selfUse = Math.round(ASSUMPTIONS.baseSelfConsumption * 100);

export const GUIDES: Guide[] = [
  {
    slug: "how-to-size-solar-from-your-bill",
    title: "How big should my solar system be? Sizing solar from your electricity bill",
    short: "How big should my solar be?",
    summary:
      "Your bill already knows how much electricity your home uses. Here's how we turn it into one recommended solar and battery system, step by step.",
    topic: "Sizing",
    updated: "2026-09-30",
    minutes: 5,
    body: [
      {
        type: "p",
        text: "Most people are asked to pick a system size before anyone has looked at how much electricity they use. We do it the other way round: your latest electricity bill shows your daily use and what you pay, and that's where sizing starts.",
      },
      { type: "h2", text: "Step 1: your yearly use" },
      {
        type: "p",
        text: "A bill covers a billing period, usually one to three months. From the kilowatt-hours (kWh) used in that period we work out your average daily use, and from that an estimate for the year. Many bills also show the same period last year, which helps.",
      },
      { type: "h2", text: "Step 2: enough solar to cover the year" },
      {
        type: "p",
        text: `Our Essential option is the least solar that makes as much electricity over a year as your home uses, based on the average sunshine at your address (from NASA's long-term records, and Google's roof data where it's available). We never go below a ${ASSUMPTIONS.minSystemKw} kW system, which is the smallest size that usually makes sense to install.`,
      },
      { type: "h2", text: "Step 3: when you use it matters" },
      {
        type: "p",
        text: `Solar only makes electricity during the day. As a rule of thumb, a home uses about ${selfUse}% of its solar as it's made (the fridge, appliances, working from home); the rest goes back to the grid for a small feed-in credit. The electricity you use after dark still comes from the grid unless you have a battery.`,
      },
      { type: "h2", text: "Step 4: with a battery, size for winter" },
      {
        type: "p",
        text: "A battery stores daytime surplus for the evening. Winter has the shortest days, so when you'd like a battery we size the panels so that even in June to August there's usually enough left over to charge it for your evening use, and the battery is the smallest size that holds that evening use.",
      },
      {
        type: "list",
        items: [
          "Essential: solar only, sized to your yearly use.",
          "Recommended: solar and a battery, sized for winter evenings.",
          "Maximum: the same solar and battery, plus a smart EV charger.",
        ],
      },
      { type: "h2", text: "Step 5: checked against your roof" },
      {
        type: "p",
        text: "Where Google's Solar API has data for your home, we check how much usable roof there is and never recommend more panels than it suggests will fit. The final design, including how many panels fit and where, is worked out before your 15-minute call and shown to you on it.",
      },
      {
        type: "note",
        text: "Every figure is an estimate from your bill, your address and typical patterns. Your real savings depend on your usage, the weather and your electricity plan.",
      },
    ],
  },
  {
    slug: "victorian-solar-battery-rebates-explained",
    title: "Solar and battery rebates in Victoria, explained simply",
    short: "Victorian rebates, explained",
    summary:
      "The federal STC incentive, the battery incentive and Solar Victoria's rebate and interest-free loan: what each one is, who it's for, and where to check you're eligible.",
    topic: "Rebates",
    updated: "2026-09-30",
    minutes: 6,
    body: [
      {
        type: "p",
        text: "There are two layers of support for Victorian homes: a federal incentive available across Australia, and Solar Victoria's programs for eligible Victorian households. They're separate, and many homes can use both.",
      },
      { type: "h2", text: "STC Solar Incentive (federal)" },
      {
        type: "p",
        text: "Under the Small-scale Renewable Energy Scheme, a new solar system creates Small-scale Technology Certificates (STCs). How many depends on the system's size, your postcode's sunshine zone and the year it's installed; the number steps down each year until the scheme ends in 2030. The certificates are usually taken as a discount off the price, so you don't need to apply yourself.",
      },
      { type: "h2", text: "BSTC Battery Incentive (federal)" },
      {
        type: "p",
        text: "Since July 2025, home batteries installed alongside solar also create certificates under the federal Cheaper Home Batteries program. The amount depends on the battery's usable size, with a lower rate for the part of a battery above 14 kWh. Like the solar incentive, it comes off the price.",
      },
      { type: "h2", text: "Solar Victoria Rebate" },
      {
        type: "p",
        text: "Solar Victoria offers rebates to eligible Victorian owner-occupiers, with limits on household income and property value, and the system must be installed by an authorised retailer. You apply to Solar Victoria yourself (it takes a few minutes online) and approval usually takes 7 to 10 business days.",
      },
      {
        type: "p",
        text: `Because of that approval, the earliest install date we offer Victorian homes getting a new system is at least ${SOLAR_VIC_LEAD_DAYS} days away, and a chosen date depends on your application being approved.`,
      },
      { type: "h2", text: "Solar Victoria interest-free loan" },
      {
        type: "p",
        text: "Eligible households can also apply for an interest-free loan, paid back over time. It doesn't change the price of the system; it lowers how much you pay upfront. You need to be eligible for the rebate to get the loan.",
      },
      { type: "h2", text: "Expanding solar you already have" },
      {
        type: "p",
        text: "If you're adding a battery to existing panels, the federal battery incentive may still apply, but Solar Victoria's solar rebate is for new systems. We show you which incentives apply to your home on your price.",
      },
      {
        type: "note",
        text: "Rebate rules and amounts change. We load today's rules from the Clean Energy Regulator and Solar Victoria for your price, but always check your eligibility with the official sources.",
      },
      { type: "link", text: "Check Solar Victoria eligibility", href: "https://www.solar.vic.gov.au/" },
      {
        type: "link",
        text: "Clean Energy Regulator: small-scale certificates",
        href: "https://cer.gov.au/schemes/renewable-energy-target/small-scale-renewable-energy-scheme",
      },
    ],
  },
  {
    slug: "do-i-need-a-home-battery",
    title: "Do I need a home battery? A straightforward way to decide",
    short: "Do I need a battery?",
    summary:
      "A battery makes sense when you use a lot of electricity after dark. Here's how to tell from your bill, and what blackout backup really means.",
    topic: "Batteries",
    updated: "2026-09-30",
    minutes: 4,
    body: [
      {
        type: "p",
        text: "Solar panels make electricity while the sun is up. If most of your use is in the evening (cooking, heating, the TV, charging devices), that's the electricity a battery can cover.",
      },
      { type: "h2", text: "A battery is likely worth a look if…" },
      {
        type: "list",
        items: [
          "Your household is out during the day and home in the evening.",
          "You pay a high price per kWh and get a low feed-in credit for solar you send to the grid.",
          "You already have solar and your bill shows you export a lot during the day.",
          "You're planning an electric car, a heat pump or electric heating.",
        ],
      },
      { type: "h2", text: "Solar alone may be enough if…" },
      {
        type: "list",
        items: ["Someone is home during the day and uses most of the solar as it's made.", "Your electricity use is low overall."],
      },
      { type: "h2", text: "What about blackouts?" },
      {
        type: "p",
        text: "Many people assume a battery keeps the lights on in a power cut. It only does if chosen circuits are wired to it for backup. With RENUABL that's an optional extra called Blackout Backup, and which circuits to back up (the fridge, lights, internet) is agreed on your call.",
      },
      { type: "h2", text: "How we size it" },
      {
        type: "p",
        text: "We look at how much you use after dark on a typical winter day and choose the smallest battery that stores it, with panels big enough to charge it. You'll never be asked to choose a battery size yourself.",
      },
      {
        type: "note",
        text: "Savings from a battery depend on your usage and electricity plan. Your price shows the estimate for your home, and the federal battery incentive is taken off it.",
      },
    ],
  },
  {
    slug: "how-to-read-your-electricity-bill",
    title: "How to read your electricity bill (and the three numbers that matter for solar)",
    summary:
      "Bills are full of charges and codes. For solar you only need three things: how much you use, what you pay per kWh and what you're paid for exports.",
    topic: "Your bill",
    updated: "2026-09-30",
    minutes: 4,
    body: [
      {
        type: "p",
        text: "Every retailer lays out its bill differently, but the same few figures are on all of them. These are the ones that decide what solar and a battery can do for you.",
      },
      { type: "h2", text: "1. Your usage (kWh)" },
      {
        type: "p",
        text: "Look for 'usage', 'consumption' or 'general usage', measured in kilowatt-hours (kWh), for the billing period. Divide by the number of days to get your average daily use. Some bills split it into peak, off-peak and shoulder times: that tells us when you use it.",
      },
      { type: "h2", text: "2. Your price per kWh" },
      {
        type: "p",
        text: "This is the rate you pay for each kWh from the grid, often 25 to 40 cents. Every kWh your solar or battery covers is one you don't buy at this price.",
      },
      { type: "h2", text: "3. Your feed-in tariff" },
      {
        type: "p",
        text: "If you already have solar, your bill shows the electricity you exported and the credit per kWh. Feed-in credits are usually much lower than the price you pay, which is why using your own solar (or storing it) is worth more than exporting it.",
      },
      { type: "h2", text: "Things you can ignore for sizing" },
      {
        type: "list",
        items: [
          "The daily supply charge: you pay it with or without solar.",
          "Your account number, NMI and personal details: we don't need or ask for them.",
          "Discounts and concessions: they change what you pay, not how much you use.",
        ],
      },
      {
        type: "p",
        text: "When you upload your bill to RENUABL, we read these figures for you and only keep the numbers: the file itself isn't stored. We also check the bill is for the address you entered.",
      },
    ],
  },
  {
    slug: "what-happens-after-you-reserve",
    title: "From your bill to switch-on: what happens after you reserve",
    summary:
      "Reserving is free. Here's each step after that, from the 15-minute confirmation call to install day and switching your system on.",
    topic: "The process",
    updated: "2026-09-30",
    minutes: 4,
    body: [
      {
        type: "p",
        text: "Buying solar shouldn't mean weeks of calls and quotes. With RENUABL you see your system and price in a few minutes, pick an install day and reserve it for free.",
      },
      { type: "h2", text: "1. Reserve your date (free)" },
      {
        type: "p",
        text: "You give your name, mobile and email, choose an install day and book a 15-minute confirmation call. Nothing is charged.",
      },
      { type: "h2", text: "2. Your system is designed" },
      {
        type: "p",
        text: "Before the call, your installation partner designs the system for your roof: the products, how many panels fit and where they go.",
      },
      { type: "h2", text: "3. The 15-minute confirmation call" },
      {
        type: "p",
        text: "This is a confirmation call, not a sales call. We go through the design, your roof and switchboard, any backup circuits and your rebates. Nothing is final until you're happy.",
      },
      { type: "h2", text: "4. The refundable deposit" },
      {
        type: "p",
        text: `Only after the call, if you'd like to go ahead, you pay a $${ASSUMPTIONS.deposit} refundable deposit to lock in your date.`,
      },
      { type: "h2", text: "5. Install day" },
      {
        type: "p",
        text: "Your installation partner arrives between 7am and 9am, and you'll know on your call roughly how long the work will take. They photograph the work, record every panel and battery serial number, and you can see it all on your installation record.",
      },
      { type: "h2", text: "6. Switch-on" },
      {
        type: "p",
        text: "Your partner and RENUABL handle the grid connection paperwork and rebates, and you can follow each step in plain language in My RENUABL.",
      },
    ],
  },
  {
    slug: "three-quotes-or-one-plan",
    title: "Three solar quotes, or one clear plan? A simpler way to buy solar",
    summary: "The usual advice is to get three quotes. Here's why comparing them is hard, and what to look for whichever way you buy.",
    topic: "Choosing",
    updated: "2026-09-30",
    minutes: 4,
    body: [
      {
        type: "p",
        text: "Getting several quotes is sensible advice, but it often leaves people comparing three different system sizes, three sets of brands and three sets of savings assumptions, with sales calls in between.",
      },
      { type: "h2", text: "Why quotes are hard to compare" },
      {
        type: "list",
        items: [
          "Each company may size the system differently, so the prices aren't for the same thing.",
          "Savings estimates use different assumptions about how much solar you'll use yourself.",
          "Rebates may be shown before or after the price, or not at all.",
          "Brand names are hard to judge without technical knowledge.",
        ],
      },
      { type: "h2", text: "What to look for, whoever you buy from" },
      {
        type: "list",
        items: [
          "A system sized from your actual electricity use, not a standard package.",
          "A price that includes installation, the inverter, electrical work, commissioning and GST.",
          "Rebates shown as separate lines, so you can see the price before and after.",
          "Installation by people accredited under Solar Accreditation Australia (SAA), with a current electrical licence and insurance.",
          "Clear warranties for panels, the inverter, the battery and the workmanship.",
        ],
      },
      { type: "h2", text: "How RENUABL does it" },
      {
        type: "p",
        text: "We read your bill, recommend one system sized for your home, show the full price with each rebate in its own line and match you with one accredited local installation partner. If you'd like to see alternatives, you can, but you don't have to compare anything to get a clear answer.",
      },
    ],
  },
  {
    slug: "what-size-battery-do-i-need",
    title: "What size battery do I need? Start with how much solar you export",
    short: "What size battery?",
    summary:
      "Before choosing a battery, find out how much solar you send to the grid each day. It's on your bill, and it's what fills your battery.",
    topic: "Batteries",
    updated: "2026-09-30",
    minutes: 3,
    body: [
      {
        type: "p",
        text: "\"What size battery should I get?\" is one of the most common questions we hear. The answer starts with another question: how much spare solar are you making? Most people don't know, and that's fine, because it's on your electricity bill.",
      },
      { type: "h2", text: "Your exports are what fill a battery" },
      {
        type: "p",
        text: "During the day your home uses some of its solar as it's made. What's left over goes out to the grid, and that's the energy a battery would store for the evening instead. A battery bigger than your spare solar can fill doesn't earn its keep.",
      },
      { type: "h2", text: "Work out your daily exports in one minute" },
      {
        type: "list",
        items: [
          "Find the energy you exported to the grid on your bill, in kilowatt-hours (kWh). It's often labelled 'solar exports', 'feed-in' or 'generation'.",
          "Find the number of days in the billing period (it's on the bill).",
          "Divide the exports by the days. That's your daily export.",
        ],
      },
      {
        type: "p",
        text: "For example, 540 kWh exported over a 90-day bill is 6 kWh a day. That's roughly how much a battery could fill on an average day from the panels you already have.",
      },
      { type: "h2", text: "Then compare it with your evening use" },
      {
        type: "p",
        text: "A battery only saves you money on electricity you'd otherwise buy after dark. If your exports are much bigger than your evening use, size for the evening use. If they're smaller, the battery can only fill with what you export, so a smaller battery (or a few extra panels) may make more sense. And sometimes the numbers show you don't need a battery at all.",
      },
      {
        type: "note",
        text: "Winter days are shorter, so exports drop. If you have a winter bill, use it too: it shows what your panels can fill on the hardest days.",
      },
      { type: "h2", text: "Let us do the maths" },
      {
        type: "p",
        text: `When you upload your bill to RENUABL, we read your exports and your use for you and recommend a battery sized to both. Our batteries come in ${ASSUMPTIONS.batterySizes[0]} kWh modules with about ${Math.round(ASSUMPTIONS.batteryUsableShare * 100)}% usable, and we only suggest extra panels if your exports can't fill it.`,
      },
    ],
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Plain text of a guide (for checks and structured data). */
export function guideText(g: Guide): string {
  const parts = [g.title, g.summary];
  for (const b of g.body) {
    if (b.type === "list") parts.push(...b.items);
    else parts.push(b.text);
  }
  return parts.join("\n");
}

/** What the guides are called to customers (one place, so it's easy to rename). */
export const LEARN_NAME = "Learn with Revo";

/** The home page pop-up that introduces the guides. */
export const LEARN_POPUP = {
  /** Seconds on the home page before it appears. */
  delaySeconds: 6,
  /** Once closed (or used), it stays away this long. */
  quietDays: 7,
  /** The guides it features, in order. */
  featured: ["how-to-size-solar-from-your-bill", "victorian-solar-battery-rebates-explained", "do-i-need-a-home-battery"],
} as const;

/** Whether the pop-up may show: not within `quietDays` of last being closed or used. */
export function shouldShowLearnPopup(lastClosedAt: number | null, now: number): boolean {
  if (lastClosedAt === null || !Number.isFinite(lastClosedAt)) return true;
  return now - lastClosedAt >= LEARN_POPUP.quietDays * 86_400_000;
}
