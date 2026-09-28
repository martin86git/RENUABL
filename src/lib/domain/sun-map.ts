/**
 * The sun map: Google Solar's measured sunlight on the home's roof across a
 * year (annual flux, which already allows for direction, pitch and shade from
 * trees and buildings), coloured over the roof, with a plain-words summary.
 * It shows Google's measurements only, never where panels go. Pure and tested.
 */
import type { RoofFace, RoofInsights } from "./solar-roof";

/** Only the home's own roof: the patch of roof pixels touching the home's spot (neighbours' roofs are left out). */
export function homeRoof(mask: Uint8Array, width: number, height: number, at: { x: number; y: number }, searchPx = 60): Uint8Array {
  const out = new Uint8Array(width * height);
  // The roof pixel nearest the home's spot (the address point can sit just off the roof).
  const cx = Math.round(at.x);
  const cy = Math.round(at.y);
  let seed = -1;
  let bestD = Infinity;
  for (let y = Math.max(0, cy - searchPx); y <= Math.min(height - 1, cy + searchPx); y++) {
    for (let x = Math.max(0, cx - searchPx); x <= Math.min(width - 1, cx + searchPx); x++) {
      if (!mask[y * width + x]) continue;
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bestD) [bestD, seed] = [d, y * width + x];
    }
  }
  if (seed < 0) return out;
  const stack = [seed];
  out[seed] = 1;
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % width;
    const y = (p - x) / width;
    for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1]) {
      if (q >= 0 && mask[q] && !out[q]) {
        out[q] = 1;
        stack.push(q);
      }
    }
  }
  return out;
}

/** Less sun (deep blue) to most sun (warm yellow), for t from 0 to 1. */
export function sunColour(t: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0, [40, 48, 140]],
    [0.45, [150, 60, 150]],
    [0.75, [240, 120, 40]],
    [1, [255, 225, 70]],
  ];
  const v = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (v <= t1) {
      const f = (v - t0) / (t1 - t0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f)) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

/** Below this share of the roof's sunniest spots, a spot counts as shaded (or facing away). */
export const SHADED_BELOW = 0.6;

/**
 * The coloured overlay (RGBA, transparent off the roof), how much of the roof
 * is shaded, and the roof's box in pixels (left, top, right, bottom). Colours are relative to the roof's own sunniest spots (95th
 * percentile), so every home shows its best and worst parts clearly.
 */
export function sunOverlay(flux: Float32Array, roof: Uint8Array, width: number, height: number, alpha = 150) {
  const values: number[] = [];
  for (let i = 0; i < roof.length; i++) if (roof[i] && Number.isFinite(flux[i]) && flux[i] > 0) values.push(flux[i]);
  const rgba = new Uint8Array(width * height * 4);
  if (!values.length) return { rgba, shadedShare: null, roofPixels: 0, box: null };
  values.sort((a, b) => a - b);
  const top = values[Math.min(values.length - 1, Math.floor(values.length * 0.95))];
  let shaded = 0;
  const box: [number, number, number, number] = [width, height, 0, 0];
  for (let i = 0; i < roof.length; i++) {
    if (!roof[i] || !(flux[i] > 0)) continue;
    const x = i % width;
    const y = (i - x) / width;
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x + 1);
    box[3] = Math.max(box[3], y + 1);
    const t = flux[i] / top;
    if (t < SHADED_BELOW) shaded++;
    const [r, g, b] = sunColour((t - 0.3) / 0.7);
    rgba.set([r, g, b, alpha], i * 4);
  }
  return { rgba, shadedShare: shaded / values.length, roofPixels: values.length, box };
}

export type Direction = "north" | "east" | "south" | "west";

/** The compass quarter a roof face looks towards. */
export function directionOf(azimuth: number): Direction {
  const a = ((azimuth % 360) + 360) % 360;
  if (a >= 315 || a < 45) return "north";
  if (a < 135) return "east";
  if (a < 225) return "south";
  return "west";
}

export interface SunSummary {
  /** Roof area on faces that get good sun (at least 70% of the best face's), by direction, m². */
  sunnyByDirection: Partial<Record<Direction, number>>;
  /** Share of the roof that's shaded or faces away (0–1), from the sun map; null when unknown. */
  shadedShare: number | null;
}

export function sunSummary(insights: Pick<RoofInsights, "faces">, shadedShare: number | null): SunSummary {
  const best = Math.max(0, ...insights.faces.map((f: RoofFace) => f.sunshineHours ?? 0));
  const sunnyByDirection: Partial<Record<Direction, number>> = {};
  for (const f of insights.faces) {
    if (!best || (f.sunshineHours ?? 0) < best * 0.7) continue;
    const d = directionOf(f.azimuth);
    sunnyByDirection[d] = (sunnyByDirection[d] ?? 0) + f.areaM2;
  }
  return { sunnyByDirection, shadedShare };
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** "Most sun on the north-facing roof (about 60 m²), then east and west. About 20% is shaded or faces away." */
export function sunSummaryText(s: SunSummary): string[] {
  const dirs = (Object.entries(s.sunnyByDirection) as [Direction, number][]).filter(([, a]) => a >= 4).sort((a, b) => b[1] - a[1]);
  const lines: string[] = [];
  if (dirs.length) {
    const [first, ...rest] = dirs;
    const then = rest.map(([d]) => d);
    lines.push(
      `Most sun on the ${first[0]}-facing roof (about ${round5(first[1])} m²)${then.length ? `, then ${then.join(" and ")}` : ""}.`,
    );
  }
  if (s.shadedShare !== null) {
    const pct = Math.round(s.shadedShare * 20) * 5;
    lines.push(pct <= 5 ? "Very little of your roof is shaded." : `About ${pct}% of your roof is shaded or faces away from the sun.`);
  }
  return lines;
}

/** A roof box from untrusted JSON, inside an image of this size. */
export function cleanBox(raw: unknown, width: number, height: number): [number, number, number, number] | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const [x0, y0, x1, y1] = raw.map(Number);
  if (![x0, y0, x1, y1].every(Number.isFinite) || x0 < 0 || y0 < 0 || x1 > width || y1 > height || x1 <= x0 || y1 <= y0) return null;
  return [x0, y0, x1, y1];
}

/** A usable summary from untrusted JSON. */
export function cleanSunSummary(raw: unknown): SunSummary | null {
  const r = (raw ?? {}) as { sunnyByDirection?: Record<string, unknown>; shadedShare?: unknown };
  if (!r.sunnyByDirection || typeof r.sunnyByDirection !== "object") return null;
  const sunnyByDirection: Partial<Record<Direction, number>> = {};
  for (const d of ["north", "east", "south", "west"] as Direction[]) {
    const v = r.sunnyByDirection[d];
    if (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 100_000) sunnyByDirection[d] = v;
  }
  const sh = r.shadedShare;
  return { sunnyByDirection, shadedShare: typeof sh === "number" && sh >= 0 && sh <= 1 ? sh : null };
}
