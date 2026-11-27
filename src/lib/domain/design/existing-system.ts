/**
 * The system a home already has (27 Nov 2026, Martin: "our designer needs to also allow us to input the existing system
 * details, to be included in yield on battery only systems, or on systems where we are adding solar onto an existing.
 * its good to be able to input the existing inverter to know its output potential"; and "perhaps sol could also ask for
 * the information, when detecting an existing array"). Pure, tested.
 *
 * It is the home's, the same on every design of the roof (kept on the quote's form, `QuoteForm.existing`); whether a
 * design keeps it or takes it off is that design's own (`QuoteFields.existingOut`). Kept, what it makes is counted with
 * the design, and the home's real use is worked back from the bill, which only shows what was bought (`designFinance`).
 * Everything here is a rule of thumb: the panels are taken to face north at the usual pitch, with no shade.
 */

import { MONTH_DAYS, TILT, sunOnPlane, yearOnPlane } from "./tilt";

export interface ExistingSystem {
  /** kW of panels on the roof already; 0 when only a battery or an inverter is known. */
  kw: number;
  /** What its inverter is rated to put out, kW. */
  inverterKw?: number;
  /** The inverter as written on it: maker and model. */
  inverter?: string;
  /** A battery the home already has, kWh. */
  batteryKwh?: number;
}

export const EXISTING_LIMITS = { kw: 100, inverterKw: 100, batteryKwh: 200, inverter: 80 } as const;

/** The panels an inverter takes against its rating, by the usual rule (133%): VERIFY against the network's own. */
export const EXISTING_OVERSIZE = 1.33;

const amount = (v: unknown, most: number): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n <= most ? Math.round(n * 100) / 100 : 0;
};

/** An existing system from outside (a saved roof, the form, Sol's card), checked. Null when nothing of it is known. */
export function cleanExisting(raw: unknown): ExistingSystem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kw = amount(r.kw, EXISTING_LIMITS.kw);
  const inverterKw = amount(r.inverterKw, EXISTING_LIMITS.inverterKw);
  const batteryKwh = amount(r.batteryKwh, EXISTING_LIMITS.batteryKwh);
  const inverter =
    typeof r.inverter === "string"
      ? r.inverter
          .replace(/[\u0000-\u001f<>]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, EXISTING_LIMITS.inverter)
      : "";
  if (!kw && !inverterKw && !batteryKwh && !inverter) return null;
  return { kw, ...(inverterKw ? { inverterKw } : {}), ...(inverter ? { inverter } : {}), ...(batteryKwh ? { batteryKwh } : {}) };
}

/** The panels that count towards what it makes: never more than its inverter takes. */
export function countedKw(e: ExistingSystem): number {
  return e.inverterKw ? Math.min(e.kw, Math.round(e.inverterKw * EXISTING_OVERSIZE * 100) / 100) : e.kw;
}

/**
 * What the existing panels make in each month, kWh, as the designer works a design's out (`monthlyProduction`): the
 * site's yield for a north roof at the usual pitch, a month at a time.
 */
export function existingMonthly(e: ExistingSystem, yieldPerKwDay: number): number[] {
  const perSun = (countedKw(e) * yieldPerKwDay) / yearOnPlane(TILT.roof, 0);
  return sunOnPlane(TILT.roof, 0).map((sun, m) => Math.round(sun * perSun * MONTH_DAYS[m]));
}

/** What it makes on an average day of the year, kWh. */
export function existingDaily(e: ExistingSystem, yieldPerKwDay: number): number {
  return Math.floor((existingMonthly(e, yieldPerKwDay).reduce((n, k) => n + k, 0) / 365) * 10) / 10;
}

/** What `designFinance` is given for a home whose existing system stays: null with nothing that makes or stores power. */
export function existingForFinance(
  e: ExistingSystem | null | undefined,
  yieldPerKwDay: number,
): { monthlyKwh: number[]; batteryKwh: number } | null {
  if (!e || (!(e.kw > 0) && !e.batteryKwh)) return null;
  return { monthlyKwh: existingMonthly(e, yieldPerKwDay), batteryKwh: e.batteryKwh ?? 0 };
}

/**
 * The existing inverter's potential: what it puts out at most, and how many more kW of panels it could take by the
 * usual rule. Null when its rating isn't known.
 */
export function inverterRoom(e: ExistingSystem): { outKw: number; roomKw: number } | null {
  if (!e.inverterKw) return null;
  return { outKw: e.inverterKw, roomKw: Math.max(0, Math.round((e.inverterKw * EXISTING_OVERSIZE - e.kw) * 100) / 100) };
}

const kwWords = (n: number) => `${Math.round(n * 100) / 100} kW`;

/** The existing system in a line: "8.72 kW of panels on a 10 kW Sungrow inverter, with a 13.5 kWh battery". */
export function existingLine(e: ExistingSystem): string {
  const inverter = e.inverterKw
    ? `a ${kwWords(e.inverterKw)}${e.inverter ? ` ${e.inverter}` : ""} inverter`
    : e.inverter
      ? `a ${e.inverter} inverter`
      : "";
  const solar = e.kw > 0 ? `${kwWords(e.kw)} of panels${inverter ? ` on ${inverter}` : ""}` : inverter;
  const battery = e.batteryKwh ? `a ${e.batteryKwh} kWh battery` : "";
  return [solar, battery].filter(Boolean).join(solar && battery ? ", with " : "") || "Nothing known yet";
}

/** What its inverter can do, in words; empty when its rating isn't known. */
export function inverterWords(e: ExistingSystem): string {
  const room = inverterRoom(e);
  if (!room) return "";
  const out = `Its inverter puts out up to ${kwWords(room.outKw)}.`;
  if (!(e.kw > 0)) return out;
  if (e.kw > room.outKw * EXISTING_OVERSIZE + 0.005)
    return `${out} It has more panels than the usual ${Math.round(EXISTING_OVERSIZE * 100)}% of its rating, so ${kwWords(countedKw(e))} is counted.`;
  return room.roomKw >= 0.4
    ? `${out} By the usual ${Math.round(EXISTING_OVERSIZE * 100)}% rule it could take about ${kwWords(room.roomKw)} more panels: check its inputs and the network's limit.`
    : `${out} It is full: more panels need an inverter of their own.`;
}

/**
 * The existing system as a deal's detail line, for the business, the installer and the customer's proposal: what is
 * there, and whether it stays, when that is known. It is the home's own, never said to be supplied with the design.
 */
export function existingDetail(e: ExistingSystem, out?: boolean): string {
  return `${existingLine(e)}${out === undefined ? "" : out ? ", being replaced" : ", staying"}`;
}

/**
 * What the customer's proposal says of it, under the system's details: that it is theirs already, whether it stays, and
 * that the estimates count it (as a rule of thumb) while it does. No figure of ours, nothing supplied with it.
 */
export function existingForCustomer(e: ExistingSystem, out: boolean): string {
  const solar = e.kw > 0 ? `${kwWords(e.kw)} of solar panels` : "";
  const battery = e.batteryKwh ? `a ${e.batteryKwh} kWh battery` : "";
  const what = [solar, battery].filter(Boolean).join(" and ");
  if (!what) return "";
  const they = solar && battery ? "They" : solar ? "The panels" : "It";
  if (out) return `Your home already has ${what}. This system takes ${solar && battery ? "their" : solar ? "their" : "its"} place.`;
  return `Your home already has ${what}, which ${solar ? "stay" : "stays"} as ${solar ? "they are" : "it is"}. ${they} ${solar && battery ? "are" : solar ? "are" : "is"} not part of this system. The estimates here count what ${solar ? "the panels already there make" : "it stores"}, taken by rule of thumb${solar ? " as a north-facing roof with no shade" : ""}.`;
}

/** What keeping it or taking it off means for a design, under the choice. */
export const EXISTING_KEPT =
  "Kept: what it makes is counted with the design, and the home's real use is worked back from the bill (which only shows what they bought).";
export const EXISTING_REMOVED = "Removed: this design replaces it, so nothing of it is counted. The bill is read as it is.";

/** What Sol asks once he knows the existing panels are staying. */
export const EXISTING_DETAILS_QUESTION =
  "What's there now? With its size I can count what it makes in the yield and the savings, and its inverter tells me what it can still take.";
