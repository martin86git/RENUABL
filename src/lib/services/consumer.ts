/**
 * Consumer-facing service layer. Every function here is the seam where a real
 * API replaces mock data; UI code should only talk to these functions.
 */
import type { CareBilling } from "@/lib/domain/care";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { rankInstallers } from "@/lib/domain/matching";
import { buildAvailability, stableHash } from "@/lib/domain/scheduling";
import type { Address, HomeAnalysis, InstallerMatch } from "@/lib/domain/types";
import { SAMPLE_ADDRESSES } from "@/lib/mock/addresses";
import { PROOF_POINTS, TESTIMONIALS } from "@/lib/mock/brand";
import { INSTALLERS } from "@/lib/mock/installers";

const latency = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export function searchAddresses(query: string): Address[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return SAMPLE_ADDRESSES.filter((a) => `${a.line} ${a.suburb} ${a.postcode}`.toLowerCase().includes(q)).slice(0, 5);
}

/** Best-effort parse for free-text addresses not in the autocomplete list. */
export function parseAddress(input: string): Address | null {
  const text = input.trim();
  if (text.length < 6) return null;
  const postcode = text.match(/\b(\d{4})\b/)?.[1] ?? LAUNCH_MARKET.capitalPostcode;
  const state = text.match(/\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/i)?.[1]?.toUpperCase() ?? LAUNCH_MARKET.state;
  const [line, rest = ""] = text.split(",");
  const suburb =
    rest
      .replace(/\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/i, "")
      .replace(/\d{4}/, "")
      .trim() || LAUNCH_MARKET.capital;
  return { line: line.trim(), suburb, state, postcode };
}

/** Steps shown while RENUABL analyses a home. */
export const ANALYSIS_STEPS = [
  "Checking roof size & orientation",
  "Analysing solar potential",
  "Local weather patterns",
  "Electricity usage",
  "Personalising your results",
] as const;

/**
 * Mock home analysis. In production this comes from roof imagery, solar
 * irradiance and network data for the address.
 */
export function analyseHome(address: Address | null): HomeAnalysis {
  const h = stableHash(address ? `${address.line}${address.postcode}` : "default");
  return {
    storeys: h % 3 === 0 ? "double" : "single",
    roof: ["Colorbond, 20° pitch", "Terracotta tile, 22° pitch", "Concrete tile, 18° pitch"][h % 3],
    orientation: ["North", "North / west split", "North-east"][(h >> 3) % 3],
    maxPanels: 30 + (h % 7),
  };
}

export function matchInstallers(postcode: string): InstallerMatch[] {
  const ranked = rankInstallers(INSTALLERS, postcode);
  // Fall back to the whole network rather than dead-ending the customer.
  return ranked.length ? ranked : rankInstallers(INSTALLERS, "");
}

export function getInstaller(id: string) {
  return INSTALLERS.find((i) => i.id === id);
}

export function getAvailability(installerId: string, from = new Date()) {
  return buildAvailability(installerId, from);
}

export type PaymentMethod = "card" | "apple-pay" | "google-pay" | "bank-transfer";

export interface ReservationResult {
  reservationId: string;
  amount: number;
  method: PaymentMethod;
  /** RENUABL Care chosen at checkout; billed only after switch-on. */
  care: CareBilling | null;
  /** 12 months of RENUABL Care included free with the top package. */
  careIncluded: boolean;
}

export async function reserveDeposit(
  amount: number,
  method: PaymentMethod,
  care: CareBilling | null = null,
  careIncluded = false,
): Promise<ReservationResult> {
  await latency(900);
  return {
    reservationId: `RN-${Math.floor(1000 + Math.random() * 9000)}`,
    amount,
    method,
    care: careIncluded ? null : care,
    careIncluded,
  };
}

export function getProofPoints() {
  return PROOF_POINTS;
}

export function getTestimonials() {
  return TESTIMONIALS;
}
