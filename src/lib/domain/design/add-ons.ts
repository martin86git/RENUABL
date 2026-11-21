/**
 * Add-ons to a RENUABL Business plan (16 Nov 2026, Martin: voice agents are "an expansion feature of their
 * subscription… it isn't offered out of the box"; marketing emails "will be extra"). One model for every add-on: kept on
 * the business (`design_addons`), charged as an item of its own on the plan's Stripe subscription, shown in Settings →
 * Billing and wherever the feature lives as "Add to your plan". Pure, tested.
 *
 * Prices (16 Nov 2026, Martin; Calls & Texts raised 21 Nov 2026): **Calls & Texts** (key `voice`) $49 a month, with the
 * business number, 30 voice-agent minutes and 30 texts free, beyond them charged at cost plus margin (voice-usage.ts);
 * **Growth** (key `marketing`) $19 a month: custom proposals
 * and marketing email, 2,000 emails a month, then $10 per 5,000 more (`GROWTH_EMAILS`). Custom proposals are no longer
 * sold apart: they come with Growth (`CUSTOM_PROPOSALS` is its key). Prices are Martin's to set; one set to null is
 * "Price on request": pressing Add to your plan asks for it (kept
 * on the business and shown as asked for, RENUABL's staff told), and staff switch it on from /admin once the price is
 * agreed. Once a price is set, Add to your plan puts it on the subscription there and then. Never invent a price.
 *
 * RENUABL's own business has every add-on, always, at no charge: it is the business they were built on.
 */

import { DEFAULT_CAP_CENTS, VOICE_FREE, VOICE_PRICES } from "./voice-usage";

const money = (cents: number) => (cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`);
const priceEach = (cents: number) => (cents < 100 ? `${cents}c` : money(cents));

export const ADD_ON_KEYS = ["voice", "marketing"] as const;
export type AddOnKey = (typeof ADD_ON_KEYS)[number];

export const cleanAddOnKey = (raw: unknown): AddOnKey | null => (ADD_ON_KEYS.includes(raw as AddOnKey) ? (raw as AddOnKey) : null);

/**
 * Each add-on's price a month for the whole business, including GST. Null until Martin sets it (then "Price on request").
 * The voice price includes the business's own phone number; calls and texts beyond it are not priced yet (VERIFY with
 * Martin how usage is charged before setting it).
 */
export const ADD_ON_MONTHLY_CENTS: Record<AddOnKey, number | null> = {
  voice: 4900,
  marketing: 1900,
};

/** What Calls & Texts includes free each month; beyond it, minutes and texts are charged (voice-usage.ts). */
export const VOICE_INCLUDES = VOICE_FREE;
/** Marketing emails a month with Growth, and the price of each 5,000 more (not charged yet). */
export const GROWTH_EMAILS = { included: 2000, extraBlock: 5000, extraCents: 1000 } as const;

export interface AddOnWords {
  name: string;
  /** One sentence: what it is. */
  what: string;
  /** What comes with it, a line each. */
  includes: readonly string[];
}

export const ADD_ON_WORDS: Record<AddOnKey, AddOnWords> = {
  voice: {
    name: "Calls & Texts",
    what: "Your own business number, texting from every deal, and phone agents that ring your leads and customers in your business's name.",
    includes: [
      "Your own Australian business number, for calls and texts",
      "30 voice-agent minutes and 30 texts a month included, then charged by the minute and by the text",
      "A sales agent and a post-sale agent with names, voices and scripts you set",
      "Calls coming in to your number answered and put on the right deal",
      "Texting customers from a deal, with replies landing on it",
      "Calling from your computer through your number",
    ],
  },
  marketing: {
    name: "Growth",
    what: "Custom proposals in your own design, and marketing email to your contacts and customers in your business's name.",
    includes: [
      "Custom proposals: blocks moved, added and laid out your way, pictures placed and sized",
      "2,000 marketing emails a month, with more available as you need them",
      "Import contacts, or bring your customers across, with consent kept on each",
      "Emails built from blocks, written with Sol",
      "Campaigns sent when you choose, and sequences that run by themselves",
      "Opens, clicks and unsubscribes reported",
    ],
  },
};

/** The words on the button wherever a feature is offered to a business without it. */
export const ADD_TO_PLAN = "Add to your plan";

/** An add-on's price in words: "Price on request" until set. */
export function addOnPriceWords(key: AddOnKey, cents: number | null = ADD_ON_MONTHLY_CENTS[key]): string {
  if (cents === null) return "Price on request";
  const dollars = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return `$${dollars} a month for your business, including GST`;
}

/** Where an add-on stands for a business, as read from its row (none: never asked for or ended). */
export type AddOnRow = {
  status: "on" | "requested";
  stripeItem: string | null;
  /** Notice given (Calls & Texts): it stays on, and billed, until this moment, then comes off and the number is released. */
  endsAt?: string | null;
} | null;

export type AddOnStanding =
  /** RENUABL's own business: always on, never charged. */
  | "included"
  /** On the business's plan. */
  | "on"
  /** Cancelled with notice given: still on and billed until the notice ends (`AddOnRow.endsAt`). */
  | "ending"
  /** Asked for while unpriced: waiting for RENUABL to confirm the price and switch it on. */
  | "requested"
  /** Not on the plan: offered. */
  | "off";

export function addOnStanding(given: { own: boolean; row: AddOnRow }): AddOnStanding {
  if (given.own) return "included";
  if (given.row?.status === "on") return given.row.endsAt ? "ending" : "on";
  if (given.row?.status === "requested") return "requested";
  return "off";
}

/** Whether the business may use the add-on now. */
export const addOnUsable = (standing: AddOnStanding): boolean => standing === "included" || standing === "on" || standing === "ending";

/** What pressing Add to your plan does: buy it now (priced), ask for it (unpriced), or nothing to do. */
export type AddOnAction = "buy" | "request" | "none";

export function addOnAction(standing: AddOnStanding, cents: number | null): AddOnAction {
  if (standing !== "off") return "none";
  return cents === null ? "request" : "buy";
}

/** Why a business can't add one yourself: only the owner manages billing, and a plan is needed to add to. */
export type AddRefusal = "not-owner" | "no-plan" | "not-monthly" | "retailers-only" | null;

export function addRefusal(given: {
  owner: boolean;
  retailer: boolean;
  plan: "monthly" | "yearly" | "none";
  cents: number | null;
}): AddRefusal {
  if (!given.retailer) return "retailers-only";
  if (!given.owner) return "not-owner";
  // An unpriced add-on is only asked for: nothing is charged, so no plan is needed yet.
  if (given.cents === null) return null;
  if (given.plan === "none") return "no-plan";
  // Every item on a Stripe subscription bills on the same interval; add-ons are monthly and yearly plans are no longer sold.
  if (given.plan === "yearly") return "not-monthly";
  return null;
}

export const ADD_REFUSAL_WORDS: Record<Exclude<AddRefusal, null>, string> = {
  "retailers-only": "Add-ons are for retailers on RENUABL Business.",
  "not-owner": "Ask your business's owner to add it in Settings → Billing.",
  "no-plan": "Choose a plan first in Settings → Billing, then add this to it.",
  "not-monthly": "Add-ons are billed monthly. Talk to us to move your plan to monthly first.",
};

/** What the business is told, by where it stands. */
export function standingWords(key: AddOnKey, standing: AddOnStanding): string {
  const name = ADD_ON_WORDS[key].name;
  switch (standing) {
    case "included":
      return `${name} is included for RENUABL's own business.`;
    case "on":
      return `${name} is on your plan.`;
    case "ending":
      return `${name} is cancelled and stays on until its notice ends.`;
    case "requested":
      return `You've asked for ${name}. We'll confirm the price with you, then switch it on.`;
    case "off":
      return `${name} is an add-on to your plan.`;
  }
}

/** Said by a route refusing a feature the business hasn't added. */
export const needsAddOn = (key: AddOnKey): string => `${ADD_ON_WORDS[key].name} isn't on your plan. Add it in Settings → Billing.`;

/** The note RENUABL's staff get when a business asks for an unpriced add-on. Nothing sensitive: who, which, when. */
export function addOnRequestNote(given: { key: AddOnKey; business: string; by: string }): string {
  return [
    `${given.business} asked for the ${ADD_ON_WORDS[given.key].name} add-on (${given.by}).`,
    "It has no price yet. Agree the price with them, then switch it on in /admin → Add-ons asked for.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Voice: what it needs beyond the add-on
// ---------------------------------------------------------------------------

/**
 * Whether a business's calls (and texts) are on, and if not, why. RENUABL's own business rings from RENUABL's number;
 * every other needs the add-on and a number of its own on the business.
 */
export type VoiceStanding = "on" | "not-set-up" | "add-on" | "number";

export function voiceStanding(given: { settings: boolean; own: boolean; addOn: boolean; number: boolean }): VoiceStanding {
  if (!given.settings) return "not-set-up";
  if (given.own) return "on";
  if (!given.addOn) return "add-on";
  if (!given.number) return "number";
  return "on";
}

export const VOICE_STANDING_WORDS: Record<Exclude<VoiceStanding, "on">, string> = {
  "not-set-up": "Calls aren't switched on for RENUABL Business yet.",
  "add-on": "Voice agents are an add-on to your plan. Add them in Settings → Billing.",
  number: "Your business phone number isn't set up yet, so customers can't be rung. See Calls & Texts in Settings → Billing.",
};

const dayWords = (iso: string | null | undefined): string => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "Australia/Melbourne" })
    : "";
};

/**
 * What a business is told before it adds Calls & Texts (21 Nov 2026, Martin: the offer said $29 a month but "doesnt tell
 * me when billing starts - no does it say the charges per call"): the price, when it is billed, what a call or text
 * costs, and that the number comes with it. `nextBill` is the plan's next bill day when known.
 */
export function voiceTerms(nextBill?: string | null): string[] {
  const cents = ADD_ON_MONTHLY_CENTS.voice;
  const day = dayWords(nextBill);
  const v = VOICE_INCLUDES;
  return [
    cents === null
      ? "Price on request: nothing is charged until we've agreed it with you."
      : `Billing starts today. The rest of this month is worked out by the day and goes on your next bill${day ? ` on ${day}` : ""}, then it is $${cents / 100} each month, including GST.`,
    `Each month includes ${v.minutes} voice-agent minutes and ${v.texts} texts free for your whole business. A call is counted to the whole minute; a long text counts as the parts it goes as.`,
    `Beyond those, ${priceEach(VOICE_PRICES.minuteCents)} a minute and ${priceEach(VOICE_PRICES.textCents)} a text, including GST, on your next bill. A spending cap you set (${money(DEFAULT_CAP_CENTS)} to start) stops calls and texts going out once reached.`,
    "Your own Australian business number comes with it, at no extra cost.",
    NOTICE_LINE,
  ];
}

// ---------------------------------------------------------------------------
// Cancelling with notice (21 Nov 2026, Martin)
// ---------------------------------------------------------------------------

/**
 * Every add-on carries 30 days' notice to cancel (Calls & Texts first; Growth too, the same day, Martin: "apply the
 * same 30 days notice to growth"). (21 Nov 2026, Martin: "the grace period should be 30 days - which is
 * the period of time the user has to commit to when they purchase, and the amount of notice to cancel the number").
 * Cancelling keeps it on, number and all, and billed for 30 days from that moment; then it comes off the plan (the
 * Stripe item removed, prorated to that day) and the number is released. Cancelled on day 15 of a billing month: that
 * month's fee stands, and the next month is billed only up to the notice's end, by the day. Growth's custom proposals
 * and marketing email work until then too.
 */
export const CANCEL_NOTICE_DAYS = 30;

/** Which add-ons carry notice to cancel. */
export const hasNotice = (key: AddOnKey): boolean => ADD_ON_KEYS.includes(key);

/** The line in an add-on's terms before it is added. */
export const NOTICE_LINE = `Cancel any time with ${CANCEL_NOTICE_DAYS} days' notice: it stays on, and billed, for ${CANCEL_NOTICE_DAYS} days after you cancel.`;

/** When notice given at `from` ends. */
export const noticeEnds = (from: Date): Date => new Date(from.getTime() + CANCEL_NOTICE_DAYS * 86_400_000);

/** The words on the button that cancels an add-on (Martin: "it should also say cancel plan and not take it off"). */
export const CANCEL_PLAN = "Cancel plan";

/**
 * What a business is told before it cancels an add-on, with the day the notice would end (if cancelled now) and, for
 * Calls & Texts, its number when it has one. Shown above the button that confirms.
 */
export function cancelNoticeWords(given: { key?: AddOnKey; endsAt: Date | string; number?: string | null }): string[] {
  const key = given.key ?? "voice";
  const name = ADD_ON_WORDS[key].name;
  const day = dayWords(typeof given.endsAt === "string" ? given.endsAt : given.endsAt.toISOString());
  const head = [
    `${name} has ${CANCEL_NOTICE_DAYS} days' notice. If you cancel now it stays on, and is billed, until ${day}.`,
    `This billing month's fee isn't refunded. If ${day} falls in your next billing month, that month is billed only up to ${day}, by the day.`,
  ];
  const last = `You can change your mind any time before ${day}.`;
  if (key === "voice") {
    const number = given.number ? `your business number ${given.number}` : "your business number";
    return [
      ...head,
      `On ${day} it comes off your plan and ${number} is released. Calls and texts to it stop reaching you, and it can't be got back.`,
      "To keep the number, move it to another phone provider before then.",
      last,
    ];
  }
  return [
    ...head,
    `On ${day} it comes off your plan: proposals you publish from then on use the standard design, marketing campaigns and sequences stop sending, and your contacts and past emails are kept.`,
    last,
  ];
}

/** Where a cancelled Calls & Texts stands while its notice runs. */
export const endingWords = (key: AddOnKey, endsAt: string | null | undefined): string => {
  const day = dayWords(endsAt);
  return key === "voice"
    ? `${ADD_ON_WORDS[key].name} is cancelled. It stays on, and is billed, until ${day}; then it comes off your plan and your business number is released.`
    : `${ADD_ON_WORDS[key].name} is cancelled and comes off your plan on ${day}.`;
};

/** Where the business's own number stands once Calls & Texts is on its plan. */
export function numberStandingWords(given: { number: string | null; canBuy: boolean }): string {
  if (given.number) return `Your business number is ${given.number}.`;
  return given.canBuy
    ? "Your business number hasn't been set up yet. Press Get my business number and it's ready in a moment."
    : "Your business number is being set up by RENUABL. We'll email you as soon as it's ready. Until then your agents can ring your own mobile for test and training calls, but not your customers.";
}

/**
 * What a voice agent knows about its own phone line, for its chat (21 Nov 2026, Martin: "i asked the sales voice agent
 * in its chat - hwo do i obtain a phone number and it told me it couldnt help me"): where the business stands and
 * exactly what to press. Facts only, a line each.
 */
export function phoneFacts(given: { standing: VoiceStanding; number: string | null; canBuy: boolean; nextBill?: string | null }): string[] {
  const name = ADD_ON_WORDS.voice.name;
  const terms = voiceTerms(given.nextBill);
  if (given.standing === "on")
    return [
      given.number
        ? `Calls are on. The business's number is ${given.number}: calls and texts go from it, and calls back to it are answered.`
        : "Calls are on.",
      terms[1]!,
      terms[2]!,
    ];
  if (given.standing === "not-set-up")
    return [
      "Calls aren't switched on for RENUABL Business itself right now. RENUABL has to fix that; nothing the business does will change it.",
    ];
  if (given.standing === "add-on")
    return [
      `The business can't make calls yet: ${name} isn't on its plan.`,
      `Its owner adds it with Add to your plan, on the card under the voice agents in Your agents (the plus on the bar at the right), or in Settings → Billing → Add-ons. ${addOnPriceWords("voice")}.`,
      ...terms,
      "The business number is asked for automatically as soon as it's added.",
    ];
  return [
    `${name} is on the plan, but the business has no number of its own yet, so customers can't be rung.`,
    numberStandingWords({ number: null, canBuy: given.canBuy }),
    given.canBuy
      ? "Get my business number is on the Calls & Texts card in Your agents (the plus on the bar at the right) and in Settings → Billing → Add-ons. Only the business's owner can press it."
      : "Nothing more needs pressing. If it has been more than a working day, they can reply to RENUABL's email or write to support.",
    "Test call and Train (the phone at the top of this chat) work now: they ring the member's own mobile.",
  ];
}

/** Marketing is a retailer's add-on (it emails the retailer's own contacts). */
export function marketingUsable(given: { retailer: boolean; standing: AddOnStanding }): boolean {
  return given.retailer && addOnUsable(given.standing);
}
