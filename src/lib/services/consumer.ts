/**
 * Consumer-facing service layer. Every function here is the seam where a real
 * API replaces mock data; UI code should only talk to these functions.
 */
import { BILL_UPLOAD, isBillMediaType, type BillSummary } from "@/lib/domain/bill";
import { buildCallAvailability, type CallDay } from "@/lib/domain/booking";
import type { AddressSuggestion } from "@/lib/domain/address";
import type { CareBilling } from "@/lib/domain/care";
import type { ContactDetails, ContactErrors } from "@/lib/domain/contact";
import type { OrderEmail } from "@/lib/domain/emails";
import type { InverterSummary } from "@/lib/domain/inverter";
import type { RebateRates } from "@/lib/domain/rebates";
import type { Sunshine } from "@/lib/domain/sunshine";
import { LAUNCH_MARKET, todayInMarket } from "@/lib/domain/market";
import { ASSUMPTIONS } from "@/lib/domain/recommendation";
import { rankInstallers } from "@/lib/domain/matching";
import { buildAvailability } from "@/lib/domain/scheduling";
import type { Address, HomeAnalysis, ISODate, InstallerMatch } from "@/lib/domain/types";
import { INSTALLERS } from "@/lib/mock/installers";

/** Address suggestions as the customer types (Google Places; sample addresses in a preview without a key). */
export async function suggestAddresses(
  query: string,
  session: string,
  signal?: AbortSignal,
): Promise<{ suggestions: AddressSuggestion[]; source: "google" | "sample" }> {
  if (query.trim().length < 3) return { suggestions: [], source: "google" };
  try {
    const res = await fetch(`/api/address/search?q=${encodeURIComponent(query)}&session=${encodeURIComponent(session)}`, { signal });
    const json = (await res.json()) as { suggestions?: AddressSuggestion[]; source?: "google" | "sample" };
    return { suggestions: json.suggestions ?? [], source: json.source ?? "google" };
  } catch {
    return { suggestions: [], source: "google" };
  }
}

/** The full address for a picked suggestion. */
export async function resolveAddress(id: string, session: string): Promise<Address | null> {
  try {
    const res = await fetch(`/api/address/place?id=${encodeURIComponent(id)}&session=${encodeURIComponent(session)}`);
    const json = (await res.json()) as { address?: Address | null };
    return json.address ?? null;
  } catch {
    return null;
  }
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
async function prepareBillFile(file: File, keepUnder = 1_500_000): Promise<File> {
  if (file.type === "application/pdf" || (file.size < keepUnder && isBillMediaType(file.type))) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
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
  /** The order confirmation email went out. */
  emailed?: boolean;
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
  /** The order breakdown for the confirmation email. */
  order?: Omit<OrderEmail, "reference" | "firstName">;
  installDate?: ISODate | null;
}): Promise<ReserveResult> {
  try {
    const res = await fetch("/api/reserve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contact: input.contact, details: input.details, order: input.order, installDate: input.installDate }),
    });
    const json = (await res.json()) as {
      ok: boolean;
      reservationId?: string;
      emailed?: boolean;
      message?: string;
      errors?: ContactErrors;
    };
    if (!json.ok || !json.reservationId) return { ok: false, message: json.message, errors: json.errors };
    return {
      ok: true,
      reservation: {
        reservationId: json.reservationId,
        depositAfterCall: input.depositAfterCall,
        care: input.careIncluded ? null : input.care,
        careIncluded: input.careIncluded,
        emailed: json.emailed === true,
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

/**
 * Books the call picked in the in-app calendar: noted on the customer's HubSpot
 * record and emailed with a calendar invite. The booking stands even if that
 * follow-up fails.
 */
export async function bookConfirmationCall(
  slot: CallSlot,
  who: { reference?: string; email?: string; firstName?: string; label: string },
): Promise<CallSlot> {
  if (who.reference) {
    try {
      await fetch("/api/call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...who, ...slot }),
      });
    } catch {
      /* the booking is kept in the flow; RENUABL follows up */
    }
  }
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

export type InverterResult = { ok: true; inverter: InverterSummary } | { ok: false; message: string };

/** Sends photos of the customer's existing inverter to read its make, model and size. The photos aren't stored. */
export async function readInverterPhotos(files: File[]): Promise<InverterResult> {
  const body = new FormData();
  for (const f of files.slice(0, 3)) body.append("photos", await prepareBillFile(f, 1_000_000));
  try {
    const res = await fetch("/api/inverter", { method: "POST", body });
    const json = (await res.json()) as { ok: boolean; inverter?: InverterSummary; message?: string };
    return json.ok && json.inverter
      ? { ok: true, inverter: json.inverter }
      : { ok: false, message: json.message ?? "We couldn't read those photos." };
  } catch {
    return { ok: false, message: "We couldn't reach RENUABL. Check your connection and try again." };
  }
}

/** Today's rebate rules (live from the CER and Solar Victoria where possible). */
export async function fetchRebateRates(): Promise<RebateRates | null> {
  try {
    const res = await fetch("/api/rebates");
    return ((await res.json()) as { rates?: RebateRates }).rates ?? null;
  } catch {
    return null;
  }
}

/** NASA POWER sunshine for the home's coordinates. */
export async function fetchSunshine(lat: number, lng: number): Promise<Sunshine | null> {
  try {
    const res = await fetch(`/api/sunshine?lat=${lat}&lng=${lng}`);
    return ((await res.json()) as { sunshine?: Sunshine | null }).sunshine ?? null;
  } catch {
    return null;
  }
}
