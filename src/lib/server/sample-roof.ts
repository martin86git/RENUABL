/**
 * Server only. The real home the sample partner portal designs on (preview
 * only), so the Design tab can be tried with Google's roof data. Looked up once
 * through Google Places, so its position is Google's own, then kept in memory.
 */
import { randomUUID } from "node:crypto";
import { autocomplete, placeAddress } from "./google-places";

export const SAMPLE_ROOF_ADDRESS = "112 Leopold Street, South Yarra VIC 3141";

let found: Promise<{ lat: number; lng: number } | null> | null = null;

async function lookUp(): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return null;
  const session = randomUUID();
  const [first] = await autocomplete(SAMPLE_ROOF_ADDRESS, session, key);
  if (!first) return null;
  const address = await placeAddress(first.id, session, key);
  return typeof address?.lat === "number" && typeof address.lng === "number" ? { lat: address.lat, lng: address.lng } : null;
}

export function sampleRoofLocation() {
  found ??= lookUp().catch((e) => {
    console.error("sample roof lookup failed", e instanceof Error ? e.message : e);
    found = null; // try again next time
    return null;
  });
  return found;
}
