/**
 * RENUABL's launch emails for RENUABL Business, as drafts (22 Nov 2026, Martin: "create RENUABLs launch strategy…
 * the whats in it for the retailer stance: ai sales force, voice sales agents calling and booking in appointments… one
 * huge leap for solar and those who adopt… influenced by tesla, space x and apple… imagery should be high end… a series
 * that educates the recipient on the features and benefits"). It replaces the drafts of 15 Nov 2026.
 *
 * Cut down the same day (Martin: "far too much text"; Sol, the voice agent's audio icon and the AI designer marketed as
 * products, the way Apple does; a call in progress animated; stacked cards of the features; a 1990s direct-mail close),
 * then given hooks (Martin: "we have good headlines. but we need customer winning HOOKS"; the voice agents "less than $2
 * per calendar day… you cant employ anyone on less than $2 per day… the savings are really important"), the real
 * product beside each claim ("a screenshot from the actual portal that aligns with the email messaging"), and a band at
 * the foot of every email for the Marketplace, coming soon.
 *
 * Each email: the hook as its heading, the product's moving picture, the card Sol types, the product itself, a line only
 * where something must be said in words (a price, the P.S.), one button, then the Marketplace band. The strategy and the
 * review copy are in docs/marketing/launch-strategy.md; keep the two in step. Every claim is something the product does
 * today; no rival named, no best, first, leading or guaranteed (Martin asked for "the first truly AI empowered sales
 * force": "first" needs proof under the Australian Consumer Law, so it isn't said), prices from plans.ts and
 * add-ons.ts, only {firstName} and {company}.
 *
 * The pictures (`GTM_PICTURES`) are files in marketing/launch/ (private: never served by the site, so nobody sees them until they are in an email RENUABL sends), drawn by tools/marketing/launch-art.mjs; the route
 * that adds the drafts (`/api/design/marketing/gtm`) reads them into RENUABL's own Marketing pictures and puts each
 * picture's id in its block (`withPictures`). Never sent or switched on by adding them.
 */
import { ADD_ON_MONTHLY_CENTS } from "@/lib/domain/design/add-ons";
import { COMMIT_SEAT_CENTS, SEAT_MONTHLY_CENTS, dollars, firstMonthWords } from "@/lib/domain/design/plans";
import type { EdmBlock, EdmContent } from "./edm";
import type { SequenceDraft, SequenceStep } from "./sequences";

const SITE = "https://www.renuabl.com.au/";
const DEMO = `${SITE}business/demo`;
const PRICING = `${SITE}#pricing`;
const MARKETPLACE = `${SITE}design/marketplace`;

const PLAN_AFTER = `${dollars(SEAT_MONTHLY_CENTS)} a user a month`;
const COMMIT = `${dollars(COMMIT_SEAT_CENTS)} a user a month`;
const VOICE_CENTS = ADD_ON_MONTHLY_CENTS.voice ?? 0;
const VOICE = `${dollars(VOICE_CENTS)} a month`;

/**
 * What a month of Calls & Texts comes to a day, averaged over the year (365.25 / 12 days a month): $49 is $1.61. Even in
 * February, the shortest month, it is $1.75, so "less than $2 a day" holds in every month while this is under $2.
 */
export const voiceAday = (cents = VOICE_CENTS) => cents / 100 / (365.25 / 12);
export const VOICE_DAY_WORDS = voiceAday() < 2 ? "less than $2 a day" : `about $${Math.ceil(voiceAday())} a day`;

/** The line on the price card (price-voice.jpg in the picture tool says it too; a test keeps them in step). */
export const PRICE_DAY_LINE = `${dollars(VOICE_CENTS)} a month is $${voiceAday().toFixed(2)} a day.`;

/** The most words an email's own text may run to: a glance, not a read. */
export const MAX_WORDS = 45;

/** A picture's file in marketing/launch/, and what it shows (its alt text in the email). */
export interface GtmPicture {
  file: string;
  alt: string;
}

/**
 * What Sol types on each feature's explainer card (tools/marketing/launch-art.mjs, `EXPLAINERS`): the same words, kept
 * here as the picture's alt text so they read with pictures off and to a screen reader. A test keeps the two in step.
 */
export const SOL_TYPES: Record<string, string> = {
  xvoice:
    "Your voice agent rings each new lead within minutes, answers their questions and books them in. It always says it's your automated assistant.",
  xlead:
    "A new lead comes in. Within minutes I've emailed them their home from above, and your voice agent is ringing them. In your hours, every time.",
  xdesigner: "You lay out the panels and the quote builds as you go. Your customer chooses a design and signs online.",
  xcrm: "I write up your calls, draft your follow-ups and turn emailed leads into deals. You do the selling.",
  xruns: "Once they sign, the order, approvals, install calendar and your installer's job card are in one place for your team.",
  solintro: "Hi, I'm Sol. Meet your AI sales force: I answer your leads, write your emails and assist you to design a system.",
  sol: "I know every deal. I write your emails in your voice, and tell you who to ring next.",
};

/** What the voice agent says on its own picture (voice-meet.gif in the picture tool; a test keeps them in step). */
export const VOICE_MEET_LINE = "Hi, it's Gary, Sunrise Solar's automated assistant. Have you got a few minutes?";

export const GTM_PICTURES: Record<string, GtmPicture> = {
  vmeet: {
    file: "voice-meet.gif",
    alt: `Meet Gary, a voice agent (you choose its name, voice and script): "${VOICE_MEET_LINE}"`,
  },
  pbook: {
    file: "product-phonebook.jpg",
    alt: "In RENUABL: a voice agent on a call beside its phone book, with a contact opened to hand the call over (example data)",
  },
  hfill: {
    file: "hero-fill.jpg",
    alt: "Design it once. The deal fills itself in: size, panels, inverter, battery, roof and strings, filled from the design (example data)",
  },
  hprop: { file: "hero-proposal.jpg", alt: "Your proposal, not ours: your logo, your colours, your layout, signed online (example data)" },
  hpromo: {
    file: "hero-promo.jpg",
    alt: "Got an offer? Tell Sol. He writes the promotional email from your words and you press send (example)",
  },
  htech: { file: "hero-tech.jpg", alt: "Fronius State 475? Ask Sol: an example answer to a technical question, with his sources under it" },
  hpaper: {
    file: "hero-paper.jpg",
    alt: "The paperwork, lined up: pre-approval, Solar Victoria, install, certificate, STCs and grid connection on one job (example data)",
  },
  hone: { file: "hero-one.jpg", alt: "Six tools. One login: lead, design, proposal, order, install and service in one place" },
  hreply: {
    file: "hero-reply.jpg",
    alt: "Faster replies: a customer's question and the reply Sol drafted from the deal, ready to send (example data)",
  },
  slist: {
    file: "say-list.jpg",
    alt: `Customers with solar and no battery: one list, one email, written by Sol. Growth, ${dollars(ADD_ON_MONTHLY_CENTS.marketing ?? 0)} a month.`,
  },
  ssrc: {
    file: "say-sources.jpg",
    alt: "Every answer from Sol comes with sources: maker pages, datasheets and network rules, under the answer",
  },
  sready: {
    file: "say-ready.jpg",
    alt: "Ready to install: a light that goes green as strings, inverter limits and clearances check out. A guide, never a site inspection.",
  },
  sopen: {
    file: "say-opened.jpg",
    alt: "Under every email you send: opened 3 times. Know who's reading, and who to ring next. An open is a guide, not proof.",
  },
  aday: { file: "aday.jpg", alt: `Calls & Texts, your voice agent: ${VOICE_DAY_WORDS}. ${VOICE}, on top of your RENUABL plan.` },
  dband: {
    file: "designer-band.jpg",
    alt: "Made for solar: RENUABL's designer, a system laid out on a real roof and priced as it's drawn",
  },
  solintro: { file: "sol-intro.gif", alt: SOL_TYPES.solintro },
  cards: {
    file: "cards.gif",
    alt: "Your customers, answered. Your emails, written. Calls written up. Your advisor. Quotes priced as you draw. Installs on one calendar.",
  },
  call: { file: "call.gif", alt: "A RENUABL voice agent on a call with a new lead, booking them in (example)" },
  xvoice: { file: "explain-voice.gif", alt: SOL_TYPES.xvoice },
  pvoice: {
    file: "product-voice.jpg",
    alt: "In RENUABL: a voice agent's window, on a call with a customer now (example data)",
  },
  pricev: {
    file: "price-voice.jpg",
    alt: `Your voice agent, with your own number: ${VOICE_DAY_WORDS}. ${PRICE_DAY_LINE}`,
  },
  sol: { file: "sol.gif", alt: SOL_TYPES.sol },
  psol: { file: "product-sol.jpg", alt: "In RENUABL: Sol on Today, saying who to call and what to say (example data)" },
  designer: { file: "designer.jpg", alt: "A roof in RENUABL's designer, whole and close up: panels laid out by hand, strung and priced" },
  xlead: { file: "explain-lead.gif", alt: SOL_TYPES.xlead },
  xdesigner: { file: "explain-designer.gif", alt: SOL_TYPES.xdesigner },
  today: { file: "today.jpg", alt: "RENUABL's Today screen: calls, deals and what needs you (example data)" },
  xcrm: { file: "explain-crm.gif", alt: SOL_TYPES.xcrm },
  runs: { file: "runs.jpg", alt: "RENUABL's install calendar after the sale (example data)" },
  xruns: { file: "explain-runs.gif", alt: SOL_TYPES.xruns },
  coupon: { file: "coupon.jpg", alt: "Yes. I want my AI sales force. First month free. No contract, cancel any time." },
  footv: {
    file: "footer-voice.jpg",
    alt: `Your AI salesperson: ${VOICE_DAY_WORDS}. Calls & Texts, ${VOICE}.`,
  },
  footer: {
    file: "footer-marketplace.jpg",
    alt: "RENUABL Marketplace, coming soon: find crews, win installs, trade stock.",
  },
};

/** The picture key a draft's block stands for, read from its id (`gtm<email>pic<key>`). */
export const pictureKeyOf = (b: EdmBlock): string | null => (b.kind === "image" ? (b.id.match(/pic([a-z]+)$/)?.[1] ?? null) : null);

/** A part of an email: a hook, the picture or pictures it is about, a line only where words must be said, a button. */
interface Section {
  hook: string;
  pictures: (keyof typeof GTM_PICTURES)[];
  words?: string[];
  cta: [string, string];
}

/**
 * Laid out as Xero's invoicing email (26 Nov 2026, Martin: "a good email marketing example we could reference for our
 * Renuabl launch"): a bar at the very top for whoever is ready to buy, then each part on a panel of its own.
 */
export const TOP_BAR: [string, string] = ["Ready for your AI sales force?", "See pricing"];
export const PANEL_FIRST = "#fff3ea";
export const PANEL_REST = "#f4f4f5";

/** The designer's own part, near the end of every email but the designer's (it isn't the first thing anyone sees). */
const DESIGNER_PART: Section = {
  hook: "Made for solar. Design and price a roof while you're on the phone.",
  pictures: ["dband"],
  cta: ["Try the designer", DEMO],
};

/**
 * One email (22 Nov 2026, Martin: "dont just dump images without a hook call to action"; "dont make the designer the first
 * slide"; every email shows the designer, so it reads at a glance as solar software): a run of parts, each a hook over its
 * picture and a button under it, then the designer's part (unless the email is about the designer), then the slim
 * $2-a-day strip and the Marketplace band.
 */
function email(key: string, subject: string, preview: string, parts: [Section, ...Section[]]): EdmContent {
  const block = (id: string, b: Omit<EdmBlock, "id" | "imageId">): EdmBlock => ({ id: `gtm${key}${id}`, imageId: null, ...b });
  const picture = (k: string, url: string) => block(`pic${k}`, { kind: "image", text: GTM_PICTURES[k].alt, url, align: "center" });
  const all = parts.some((p) => p.pictures.includes("designer")) ? parts : [...parts, DESIGNER_PART];
  return {
    subject,
    preview,
    blocks: [
      block("bar", { kind: "bar", text: TOP_BAR[0], label: TOP_BAR[1], url: PRICING, align: "left" }),
      ...all.flatMap((p, i) => {
        // Each part on its own panel, the first warm and the rest a quiet grey, a gap between so they stay apart.
        const fill = i === 0 ? PANEL_FIRST : PANEL_REST;
        return [
          ...(i > 0 ? [block(`gap${i}`, { kind: "spacer", text: "", url: null, align: "left", space: "small" })] : []),
          block(`h${i}`, { kind: "heading", text: p.hook, url: null, align: "center", fill }),
          ...p.pictures.map((k) => ({ ...picture(k, p.cta[1]), fill })),
          ...(p.words?.length ? [block(`t${i}`, { kind: "text", text: p.words.join("\n\n"), url: null, align: "center", fill })] : []),
          block(`b${i}`, { kind: "button", text: p.cta[0], url: p.cta[1], align: "center", fill }),
        ];
      }),
      picture("footv", SITE),
      picture("footer", MARKETPLACE),
    ],
  };
}
/** Every picture in an email filled in from the ids the route made for each file (key → mimg id). */
export function withPictures(c: EdmContent, ids: Record<string, string>): EdmContent {
  return {
    ...c,
    blocks: c.blocks.map((b) => {
      const key = pictureKeyOf(b);
      return key && ids[key] ? { ...b, imageId: ids[key] } : b;
    }),
  };
}

export const GTM_CAMPAIGN_NAME = "One giant leap · launch";
export const GTM_SEQUENCE_NAME = "One giant leap · the series";

/** The launch: Sol introducing himself, then what he does as a stack of cards. */
export const GTM_LAUNCH: EdmContent = email(
  "l",
  "Solar just got an AI sales force",
  "Your leads answered in minutes. Your follow-ups drafted. Your quotes priced as you draw.",
  [
    { hook: "Solar just got an AI sales force.", pictures: ["solintro"], cta: ["Meet Sol", SITE] },
    { hook: "Leads answered, follow-ups drafted, while you're with a customer.", pictures: ["cards"], cta: ["See it work", DEMO] },
  ],
);

/**
 * The voice email, a campaign of its own (26 Nov 2026, Martin: "lets create another marketing email. do it emphasising
 * voice. add in a nice visual to bring character to the voice ai. then add one visual to understand how it looks in the
 * software, the phone book"): the agent introduced by an example name, the product drawn with made-up names and
 * numbers, then the price a day. Not part of the series, which is full at six emails.
 */
export const GTM_VOICE_NAME = "Meet your voice agent · voice";
export const GTM_VOICE: EdmContent = email(
  "v",
  "Meet your voice agent. It rings your leads in minutes.",
  "You choose its name, its voice and its script. It always says it's automated.",
  [
    { hook: "Meet the voice agent that rings your leads.", pictures: ["vmeet"], cta: ["Hear it call", SITE] },
    { hook: "Pick a contact. Hand over the call. Watch it happen.", pictures: ["pbook"], cta: ["Try the demo", DEMO] },
    {
      hook: `Your own number, for ${VOICE_DAY_WORDS}.`,
      pictures: ["aday"],
      words: [
        `Calls & Texts is ${VOICE}, on top of your RENUABL plan. Every call says it's your automated assistant, and goes out in calling hours.`,
      ],
      cta: ["See the pricing", PRICING],
    },
  ],
);

/**
 * Seven more campaigns of their own (26 Nov 2026, Martin: "create 7 more… ready in campaigns… different hooks and
 * selling propositions… the pain points in solar: admin, compliance, technical issues needing expertise and how Sol and
 * RENUABL help reduce the burden… getting more work done, get answers to hard technical problems, one workspace end to
 * end, faster responses to customers"). Four he named (the design filling in the customer's file, the custom proposal,
 * promotional emails with Growth, technical questions) and three of ours (the paperwork after the sale, one workspace,
 * faster replies). Each opens on its own hero picture; every claim is something the product does today.
 */
const GROWTH = `${dollars(ADD_ON_MONTHLY_CENTS.marketing ?? 0)} a month`;

const MORE: { name: string; content: EdmContent }[] = [
  {
    name: "Design it once · the deal fills itself in",
    content: email(
      "g",
      "Design the roof once. The customer's file fills itself in.",
      "Panels, inverter, battery and strings, on the deal the moment you save.",
      [
        { hook: "Design it once. Every detail lands on the customer's file.", pictures: ["hfill"], cta: ["See it fill in", DEMO] },
        { hook: "Take the call. Sol writes it up and fills in the rest.", pictures: ["xcrm"], cta: ["See Sol at work", DEMO] },
      ],
    ),
  },
  {
    name: "Your proposal, your brand",
    content: email(
      "p",
      "Your proposal should look like your business",
      "Your logo, colours and layout. Your customer chooses a system and signs online.",
      [
        {
          hook: "A proposal that looks like you, not like software.",
          pictures: ["hprop"],
          words: [
            `Your logo, colours and type are in every plan. Layouts of your own come with Growth, ${GROWTH} on top of your RENUABL plan.`,
          ],
          cta: ["Build yours", DEMO],
        },
        { hook: "Their roof, their system, their price. Signed online.", pictures: ["xdesigner"], cta: ["See a proposal", DEMO] },
      ],
    ),
  },
  {
    name: "Got an offer? Tell Sol",
    content: email(
      "m",
      "Got an offer? Tell Sol. He writes the email.",
      "Promotions to your own customers, sent from the CRM they already live in.",
      [
        {
          hook: "Got an offer? Tell Sol. He writes the email.",
          pictures: ["hpromo"],
          words: [`Email marketing comes with Growth, ${GROWTH} on top of your RENUABL plan. Sol writes from your words. You press send.`],
          cta: ["See it written", DEMO],
        },
        { hook: "Everyone with solar and no battery, in one list.", pictures: ["slist"], cta: ["See the pricing", PRICING] },
      ],
    ),
  },
  {
    name: "Hard technical question? Ask Sol",
    content: email("t", "State 475 on a Fronius. What now?", "Ask Sol. He answers from the maker's own pages and shows his sources.", [
      {
        hook: "Hard technical question? Ask Sol.",
        pictures: ["htech"],
        words: [
          "Error codes, datasheets, network rules. Sol finds the answer and shows where it came from. Your electrician still makes the call on site.",
        ],
        cta: ["Ask Sol in the demo", DEMO],
      },
      { hook: "An inverter that's lost its Wi-Fi? Ask before you drive out.", pictures: ["ssrc"], cta: ["Meet Sol", SITE] },
    ]),
  },
  {
    name: "The paperwork after the sale",
    content: email("k", "Pre-approvals, rebates, grid connection: one list", "Every sold job filed at the step it's waiting on.", [
      { hook: "The paperwork after the sale, lined up for you.", pictures: ["hpaper"], cta: ["See after the sale", DEMO] },
      { hook: "Every string checked against the inverter's limits as you draw.", pictures: ["sready"], cta: ["Try the designer", DEMO] },
    ]),
  },
  {
    name: "One workspace, end to end",
    content: email(
      "w",
      "One workspace, from the enquiry to the final invoice",
      "Leads, design, proposal, order, install and service. One login.",
      [
        { hook: "Stop copying the same job into five tools.", pictures: ["hone"], cta: ["See it end to end", DEMO] },
        { hook: "Open Today and see who needs you.", pictures: ["today"], cta: ["Open the demo", DEMO] },
      ],
    ),
  },
  {
    name: "Faster replies · Sol drafts, you send",
    content: email(
      "r",
      "Reply to every customer while they're still thinking about it",
      "Sol drafts the reply from the deal. You read it and press send.",
      [
        { hook: "Faster replies. Sol drafts, you press send.", pictures: ["hreply"], cta: ["See a draft", DEMO] },
        { hook: "See who opened it, and who to ring next.", pictures: ["sopen"], cta: ["Open the demo", DEMO] },
      ],
    ),
  },
];

/** The campaigns of their own, beside the launch and its series: each added once by its name (the gtm route). */
export const GTM_CAMPAIGNS: { name: string; content: EdmContent }[] = [{ name: GTM_VOICE_NAME, content: GTM_VOICE }, ...MORE];

/** The series: one product an email, each picture with its own hook and button. */
const SERIES: { wait: number; content: EdmContent }[] = [
  {
    wait: 2,
    content: email(
      "a",
      `An AI salesperson for ${VOICE_DAY_WORDS}`,
      "It rings every new lead in minutes and books them in. Nobody can be hired for that.",
      [
        {
          hook: `An AI salesperson for ${VOICE_DAY_WORDS}.`,
          pictures: ["call"],
          words: [`Calls & Texts is ${VOICE} with your own business number, on top of your RENUABL plan. Calls go out in calling hours.`],
          cta: ["Hear it call", SITE],
        },
        { hook: "It rings every new lead, and books them in.", pictures: ["xvoice"], cta: ["See how it books", DEMO] },
        { hook: "Watch any call live. Step in whenever you like.", pictures: ["pvoice"], cta: ["Try the demo", DEMO] },
        {
          hook: `${PRICE_DAY_LINE.replace(" is ", ". That's ")} Your own number included.`,
          pictures: ["pricev"],
          cta: ["See the pricing", PRICING],
        },
      ],
    ),
  },
  {
    wait: 2,
    content: email("d", "Answer every lead in minutes", "Emailed, rung and in your CRM while you're still with another customer.", [
      { hook: "Every new lead, answered in minutes.", pictures: ["xlead"], cta: ["See it answer", DEMO] },
      { hook: "Your calls written up. Your follow-ups drafted.", pictures: ["xcrm"], cta: ["See Sol at work", DEMO] },
      { hook: "Open Today and see who needs you.", pictures: ["today"], cta: ["Open the demo", DEMO] },
    ]),
  },
  {
    wait: 3,
    content: email("b", "Who should you call this morning?", "Sol knows. And he's written what to say.", [
      { hook: "Know who to call, and what to say. Every morning.", pictures: ["sol"], cta: ["Meet Sol", SITE] },
      { hook: "Ask Sol about any deal. He knows them all.", pictures: ["psol"], cta: ["Ask Sol in the demo", DEMO] },
    ]),
  },
  {
    wait: 3,
    content: email("c", "Quote it before you leave the driveway", "Lay out the panels and it's priced as you go. Signed online.", [
      { hook: "Quote it before you leave the driveway.", pictures: ["xdesigner"], cta: ["See it price", DEMO] },
      { hook: "Real roofs, laid out and priced as you draw.", pictures: ["designer"], cta: ["Try the designer", DEMO] },
    ]),
  },
  {
    wait: 3,
    content: email(
      "e",
      "Signed? Everything after the sale, in one place",
      "The order, approvals, install calendar and job card, together for your team.",
      [
        { hook: "Signed? Everything after the sale, in one place.", pictures: ["xruns"], cta: ["See after the sale", DEMO] },
        { hook: "Every install on one calendar, ready for your crew.", pictures: ["runs"], cta: ["Open the calendar", DEMO] },
      ],
    ),
  },
  {
    wait: 4,
    content: email("f", `Yes: your first month is ${firstMonthWords}`, "No contract. Cancel any time.", [
      {
        hook: "Here's the deal.",
        pictures: ["coupon"],
        words: [
          `Your first month is ${firstMonthWords}. Then it's ${PLAN_AFTER}, or ${COMMIT} on the 12-month plan. No contract. Cancel any time.`,
          "P.S. Leads go to whoever answers soonest. Let yours answer this week.",
        ],
        cta: ["Yes, start now", PRICING],
      },
    ]),
  },
];

/** The series, started by opening the launch campaign; off until switched on by hand. */
export function gtmSequence(launchCampaignId: string, ids: Record<string, string> = {}): SequenceDraft {
  const steps: SequenceStep[] = SERIES.flatMap((s, i) => [
    { id: `gtmwait${i}`, kind: "wait" as const, days: s.wait },
    { id: `gtmmail${i}`, kind: "email" as const, content: withPictures(s.content, ids) },
  ]);
  return {
    name: GTM_SEQUENCE_NAME,
    trigger: { kind: "opened", campaignId: launchCampaignId },
    steps,
    stops: { signedUp: true, clicked: false },
  };
}

/** Every email in the drafts, for the checks and the review copy. */
export const GTM_EMAILS: EdmContent[] = [GTM_LAUNCH, ...SERIES.map((s) => s.content), ...GTM_CAMPAIGNS.map((c) => c.content)];

/** The picture keys an email uses, so only those are read in when it alone is added. */
export const pictureKeys = (c: EdmContent): string[] => c.blocks.map(pictureKeyOf).filter((k): k is string => Boolean(k));
