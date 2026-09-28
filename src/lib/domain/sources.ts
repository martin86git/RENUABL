/**
 * The trusted sources named on "Setting up your plan", as tick circles. Only
 * sources actually used for this home are listed, and a tick means its data
 * has arrived. Wording stays "based on", never "exact".
 */
import { solarVictoriaApplies } from "./rebates";
import type { Address } from "./types";

export interface PlanCheck {
  id: "google" | "google-solar" | "nasa" | "sunshine-typical" | "cer" | "solar-vic";
  name: string;
  detail: string;
}

export const PLAN_HEADLINE = "How we're working out your energy plan.";
export const PLAN_ASSURANCE = "Your recommendation is built from our trusted data, not guesswork.";

export function planChecks(input: {
  address: Pick<Address, "state" | "placeId" | "lat" | "lng"> | null;
  /** NASA's sunshine didn't arrive: say typical local sunshine rather than credit NASA. */
  sunshineUnavailable?: boolean;
  /** Google's roof data arrived for this home (only then is it named). */
  roofData?: boolean;
}): PlanCheck[] {
  const { address } = input;
  const out: PlanCheck[] = [];
  if (address?.placeId && address.lat !== undefined && address.lng !== undefined) {
    out.push({ id: "google", name: "Google Maps", detail: "Locating your home" });
  }
  if (input.roofData) out.push({ id: "google-solar", name: "Google Solar", detail: "Satellite data for your roof and its sunshine" });
  out.push(
    address?.lat !== undefined && !input.sunshineUnavailable
      ? { id: "nasa", name: "NASA POWER", detail: "Satellite sunshine records for your home" }
      : { id: "sunshine-typical", name: "Local sunshine averages", detail: "Typical sunshine for your area" },
  );
  out.push({ id: "cer", name: "Clean Energy Regulator", detail: "Federal rebates for your postcode" });
  if (solarVictoriaApplies(address?.state ?? null)) {
    out.push({ id: "solar-vic", name: "Solar Victoria", detail: "Victorian rebates and interest-free loans" });
  }
  return out;
}
