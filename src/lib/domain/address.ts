/** Turning a Google Places result into a RENUABL address. Pure and tested. */
import type { Address } from "./types";
import { LAUNCH_MARKET } from "./market";

export interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

export interface AddressSuggestion {
  id: string;
  main: string;
  secondary: string;
}

function part(components: AddressComponent[], type: string, short = false) {
  const c = components.find((x) => x.types?.includes(type));
  return (short ? c?.shortText : c?.longText) ?? c?.longText ?? "";
}

/** A street address from Google's address components, or null if it isn't a street address. */
export function addressFromComponents(
  components: AddressComponent[],
  extra: { lat?: number; lng?: number; placeId?: string } = {},
): Address | null {
  const unit = part(components, "subpremise");
  const number = part(components, "street_number");
  const street = part(components, "route");
  const suburb = part(components, "locality") || part(components, "sublocality") || part(components, "postal_town");
  const state = part(components, "administrative_area_level_1", true);
  const postcode = part(components, "postal_code");
  if (!number || !street || !suburb || !state) return null;
  const line = `${unit ? `${unit}/` : ""}${number} ${street}`;
  return { line, suburb, state, postcode, ...extra };
}

const STATE_NAMES: Record<string, string> = {
  NSW: "New South Wales",
  QLD: "Queensland",
  SA: "South Australia",
  WA: "Western Australia",
  TAS: "Tasmania",
  NT: "the Northern Territory",
  ACT: "the ACT",
  VIC: "Victoria",
};

/** What we say when someone enters an address outside the launch market: plainly, without blaming them. */
export function outsideMarketMessage(address: Pick<Address, "state" | "suburb">): { title: string; body: string } {
  const where = address.suburb?.trim() || STATE_NAMES[address.state.toUpperCase()] || "your area";
  return {
    title: `Sorry, we're not servicing ${where} at this time.`,
    body: `RENUABL is installing in ${LAUNCH_MARKET.name} for now. We're working on more areas and hope to be with you soon.`,
  };
}

/** RENUABL installs in Victoria first. */
export function inLaunchMarket(address: Pick<Address, "state">) {
  return address.state.toUpperCase() === LAUNCH_MARKET.state;
}

/** What to fix in Google Cloud when Places refuses a request, from Google's error reason. */
export function placesProblem(status: number, body: string): { reason: string; fix: string } {
  let reason = "";
  let message = "";
  try {
    const err = (JSON.parse(body) as { error?: { message?: string; status?: string; details?: { reason?: string }[] } }).error;
    reason = err?.details?.find((d) => d.reason)?.reason ?? err?.status ?? "";
    message = err?.message ?? "";
  } catch {
    message = body;
  }
  const text = `${reason} ${message}`;
  const fix = /API_KEY_INVALID|key not valid/i.test(text)
    ? "The key isn't valid. Copy it again from Google Cloud → Credentials (no spaces or quotes) into GOOGLE_MAPS_API_KEY, then redeploy."
    : /SERVICE_DISABLED|has not been used|is disabled/i.test(text)
      ? "Places API (New) isn't enabled for the key's project. Google Cloud → APIs & Services → Library → Places API (New) → Enable (the older \"Places API\" doesn't count)."
      : /BILLING/i.test(text)
        ? "Billing isn't enabled. Google Cloud → Billing → link a billing account to this project."
        : /REFERRER|referer|IP_ADDRESS|IP address|ANDROID|IOS/i.test(text)
          ? "The key has an application restriction. Credentials → the key → Application restrictions → None (the lookups run on Vercel's servers)."
          : /API_KEY_SERVICE_BLOCKED|blocked/i.test(text)
            ? "The key's API restrictions don't allow Places API (New). Credentials → the key → API restrictions → tick Places API (New)."
            : status === 429 || /QUOTA|RESOURCE_EXHAUSTED/i.test(text)
              ? "Google's quota is used up. Check quotas under APIs & Services → Places API (New)."
              : "Google refused the request. The reason is shown above.";
  return { reason: (reason || `HTTP ${status}`) + (message ? `: ${message.slice(0, 160)}` : ""), fix };
}
