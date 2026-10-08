/**
 * Homes that already have solar. The bill only shows what they buy from the
 * grid and what their panels export, so they're handled differently:
 * - expand: keep the existing panels; add a battery (and a few panels only if
 *   the current exports can't fill it). The inverter is checked on the call.
 * - replace: a full new system, sized to the home's real use.
 */
import type { BillSummary } from "./bill";
import { describeInverter, type InverterSummary } from "./inverter";
import type { EnergyProfile, ExistingSolarPlan, ExistingSolarSize, FlatMount, RoofType } from "./types";

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

/** The note shown when expanding: the disclaimer, or what we read from the inverter photos. */
export function expandNote(inverter: InverterSummary | null): string {
  if (!inverter) return EXPAND_DISCLAIMER;
  return `Your current inverter: ${describeInverter(inverter)}${inverter.sample ? " (sample)" : ""}. We'll confirm it works with your new battery, and check your panels, on your 15-minute confirmation call before anything is final.`;
}

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

export const ROOF_OPTIONS: { value: RoofType; label: string }[] = [
  { value: "tin", label: "Tin (Colorbond)" },
  { value: "tile", label: "Tiles" },
  { value: "flat", label: "Flat" },
  { value: "unsure", label: "Not sure" },
];

/** Flat roofs: laid flat is the default; tilting depends on roof space and looks, both checked on the call. */
export const FLAT_MOUNT_OPTIONS: { value: FlatMount; label: string; hint: string }[] = [
  { value: "flat", label: "Laid flat", hint: "Low profile, hard to see" },
  { value: "tilt", label: "Tilted", hint: "More power, extra cost" },
];

export const FLAT_MOUNT_NOTE: Record<FlatMount, string> = {
  flat: "Panels laid flat make a little less power, so we've sized your system for that.",
  tilt: "Tilting needs room for all your panels, and tilted panels can be seen from the street. We'll check both on your call.",
};

export const PHASE_OPTIONS: { value: "single" | "three" | "unsure"; label: string }[] = [
  { value: "single", label: "Single phase" },
  { value: "three", label: "Three phase" },
  { value: "unsure", label: "Not sure" },
];

/** "About your home" is done once the bill is read and every question shown is answered. */
/**
 * Ready to continue: a bill (or spend range), the existing-solar questions when the bill shows panels, and the
 * battery question. Roof, storeys, phase, EVs and backup are optional (8 Oct 2026, to cut overwhelm): unanswered,
 * they're quoted as a tiled, single-storey, single-phase home with no EV or backup, and checked on the call.
 */
export function isAboutComplete(bill: BillSummary | null, profile: Partial<EnergyProfile>): boolean {
  if (!bill) return false;
  const q = existingSolarQuestions(bill, profile);
  if (q.size && !profile.existingSize) return false;
  if (q.plan && !profile.existingPlan) return false;
  return !(asksAboutBattery(bill, profile) && profile.wantsBattery === undefined);
}

/** One line for the optional details panel: what we've assumed, or what they told us. */
export function homeDetailsSummary(profile: Partial<EnergyProfile>): string {
  const roof = profile.roofType === "tin" ? "tin roof" : profile.roofType === "flat" ? "flat roof" : "tiled roof";
  const storeys = profile.storeys === "double" ? "double storey" : "single storey";
  const phase = profile.phase === "three" ? "three-phase power" : "single-phase power";
  const extras = [profile.ev && "an EV", profile.evPlanned && "an EV planned", profile.backup && "blackout backup"].filter(Boolean);
  return `${roof[0].toUpperCase()}${roof.slice(1)}, ${storeys}, ${phase}${extras.length ? `, ${extras.join(", ")}` : ""}.`;
}

/** Annual use including the solar a home already uses itself (for a replacement). */
export function realAnnualUse(bill: Pick<BillSummary, "annualUsageKwh" | "exportedDailyKwh">): number {
  const exported = (bill.exportedDailyKwh ?? 0) * 365;
  const selfUsed = (exported * EXISTING_SELF_USE_SHARE) / (1 - EXISTING_SELF_USE_SHARE);
  return Math.round(bill.annualUsageKwh + selfUsed);
}
