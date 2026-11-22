/**
 * RENUABL's launch emails for RENUABL Business, as drafts (22 Nov 2026, Martin: "create RENUABLs launch strategy…
 * the whats in it for the retailer stance: ai sales force, voice sales agents calling and booking in appointments… one
 * huge leap for solar and those who adopt… influenced by tesla, space x and apple… imagery should be high end… a series
 * that educates the recipient on the features and benefits"). It replaces the drafts of 15 Nov 2026.
 *
 * Cut down the same day (Martin: "far too much text - noone has enough time in their day to read about something that
 * they have no idea that it serves any incentive for them"; Sol, the voice agent's audio icon and the AI designer
 * marketed as products, the way Apple does; the AI sales force email exciting and instantly obvious, a call in progress
 * animated; stacked cards of the features; "bring it home with the 90's style direct marketing"). "One giant leap": a
 * launch campaign (the products as stacked cards) and a six-email series started by opening it, each one product, one
 * moving or still picture, one headline, a line or two (`MAX_WORDS`) and one button, ending on a mail-order coupon. The strategy, the send plan and the review copy are in docs/marketing/launch-strategy.md; keep the two in
 * step. Every claim is something the product does today, worded as the business page words it; no rival named, no
 * best, first, leading or guaranteed, prices from plans.ts and add-ons.ts, only {firstName} and {company}.
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

const PLAN_AFTER = `${dollars(SEAT_MONTHLY_CENTS)} a user a month`;
const VOICE = `${dollars(ADD_ON_MONTHLY_CENTS.voice ?? 0)} a month`;

/** The most words an email's own text may run to: a glance, not a read. */
export const MAX_WORDS = 45;

/** A picture's file under public/, and what it shows (its alt text in the email). */
export interface GtmPicture {
  file: string;
  alt: string;
}

export const GTM_PICTURES: Record<string, GtmPicture> = {
  cards: {
    file: "/design/launch/cards.gif",
    alt: "RENUABL's AI sales force: your customers answered, your emails written, your calls written up, your roofs designed",
  },
  call: { file: "/design/launch/call.gif", alt: "A RENUABL voice agent on a call with a new lead, booking them in (example)" },
  sol: { file: "/design/launch/sol.gif", alt: "Sol, the brain of your business" },
  designer: { file: "/design/launch/designer.gif", alt: "RENUABL's AI designer laying panels on a roof in one press (example home)" },
  today: { file: "/design/launch/today.jpg", alt: "RENUABL's Today screen: calls, deals and what needs you (example data)" },
  runs: { file: "/design/launch/runs.jpg", alt: "RENUABL's install calendar after the sale (example data)" },
  coupon: { file: "/design/launch/coupon.jpg", alt: "YES! I want my AI sales force. First month free. No contract, cancel any time." },
};

/** The picture key a draft's block stands for, read from its id (`gtm<email>pic<key>`). */
export const pictureKeyOf = (b: EdmBlock): string | null => (b.kind === "image" ? (b.id.match(/pic([a-z]+)$/)?.[1] ?? null) : null);

function email(
  key: string,
  picture: keyof typeof GTM_PICTURES,
  subject: string,
  preview: string,
  heading: string,
  words: string[],
  button: [string, string],
): EdmContent {
  const block = (id: string, b: Omit<EdmBlock, "id" | "imageId">): EdmBlock => ({ id: `gtm${key}${id}`, imageId: null, ...b });
  return {
    subject,
    preview,
    blocks: [
      block(`pic${picture}`, { kind: "image", text: GTM_PICTURES[picture].alt, url: button[1], align: "center" }),
      block("h", { kind: "heading", text: heading, url: null, align: "left" }),
      block("t", { kind: "text", text: words.join("\n\n"), url: null, align: "left" }),
      block("b", { kind: "button", text: button[0], url: button[1], align: "left" }),
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

/** The launch: the idea in one line, the products as a stack of cards. */
export const GTM_LAUNCH: EdmContent = email(
  "l",
  "cards",
  "One giant leap for solar",
  "Your AI sales force is here.",
  "One giant leap for solar.",
  ["{firstName}, your AI sales force is here. It answers your leads, writes your emails and designs your roofs."],
  ["See it work", SITE],
);

/** The series: one product an email, Apple style, then the deal, 1990s mail-order style. */
const SERIES: { wait: number; content: EdmContent }[] = [
  {
    wait: 2,
    content: email(
      "a",
      "call",
      "It's on the phone with your new lead",
      "Voice agents that ring every lead and book them in.",
      "Your customers, answered.",
      [
        "Your voice agent rings each new lead within minutes, answers their questions and books them in. You choose its name and its voice.",
        `It always says it's your automated assistant. Calls go out in calling hours. Calls & Texts, ${VOICE}.`,
      ],
      ["Hear it call", SITE],
    ),
  },
  {
    wait: 3,
    content: email(
      "b",
      "sol",
      "Meet Sol",
      "The brain of your business.",
      "Meet Sol.",
      ["He knows every deal, writes your emails in your voice and tells you who to ring next. Ask him anything about solar."],
      ["Meet Sol", SITE],
    ),
  },
  {
    wait: 3,
    content: email(
      "c",
      "designer",
      "Your roofs, designed",
      "One press. Three priced designs.",
      "Your roofs, designed.",
      ["One press lays out three designs, each priced as it lands. Your customer signs online."],
      ["Try the designer", DEMO],
    ),
  },
  {
    wait: 3,
    content: email(
      "d",
      "today",
      "The CRM that does the typing",
      "Calls written up. Follow-ups drafted.",
      "Your calls, written up.",
      ["Calls written up. Follow-ups drafted. Emailed leads turned into deals. You do the selling."],
      ["See Today", DEMO],
    ),
  },
  {
    wait: 3,
    content: email(
      "e",
      "runs",
      "Signed. Then it runs itself.",
      "Ordering, approvals, installs and job cards in one place.",
      "Signed. Then it runs itself.",
      ["The moment they sign, the order opens, approvals line up and your installer's job card is ready."],
      ["See after the sale", SITE],
    ),
  },
  {
    wait: 4,
    content: email(
      "f",
      "coupon",
      `YES! Your first month is ${firstMonthWords}`,
      "No contract. Cancel any time. Every feature, every user.",
      "Here's the deal.",
      [
        `Your first month is ${firstMonthWords}. Then it's ${PLAN_AFTER}. No contract. Cancel any time.`,
        "P.S. Leads go to whoever answers soonest. Let yours answer this week.",
      ],
      ["YES! Start now", PRICING],
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
