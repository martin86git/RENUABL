/**
 * Consumer-facing service layer. Every function here is the seam where a real
 * API replaces mock data; UI code should only talk to these functions.
 */
import { BILL_UPLOAD, isBillMediaType, type BillSummary } from "@/lib/domain/bill";
import type { CareBilling } from "@/lib/domain/care";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { rankInstallers } from "@/lib/domain/matching";
import { buildAvailability, stableHash } from "@/lib/domain/scheduling";
import type { Address, HomeAnalysis, InstallerMatch } from "@/lib/domain/types";
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

export type BillResult = { ok: true; bill: BillSummary } | { ok: false; message: string };

/** Shrinks large phone photos so they upload quickly and stay under the size limit. */
async function prepareBillFile(file: File): Promise<File> {
  if (file.type === "application/pdf" || (file.size < 1_500_000 && isBillMediaType(file.type))) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], "bill.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file; // e.g. a format the browser can't decode; the server will say so
  }
}

/** Sends the customer's bill to RENUABL to read their usage. The file isn't stored. */
export async function readEnergyBill(file: File): Promise<BillResult> {
  const prepared = await prepareBillFile(file);
  if (prepared.size > BILL_UPLOAD.maxBytes) {
    return { ok: false, message: "That file is too large. Try the PDF from your retailer's email, or a photo." };
  }
  const body = new FormData();
  body.append("bill", prepared);
  try {
    const res = await fetch("/api/bill", { method: "POST", body });
    const json = (await res.json()) as BillResult;
    return json.ok && json.bill ? json : { ok: false, message: json.ok ? "We couldn't read that bill." : json.message };
  } catch {
    return { ok: false, message: "We couldn't reach RENUABL. Check your connection and try again." };
  }
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
