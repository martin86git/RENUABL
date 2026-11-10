/**
 * How full the design's battery gets on an average day, drawn on the battery itself in the designer (10 Nov 2026,
 * Martin: no line running from the panels to it; the battery fills as panels are laid, and when there aren't enough
 * panels for the home's use it isn't filled). Pure, tested. A rule of thumb, as the calculator's.
 *
 * What goes in is the least of: the day's spare solar once the home has used its share as it is made, what the battery
 * holds (less a module kept for blackouts), and, when the home's use is known, what it uses after dark (a battery
 * bigger than the evenings is never emptied, so never refilled past them).
 */
import { ASSUMPTIONS } from "../recommendation";

export interface BatteryFillInput {
  /** What the panels make on an average day, kWh. */
  solarDayKwh: number;
  /** What the home uses a day, kWh, when the bill is in. */
  homeDayKwh: number | null;
  /** The battery's size, kWh. */
  batteryKwh: number;
  /** Of it, kWh held for blackouts. */
  backupKwh?: number;
}

export interface BatteryFill {
  /** The share of the battery filled, 0 to 1. */
  share: number;
  /** kWh it takes in a day. */
  kwh: number;
  /** What stops it filling: the panels, the home's evenings, or nothing. */
  limit: "panels" | "evenings" | null;
}

export function batteryFill(input: BatteryFillInput): BatteryFill | null {
  const holds = Math.max(0, input.batteryKwh - (input.backupKwh ?? 0)) * ASSUMPTIONS.batteryUsableShare;
  if (!(holds > 0)) return null;
  const spare = Math.max(0, input.solarDayKwh) * (1 - ASSUMPTIONS.baseSelfConsumption);
  const evening = input.homeDayKwh && input.homeDayKwh > 0 ? input.homeDayKwh * ASSUMPTIONS.eveningShare : Infinity;
  const kwh = Math.min(spare, holds, evening);
  const limit = kwh >= holds - 0.05 ? null : spare <= evening ? "panels" : "evenings";
  return { share: Math.round((kwh / holds) * 100) / 100, kwh: Math.round(kwh * 10) / 10, limit };
}

/** What the battery's mark says when it isn't filled. */
export function batteryFillWords(fill: BatteryFill): string {
  const pct = Math.round(fill.share * 100);
  if (fill.limit === "panels") return `Fills about ${pct}% on an average day: more panels would fill it.`;
  if (fill.limit === "evenings") return `Fills about ${pct}%: the home's evenings don't use more.`;
  return "Fills on an average day.";
}
