/**
 * The sign-up page for solar businesses (`/design` signed out; Martin, 1 Nov 2026: "Pay less. Do more."): what it
 * says, in one place so it can be checked (`sales-page.test.ts`). Loud in tone, true in every line (Australian Consumer
 * Law): no "best" or "first", no rival named or compared with (3 Nov 2026, Martin: "we don't need to compare"), every coming-soon thing
 * labelled, and every screenshot a real screen of the product with made-up example data.
 */
import { COMMIT_MONTHS, COMMIT_SEAT_CENTS, ENTERPRISE_FROM, PLAN_WORDS, SEAT_MONTHLY_CENTS, dollars } from "./plans";
import { ADD_ON_KEYS, ADD_ON_WORDS, addOnPriceWords } from "./add-ons";
import { SOL_PER_USER } from "./sol-credits";

/**
 * The hero (3 Nov 2026, Martin, after "Pay less. Do more." and "Just ask. It's done." didn't land: witty, not a feature
 * list; call out that RENUABL is powered by AI and spark what's possible with it, in a trade that is usually dull. The
 * all-in-one platform is said, but isn't the headline).
 */
export const SALES_HERO = {
  eyebrow: "RENUABL Business · Powered by AI",
  /** Said in two lines, the second lit in the signal orange. */
  headline: ["Solar just", "got a brain."],
  sub: "RENUABL is the all-in-one platform for solar businesses, with AI built into every part of it. Ask it to design a roof, line up your day, check a standard or write the follow-up, and watch it happen.",
  cta: "Sign up",
  small: ["Everything in one platform", "Up and running today", "Cancel any time"],
} as const;

/**
 * Everything a business gets, early and in one look (3 Nov 2026, Martin: "a slide that very quickly details everything
 * you get... upgrade your business"). Each line something RENUABL does today; the Marketplace is marked coming soon.
 */
/** The smart CRM band's real screen: the pipeline with each deal's clock and temperature (made-up customers). */
export const CRM_SHOT = {
  src: "/design/landing/deals.webp",
  alt: "RENUABL's smart CRM: deals with their clock, temperature and who to call next (example data)",
} as const;

/** The service band's real screen: a case picked, Sol's summary and recommended next steps (made-up customer). */
export const SERVICE_SHOT = {
  src: "/design/landing/service-sol.webp",
  alt: "RENUABL's service screen: Sol summing up a customer's inverter fault and recommending the next steps (example data)",
} as const;

export const UPGRADE = {
  eyebrow: "What you get",
  headline: "Your business, upgraded.",
  sub: "Out with the old way. Here's what changes the day you start.",
  items: [
    {
      key: "crm",
      was: "A CRM you feed by hand",
      title: "A smart CRM",
      body: "It writes up your calls, drafts your emails and tells you who to ring next.",
    },
    {
      key: "sol",
      was: "Googling the rules at 9pm",
      title: "An AI expert on the team",
      body: "Sol knows solar, your deals and the standards, and shows his sources.",
    },
    {
      key: "design",
      was: "Drawing every roof from scratch",
      title: "A design tool that designs itself",
      body: "Ask for 8 kW and a battery, or press once for three designs, priced as they're drawn.",
    },
    {
      key: "proposals",
      was: "Quotes pasted into a template",
      title: "Proposals that are yours",
      body: "Your brand, your terms, signed online with the deposit asked for.",
    },
    {
      key: "service",
      was: "Hunting through old texts",
      title: "Service, summed up by Sol",
      body: "Every customer issue in a line, with the steps he'd take next.",
    },
    {
      key: "installs",
      was: "Spreadsheets and phone tag",
      title: "Orders and installs, handled",
      body: "A signed job becomes the order, the booking and the job card.",
    },
    {
      key: "team",
      was: "A group chat on your phone",
      title: "Your team, beside the work",
      body: "Channels, direct messages and @Sol, right next to your deals.",
    },
    {
      key: "market",
      was: "Ringing around for a crew",
      title: "RENUABL Marketplace",
      body: "Jobs, installers and spare stock across the industry.",
      soon: true,
    },
  ],
} as const;

/**
 * The hero's moving example (3 Nov 2026, Martin: spark the imagination, don't lead with a design): requests typed to
 * Sol one after another, each answered in a line. Every one is something RENUABL does today: the design tool's whole-
 * system request, Today's Up first, the web with sources, the electrical rules (never saying a site complies), a
 * drafted follow-up (never sent by him), a bill read. Made-up names; no figure he'd have to prove.
 */
export const ASK_ANYTHING = {
  label: "Ask Sol anything",
  prompts: [
    {
      ask: "Load 8 kW of panels, an inverter and a battery on the Hart roof",
      answer: "Done. 17 panels, a hybrid inverter and a battery, strung and priced.",
    },
    { ask: "Who should I call next?", answer: "Olivia Hart. Her enquiry came in two days ago and her roof isn't designed yet." },
    {
      ask: "What's AusNet's export limit for a single-phase home?",
      answer: "Here's what AusNet's own pages say, with the links so you can check.",
    },
    {
      ask: "What does AS/NZS 5139 ask for around a battery in a garage?",
      answer: "The clearances and barriers it asks for, and why. Check the clause in your copy.",
    },
    { ask: "Write the follow-up for Priya's proposal", answer: "Drafted in your voice. Have a read, then press send." },
    { ask: "Read this bill and size the system", answer: "About 18 kWh a day. Three designs are ready, each priced against it." },
  ],
  caption: "Requests you can make in RENUABL today. Made-up customers.",
} as const;

/**
 * The design tool's moving example: a request typed into its "Ask Sol to change it" bar, done as it is in the
 * product (`parseCommand` reads it as a whole system: the panels to the kW, an inverter and a battery by rule). The
 * reply is the shape the designer gives, on the drawn, made-up home with generic product names.
 */
export const ASK_DEMO = {
  label: "Ask Sol to change it",
  request: "Load 8 kW of panels, an inverter and a battery",
  reply: "17 panels, 8.07 kW · 8 kW hybrid inverter · 2 × 8 kWh battery (16 kWh).",
  caption: "The design tool, drawn at work on a made-up home. The request is one you can type today.",
} as const;

/**
 * The three things RENUABL is known by (3 Nov 2026, Martin: the designer, Sol and the Marketplace are huge features and
 * must feel it; the designer is sold for the AI over it, not as one more design tool). The Marketplace is labelled
 * coming soon. The designer has no band of its own (6 Nov 2026, Martin: the "Your business, upgraded" deck just above
 * already shows it, and the hero's film; "we don't need it twice").
 */
/** Over the cards of the four big parts (16 Nov 2026, Martin, as xAI's Grok Bot page lays its features out). */
export const FEATURES = {
  headline: "Everything a solar business runs on",
  sub: "One login for the CRM, service, Sol and the marketplace. AI takes the busywork in every part, and you make the calls.",
} as const;

export const BIG_THREE = [
  {
    id: "crm",
    line: "The note-taker writes the call up and fills in the deal. Sol drafts the follow-up, and every deal says who to ring next.",
    eyebrow: "The smart CRM",
    title: "The CRM that takes its own notes.",
    body: "A normal CRM sits there waiting for you to type. This one does the typing. Turn on the note-taker for a call and it writes the call up, fills in the deal and sends the design notes straight to the design tool. Sol drafts the follow-up in your voice. And every deal tells you how warm it is and who to ring next.",
    points: [
      "Calls written up for you, with the recap email ready",
      "Design notes land beside the roof in the design tool",
      "Sol drafts the emails; you check and send",
      "Every deal's clock and temperature, and who to call next",
    ],
    link: { label: "Get started", href: "#start" },
  },
  {
    id: "service",
    line: "Pick the case and Sol has read the lot: the issue in a line, what was promised, and the steps he would take.",
    eyebrow: "After the sale",
    title: "“My inverter's flashing red.” Relax.",
    body: "Service is where solar businesses lose hours: digging through old chats, emails and notes to work out what's wrong and what was promised. On RENUABL, pick the case and Sol has already read the lot: the issue in a line, what the customer told you, what's been done, and the steps he'd take next.",
    points: [
      "Every case in one place, the longest waiting at the top",
      "Sol sums up the issue and recommends the fix",
      "What the customer said and what's been done, side by side",
      "An electrical fault always goes to a licensed electrician",
    ],
    link: { label: "Get started", href: "#start" },
  },
  {
    id: "sol",
    line: "He lines up your day, writes up your calls and checks the rules of the trade, with the sources to prove it.",
    eyebrow: "Sol, your AI assistant",
    title: "An expert on solar, on every screen.",
    body: "Sol knows your deals, your customers and the rules of the trade. He lines up your day, drafts the follow-ups, writes up your calls, reads bills and switchboard photos, and looks up network rules, rebates and datasheets with the sources to prove it. You check, you send.",
    points: [
      "Writes your day up for you, the most pressing at the top",
      "Drafts every follow-up in your voice",
      "Answers from the web with his sources shown",
      "Never sends anything himself",
    ],
    link: { label: "Meet Sol", href: "#sol" },
  },
  {
    id: "marketplace",
    line: "Find a crew for your jobs, win work near your base and move spare stock. Opening once the network is big enough.",
    eyebrow: "RENUABL Marketplace · Coming soon",
    title: "The solar industry, connected.",
    body: "One network for retailers, installers and electrical inspectors. Sell a job and find the crew to install it, win work near your base, nominate the inspector, and move spare stock to the business down the road.",
    points: [
      "Job listings installers bid on",
      "Jobs sent to the crews you trust",
      "Inspectors nominated on the job",
      "Spare equipment, bought and sold",
    ],
    link: { label: "Look inside the Marketplace", href: "/design/marketplace" },
  },
] as const;

export type Visual = { kind: "shot"; src: string; alt: string } | { kind: "demo"; demo: "automation" | "three" | "conversation" | "after" };

export interface JourneyStep {
  key: string;
  step: string;
  title: string;
  body: string;
  visual: Visual;
}

/** One deal, from the enquiry to the service call: each stop a real screen or the product drawn doing it. */
export const JOURNEY: readonly JourneyStep[] = [
  {
    key: "lead",
    step: "Lead",
    title: "The enquiry lands. You know what to do with it.",
    body: "Today puts every new lead, unanswered message and stalled deal in order, with the one button that moves each along. Before you call, it shows who they are and what's still open.",
    visual: { kind: "shot", src: "/design/landing/today.webp", alt: "RENUABL's Today screen: things to action in order, and who to call" },
  },
  {
    key: "design",
    step: "Design",
    title: "Draw the roof. The quote builds itself.",
    body: "Panels, rails, brackets, inverter, battery and every fee, priced from your own wholesaler lists as you place them. Strung and checked against the inverter's inputs.",
    visual: { kind: "demo", demo: "automation" },
  },
  {
    key: "three",
    step: "Design it for me",
    title: "Three designs. One click.",
    body: "The fastest payback, the most dollars back over the years, the most independence. Each laid by installer rules, priced and strung, set against the customer's bill.",
    visual: { kind: "demo", demo: "three" },
  },
  {
    key: "proposal",
    step: "Proposal",
    title: "Send it before you leave the driveway.",
    body: "Your brand, your note, a chat for their questions. They choose a system, sign online and see how to pay the deposit straight to you.",
    visual: { kind: "demo", demo: "conversation" },
  },
  {
    key: "pipeline",
    step: "Pipeline",
    title: "Every deal has a clock and a temperature.",
    body: "How long it's been open, how warm it is and why, and which three to call next. Email opens tracked. Nothing goes quiet without you seeing it.",
    visual: { kind: "shot", src: "/design/landing/deals.webp", alt: "RENUABL's sales pipeline with each deal's clock and temperature" },
  },
  {
    key: "approvals",
    step: "Approvals",
    title: "Nothing gets booked before it's cleared.",
    body: "Grid pre-approval and Solar Victoria, gate by gate. Every sold job sits at the gate it hasn't passed, longest waiting at the top.",
    visual: { kind: "shot", src: "/design/landing/approvals.webp", alt: "RENUABL's pre-approvals list" },
  },
  {
    key: "book",
    step: "Book the install",
    title: "A calendar that knows what your crews can do.",
    body: "Six weeks of capacity at a glance, holidays shaded, each job green, amber or grey by whether its stock and deposit are in.",
    visual: { kind: "shot", src: "/design/landing/calendar.webp", alt: "RENUABL's install calendar with weekly capacity" },
  },
  {
    key: "order",
    step: "Order the equipment",
    title: "Signed. Then it runs itself.",
    body: "The signed system becomes the order, grouped by wholesaler. Purchase orders emailed, sales order numbers kept, and a pickup slip for the counter.",
    visual: { kind: "demo", demo: "after" },
  },
  {
    key: "install",
    step: "Install",
    title: "Your installers get the job, not a phone call.",
    body: "A job card with the panel layout and strings drawn over the roof, the parts, the site notes, and a thread for their notes and photos. From their phone, no login.",
    visual: { kind: "shot", src: "/design/landing/upcoming.webp", alt: "RENUABL's upcoming installations with installers and materials" },
  },
  {
    key: "finish",
    step: "Finish",
    title: "Paid, claimed, connected. Ticked off.",
    body: "Installer invoices read and checked against what the quote allowed. Customer invoice, STCs and grid connection tracked to the end. Then the service pipeline for anything after.",
    visual: { kind: "shot", src: "/design/landing/completed.webp", alt: "RENUABL's completed installations with paperwork tracked" },
  },
];

export const SOL = {
  eyebrow: "Intelligence, built in",
  headline: "Already using ChatGPT or Claude for part of your work? Sol does it inside your deals.",
  sub: "No copying and pasting customer details into a chat window. Sol already knows your pipeline, as you're allowed to see it.",
  points: [
    "Tells you which deals to chase next, and why",
    "Drafts the follow-up email in your voice",
    "Finds any customer, deal or price in a sentence",
    "Sets reminders and charts your month",
    "Answers in your team's chat when someone tags @Sol",
    "Draws a diagram or a chart when a picture says it faster",
    "Never sends anything himself: you check, you send",
  ],
  footnote: "Sol runs on Claude, by Anthropic.",
  shot: {
    src: "/design/landing/sol.webp",
    alt: "Sol going through the day: overdue installs, leads and proposals waiting, most urgent first (example data)",
  },
  /** A real answer from Sol on solar work (Martin, 1 Nov 2026: "use examples like this in our marketing"). */
  example: {
    eyebrow: "Asked in the Installations channel",
    title: "He knows solar, and says what to check.",
    body: "Asked where a battery can go on a garage wall with a door and a window, Sol set out the clearances, drew them, flagged a bollard if a car could hit it, and said what to check before picking a spot: the current standard, the battery maker's manual and Energy Safe Victoria's rules. Your team sees it. Your customers never do.",
    fine: "A real answer from Sol in RENUABL's team chat. Check figures like these against the current standard before acting on them.",
    shot: {
      src: "/design/landing/sol-garage-wall.webp",
      alt: "Asked where a battery can go on a garage wall with a door and a window, Sol answers with the clearances, a drawing and what to check",
      width: 1920,
      height: 1800,
    },
  },
} as const;

export interface Feature {
  title: string;
  body: string;
}

/** Everything else in the box, all in the product today. */
export const EVERYTHING: readonly Feature[] = [
  { title: "Team chat", body: "Channels for deals, installs and service, direct messages, @mentions, files." },
  { title: "Your Gmail, matched to deals", body: "Every email from a customer shows their deal beside it. Notes shared with a tag." },
  { title: "Call note-taker", body: "Talk on the phone; your side is written up into a note on the deal." },
  { title: "Email opens", body: "See when a customer opened what you sent." },
  { title: "Group emails", body: "Email every customer with a battery, or without one, with one-click unsubscribe." },
  { title: "Branded proposals", body: "Five templates in your logo and colours, a PDF, online acceptance." },
  { title: "Deposits paid to you", body: "Bank transfer or your own card link. RENUABL never touches your money." },
  { title: "Job map", body: "Every job, your base and your wholesalers, with the run worked out." },
  { title: "Datasheets read for you", body: "Upload a panel or inverter sheet and its electrical figures are read in." },
  { title: "Service pipeline", body: "Warranty calls and fixes, open to resolved, on the customer's record." },
  { title: "Your fields, your pipelines", body: "Rename, reorder and add deal fields. Save the pipelines you work by." },
  { title: "Who sees what", body: "Owners, members and designers. Hide costs and margin. View as anyone." },
];

export const COMING_SOON_LABEL = "Coming soon";

export const COMING_SOON: readonly Feature[] = [
  { title: "Automatic proposals from Nearmap", body: "An address in, a designed and priced proposal out, from Nearmap's imagery." },
  { title: "HubSpot", body: "Contacts and deals kept in step with your HubSpot." },
  { title: "Pipedrive", body: "Bring your Pipedrive pipeline across, and keep it in step." },
  { title: "Nearmap imagery", body: "Sharper, newer roof photos in the design tool." },
];

export const MARKETPLACE = {
  eyebrow: `RENUABL Marketplace · ${COMING_SOON_LABEL}`,
  headline: "Every business that joins makes it worth more to the rest.",
  sub: "Retailers, installers and inspectors on one network, working jobs through together without leaving the platform they run on. It opens once enough businesses are on board for there to be work and stock near you.",
  sides: [
    {
      title: "Job listings",
      body: "Sold more than your crews can install? List the job (suburb and system only, never the customer) and let installers nearby bid. Short on work? Bid on jobs near your base.",
    },
    {
      title: "Spare equipment",
      body: "Sell surplus panels, inverters and batteries to businesses near you, with photos and a price. Message the seller, pick up or deliver.",
    },
    {
      title: "Connections",
      body: "Find the installers and inspectors you work with in the directory and connect. Send a job to your installer in one press; they nominate the inspector, who books it and uploads the certificate.",
    },
  ],
  cta: "Register interest",
  look: "Look inside the Marketplace",
} as const;

/**
 * The pricing, set out as a software pricing page (3 Nov 2026, Martin: "more like a software pricing page"; nothing
 * crossed out, nothing that reads as a discount, which devalues the tool). Two plans and Enterprise. The first month's
 * price is said once, plainly, because it is what is charged at sign-up.
 */
export const PRICING = {
  eyebrow: "Pricing",
  headline: "One price a user. Every feature in it.",
  sub: "Every feature for every user, and no per-signature fees. Add calls and marketing email when you want them.",
  plans: [
    {
      key: "month",
      name: "Monthly",
      price: dollars(SEAT_MONTHLY_CENTS),
      per: "a user a month",
      note: "Billed monthly. Cancel any time.",
      featured: false,
      listHead: "Includes:",
    },
    {
      key: "commit",
      name: `${COMMIT_MONTHS}-month plan`,
      price: dollars(COMMIT_SEAT_CENTS),
      per: "a user a month",
      note: `Billed monthly for ${COMMIT_MONTHS} months. Choose it in Billing.`,
      featured: true,
      listHead: "Everything in Monthly, plus:",
      list: [
        `${dollars(SEAT_MONTHLY_CENTS - COMMIT_SEAT_CENTS)} less a user, every month`,
        `That price held for ${COMMIT_MONTHS} months`,
        "Leave early and you repay what you saved",
      ],
    },
  ],
  firstMonth: `${PLAN_WORDS.firstMonth}, on either plan, with ${PLAN_WORDS.trialSites.replace(" in your first month", "")} in the designer. ${PLAN_WORDS.gst}`,
  includesTitle: "Every plan includes",
  includes: [
    "The full CRM, pipelines and Today",
    "Branded proposals with online acceptance",
    "Approvals, install calendar and ordering",
    "Installer job cards and invoices",
    `Sol, the AI assistant: ${SOL_PER_USER} credits a user a month`,
    "Team chat, Gmail inbox and note-taker",
  ],
  tokensTitle: `The designer: ${PLAN_WORDS.token}`,
  tokens: PLAN_WORDS.tokenExplained,
  start: PLAN_WORDS.startExplained,
  addOnsTitle: "Add-ons for your business",
  addOnsSub: "One price for the whole business, whatever its size. Add one from Billing when you want it, and take it off any time.",
  addOns: ADD_ON_KEYS.map((key) => ({ key, name: ADD_ON_WORDS[key].name, price: addOnPriceWords(key), what: ADD_ON_WORDS[key].what })),
  enterprise: {
    title: "Enterprise",
    lead: `${ENTERPRISE_FROM} users or more`,
    body: "Volume pricing, help moving your team and data across, and a direct line to us.",
    cta: "Talk to sales",
    price: "Let's talk",
    note: "For large teams.",
    listHead: `Everything in the ${COMMIT_MONTHS}-month plan, plus:`,
    list: ["Volume pricing", "Help moving your team and data across", "A direct line to us"],
  },
  perShort: "/ user / month",
} as const;

export const FAQ: readonly { q: string; a: string }[] = [
  {
    q: "When am I charged?",
    a: `When you sign up, on Stripe's secure page (we never see your card): ${PLAN_WORDS.firstMonth}. Cancel any time: it runs to the end of the month you've paid for.`,
  },
  { q: "What happens after the first month?", a: PLAN_WORDS.offerExplained },
  { q: "Can I leave the 12-month plan early?", a: PLAN_WORDS.commitExplained },
  { q: "How does the designer charge?", a: PLAN_WORDS.tokenExplained },
  {
    q: "What else is there to pay for?",
    a: "Every feature for every user, including Sol. Designer credits are bought as you use them, and Calls & Texts or Growth are added when you want them.",
  },
  { q: "Are prices with GST?", a: "Yes. Every price on this page includes GST." },
  {
    q: "Can I bring my team and my data across?",
    a: "Add your team when you sign up, and more users at any time. For larger teams moving from another system, Enterprise includes help moving your data.",
  },
];

/**
 * The hero's product film (16 Nov 2026, Martin: the old film showed Sol laying panels from one sentence, which isn't how
 * the designer works today; "it should be a real video of how the designer works today", "I just want to make sure the
 * film isn't misleading", and not so much that a competitor could copy it). Every frame is a real screen of the product
 * on the made-up demo business, a camera moving over it: nothing drawn over the screens says something the product
 * doesn't do. The roof is shown in the designer's own drawn view, so the site isn't recognisable, and every address on
 * screen is a made-up one. Chapters that need an add-on say so (`addOn`): Martin, voice agents are an expansion of the
 * subscription, not out of the box, and marketing email is extra. The Marketplace closes it, marked coming soon.
 */
export const FILM = {
  label: "RENUABL at work: a short film of the product on example data",
  chapters: [
    {
      key: "sol",
      title: "Sol, who knows your business",
      line: "He lines up what needs you, offers the next move and answers the technical questions.",
    },
    { key: "service", title: "Service, answered by Sol", line: "Sol sums up the case, recommends the fix and drafts the reply." },
    { key: "voice", title: "Voice agents for your calls", line: "Hand the call to your agent and watch it live.", addOn: "voice" },
    { key: "design", title: "The assisted designer", line: "Sol suggests a system from the bill. You check and adjust it." },
    {
      key: "proposal",
      title: "Proposals in your brand",
      line: "Build it your way. Your customer compares the options and signs online.",
    },
    { key: "signed", title: "Everything after the signature", line: "The order opens itself, then the install day and the job card." },
    {
      key: "marketing",
      title: "Email for your whole database",
      line: "Sol writes the subject and the words. You choose who gets it.",
      addOn: "marketing",
    },
  ],
  /** The film's last card. */
  marketplace: {
    title: "RENUABL Marketplace",
    line: "List jobs for installers, find partners and trade spare stock.",
    soon: "Coming soon",
  },
  /**
   * Sol's chapter, played as a live chat (16 Nov 2026, Martin: as xAI's Grok Bot page shows its bots at work). Made-up
   * people only, and only what Sol does today: reads the deal, checks a standard, drafts a reply that a person sends,
   * offers the next move, sets a reminder; the phone assistant works beside him.
   */
  sol: {
    business: "Sunrise Solar (example)",
    agents: [
      { key: "sol", name: "Sol", job: "Your AI", preview: "One thing needs you this morning" },
      {
        key: "charlie",
        name: "Charlie",
        job: "Sales calls",
        preview: "Booked Adam Smith a call, Thu 10 am",
        busy: "On a call with Adam Smith",
      },
      { key: "alex", name: "Alex", job: "Post sale", preview: "Pencilled in an install day, Tue 2 Dec" },
    ],
    team: { name: "Team chat", preview: "Sam: the roof photos are in" },
    when: "Monday 7:48 am",
    opening: "Morning. Jane Doe opened her proposal last night and asked in the chat whether the battery can go in her garage.",
    ask: "can it?",
    steps: ["Read her chat and the deal's notes", "Checked the battery standard, AS/NZS 5139", "Drafted her reply"],
    working: "Working",
    answer:
      "It can, if it's clear of the door, the window and anywhere a car could hit it. The standard sets the clearances and your electrician confirms them on site. Her reply is ready.",
    draft: {
      label: "Draft email · not sent",
      to: "To Jane Doe",
      subject: "Your battery and the garage",
      body: "Hi Jane, good question. Yes, the battery can go in your garage, clear of the door and the window. We'll confirm where it goes when we visit.",
      send: "Send",
      edit: "Edit",
      sent: "Sent from Jane's deal",
    },
    choice: { ask: "Anything else?", options: ["Remind me to call her at 10 am", "Draft a follow-up for Friday"] },
    done: "Done. I'll remind you at 10 am.",
    box: "Message Sol…",
  },
  /** Over each chapter, as a launch film says it. */
  introducing: "Introducing",
  /** Beside a chapter that needs an add-on. */
  addOn: "Add-on",
  pause: "Pause the film",
  play: "Play the film",
} as const;

export const CLOSING = {
  headline: "Solar just got a brain. Your move.",
  sub: "Up and running today. Bring the whole team. Cancel any time.",
} as const;

/** Every line of copy on the page, for the test that checks it. */
export function salesCopy(): string[] {
  return [
    ...Object.values(SALES_HERO).flat(),
    ...Object.values(ASK_DEMO),
    ASK_ANYTHING.label,
    ASK_ANYTHING.caption,
    ...ASK_ANYTHING.prompts.flatMap((p) => [p.ask, p.answer]),
    UPGRADE.eyebrow,
    UPGRADE.headline,
    UPGRADE.sub,
    ...UPGRADE.items.flatMap((i) => [i.was, i.title, i.body]),
    FEATURES.headline,
    FEATURES.sub,
    PRICING.perShort,
    ...PRICING.enterprise.list,
    PRICING.enterprise.listHead,
    ...PRICING.plans.flatMap((p) => [p.listHead, ...("list" in p ? p.list : [])]),
    ...BIG_THREE.flatMap((p) => [p.eyebrow, p.title, p.line, p.body, ...p.points, p.link.label]),
    ...JOURNEY.flatMap((j) => [j.step, j.title, j.body]),
    SOL.eyebrow,
    SOL.headline,
    SOL.sub,
    ...SOL.points,
    SOL.example.title,
    SOL.example.body,
    SOL.example.fine,
    ...EVERYTHING.flatMap((f) => [f.title, f.body]),
    ...COMING_SOON.flatMap((f) => [f.title, f.body]),
    MARKETPLACE.headline,
    MARKETPLACE.look,
    MARKETPLACE.sub,
    ...MARKETPLACE.sides.flatMap((s) => [s.title, s.body]),
    PRICING.headline,
    PRICING.sub,
    ...PRICING.includes,
    ...Object.values(PRICING.enterprise).flat(),
    PRICING.addOnsTitle,
    PRICING.addOnsSub,
    ...PRICING.addOns.flatMap((a) => [a.name, a.price, a.what]),
    ...FAQ.flatMap((f) => [f.q, f.a]),
    ...PRICING.plans.flatMap((p) => [p.name, p.per, p.note]),
    PRICING.firstMonth,
    PRICING.includesTitle,
    ...PRICING.includes,
    ...FILM.chapters.flatMap((c) => [c.title, c.line]),
    FILM.addOn,
    FILM.introducing,
    ...Object.values(FILM.sol).flatMap((v) => (typeof v === "string" ? [v] : (JSON.stringify(v).match(/"[^"]{3,}"/g) ?? []))),
    FILM.marketplace.title,
    FILM.marketplace.line,
    FILM.marketplace.soon,
    CLOSING.headline,
    CLOSING.sub,
  ];
}
