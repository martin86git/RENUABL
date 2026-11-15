/**
 * RENUABL's own go-to-market emails for RENUABL Business (15 Nov 2026, Martin: "build out our go to marketing campaign
 * edms for me to review"), as drafts: a launch campaign and a four-email nurture sequence started by opening it. Their
 * review copy, with the rollout plan, is docs/marketing/go-to-market-plan.md; keep the two in step. In line with the
 * /business page: Sol is the built-in AI, everything in one platform, the plan prices as there (never shown as a
 * discount), no rival named, no best, first, leading or guaranteed, only {firstName} and {company}. Added to RENUABL's
 * own business by one press (`/api/design/marketing/gtm`); never sent or switched on by it.
 */
import { COMMIT_MONTHS, COMMIT_SEAT_CENTS, FIRST_MONTH_CENTS, SEAT_MONTHLY_CENTS, dollars } from "@/lib/domain/design/plans";
import type { EdmBlock, EdmContent } from "./edm";
import type { SequenceDraft, SequenceStep } from "./sequences";

const SITE = "https://www.renuabl.com.au/business";
const DEMO = "https://www.renuabl.com.au/business/demo";
const PRICING = `${SITE}#pricing`;

const PRICE_LINE = `It's ${dollars(SEAT_MONTHLY_CENTS)} a user a month, and your first month is ${dollars(FIRST_MONTH_CENTS)} a user. Prices include GST. Cancel any time.`;

function email(key: string, subject: string, preview: string, heading: string, words: string[], button: [string, string]): EdmContent {
  const block = (n: number, b: Omit<EdmBlock, "id" | "imageId">): EdmBlock => ({ id: `gtm${key}${n}`, imageId: null, ...b });
  return {
    subject,
    preview,
    blocks: [
      block(1, { kind: "heading", text: heading, url: null, align: "left" }),
      block(2, { kind: "text", text: ["Hi {firstName},", ...words].join("\n\n"), url: null, align: "left" }),
      block(3, { kind: "button", text: button[0], url: button[1], align: "center" }),
    ],
  };
}

export const GTM_CAMPAIGN_NAME = "RENUABL Business launch";
export const GTM_SEQUENCE_NAME = "RENUABL Business nurture";

export const GTM_LAUNCH: EdmContent = email(
  "l",
  "Solar just got a brain",
  "RENUABL Business: design, CRM, proposals and service in one platform, with AI built in.",
  "Solar just got a brain.",
  [
    "RENUABL Business is the all-in-one platform for solar businesses, with AI built into every part of it.",
    "Draw a roof and it's priced as you draw. Send a branded proposal your customer can accept online. Once it's signed, ordering, the install calendar, installer job cards and the paperwork after the install are all in the same place.",
    "Sol, RENUABL's built-in AI, works inside your deals. He tells you who to ring next, drafts the follow-up in your voice and answers questions on solar and the standards, with his sources. He never sends anything himself: you check, you send.",
    PRICE_LINE,
  ],
  ["See RENUABL Business", SITE],
);

const NURTURE: { wait: number; content: EdmContent }[] = [
  {
    wait: 2,
    content: email(
      "a",
      "A design tool that designs itself",
      "Ask for 8 kW and a battery, or press once for three designs.",
      "Three designs. One press.",
      [
        "Ask the designer for 8 kW and a battery, or press once and it lays out three designs for the roof, each priced as it's drawn, with the strings checked against the inverter.",
        "You check them against the photo and send the one you like.",
      ],
      ["Try the demo", DEMO],
    ),
  },
  {
    wait: 4,
    content: email(
      "b",
      "Your CRM, doing the typing",
      "Calls written up, follow-ups drafted, the next deal to ring.",
      "A CRM that keeps itself up to date.",
      [
        "The note-taker writes up your calls into the deal. Sol drafts the follow-up when a proposal is due one, and Today shows which deals need you and why.",
        "Your team talks on each deal. Your customers never see it.",
      ],
      ["See how it works", SITE],
    ),
  },
  {
    wait: 5,
    content: email(
      "c",
      "After the signature",
      "Ordering, install calendar, job cards and paperwork in one place.",
      "Signed. Then it runs.",
      [
        "When a customer accepts, the order opens with the exact lines sold, the install goes on the calendar, and your installer gets a job card with the layout and strings.",
        "Invoices, STCs and the grid connection are tracked to the end, and service cases after that.",
      ],
      ["See RENUABL Business", SITE],
    ),
  },
  {
    wait: 5,
    content: email(
      "d",
      "One price for {company}",
      `${dollars(SEAT_MONTHLY_CENTS)} a user a month, first month ${dollars(FIRST_MONTH_CENTS)}. Cancel any time.`,
      "One price. Everything in it.",
      [
        "Every feature for every user: the designer, CRM, proposals, after the sale, service and Sol.",
        `${dollars(SEAT_MONTHLY_CENTS)} a user a month, or ${dollars(COMMIT_SEAT_CENTS)} a user a month on the ${COMMIT_MONTHS}-month plan. Your first month is ${dollars(FIRST_MONTH_CENTS)} a user. Prices include GST, and you can cancel any time.`,
      ],
      ["Sign up", PRICING],
    ),
  },
];

/** The nurture sequence, started by opening the launch campaign; off until switched on by hand. */
export function gtmSequence(launchCampaignId: string): SequenceDraft {
  const steps: SequenceStep[] = NURTURE.flatMap((s, i) => [
    { id: `gtmwait${i}`, kind: "wait" as const, days: s.wait },
    { id: `gtmmail${i}`, kind: "email" as const, content: s.content },
  ]);
  return {
    name: GTM_SEQUENCE_NAME,
    trigger: { kind: "opened", campaignId: launchCampaignId },
    steps,
    stops: { signedUp: true, clicked: false },
  };
}

/** Every email in the drafts, for the checks. */
export const GTM_EMAILS: EdmContent[] = [GTM_LAUNCH, ...NURTURE.map((s) => s.content)];
