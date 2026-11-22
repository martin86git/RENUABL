/**
 * RENUABL's launch emails for RENUABL Business, as drafts (22 Nov 2026, Martin: "create RENUABLs launch strategy…
 * the whats in it for the retailer stance: ai sales force, voice sales agents calling and booking in appointments… one
 * huge leap for solar and those who adopt… influenced by tesla, space x and apple… imagery should be high end… a series
 * that educates the recipient on the features and benefits"). It replaces the drafts of 15 Nov 2026.
 *
 * "One giant leap": a launch campaign and a six-email series started by opening it, each email one idea, one picture,
 * one button. The strategy, the send plan and the review copy are in docs/marketing/launch-strategy.md; keep the two in
 * step. Every claim is something the product does today, worded as the business page words it; no rival named, no
 * best, first, leading or guaranteed, prices from plans.ts and add-ons.ts, only {firstName} and {company}.
 *
 * The pictures (`GTM_PICTURES`) are files in public/design/launch/, drawn by tools/marketing/launch-art.mjs; the route
 * that adds the drafts (`/api/design/marketing/gtm`) reads them into RENUABL's own Marketing pictures and puts each
 * picture's id in its block (`withPictures`). Never sent or switched on by adding them.
 */
import { ADD_ON_MONTHLY_CENTS } from "@/lib/domain/design/add-ons";
import { COMMIT_MONTHS, COMMIT_SEAT_CENTS, SEAT_MONTHLY_CENTS, dollars, firstMonthWords } from "@/lib/domain/design/plans";
import type { EdmBlock, EdmContent } from "./edm";
import type { SequenceDraft, SequenceStep } from "./sequences";

const SITE = "https://www.renuabl.com.au/";
const DEMO = `${SITE}business/demo`;
const PRICING = `${SITE}#pricing`;

const PLAN = `${dollars(SEAT_MONTHLY_CENTS)} a user a month, your first month ${firstMonthWords}`;
const VOICE = `${dollars(ADD_ON_MONTHLY_CENTS.voice ?? 0)} a month`;

/** A picture's file under public/, and what it shows (its alt text in the email). */
export interface GtmPicture {
  file: string;
  alt: string;
}

export const GTM_PICTURES: Record<string, GtmPicture> = {
  leap: { file: "/design/launch/leap.jpg", alt: "The sun rising over the curve of the earth" },
  voice: { file: "/design/launch/voice.jpg", alt: "A RENUABL voice agent on a call, its words as they are said (example)" },
  sol: { file: "/design/launch/sol.jpg", alt: "Sol on RENUABL's Today screen, putting the day in order (example data)" },
  roof: { file: "/design/launch/roof.jpg", alt: "A roof designed from above in RENUABL's designer (example home)" },
  today: { file: "/design/launch/today.jpg", alt: "RENUABL's Today screen: calls, deals and what needs you (example data)" },
  runs: { file: "/design/launch/runs.jpg", alt: "RENUABL's install calendar after the sale (example data)" },
  close: { file: "/design/launch/close.jpg", alt: "The sun on the horizon" },
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
      block("t", { kind: "text", text: ["Hi {firstName},", ...words].join("\n\n"), url: null, align: "left" }),
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

/** The launch: the idea in one email. */
export const GTM_LAUNCH: EdmContent = email(
  "l",
  "leap",
  "One giant leap for solar",
  "RENUABL Business is live: an AI sales force for your solar business.",
  "One giant leap for solar.",
  [
    "For years, a solar business has run on the same things: a spreadsheet of leads, a CRM you type into, a design tool, a proposal tool, and somebody on the phone chasing.",
    "RENUABL Business puts it in one place and puts AI to work in every part of it.",
    "Voice agents ring your new leads, answer their questions and book them a call with your team. Sol, the brain of the business, knows every deal, tells you who needs you and drafts the follow-up in your voice. The designer prices the roof as you draw it. And once a customer signs, the order, the install and the paperwork carry on in the same place.",
    "The businesses that move now will be answering leads in minutes while everyone else is still returning calls.",
  ],
  ["See RENUABL Business", SITE],
);

/** The series: one idea an email, a few working days apart. */
const SERIES: { wait: number; content: EdmContent }[] = [
  {
    wait: 2,
    content: email(
      "a",
      "voice",
      "Your new sales team doesn't sleep in",
      "Voice agents that ring every lead and book them in.",
      "Meet your AI sales force.",
      [
        "Solar leads go to whoever talks to them soonest. Most businesses ring back the next day. Yours won't need to.",
        "A RENUABL voice agent rings each new lead in calling hours, says it's {company}'s automated assistant, answers their questions, meets the usual worries (price, other quotes, is a battery worth it) and books them a call with your team.",
        "You name each agent, choose its voice and give it its script. Watch any call live, type it a note mid-call, or hang up. Every call is written on the deal.",
        `Voice agents come with Calls & Texts, ${VOICE}, with your own business number.`,
      ],
      ["Meet your voice agents", SITE],
    ),
  },
  {
    wait: 3,
    content: email(
      "b",
      "sol",
      "The brain of your business",
      "Sol knows every deal, and tells you what matters next.",
      "Sol thinks. You decide.",
      [
        "Sol is the AI built into RENUABL Business. He reads every deal, every email and every call, and each morning he puts the day in order: who wrote in, who's gone quiet, and who to ring next.",
        "Ask him anything: which proposals have gone cold, what to say to a customer worried about their roof, where a battery can go on a garage wall. He answers from your own deals, and from the standards and makers' sheets with his sources.",
        "He drafts. You send. Nothing goes to a customer until you say so, or until you switch on the agents you trust.",
      ],
      ["Meet Sol", SITE],
    ),
  },
  {
    wait: 3,
    content: email(
      "c",
      "roof",
      "Roof to signed, in one sitting",
      "Three priced designs in one press. A proposal they sign online.",
      "It prices as you draw.",
      [
        "Type an address and the roof is there from above, to scale. Press once and the designer lays out three designs, one for the quickest payback, one for the biggest return over time and one for the most independence, each priced, with the strings checked against the inverter.",
        "Send a proposal in your own name, logo and colours. Your customer chooses their system, asks questions in the chat and signs online.",
        "Record a short walkthrough of the design as you talk, with subtitles written as you speak, and it sits at the top of their proposal.",
      ],
      ["Try the designer", DEMO],
    ),
  },
  {
    wait: 3,
    content: email(
      "d",
      "today",
      "A CRM that does the typing",
      "Calls written up. Follow-ups drafted. Leads emailed in, added for you.",
      "Software that works while you're on the roof.",
      [
        "A normal CRM waits for you to type. This one does the typing. The note-taker writes your calls up into the deal. Leads emailed to your inbox arrive as deals. Every deal says how warm it is and what it needs next.",
        "Today is one feed of what's happening: what Sol has lined up and when it goes, what only a person can do, and one button for each.",
        "Your team talks on each deal. Your customers never see it.",
      ],
      ["See Today", DEMO],
    ),
  },
  {
    wait: 3,
    content: email(
      "e",
      "runs",
      "Signed. Then it runs itself.",
      "Ordering, approvals, installs, job cards and service, in the same place.",
      "Signed. Then it runs itself.",
      [
        "The moment a customer accepts, the order opens with the exact lines sold, approvals line up in order, and the install goes on the calendar against your weekly capacity.",
        "Your installer gets a job card with the layout, strings and photos. Your post-sale voice agent can ring the customer to pencil in their install day.",
        "Invoices, STCs and the grid connection are tracked to the end, and service cases after that.",
      ],
      ["See after the sale", SITE],
    ),
  },
  {
    wait: 4,
    content: email(
      "f",
      "close",
      "The leap, for {company}",
      `${PLAN}. Cancel any time.`,
      "One price. Everything in it.",
      [
        "Every user gets everything: the designer, the CRM, proposals, after the sale, service and Sol.",
        `It's ${PLAN}, or ${dollars(COMMIT_SEAT_CENTS)} a user a month on the ${COMMIT_MONTHS}-month plan. Voice agents and your business number come with Calls & Texts, ${VOICE}. Prices include GST. Cancel any time.`,
        "This is where selling solar is going. The businesses that start now get the head start.",
      ],
      ["Start now", PRICING],
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
