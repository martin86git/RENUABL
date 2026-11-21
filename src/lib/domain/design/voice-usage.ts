/**
 * What Calls & Texts uses, and what it costs beyond the month's free allowance (21 Nov 2026, Martin: "$49, metering and
 * a spending cap… 30 minutes of free calls. texts should be 30 free a month. easy to remember both. then we need to
 * apply a charge to the minutes and texts - i would think we attach some cost + a margin"). Pure, tested.
 *
 * **The month** is the calendar month in the market's time, so the allowance resets on the 1st. **Minutes** are every
 * voice-agent call's length rounded up to the whole minute (as Twilio and Vapi bill), calls out and in, test and
 * training calls included. **Texts** are each text sent from the business's number, a long one counting as the parts it
 * goes as (`textParts`). Beyond the free 30 of each, a minute and a text are charged at our cost plus `VOICE_MARGIN`,
 * with GST (`VOICE_PRICES`), added to the next bill after the month ends.
 *
 * **The spending cap** is the most a month's charges beyond the free allowance may come to (`DEFAULT_CAP_CENTS` until
 * the owner sets it; 0 stops at the free allowance). Once reached, the business's agents start no new calls and no
 * texts go out until the 1st; calls coming in are still answered, so a customer is never turned away, and still count.
 */
import { LAUNCH_MARKET } from "../market";

/** Free each calendar month with Calls & Texts. */
export const VOICE_FREE = { minutes: 30, texts: 30 } as const;

/**
 * What a minute and a text cost RENUABL, in Australian cents before GST. PLACEHOLDER, VERIFY: a minute is Vapi's
 * platform, the voice, the transcriber and Claude, plus Twilio's line to an Australian mobile (about A$0.25–0.45 read
 * from memory, 21 Nov 2026); a text is Twilio's price for one part to an Australian mobile. Read the real figures from
 * Vapi's call log and Twilio's pricing page, then set these.
 */
export const VOICE_COSTS = { minuteCents: 40, textCents: 9 } as const;

/** The margin on top of cost: 0.5 is cost plus half again. */
export const VOICE_MARGIN = 0.5;

/** GST, added on top: prices to businesses include it. */
const GST = 0.1;

/** A unit's price to the business, including GST, rounded up to the cent. */
export const unitPrice = (costCents: number, margin = VOICE_MARGIN): number => Math.ceil(costCents * (1 + margin) * (1 + GST) - 1e-9);

/** What a minute and a text cost the business beyond the free allowance, including GST. */
export const VOICE_PRICES = {
  minuteCents: unitPrice(VOICE_COSTS.minuteCents),
  textCents: unitPrice(VOICE_COSTS.textCents),
} as const;

/** The spending cap a business starts with, in cents. */
export const DEFAULT_CAP_CENTS = 10_000;
/** The highest cap a business may set. */
export const MAX_CAP_CENTS = 500_000;

/** A cap typed in dollars, as cents: whole dollars from 0 to the most allowed. Null: not a cap. */
export function cleanCap(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw.replace(/[$,\s]/g, "")) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  const cents = Math.round(n) * 100;
  return cents > MAX_CAP_CENTS ? null : cents;
}

/** A call's length in billed minutes: rounded up to the whole minute; nothing for a call that never connected. */
export const minutesOf = (seconds: number): number => (Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 0);

/** The calendar month (YYYY-MM) a moment falls in, in the market's time. */
export const usageMonth = (at: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: LAUNCH_MARKET.timeZone, year: "numeric", month: "2-digit" }).format(at).slice(0, 7);

/** The month before one (YYYY-MM). */
export function monthBefore(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export interface Usage {
  minutes: number;
  texts: number;
}

export interface UsageBill {
  extraMinutes: number;
  extraTexts: number;
  /** What the month's usage beyond the free allowance comes to, including GST. */
  cents: number;
}

/** What a month's usage comes to beyond the free allowance. */
export function usageBill(u: Usage): UsageBill {
  const extraMinutes = Math.max(0, u.minutes - VOICE_FREE.minutes);
  const extraTexts = Math.max(0, u.texts - VOICE_FREE.texts);
  return { extraMinutes, extraTexts, cents: extraMinutes * VOICE_PRICES.minuteCents + extraTexts * VOICE_PRICES.textCents };
}

/**
 * Whether the month's charges have reached the cap for a kind of use: no new calls (or texts) go out until the 1st. A
 * cap of $0 stops each at its own free allowance; any other stops both once the charges come to it.
 */
export function capReached(u: Usage, capCents: number, kind?: "minute" | "text"): boolean {
  if (capCents <= 0) {
    if (kind === "minute") return u.minutes >= VOICE_FREE.minutes;
    if (kind === "text") return u.texts >= VOICE_FREE.texts;
    return u.minutes >= VOICE_FREE.minutes && u.texts >= VOICE_FREE.texts;
  }
  return usageBill(u).cents >= capCents;
}

const money = (cents: number) => (cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`);
const priceEach = (cents: number) => (cents < 100 ? `${cents}c` : money(cents));

/** The prices in words, for the offer and the agent's facts. */
export const usagePriceWords = (): string =>
  `${VOICE_FREE.minutes} minutes and ${VOICE_FREE.texts} texts free each month; beyond them, ${priceEach(VOICE_PRICES.minuteCents)} a minute and ${priceEach(VOICE_PRICES.textCents)} a text, including GST, on your next bill.`;

/** What the business is told about this month, on its Calls & Texts card. */
export function usageWords(u: Usage, capCents: number): string[] {
  const bill = usageBill(u);
  const lines = [
    `This month: ${u.minutes} of ${VOICE_FREE.minutes} free minutes, ${u.texts} of ${VOICE_FREE.texts} free texts.`,
    bill.cents > 0
      ? `Beyond the free allowance so far: ${bill.extraMinutes} minutes and ${bill.extraTexts} texts, ${money(bill.cents)} on your next bill.`
      : "Nothing beyond the free allowance so far.",
    capCents <= 0
      ? "Your spending cap is $0: calls and texts stop once the free allowance is used."
      : `Your spending cap is ${money(capCents)} a month beyond the free allowance.`,
  ];
  const calls = capReached(u, capCents, "minute");
  const texts = capReached(u, capCents, "text");
  if (calls || texts)
    lines.push(
      `The cap is reached: ${calls && texts ? "your agents start no new calls and no texts go out" : calls ? "your agents start no new calls" : "no texts go out"} until the 1st. Calls coming in are still answered.`,
    );
  return lines;
}

/** Said when a call or text is refused for the cap. */
export const CAP_REACHED =
  "This month's spending cap for calls and texts is reached. Raise it in Settings → Billing → Calls & Texts, or it resets on the 1st.";

/** The line on the invoice for a month's usage beyond the free allowance. */
export function usageInvoiceLine(month: string, bill: UsageBill): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const name = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
  const parts = [
    bill.extraMinutes ? `${bill.extraMinutes} minutes at ${priceEach(VOICE_PRICES.minuteCents)}` : "",
    bill.extraTexts ? `${bill.extraTexts} texts at ${priceEach(VOICE_PRICES.textCents)}` : "",
  ].filter(Boolean);
  return `Calls & Texts, ${name}, beyond the free ${VOICE_FREE.minutes} minutes and ${VOICE_FREE.texts} texts: ${parts.join(" and ")}`;
}
