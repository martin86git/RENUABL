/**
 * Server only. Google Places API (New): address autocomplete and details,
 * limited to Australia. Needs GOOGLE_MAPS_API_KEY with "Places API (New)" enabled.
 */
import { addressFromComponents, placesProblem, type AddressComponent, type AddressSuggestion } from "@/lib/domain/address";
import type { Address } from "@/lib/domain/types";

const BASE = "https://places.googleapis.com/v1";

export class PlacesError extends Error {
  constructor(
    message: string,
    /** What to change in Google Cloud, in plain English. */
    readonly fix?: string,
  ) {
    super(message);
  }
}

async function refused(what: string, res: Response): Promise<PlacesError> {
  const problem = placesProblem(res.status, await res.text());
  return new PlacesError(`Places ${what} ${res.status} ${problem.reason}`, problem.fix);
}

export async function autocomplete(input: string, sessionToken: string, key: string): Promise<AddressSuggestion[]> {
  const res = await fetch(`${BASE}/places:autocomplete`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({
      input,
      sessionToken,
      includedRegionCodes: ["au"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw await refused("autocomplete", res);
  const json = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text?: { text: string };
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      };
    }[];
  };
  return (json.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
    .slice(0, 5)
    .map((p) => ({
      id: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

export async function placeAddress(placeId: string, sessionToken: string, key: string): Promise<Address | null> {
  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,addressComponents,location" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw await refused("details", res);
  const json = (await res.json()) as {
    id?: string;
    addressComponents?: AddressComponent[];
    location?: { latitude: number; longitude: number };
  };
  return addressFromComponents(json.addressComponents ?? [], {
    lat: json.location?.latitude,
    lng: json.location?.longitude,
    placeId: json.id ?? placeId,
  });
}
