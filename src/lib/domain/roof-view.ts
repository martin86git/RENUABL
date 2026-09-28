/**
 * The satellite view of a job's roof, from Google's Maps Static API. Built on
 * the server only (the key never reaches the browser), centred on the home's
 * coordinates or, without them, its address. Pure and tested.
 */
import type { Address } from "./types";

export type RoofViewSize = "wide" | "thumb" | "design";

/** Pixel sizes before Google's 2x scale: a banner, and a square for lists. */
export const ROOF_VIEW_SIZES: Record<RoofViewSize, { w: number; h: number; zoom: number }> = {
  wide: { w: 640, h: 360, zoom: 20 },
  thumb: { w: 200, h: 200, zoom: 20 },
  /** For panel layouts: must match designView() in roof-layout.ts. */
  design: { w: 640, h: 640, zoom: 20 },
};

export function isRoofViewSize(v: unknown): v is RoofViewSize {
  return v === "wide" || v === "thumb" || v === "design";
}

export function roofViewUrl(address: Address, size: RoofViewSize, key: string): string | null {
  const centre =
    typeof address.lat === "number" && typeof address.lng === "number"
      ? `${address.lat.toFixed(6)},${address.lng.toFixed(6)}`
      : [address.line, address.suburb, address.state, address.postcode].filter(Boolean).join(", ");
  if (!centre || !key) return null;
  const s = ROOF_VIEW_SIZES[size];
  const params = new URLSearchParams({
    center: centre,
    zoom: String(s.zoom),
    size: `${s.w}x${s.h}`,
    scale: "2",
    maptype: "satellite",
    format: "jpg",
    key,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}
