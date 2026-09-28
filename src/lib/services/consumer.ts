/**
 * Consumer-facing service layer. Every function here is the seam where a real
 * API replaces mock data; UI code should only talk to these functions.
 */
import { cleanGeoFrame, type GeoFrame, type RoofModel } from "@/lib/domain/roof-layout";
import { cleanBox, cleanSunSummary, type SunSummary } from "@/lib/domain/sun-map";
import type { RoofInsights } from "@/lib/domain/solar-roof";
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
import { customerNetwork, rankInstallers } from "@/lib/domain/matching";
import { buildAvailability } from "@/lib/domain/scheduling";
import type { Address, HomeAnalysis, ISODate, InstallerMatch } from "@/lib/domain/types";
import { PREVIEW_MODE } from "@/lib/config";
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
export async function prepareBillFile(file: File, keepUnder = 1_500_000): Promise<File> {
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

/** The installers customers can be matched with: the demo's fictional ones only in preview. */
const NETWORK = customerNetwork(INSTALLERS, PREVIEW_MODE);

export function matchInstallers(postcode: string): InstallerMatch[] {
  const ranked = rankInstallers(NETWORK, postcode);
  // Fall back to the whole network rather than dead-ending the customer.
  return ranked.length ? ranked : rankInstallers(NETWORK, "");
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
  /** The home, system and site, for the job offered to installation partners. */
  job?: unknown;
}): Promise<ReserveResult> {
  try {
    const res = await fetch("/api/reserve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contact: input.contact,
        details: input.details,
        order: input.order,
        installDate: input.installDate,
        job: input.job,
      }),
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

/** Asks RENUABL for a Stripe Checkout Session for the deposit; returns its client secret for the embedded form. */
export async function startDepositPayment(
  reference: string,
  email: string | null,
): Promise<{ ok: true; clientSecret: string } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/deposit/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference, email }),
    });
    const json = (await res.json()) as { ok: boolean; client_secret?: string; message?: string };
    return json.ok && json.client_secret
      ? { ok: true, clientSecret: json.client_secret }
      : { ok: false, message: json.message ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false, message: "We couldn't reach RENUABL. Check your connection and try again." };
  }
}

/** The backup: a link to Stripe's own payment page for the deposit. */
export async function startHostedDepositPayment(
  reference: string,
  email: string | null,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/deposit/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference, email, hosted: true }),
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

/** The home's roof from Google's Solar API (figures and panel spots), or why there isn't one. */
export async function fetchRoofInsights(
  lat: number,
  lng: number,
): Promise<{ insights: RoofInsights | null; model: RoofModel | null; reason?: string }> {
  try {
    const res = await fetch(`/api/roof?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`);
    const json = (await res.json()) as { ok: boolean; roof?: RoofInsights; model?: RoofModel | null; reason?: string };
    if (json.ok && json.roof) return { insights: json.roof, model: json.model ?? null };
    return { insights: null, model: null, reason: json.reason ?? (res.status === 429 ? "too many lookups" : "unavailable") };
  } catch {
    return { insights: null, model: null, reason: "offline" };
  }
}

/**
 * Google Solar's own photo of the roof: its grid, for placing panels on it, and
 * where to draw the sharper satellite photo so it lines up (null: no clear match).
 * Null altogether when there's no Google Solar photo: use the satellite view as it is.
 */
export async function fetchRoofPhotoFrame(
  lat: number,
  lng: number,
): Promise<{ frame: GeoFrame; shift: { x: number; y: number } | null } | null> {
  try {
    const res = await fetch(`/api/roof/photo?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}&frame=1`);
    if (!res.ok) return null;
    const json = (await res.json()) as { frame?: unknown; shift?: { x?: unknown; y?: unknown } | null };
    const frame = cleanGeoFrame(json.frame);
    if (!frame) return null;
    const { x, y } = json.shift ?? {};
    const ok = typeof x === "number" && typeof y === "number" && Math.abs(x) <= 200 && Math.abs(y) <= 200;
    return { frame, shift: ok ? { x, y } : null };
  } catch {
    return null;
  }
}

/** The home's sun map: its grid, the summary, and where to draw the sharp satellite photo (null: Google Solar's photo). */
export async function fetchSunMap(
  lat: number,
  lng: number,
): Promise<{
  frame: GeoFrame;
  summary: SunSummary;
  box: [number, number, number, number];
  shift: { x: number; y: number } | null;
} | null> {
  try {
    const res = await fetch(`/api/roof/sun?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}&frame=1`);
    if (!res.ok) return null;
    const json = (await res.json()) as { frame?: unknown; summary?: unknown; box?: unknown; shift?: { x?: unknown; y?: unknown } | null };
    const frame = cleanGeoFrame(json.frame);
    const summary = cleanSunSummary(json.summary);
    const box = frame && cleanBox(json.box, frame.width, frame.height);
    if (!frame || !summary || !box) return null;
    const { x, y } = json.shift ?? {};
    const ok = typeof x === "number" && typeof y === "number" && Math.abs(x) <= 200 && Math.abs(y) <= 200;
    return { frame, summary, box, shift: ok ? { x, y } : null };
  } catch {
    return null;
  }
}

export function sunMapSrc(lat: number, lng: number) {
  return `/api/roof/sun?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`;
}

export function roofPhotoSrc(lat: number, lng: number) {
  return `/api/roof/photo?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`;
}

/** The satellite image under the customer's panel layout. */
export function roofImageSrc(lat: number, lng: number) {
  return `/api/roof/image?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`;
}
