/**
 * Topping up by itself (16 Nov 2026, Martin: credits "constantly auto top up so they always have credits available";
 * Grok's "on-demand monthly limit" for Sol). Pure, tested (`top-up.test.ts`).
 *
 * Two balances can top up: the designer's credits and Sol's credits. Each is the owner's choice, off until switched on:
 * when the balance falls below a floor, the pack chosen is bought on the card RENUABL's plan is paid with, never more
 * than the monthly limit in a calendar month, and never twice within `TOP_UP_GAP_MINUTES`. A failed charge waits
 * `FAILED_WAIT_HOURS` before another try. Free trial sites and the month's included Sol credits are used first, so a
 * top-up only follows once they're gone.
 */
import { BATTERY_SITE_CREDITS, TOKEN_PACKS, dollars, packDollars, packPriceCents, type TokenPack } from "./plans";
import { SOL_PACKS } from "./sol-credits";

export const TOP_UP_KINDS = ["design", "sol"] as const;
export type TopUpKind = (typeof TOP_UP_KINDS)[number];

export const cleanTopUpKind = (raw: unknown): TopUpKind | null => (TOP_UP_KINDS.includes(raw as TopUpKind) ? (raw as TopUpKind) : null);

export interface TopUpSettings {
  on: boolean;
  /** The pack bought: a design pack by its price in dollars, a Sol pack by its credits. */
  pack: number;
  /** Top up when the credits left fall below this. */
  below: number;
  /** No more than this a calendar month, cents. */
  monthlyCapCents: number;
}

export const TOP_UP_DEFAULTS: Record<TopUpKind, TopUpSettings> = {
  // Two battery sites' worth left, the $60 pack, at most $300 a month.
  design: { on: false, pack: 60, below: BATTERY_SITE_CREDITS * 2, monthlyCapCents: 30000 },
  // Twenty answers left, the 250-credit pack, at most $149 a month.
  sol: { on: false, pack: 250, below: 20, monthlyCapCents: 14900 },
};

/** The floors that can be chosen. */
export const TOP_UP_FLOORS: Record<TopUpKind, readonly number[]> = { design: [7, 14, 21, 35], sol: [10, 20, 50, 100] };
/** The monthly limits that can be chosen, cents. */
export const TOP_UP_CAPS: Record<TopUpKind, readonly number[]> = {
  design: [6000, 15000, 30000, 60000, 120000],
  sol: [4900, 14900, 29800, 42900, 85800],
};

export const TOP_UP_GAP_MINUTES = 10;
export const FAILED_WAIT_HOURS = 24;

/** A pack's price, cents; null for a pack not sold. */
export function topUpPackCents(kind: TopUpKind, pack: number): number | null {
  if (kind === "design") return TOKEN_PACKS.includes(pack as TokenPack) ? packPriceCents(pack as TokenPack) : null;
  return SOL_PACKS.find((p) => p.credits === pack)?.cents ?? null;
}

/** The credits a pack adds (a design pack's bonus included). */
export function topUpPackCredits(kind: TopUpKind, pack: number): number {
  return kind === "design" ? packDollars(pack as TokenPack) : pack;
}

/** Settings from the browser, cleaned: any value not on offer goes back to the default. */
export function cleanTopUp(kind: TopUpKind, raw: unknown): TopUpSettings {
  const d = TOP_UP_DEFAULTS[kind];
  const r = (raw ?? {}) as Partial<Record<keyof TopUpSettings, unknown>>;
  const num = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v);
  const pack = num(r.pack);
  const below = num(r.below);
  const cap = num(r.monthlyCapCents);
  const packOk = typeof pack === "number" && topUpPackCents(kind, pack) !== null;
  const packCents = topUpPackCents(kind, packOk ? (pack as number) : d.pack) ?? 0;
  const capOk = typeof cap === "number" && TOP_UP_CAPS[kind].includes(cap);
  return {
    on: r.on === true,
    pack: packOk ? (pack as number) : d.pack,
    below: typeof below === "number" && TOP_UP_FLOORS[kind].includes(below) ? below : d.below,
    // The limit always lets at least one pack through.
    monthlyCapCents: Math.max(capOk ? (cap as number) : d.monthlyCapCents, packCents),
  };
}

export interface TopUpCheck {
  kind: TopUpKind;
  settings: TopUpSettings;
  /** Credits that can still be used: the bought balance, plus the month's included or trial ones. */
  left: number;
  /** Already charged by top-ups this calendar month, cents. */
  spentThisMonthCents: number;
  /** When the last top-up was tried, and whether it failed. */
  last: { at: string; failed: boolean } | null;
  now: Date;
}

export type TopUpVerdict = "buy" | "off" | "enough" | "cap" | "too-soon";

/** Whether to buy a pack now, and why not when not. */
export function topUpDue(c: TopUpCheck): TopUpVerdict {
  if (!c.settings.on) return "off";
  if (c.left >= c.settings.below) return "enough";
  const price = topUpPackCents(c.kind, c.settings.pack) ?? 0;
  if (price === 0 || c.spentThisMonthCents + price > c.settings.monthlyCapCents) return "cap";
  if (c.last) {
    const wait = (c.last.failed ? FAILED_WAIT_HOURS * 60 : TOP_UP_GAP_MINUTES) * 60_000;
    if (c.now.getTime() - Date.parse(c.last.at) < wait) return "too-soon";
  }
  return "buy";
}

/** The setting in words, for Billing and Sol's usage window. */
export function topUpWords(kind: TopUpKind, s: TopUpSettings): string {
  if (!s.on) return "Off. Buy credits yourself when you need them.";
  const price = topUpPackCents(kind, s.pack) ?? 0;
  const credits = topUpPackCredits(kind, s.pack).toLocaleString("en-AU");
  return `On: ${credits} credits for ${dollars(price)} when you have fewer than ${s.below} left, up to ${dollars(s.monthlyCapCents)} a month.`;
}
