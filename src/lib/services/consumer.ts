/**
 * Consumer-facing service layer. Every function here is the seam where a real
 * API replaces mock data; UI code should only talk to these functions.
 */
import { BILL_UPLOAD, isBillMediaType, type BillSummary } from "@/lib/domain/bill";
import { buildCallAvailability, type CallDay } from "@/lib/domain/booking";
import type { CareBilling } from "@/lib/domain/care";
import type { ContactDetails, ContactErrors } from "@/lib/domain/contact";
import { LAUNCH_MARKET, todayInMarket } from "@/lib/domain/market";
import { ASSUMPTIONS } from "@/lib/domain/recommendation";
import { rankInstallers } from "@/lib/domain/matching";
import { buildAvailability } from "@/lib/domain/scheduling";
import type { Address, HomeAnalysis, ISODate, InstallerMatch } from "@/lib/domain/types";
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

/**
 * Steps shown after the address is entered. Only claim what actually happens
 * here: no roof or usage checks (the roof is confirmed on the call, usage comes
 * from the bill on the next step).
 */
export const ANALYSIS_STEPS = ["Finding your home", "Checking we install in your area", "Loading local sunshine averages"] as const;

/**
 * What we know about the home from its address. Nothing is measured yet: no
 * roof data source is connected, so the roof, storeys and space for panels
 * are confirmed on the 15-minute call. Sizing is capped by the inverter only.
 */
export function analyseHome(address: Address | null): HomeAnalysis {
  void address;
  return { storeys: "single", roof: "To be confirmed", orientation: "To be confirmed", maxPanels: ASSUMPTIONS.maxPanels };
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

export interface ReservationResult {
  reservationId: string;
  /** Deposit taken after the confirmation call (nothing is charged to reserve). */
  depositAfterCall: number;
  /** RENUABL Care chosen at checkout; billed only after switch-on. */
  care: CareBilling | null;
  /** 12 months of RENUABL Care included free with the top package. */
  careIncluded: boolean;
}

export type ReserveResult = { ok: true; reservation: ReservationResult } | { ok: false; message?: string; errors?: ContactErrors };

/**
 * Reserves the install date with the customer's contact details. Nothing is
 * charged; the reservation (and lead) goes to RENUABL's CRM.
 */
export async function reserveInstall(input: {
  contact: ContactDetails;
  details: Record<string, string | undefined>;
  depositAfterCall: number;
  care: CareBilling | null;
  careIncluded: boolean;
}): Promise<ReserveResult> {
  try {
    const res = await fetch("/api/reserve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contact: input.contact, details: input.details }),
    });
    const json = (await res.json()) as { ok: boolean; reservationId?: string; message?: string; errors?: ContactErrors };
    if (!json.ok || !json.reservationId) return { ok: false, message: json.message, errors: json.errors };
    return {
      ok: true,
      reservation: {
        reservationId: json.reservationId,
        depositAfterCall: input.depositAfterCall,
        care: input.careIncluded ? null : input.care,
        careIncluded: input.careIncluded,
      },
    };
  } catch {
    return { ok: false, message: "We couldn't reach RENUABL. Check your connection and try again." };
  }
}

/** Open times for the 15-minute confirmation call (before the install date). */
export function getCallAvailability(installDate: ISODate | null): CallDay[] {
  return buildCallAvailability(todayInMarket(), installDate);
}

export interface CallSlot {
  date: ISODate;
  time: string;
}

/** Mock: in production this books the slot in RENUABL's HubSpot calendar and emails an invite. */
export async function bookConfirmationCall(slot: CallSlot): Promise<CallSlot> {
  await latency(700);
  return slot;
}

/** Asks RENUABL for a Stripe payment page for the deposit. */
export async function startDepositPayment(
  reference: string,
  email: string | null,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/deposit/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference, email }),
    });
    const json = (await res.json()) as { ok: boolean; url?: string; message?: string };
    return json.ok && json.url
      ? { ok: true, url: json.url }
      : { ok: false, message: json.message ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false, message: "We couldn't reach RENUABL. Check your connection and try again." };
  }
}
