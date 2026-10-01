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
  | { type: "link"; text: string; href: string }
  /** "Revo's tip": one practical, friendly pointer. */
  | { type: "tip"; text: string };

export interface Guide {
  slug: string;
  title: string;
  /** A short title for tight spaces (the home page pop-up). */
  short?: string;
  /** One or two sentences: the meta description and the card text on /learn. */
  summary: string;
  /** Short label shown above the title. */
  topic: GuideTopic;
  /** When the facts were last checked (ISO date). */
  updated: string;
  minutes: number;
  /** "The short answer": two or three sentences at the top, so a reader who stops there still has the answer. */
  answer: string;
  body: GuideBlock[];
}

/** Topics, in the order /learn shows them. */
export const GUIDE_TOPICS = [
  "Sizing",
  "Batteries",
  "Healthy home",
  "Rebates",
  "Your bill",
  "Your home",
  "Everyday solar",
  "Choosing",
  "The process",
] as const;
export type GuideTopic = (typeof GUIDE_TOPICS)[number];

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
    answer:
      "Start with your bill, not a package. Enough solar to cover your yearly use is the starting point; if you want a battery, add enough to charge it on a winter day. We do this for you from your bill in about two minutes.",
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
    updated: "2026-10-01",
    minutes: 6,
    answer:
      "Most Victorian homes can get a federal discount on solar and batteries, taken straight off the price. Eligible households may also get a Solar Victoria rebate and an interest-free loan. We show each one as its own line on your price.",
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
    answer:
      "A battery pays off when you use a lot of power after dark and export a lot during the day. If someone's home all day using the solar as it's made, solar alone may be enough.",
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
    answer:
      "You only need three numbers: how much you use (kWh), what you pay per kWh, and what you're paid for exports. Everything else on the bill can wait.",
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
    answer:
      "Reserve for free, have a 15-minute confirmation call, pay a refundable deposit only if you're happy, then your installation partner arrives on the day you chose.",
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
    answer:
      "Three quotes often means three different systems, so they're hard to compare. What matters is a system sized from your bill, a full price with rebates shown separately, and an accredited team to install it.",
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
    answer:
      "Check your bill first. Divide the solar you exported by the days in the billing period: that's roughly what can fill a battery each day. Then size for your evening use.",
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
  {
    slug: "how-does-solar-work",
    title: "How does solar work? The 60-second version",
    short: "How does solar work?",
    summary: "Panels make power from daylight, your home uses it first, and the spare goes to the grid or a battery. That's really it.",
    topic: "Everyday solar",
    updated: "2026-09-30",
    minutes: 2,
    answer:
      "Panels on your roof turn daylight into electricity. Your home uses it first, any spare goes to a battery (if you have one) or out to the grid, and at night you draw from the battery or the grid as usual.",
    body: [
      { type: "h2", text: "1. Panels make power from daylight" },
      {
        type: "p",
        text: "Solar panels make electricity whenever there's daylight: most around the middle of the day, less in the morning, the evening and on cloudy days.",
      },
      { type: "h2", text: "2. The inverter makes it usable" },
      {
        type: "p",
        text: "Panels make a kind of electricity (DC) your home can't use directly. The inverter, a box usually on a wall near your switchboard, turns it into the kind your appliances use (AC).",
      },
      { type: "h2", text: "3. Your home uses it first" },
      {
        type: "p",
        text: "Whatever's running while the sun is up (the fridge, the washing machine, the air conditioner) runs on your solar first. That's the power you no longer buy.",
      },
      { type: "h2", text: "4. The spare goes somewhere useful" },
      {
        type: "p",
        text: "If you make more than you're using, the spare charges your battery, if you have one, or goes to the grid for a feed-in credit on your bill.",
      },
      { type: "h2", text: "5. At night, nothing changes" },
      {
        type: "p",
        text: "After dark your home runs on your battery or on grid power, just like before. You don't need to do anything: it all switches automatically.",
      },
      {
        type: "tip",
        text: "Run the dishwasher, washing machine and pool pump in the middle of the day. It's the easiest way to get more from your solar without spending a cent.",
      },
    ],
  },
  {
    slug: "what-is-an-inverter",
    title: "What is a solar inverter, and why does it matter?",
    short: "What's an inverter?",
    summary: "The inverter is the brain of a solar system. Here's what it does, why its size matters and what a hybrid inverter is.",
    topic: "Everyday solar",
    updated: "2026-09-30",
    minutes: 2,
    answer:
      "The inverter turns your panels' power into the power your home uses, and keeps track of what your system makes. A hybrid inverter can also run a battery, which is what we use whenever a battery is part of the plan.",
    body: [
      { type: "h2", text: "What it does" },
      {
        type: "list",
        items: [
          "Converts the panels' DC power into the AC power your home uses.",
          "Works out, second by second, whether to power the home, charge a battery or export.",
          "Records what your system makes, which you can usually see in an app.",
        ],
      },
      { type: "h2", text: "Why the size matters" },
      {
        type: "p",
        text: "Inverters are rated in kilowatts (kW). It's normal, and allowed within limits, for the panels to add up to a bit more than the inverter's rating, because panels rarely make their full rating at once. We size the inverter to your panels for you.",
      },
      { type: "h2", text: "String or hybrid?" },
      {
        type: "p",
        text: "A string inverter handles solar only. A hybrid inverter also manages a battery. If you're getting a battery now, or think you will, a hybrid saves replacing the inverter later.",
      },
      {
        type: "tip",
        text: "Your inverter usually lives on an outside wall or in the garage near the switchboard. Somewhere shaded and out of the weather helps it last.",
      },
    ],
  },
  {
    slug: "is-my-roof-right-for-solar",
    title: "Is my roof right for solar? Direction, shade and roof type",
    short: "Is my roof right for solar?",
    summary: "North is great, east and west work well, shade matters most. A plain-English check of your roof before you buy.",
    topic: "Your home",
    updated: "2026-09-30",
    minutes: 3,
    answer:
      "Most Victorian roofs work. North-facing roofs get the most sun, east and west are good too, and shade is the thing to watch. Tile, tin and flat roofs can all take panels; the fittings are just different.",
    body: [
      { type: "h2", text: "Which way does it face?" },
      {
        type: "list",
        items: [
          "North: the most sun over the day in Australia.",
          "East and west: a little less overall, but spread across morning and afternoon, which can suit how you use power.",
          "South: usually the last choice, used only when other roofs are full or shaded.",
        ],
      },
      { type: "h2", text: "Shade is the big one" },
      {
        type: "p",
        text: "Trees, chimneys, a taller building next door or a roof that shades itself can all cut what panels make. When we look at your home we use Google's roof data, which includes shading, and your partner checks it again before anything is final.",
      },
      { type: "h2", text: "Tile, tin or flat?" },
      {
        type: "list",
        items: [
          "Tile: panels mount on brackets hooked under the tiles.",
          "Tin (Colorbond or similar): brackets fix straight to the roof.",
          "Flat: panels can lie flat, or be tilted on frames to catch more sun. Tilting depends on roof space and how it looks, and it's checked on your call.",
        ],
      },
      { type: "h2", text: "How much space?" },
      {
        type: "p",
        text: "Each panel is roughly the size of a door lying down. We never recommend more panels than Google's roof data suggests will fit, and the final layout is confirmed with you before install.",
      },
      {
        type: "tip",
        text: "Not sure which way your roof faces? Open a map on your phone in satellite view: the top of the screen is north.",
      },
    ],
  },
  {
    slug: "single-phase-or-three-phase",
    title: "Single phase or three phase? How to tell in two minutes",
    short: "Single or three phase?",
    summary: "Most homes are single phase. Here's how to check yours, and why it matters for solar.",
    topic: "Your home",
    updated: "2026-09-30",
    minutes: 2,
    answer:
      "Most Australian homes are single phase. Three phase is more common in bigger or newer homes, and it lets you have a bigger solar system. If you're not sure, say so: we'll plan for single phase and check on the call.",
    body: [
      { type: "h2", text: "Why it matters" },
      {
        type: "p",
        text: "The electricity network limits how big a solar system each home can connect, and three-phase homes can usually connect more. It also decides which inverter your home needs.",
      },
      { type: "h2", text: "Three ways to check" },
      {
        type: "list",
        items: [
          "Look at your switchboard: a main switch that's three switches joined together often means three phase. A single one usually means single phase.",
          "Check your meter or bill: some show 'three phase' or list three sets of readings.",
          "Ask an electrician, or tick 'not sure' and we'll check for you.",
        ],
      },
      {
        type: "note",
        text: "Only a licensed electrician should open or work on your switchboard. Looking at the front is fine; leave the rest to the professionals.",
      },
      { type: "tip", text: "Snap a photo of your switchboard with the cover open (don't touch anything) and keep it handy for your call." },
    ],
  },
  {
    slug: "feed-in-tariffs-explained",
    title: "Feed-in tariffs: why exporting solar pays less than you think",
    short: "Feed-in tariffs, explained",
    summary:
      "You're paid a little for solar you send to the grid, but it's usually far less than what you pay for power. Here's what that means for you.",
    topic: "Your bill",
    updated: "2026-09-30",
    minutes: 2,
    answer:
      "A feed-in tariff is the credit your retailer pays for solar you send to the grid. It's usually a small fraction of what you pay per kWh, so solar is worth the most when you use it yourself or store it.",
    body: [
      { type: "h2", text: "A quick comparison" },
      {
        type: "p",
        text: "Look at your bill: the price you pay for each kWh from the grid is usually several times the credit you get for each kWh you export. Every kWh you use yourself saves you the full price; every kWh you export earns you the small credit.",
      },
      { type: "h2", text: "What this means in practice" },
      {
        type: "list",
        items: [
          "Using your solar during the day is worth more than exporting it.",
          "A battery turns cheap exports into evening power you'd otherwise buy at full price.",
          "Feed-in rates vary between retailers and change over time, so it's worth checking your plan once a year.",
        ],
      },
      { type: "h2", text: "Who sets it?" },
      {
        type: "p",
        text: "Your electricity retailer sets the rate on your plan. In Victoria, the Essential Services Commission sets a minimum each year.",
      },
      {
        type: "link",
        text: "Essential Services Commission: minimum feed-in tariff",
        href: "https://www.esc.vic.gov.au/electricity-and-gas/prices-tariffs-and-benchmarks/minimum-feed-tariff",
      },
      {
        type: "tip",
        text: "When you compare electricity plans after getting solar, don't just chase the highest feed-in rate: a plan with a lower usage price can save you more.",
      },
    ],
  },
  {
    slug: "solar-myths",
    title: "Five solar myths, busted (cloudy days, blackouts and more)",
    short: "Five solar myths, busted",
    summary:
      "Does solar work on cloudy days? Will it keep my lights on in a blackout? Quick, honest answers to the things people often get wrong.",
    topic: "Everyday solar",
    updated: "2026-09-30",
    minutes: 3,
    answer:
      "Solar still works on cloudy days (just less), doesn't power your home in a blackout unless it's set up for backup, and panels don't need to face north to be worth it.",
    body: [
      { type: "h2", text: "Myth 1: solar doesn't work on cloudy days" },
      {
        type: "p",
        text: "Panels make power from daylight, not heat, so they keep working when it's cloudy, just less. Your savings are worked out over a whole year, cloudy days included.",
      },
      { type: "h2", text: "Myth 2: solar keeps the lights on in a blackout" },
      {
        type: "p",
        text: "Most systems switch off in a blackout, as Australian standards require, so they don't send power into lines that people may be working on. To keep chosen circuits running you need a battery set up for backup (with us, that's Blackout Backup).",
      },
      { type: "h2", text: "Myth 3: panels have to face north" },
      {
        type: "p",
        text: "North gets the most sun, but east and west roofs work well and spread your solar across the morning and afternoon.",
      },
      { type: "h2", text: "Myth 4: solar is only worth it if you're home all day" },
      {
        type: "p",
        text: "Being home helps you use more of it, but the fridge, hot water timers and appliances you schedule for the day all count. A battery covers the evening.",
      },
      { type: "h2", text: "Myth 5: panels need lots of maintenance" },
      {
        type: "p",
        text: "Not really. Rain cleans most tilted panels, and an occasional check is usually all they need. See our guide to looking after your panels.",
      },
      {
        type: "tip",
        text: "Heard something else about solar and not sure if it's true? Ask me in the chat. I'll give you a straight answer.",
      },
    ],
  },
  {
    slug: "solar-and-electric-cars",
    title: "Solar and electric cars: charging your car from your roof",
    short: "Charging an EV with solar",
    summary:
      "An electric car can soak up your spare solar. Here's how it works, what a smart charger does and when charging at home makes sense.",
    topic: "Everyday solar",
    updated: "2026-09-30",
    minutes: 2,
    answer:
      "An electric car is a great way to use spare solar: plug it in during the day and it charges from your roof instead of the grid. A smart charger can do this automatically, using only the solar you'd otherwise export.",
    body: [
      { type: "h2", text: "Why they pair so well" },
      {
        type: "p",
        text: "A car battery is big, so it can soak up solar that would otherwise go to the grid for a small credit. Driving on your own sunshine is usually the cheapest way to run a car.",
      },
      { type: "h2", text: "What a smart charger does" },
      {
        type: "list",
        items: [
          "Charges faster than a normal power point.",
          "Can follow your solar, speeding up when there's spare and slowing down when there isn't.",
          "Lets you set times, so it tops up off-peak if the car's home at night.",
        ],
      },
      { type: "h2", text: "What if the car's at work all day?" },
      {
        type: "p",
        text: "Then weekends and days at home are your solar charging days, and a home battery or an off-peak plan can help the rest of the week.",
      },
      { type: "p", text: "Our Maximum option includes a smart EV charger, and you can switch it on or off when you look at your system." },
      { type: "tip", text: "Planning an EV in the next few years? Mention it when you size your solar, so the system has room for it." },
    ],
  },
  {
    slug: "looking-after-your-solar-panels",
    title: "Looking after your solar panels: cleaning, checks and warranties",
    short: "Looking after your panels",
    summary: "Panels need very little care. Here's what's worth doing, what to leave alone, and what the warranties usually cover.",
    topic: "Everyday solar",
    updated: "2026-09-30",
    minutes: 3,
    answer:
      "Panels need very little looking after. Rain cleans most of them, a glance at your app tells you they're working, and the warranties cover the panels, the inverter, any battery and the installation separately.",
    body: [
      { type: "h2", text: "Cleaning" },
      {
        type: "list",
        items: [
          "Tilted panels are usually cleaned by the rain.",
          "Flat panels, or homes near the coast, dusty roads or trees, may need an occasional clean.",
          "Hose from the ground, or use a professional. Please don't climb onto the roof.",
        ],
      },
      { type: "h2", text: "Easy checks" },
      {
        type: "list",
        items: [
          "Look at your system's app now and then: a sudden drop on a sunny day is worth a question.",
          "Check the inverter for warning lights.",
          "Keep an eye on trees growing into the panels' sun.",
        ],
      },
      { type: "h2", text: "What the warranties usually cover" },
      {
        type: "list",
        items: [
          "Panels: a product warranty and a performance warranty, often 25 years or more.",
          "Inverter: usually a shorter warranty than the panels.",
          "Battery: often around 10 years.",
          "Installation: the workmanship, from whoever installed it.",
        ],
      },
      {
        type: "note",
        text: "Warranty terms differ by product and maker. The documents for your system are the ones that count, and they're kept on your installation record in My RENUABL.",
      },
      { type: "tip", text: "If something looks off, book a service visit in My RENUABL. Warranty work is free." },
    ],
  },
  {
    slug: "gas-cooking-and-indoor-air",
    title: "Cooking on gas: what it means for the air in your kitchen",
    short: "Gas cooking and indoor air",
    summary:
      "A gas cooktop burns gas inside your home. Here's what that puts into the air, and simple ways to keep your kitchen air fresher.",
    topic: "Healthy home",
    updated: "2026-09-30",
    minutes: 3,
    answer:
      "Burning gas releases combustion gases, including nitrogen dioxide, into your kitchen. A rangehood that vents outside helps a lot. Induction cooking avoids it altogether because nothing is burned.",
    body: [
      { type: "h2", text: "What's in the air when you cook on gas" },
      {
        type: "p",
        text: "A gas flame is combustion, like a small fire. Along with heat, it gives off gases such as nitrogen dioxide and carbon monoxide, plus fine particles from the cooking itself. In a kitchen, those mix straight into the air you breathe.",
      },
      { type: "h2", text: "Why ventilation matters" },
      {
        type: "list",
        items: [
          "A rangehood ducted to the outside removes fumes at the source. Recirculating hoods filter grease but don't take gases outside.",
          "Use the back burners when you can: most rangehoods capture more from there.",
          "Open a window while cooking if you don't have a ducted rangehood.",
        ],
      },
      { type: "h2", text: "What induction changes" },
      {
        type: "p",
        text: "An induction cooktop heats the pan with a magnetic field, so there's no flame and no combustion gases. It's also quick, easy to clean and runs on electricity, which your solar can supply during the day.",
      },
      { type: "h2", text: "Is it worth switching?" },
      {
        type: "list",
        items: [
          "Switching usually means a new cooktop, a quick electrical check and sometimes new pans (a magnet should stick to the base).",
          "If you're planning to leave gas altogether, induction is a common place to start, alongside heat-pump hot water.",
        ],
      },
      {
        type: "tip",
        text: "Turn the rangehood on before you start cooking and leave it running for a few minutes after. It's the easiest free fix there is.",
      },
      { type: "link", text: "Take the Home Health check", href: "/home-health" },
    ],
  },
  {
    slug: "better-bedroom-air-overnight",
    title: "How to improve the air in your bedroom overnight",
    short: "Fresher bedroom air overnight",
    summary:
      "Waking up to a stuffy room is common in closed-up bedrooms. Here's why it happens and what helps, starting with the free fixes.",
    topic: "Healthy home",
    updated: "2026-09-30",
    minutes: 3,
    answer:
      "A closed bedroom slowly fills with the air you breathe out, which is why it can feel stuffy by morning. A little fresh air overnight is the simplest fix; a monitor shows you when it's needed, and fresh-air ventilation does it for you.",
    body: [
      { type: "h2", text: "Why bedrooms get stuffy" },
      {
        type: "p",
        text: "Every breath adds carbon dioxide and moisture to the room. With the door and windows shut for eight hours, levels build up, especially in smaller rooms or with two people. That's the heavy, stale feeling some people notice when they wake up.",
      },
      { type: "h2", text: "Free fixes to try first" },
      {
        type: "list",
        items: [
          "Leave a window open a crack, or the bedroom door ajar.",
          "Air the room out for ten minutes in the morning.",
          "Keep the bedroom a little cooler: stale air feels worse in a warm room.",
        ],
      },
      { type: "h2", text: "When a monitor helps" },
      {
        type: "p",
        text: "An air-quality monitor measures carbon dioxide, humidity and particles and shows them on a small display or your phone. It takes the guesswork out: you can see whether the room needs more fresh air, and whether what you've changed is working.",
      },
      { type: "h2", text: "Fresh-air ventilation" },
      {
        type: "p",
        text: "A fresh-air system brings filtered outdoor air in and takes stale air out, without opening windows. That suits homes near busy roads, with noise at night, or where windows stay shut in winter. Some systems recover heat from the outgoing air, so the house doesn't lose its warmth.",
      },
      { type: "h2", text: "Condensation or mould?" },
      {
        type: "p",
        text: "Water on the windows in the morning, or mould in corners, usually means moist air isn't getting out. Ventilation or a dehumidifier helps, and it's worth fixing sooner rather than later.",
      },
      {
        type: "tip",
        text: "Try one week with the window open a crack and one with it closed. If mornings feel noticeably fresher, fresh air is what the room needs.",
      },
      { type: "link", text: "Take the Home Health check", href: "/home-health" },
    ],
  },
  {
    slug: "water-filtration-explained",
    title: "Water filtration explained: jug, under-sink or whole-house?",
    short: "Water filtration explained",
    summary:
      "Australian tap water is treated to strict guidelines. Filters are about taste, chlorine and peace of mind. Here's how the main types compare.",
    topic: "Healthy home",
    updated: "2026-09-30",
    minutes: 3,
    answer:
      "Tap water in Victoria is treated to meet the Australian Drinking Water Guidelines. Filters mostly change taste and smell (chlorine) and catch sediment. A tap or under-sink filter covers drinking and cooking water; a whole-house filter covers every tap and shower.",
    body: [
      { type: "h2", text: "Why people filter" },
      {
        type: "list",
        items: [
          "Taste and smell: mostly the chlorine used to keep water safe on its way to you.",
          "Sediment from older pipes, or after works on the mains.",
          "Water in the shower that feels softer on skin and hair (a common reason for whole-house filters).",
        ],
      },
      { type: "h2", text: "The main types" },
      {
        type: "list",
        items: [
          "Jug filters: cheap and simple, for drinking water only. Cartridges need changing often.",
          "Under-sink filters: a filter under the kitchen sink with its own tap or through your mixer. Filters drinking and cooking water with little fuss.",
          "Reverse osmosis: filters more finely, but wastes some water and needs more maintenance.",
          "Whole-house filters: fitted where water enters the home, so every tap and shower is filtered.",
        ],
      },
      { type: "h2", text: "What to check" },
      {
        type: "list",
        items: [
          "What it's certified to remove. Look for independent certification, not just a brand claim.",
          "How often cartridges need changing, and what they cost.",
          "Whether a licensed plumber needs to fit it (under-sink and whole-house filters usually do).",
        ],
      },
      {
        type: "note",
        text: "A filter only works if it's maintained. An old cartridge can do more harm than good, so set a reminder to change it.",
      },
      { type: "tip", text: "Not sure what's in your water? Your water retailer publishes a yearly water quality report for your area." },
      { type: "link", text: "Take the Home Health check", href: "/home-health" },
    ],
  },
  {
    slug: "circadian-lighting-explained",
    title: "Circadian lighting explained: bright mornings, warm evenings",
    short: "Circadian lighting explained",
    summary:
      "Lights that change brightness and colour through the day, following natural daylight. Here's what circadian lighting is and how it works in a home.",
    topic: "Healthy home",
    updated: "2026-09-30",
    minutes: 3,
    answer:
      "Circadian lighting changes its brightness and colour through the day: bright, cooler light in the morning and dim, warm light in the evening, following natural daylight. It runs on a schedule, so you don't have to think about it.",
    body: [
      { type: "h2", text: "What it does" },
      {
        type: "p",
        text: "Daylight changes from bright and cool at midday to warm and soft at sunset. Circadian lighting follows the same pattern indoors, using smart globes or fittings that can change their colour temperature and brightness on a schedule.",
      },
      { type: "h2", text: "What it looks like at home" },
      {
        type: "list",
        items: [
          "Mornings: lights brighten gently before your alarm, like a sunrise.",
          "Daytime: brighter, cooler light for cooking, working and reading.",
          "Evenings: warmer, dimmer light, instead of harsh white overhead lights.",
          "Night: a soft, low path light for getting up without switching everything on.",
        ],
      },
      { type: "h2", text: "Where to start" },
      {
        type: "list",
        items: [
          "The main bedroom is the usual first room: a gentle morning light makes a noticeable difference to waking up in a dark room.",
          "Living areas next, where evening lighting matters most.",
          "It can often reuse your existing light points, so it's mostly a change of globes, switches or fittings.",
        ],
      },
      { type: "h2", text: "Pairs well with" },
      {
        type: "p",
        text: "Blackout or smart blinds keep streetlights and early sunrise out, so the lighting you choose is the light you get.",
      },
      {
        type: "tip",
        text: "Harsh evening lights? Swap the globe you use most after dark for a warm-white one. It's a small change you'll notice straight away.",
      },
      { type: "link", text: "Take the Home Health check", href: "/home-health" },
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
  parts.push(g.answer);
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
