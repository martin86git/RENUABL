/**
 * "Suggest one" in the roof designer's battery list, beside "suggest an
 * inverter". Worked out by rule, with the reason written beside it: the same
 * every time, nothing to wait for. Pure, tested.
 *
 * The rules:
 *  - **sized to the home's nights**: with the customer's bill, what the home
 *    uses after dark (the evening share of a day's use, as `designFinance`
 *    takes it, `DAY.eveningShare`);
 *  - **no bigger than the panels can fill**: what the design makes beyond the
 *    day's own use on a middling month (the median of the twelve), since a
 *    battery the roof can't fill most days is money in a box. Without a bill
 *    it is sized to that alone, and says so;
 *  - a battery gives back about 90% of what it holds (`DAY.batteryRoundTrip`),
 *    so the size asked for is the usable need over 0.9;
 *  - **the inverter decides the maker**: a battery has to work with the
 *    inverter, so when the design has an inverter and the list has batteries
 *    of the same maker, only those are suggested; a design whose inverters
 *    aren't hybrids is told it needs one. Otherwise one suggestion a maker,
 *    with "check it works with the inverter";
 *  - for each maker, the stack of its modules that reaches the size with the
 *    least to spare, then the fewest units (or the biggest it stacks to);
 *  - and when the nights are small, it says plainly that a battery wouldn't do
 *    much: the honest "less", never an upsell.
 */
import type { CatalogueBattery } from "./catalogue";
import { DAY } from "./quote";
import { MAX_BATTERY_QTY } from "./roof-design";
import { MONTH_DAYS } from "./tilt";

export interface BatterySuggestion {
  battery: CatalogueBattery;
  /** How many of it, stacked. */
  qty: number;
  /** The maker, written as people write it ("Sigenergy", "BYD"). */
  maker: string;
  why: string;
}

export interface BatterySuggestions {
  /** The size asked for, kWh (what it holds, not what it gives back). 0 when there is nothing to size. */
  size: number;
  /** One or two plain sentences on how the size was reached. */
  note: string;
  /** At most six, smallest total first. */
  suggestions: BatterySuggestion[];
}

/** Usable share of what a battery holds. */
const USABLE = DAY.batteryRoundTrip;
/** Below this many kWh of nights a battery has little to do. */
export const SMALL_NIGHTS_KWH = 4;
/** The most suggestions shown. */
const MAX_SUGGESTIONS = 6;

/** Makers the designer knows, as their names flatten (spaces and marks taken out). */
const MAKERS = [
  "sungrow",
  "sigenergy",
  "goodwe",
  "solaredge",
  "byd",
  "tesla",
  "fronius",
  "alphaess",
  "enphase",
  "huawei",
  "redback",
  "growatt",
];
/** Other ways a maker's name is written on price lists ("Sigen Energy Gateway"). */
const ALIASES: Record<string, string> = { sigen: "sigenergy" };

/** The maker a product is from: one the designer knows, by name with the spaces taken out, else the first word. */
export function makerOf(name: string): string {
  const flat = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const known = MAKERS.find((m) => flat.startsWith(m));
  if (known) return known;
  const alias = Object.keys(ALIASES).find((a) => flat.startsWith(a));
  if (alias) return ALIASES[alias];
  return (name.trim().split(/\s+/)[0] ?? "").toLowerCase();
}

const SPELLING: Record<string, string> = {
  byd: "BYD",
  goodwe: "GoodWe",
  solaredge: "SolarEdge",
  alphaess: "AlphaESS",
};
/** A maker as people write it. */
export function makerName(maker: string): string {
  return SPELLING[maker] ?? (maker ? maker[0].toUpperCase() + maker.slice(1) : "");
}

/** Whether an inverter takes a battery: its own flag when the list gives one, else its name. */
export function takesBattery(inverter: { name: string; hybrid?: boolean }): boolean {
  if (typeof inverter.hybrid === "boolean") return inverter.hybrid;
  return /hybrid|\bSH\d|sigenstor/i.test(inverter.name);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function suggestBatteries(input: {
  batteries: CatalogueBattery[];
  /** The inverters on the design, by name. */
  inverters: { name: string; hybrid?: boolean }[];
  /** What the design makes in each month, kWh (twelve figures, January first). */
  monthlyKwh: readonly number[];
  /** The home's daily use from the bill, kWh; null without a bill. */
  dailyKwh: number | null;
  /** The share of what the panels make that the home uses as it is made. */
  selfUseShare: number;
  /** The share of a day's use that is after dark. */
  eveningShare: number;
}): BatterySuggestions {
  const { selfUseShare, eveningShare } = input;
  const dailyKwh = input.dailyKwh !== null && input.dailyKwh > 0 ? input.dailyKwh : null;
  if (input.monthlyKwh.length !== 12 || !input.monthlyKwh.some((k) => k > 0)) return { size: 0, note: "", suggestions: [] };

  // What the panels have to spare on a day of each month, after the home's own use as it is made.
  const spare = input.monthlyKwh
    .map((kwh, m) => {
      const made = Math.max(0, kwh) / MONTH_DAYS[m];
      const used = dailyKwh ? Math.min(made * selfUseShare, dailyKwh * (1 - eveningShare)) : made * selfUseShare;
      return made - used;
    })
    .sort((a, b) => a - b);
  const middling = (spare[5] + spare[6]) / 2;
  const nights = dailyKwh ? dailyKwh * eveningShare : null;
  const usable = nights === null ? middling : Math.min(nights, middling);
  const size = r1(usable / USABLE);

  let note =
    nights === null
      ? `Sized to what the panels spare on a middling month, about ${r1(middling)} kWh a day. Add the customer's bill to size it to their nights.`
      : nights <= middling
        ? `Their nights use about ${r1(nights)} kWh (from the bill), and the panels spare about ${r1(middling)} kWh on a middling month, so it is sized to the nights.`
        : `Their nights use about ${r1(nights)} kWh (from the bill), but the panels spare only about ${r1(middling)} kWh on a middling month, so it is sized to what the roof can fill.`;
  if (nights !== null && nights < SMALL_NIGHTS_KWH) note += " That is a small night: a battery wouldn't do much for this home.";
  if (!(size > 0)) return { size: 0, note, suggestions: [] };

  // The inverter decides the maker, when the list has that maker's batteries.
  const fitted = input.inverters.map((i) => ({ maker: makerOf(i.name), hybrid: takesBattery(i) }));
  const sameMaker = input.batteries.filter((b) => fitted.some((f) => f.maker === makerOf(b.name)));
  const pool = sameMaker.length ? sameMaker : input.batteries;
  if (fitted.length && !fitted.some((f) => f.hybrid))
    note += " The inverter on the design doesn't take a battery: it needs a hybrid inverter.";

  const byMaker = new Map<string, CatalogueBattery[]>();
  for (const b of pool) {
    const maker = makerOf(b.name);
    byMaker.set(maker, [...(byMaker.get(maker) ?? []), b]);
  }

  const suggestions: BatterySuggestion[] = [];
  for (const [maker, products] of byMaker) {
    const stacks = products
      .filter((b) => b.kwh > 0)
      .map((b) => {
        const qty = Math.min(MAX_BATTERY_QTY, Math.max(1, Math.ceil(size / b.kwh - 1e-9)));
        return { battery: b, qty, total: r1(b.kwh * qty) };
      });
    const reaching = stacks.filter((s) => s.total >= size);
    const pick = reaching.length
      ? reaching.sort((a, b) => a.total - b.total || a.qty - b.qty)[0]
      : stacks.sort((a, b) => b.total - a.total || a.qty - b.qty)[0];
    if (!pick) continue;
    const short = pick.total < size;
    suggestions.push({
      battery: pick.battery,
      qty: pick.qty,
      maker: makerName(maker),
      why:
        `${pick.qty > 1 ? `${pick.qty} × ${pick.battery.kwh} kWh = ` : ""}${pick.total} kWh against about ${size} kWh asked for` +
        (short ? ": the most this one stacks to." : ".") +
        (sameMaker.length
          ? " The same maker as the inverter on the design."
          : fitted.length
            ? " Check it works with the inverter on the design."
            : ""),
    });
  }
  suggestions.sort((a, b) => a.battery.kwh * a.qty - b.battery.kwh * b.qty);
  return { size, note, suggestions: suggestions.slice(0, MAX_SUGGESTIONS) };
}
