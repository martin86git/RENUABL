/**
 * Consumer-facing service layer. Every function here is the seam where a real
 * API replaces mock data; UI code should only talk to these functions.
 */
import { rankInstallers } from "@/lib/domain/matching";
import { buildAvailability, buildCallSlots } from "@/lib/domain/scheduling";
import type { Address, InstallerMatch } from "@/lib/domain/types";
import { SAMPLE_ADDRESSES } from "@/lib/mock/addresses";
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
  const postcode = text.match(/\b(\d{4})\b/)?.[1] ?? "2000";
  const state = text.match(/\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/i)?.[1]?.toUpperCase() ?? "NSW";
  const [line, rest = ""] = text.split(",");
  const suburb =
    rest
      .replace(/\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/i, "")
      .replace(/\d{4}/, "")
      .trim() || "Sydney";
  return { line: line.trim(), suburb, state, postcode };
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

export function getCallSlots(from = new Date()) {
  return buildCallSlots(from);
}

export interface ReservationResult {
  reservationId: string;
  amount: number;
  method: PaymentMethod;
}

export type PaymentMethod = "apple-pay" | "google-pay" | "card";

export async function reserveDeposit(amount: number, method: PaymentMethod): Promise<ReservationResult> {
  await latency(900);
  return {
    reservationId: `RN-${Math.floor(1000 + Math.random() * 9000)}`,
    amount,
    method,
  };
}

export async function bookConfirmationCall(date: string, time: string) {
  await latency(500);
  return { date, time, confirmed: true as const };
}
