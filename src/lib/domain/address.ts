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

/** RENUABL installs in Victoria first. */
export function inLaunchMarket(address: Pick<Address, "state">) {
  return address.state.toUpperCase() === LAUNCH_MARKET.state;
}
