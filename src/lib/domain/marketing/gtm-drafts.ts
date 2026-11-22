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
 * The pictures (`GTM_PICTURES`) are files in public/design/launch/, drawn by tools/marketing/launch-art.mjs; the route
 * that adds the drafts (`/api/design/marketing/gtm`) reads them into RENUABL's own Marketing pictures and puts each
 * picture's id in its block (`withPictures`). Never sent or switched on by adding them.
 */
import { ADD_ON_MONTHLY_CENTS } from "@/lib/domain/design/add-ons";
import { SEAT_MONTHLY_CENTS, dollars, firstMonthWords } from "@/lib/domain/design/plans";
import type { EdmBlock, EdmContent } from "./edm";
import type { SequenceDraft, SequenceStep } from "./sequences";

const SITE = "https://www.renuabl.com.au/";
const DEMO = `${SITE}business/demo`;
const PRICING = `${SITE}#pricing`;
const MARKETPLACE = `${SITE}design/marketplace`;

const PLAN_AFTER = `${dollars(SEAT_MONTHLY_CENTS)} a user a month`;
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

/** A picture's file under public/, and what it shows (its alt text in the email). */
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
  xdesigner: "One press lays out three designs, each priced as it lands. Your customer chooses one and signs online.",
  xcrm: "I write up your calls, draft your follow-ups and turn emailed leads into deals. You do the selling.",
  xruns: "The moment they sign, the order opens, approvals line up and your installer's job card is ready.",
  solintro: "Hi, I'm Sol. Meet your AI sales force: I answer your leads, write your emails and assist you to design a system.",
  sol: "I know every deal. I write your emails in your voice, and tell you who to ring next.",
};

export const GTM_PICTURES: Record<string, GtmPicture> = {
  solintro: { file: "/design/launch/sol-intro.gif", alt: SOL_TYPES.solintro },
  cards: {
    file: "/design/launch/cards.gif",
    alt: "Your customers, answered. Your emails, written. Your calls, written up. Your super-intelligent advisor. Your roofs, designed.",
  },
  call: { file: "/design/launch/call.gif", alt: "A RENUABL voice agent on a call with a new lead, booking them in (example)" },
  xvoice: { file: "/design/launch/explain-voice.gif", alt: SOL_TYPES.xvoice },
  pvoice: {
    file: "/design/launch/product-voice.jpg",
    alt: "In RENUABL: a voice agent's window, on a call with a customer now (example data)",
  },
  pricev: {
    file: "/design/launch/price-voice.jpg",
    alt: `Your voice agent, with your own number: ${VOICE_DAY_WORDS}. ${PRICE_DAY_LINE}`,
  },
  sol: { file: "/design/launch/sol.gif", alt: SOL_TYPES.sol },
  psol: { file: "/design/launch/product-sol.jpg", alt: "In RENUABL: Sol on Today, saying who to call and what to say (example data)" },
  designer: { file: "/design/launch/designer.jpg", alt: "Two homes designed in RENUABL's designer: panels laid, strung and priced" },
  xdesigner: { file: "/design/launch/explain-designer.gif", alt: SOL_TYPES.xdesigner },
  today: { file: "/design/launch/today.jpg", alt: "RENUABL's Today screen: calls, deals and what needs you (example data)" },
  xcrm: { file: "/design/launch/explain-crm.gif", alt: SOL_TYPES.xcrm },
  runs: { file: "/design/launch/runs.jpg", alt: "RENUABL's install calendar after the sale (example data)" },
  xruns: { file: "/design/launch/explain-runs.gif", alt: SOL_TYPES.xruns },
  coupon: { file: "/design/launch/coupon.jpg", alt: "Yes. I want my AI sales force. First month free. No contract, cancel any time." },
  footv: {
    file: "/design/launch/footer-voice.jpg",
    alt: `Your AI salesperson: ${VOICE_DAY_WORDS}. Calls & Texts, ${VOICE}.`,
  },
  footer: {
    file: "/design/launch/footer-marketplace.jpg",
    alt: "RENUABL Marketplace, coming soon: find crews, win installs, trade stock.",
  },
};

/** The picture key a draft's block stands for, read from its id (`gtm<email>pic<key>`). */
export const pictureKeyOf = (b: EdmBlock): string | null => (b.kind === "image" ? (b.id.match(/pic([a-z]+)$/)?.[1] ?? null) : null);

/**
 * One email: the hook as its heading, its pictures (the product moving, Sol's card, the product itself), a line only
 * where something must be said in words, one button, then the slim $2-a-day strip and the Marketplace band.
 */
function email(
  key: string,
  pictures: [keyof typeof GTM_PICTURES, ...(keyof typeof GTM_PICTURES)[]],
  subject: string,
  preview: string,
  hook: string,
  words: string[],
  button: [string, string],
): EdmContent {
  const block = (id: string, b: Omit<EdmBlock, "id" | "imageId">): EdmBlock => ({ id: `gtm${key}${id}`, imageId: null, ...b });
  const picture = (k: string, url = button[1]) => block(`pic${k}`, { kind: "image", text: GTM_PICTURES[k].alt, url, align: "center" });
  return {
    subject,
    preview,
    blocks: [
      block("h", { kind: "heading", text: hook, url: null, align: "left" }),
      ...pictures.map((k) => picture(k)),
      ...(words.length ? [block("t", { kind: "text", text: words.join("\n\n"), url: null, align: "left" })] : []),
      block("b", { kind: "button", text: button[0], url: button[1], align: "left" }),
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

/** The launch: the hook, Sol introducing himself, the products as a stack of cards. */
export const GTM_LAUNCH: EdmContent = email(
  "l",
  ["solintro", "cards"],
  "Solar just got an AI sales force",
  "Your leads answered in minutes. Your emails written. Your systems designed with you.",
  "Solar just got an AI sales force.",
  [],
  ["See it work", SITE],
);

/** The series: a hook an email, the product moving, Sol's card, the product itself; then the deal. */
const SERIES: { wait: number; content: EdmContent }[] = [
  {
    wait: 2,
    content: email(
      "a",
      ["call", "xvoice", "pvoice", "pricev"],
      `An AI salesperson for ${VOICE_DAY_WORDS}`,
      "It rings every new lead in minutes and books them in. Nobody can be hired for that.",
      `An AI salesperson for ${VOICE_DAY_WORDS}.`,
      [`Calls & Texts is ${VOICE} with your own business number, on top of your RENUABL plan. Calls go out in calling hours.`],
      ["Hear it call", SITE],
    ),
  },
  {
    wait: 3,
    content: email(
      "b",
      ["sol", "psol"],
      "Who should you call this morning?",
      "Sol knows. And he's written what to say.",
      "Know who to call, and what to say. Every morning.",
      [],
      ["Meet Sol", SITE],
    ),
  },
  {
    wait: 3,
    content: email(
      "c",
      ["designer", "xdesigner"],
      "Quote it before you leave the driveway",
      "One press. Three priced designs. Signed online.",
      "Quote it before you leave the driveway.",
      [],
      ["Try the designer", DEMO],
    ),
  },
  {
    wait: 3,
    content: email(
      "d",
      ["xcrm", "today"],
      "Stop typing up your calls",
      "Calls written up. Follow-ups drafted. Emailed leads turned into deals.",
      "Stop typing up your calls.",
      [],
      ["See Today", DEMO],
    ),
  },
  {
    wait: 3,
    content: email(
      "e",
      ["xruns", "runs"],
      "Signed? It's already moving.",
      "The order, approvals and the job card, from the moment they sign.",
      "Signed? It's already moving.",
      [],
      ["See after the sale", SITE],
    ),
  },
  {
    wait: 4,
    content: email(
      "f",
      ["coupon"],
      `Yes: your first month is ${firstMonthWords}`,
      "No contract. Cancel any time. Every feature, every user.",
      "Here's the deal.",
      [
        `Your first month is ${firstMonthWords}. Then it's ${PLAN_AFTER}. No contract. Cancel any time.`,
        "P.S. Leads go to whoever answers soonest. Let yours answer this week.",
      ],
      ["Yes, start now", PRICING],
    ),
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
export const GTM_EMAILS: EdmContent[] = [GTM_LAUNCH, ...SERIES.map((s) => s.content)];
