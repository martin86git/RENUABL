/**
 * Homes that already have solar. The bill only shows what they buy from the
 * grid and what their panels export, so they're handled differently:
 * - expand: keep the existing panels; add a battery (and a few panels only if
 *   the current exports can't fill it). The inverter is checked on the call.
 * - replace: a full new system, sized to the home's real use.
 */
import type { BillSummary } from "./bill";
import type { EnergyProfile, ExistingSolarPlan, ExistingSolarSize } from "./types";

export const EXISTING_SIZE_OPTIONS: { value: ExistingSolarSize; label: string }[] = [
  { value: "under-5", label: "Under 5 kW" },
  { value: "5-10", label: "5–10 kW" },
  { value: "over-10", label: "Over 10 kW" },
  { value: "unsure", label: "I'm not sure" },
];

export const EXISTING_PLAN_OPTIONS: { value: ExistingSolarPlan; label: string; hint: string }[] = [
  { value: "expand", label: "Expand it", hint: "Keep my panels and add to them" },
  { value: "replace", label: "Replace it", hint: "Start fresh with a new system" },
];

export const EXPAND_DISCLAIMER =
  "We don't know which inverter your current system uses yet. We'll check it and your panels on your 15-minute confirmation call, and confirm exactly what you need before anything is final.";

/**
 * Share of an existing system's output a home typically uses itself; the rest
 * is exported. Used to estimate real use (the bill only shows grid purchases).
 * PLACEHOLDER: confirm with Primero.
 */
export const EXISTING_SELF_USE_SHARE = 0.3;

export type SolarSituation = "new" | "expand" | "replace";

/** How to treat this home: no existing solar, expanding it, or replacing it. */
export function solarSituation(bill: Pick<BillSummary, "hasSolar">, profile: Partial<EnergyProfile>): SolarSituation {
  if (!bill.hasSolar) return "new";
  if (profile.existingSize === "unsure") return profile.existingPlan === "replace" ? "replace" : "expand";
  return "expand"; // a known size: keep it and add a battery
}

/** Which existing-solar questions to show for this bill and these answers. */
export function existingSolarQuestions(bill: Pick<BillSummary, "hasSolar"> | null, profile: Partial<EnergyProfile>) {
  const hasSolar = Boolean(bill?.hasSolar);
  return { size: hasSolar, plan: hasSolar && profile.existingSize === "unsure" };
}

/** A battery is part of every expand option, so "Would you like a battery?" only matters otherwise. */
export function asksAboutBattery(bill: Pick<BillSummary, "hasSolar"> | null, profile: Partial<EnergyProfile>) {
  return !bill || solarSituation(bill, profile) !== "expand";
}

export const ROOF_OPTIONS: { value: "tin" | "tile" | "unsure"; label: string }[] = [
  { value: "tin", label: "Tin (Colorbond)" },
  { value: "tile", label: "Tiles" },
  { value: "unsure", label: "Not sure" },
];

export const STOREY_OPTIONS: { value: "single" | "double"; label: string }[] = [
  { value: "single", label: "Single storey" },
  { value: "double", label: "Double storey" },
];

export const PHASE_OPTIONS: { value: "single" | "three" | "unsure"; label: string }[] = [
  { value: "single", label: "Single phase" },
  { value: "three", label: "Three phase" },
  { value: "unsure", label: "Not sure" },
];

/** "About your home" is done once the bill is read and every question shown is answered. */
export function isAboutComplete(bill: BillSummary | null, profile: Partial<EnergyProfile>): boolean {
  if (!bill || !profile.roofType || !profile.storeys || !profile.phase) return false;
  const q = existingSolarQuestions(bill, profile);
  if (q.size && !profile.existingSize) return false;
  if (q.plan && !profile.existingPlan) return false;
  if (asksAboutBattery(bill, profile) && profile.wantsBattery === undefined) return false;
  return profile.ev !== undefined && profile.evPlanned !== undefined && profile.backup !== undefined;
}

/** Annual use including the solar a home already uses itself (for a replacement). */
export function realAnnualUse(bill: Pick<BillSummary, "annualUsageKwh" | "exportedDailyKwh">): number {
  const exported = (bill.exportedDailyKwh ?? 0) * 365;
  const selfUsed = (exported * EXISTING_SELF_USE_SHARE) / (1 - EXISTING_SELF_USE_SHARE);
  return Math.round(bill.annualUsageKwh + selfUsed);
}
