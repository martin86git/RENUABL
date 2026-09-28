/**
 * The home's roof from Google's Solar API (buildingInsights): each roof face's
 * direction, pitch and area, and how many of our panels could fit. Used to
 * check the recommended system fits, and to brief the installation partner.
 * Pure and tested; the data is an estimate from aerial imagery, confirmed on site.
 */
import { PANEL } from "./catalogue";

export interface RoofFace {
  /** Degrees from north, clockwise (0 = north-facing). */
  azimuth: number;
  pitch: number;
  areaM2: number;
  /** Median sunshine hours a year on this face. */
  sunshineHours: number | null;
}

export interface RoofInsights {
  faces: RoofFace[];
  /** Roof area Google considers usable for panels. */
  usableAreaM2: number;
  /** How many of RENUABL's panels could fit on that area. */
  panelsThatFit: number;
  sunshineHoursPerYear: number | null;
  imageryDate: string | null;
  imageryQuality: "HIGH" | "MEDIUM" | "LOW" | "BASE" | null;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Our panels fill Google's usable area less tightly than its own layout: allow for gaps and edge setbacks. */
export const PANEL_PACKING = 0.9;

/** Reads a buildingInsights response. Null when it has no usable roof. */
export function parseBuildingInsights(raw: unknown): RoofInsights | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sp = (r.solarPotential ?? {}) as Record<string, unknown>;
  const usable = num(sp.maxArrayAreaMeters2);
  if (!usable || usable <= 0) return null;
  const segments = Array.isArray(sp.roofSegmentStats) ? sp.roofSegmentStats : [];
  const faces: RoofFace[] = segments
    .map((s) => {
      const seg = (s ?? {}) as Record<string, unknown>;
      const stats = (seg.stats ?? {}) as Record<string, unknown>;
      const q = Array.isArray(stats.sunshineQuantiles) ? (stats.sunshineQuantiles as unknown[]).map(num) : [];
      return {
        azimuth: Math.round((((num(seg.azimuthDegrees) ?? 0) % 360) + 360) % 360),
        pitch: Math.round(num(seg.pitchDegrees) ?? 0),
        areaM2: Math.round(num(stats.areaMeters2) ?? 0),
        sunshineHours: q.length ? Math.round(q[Math.floor(q.length / 2)] ?? 0) || null : null,
      };
    })
    .filter((f) => f.areaM2 >= 4)
    .sort((a, b) => b.areaM2 - a.areaM2);
  const d = (r.imageryDate ?? {}) as Record<string, unknown>;
  const y = num(d.year);
  const m = num(d.month);
  const quality = r.imageryQuality;
  return {
    faces,
    usableAreaM2: Math.round(usable),
    panelsThatFit: Math.floor((usable * PANEL_PACKING) / (PANEL.heightM * PANEL.widthM)),
    sunshineHoursPerYear: num(sp.maxSunshineHoursPerYear) ? Math.round(num(sp.maxSunshineHoursPerYear)!) : null,
    imageryDate: y && m ? `${y}-${String(m).padStart(2, "0")}` : null,
    imageryQuality: quality === "HIGH" || quality === "MEDIUM" || quality === "LOW" || quality === "BASE" ? quality : null,
  };
}

const POINTS = ["North", "North-east", "East", "South-east", "South", "South-west", "West", "North-west"];

/** "North-facing", "West-facing", … */
export function facing(azimuth: number) {
  return `${POINTS[Math.round((((azimuth % 360) + 360) % 360) / 45) % 8]}-facing`;
}

export type RoofFit = "comfortable" | "snug" | "check";

/** Whether the system's panels fit: comfortably, only just (confirm the layout), or check on the call. */
export function roofFit(insights: RoofInsights, panelCount: number): RoofFit {
  if (panelCount <= 0) return "comfortable";
  if (panelCount <= insights.panelsThatFit * 0.85) return "comfortable";
  if (panelCount <= insights.panelsThatFit) return "snug";
  return "check";
}

/** The roof in one line for customers: "Room for about 26 panels · mostly north-facing · 20° pitch". */
export function roofSummary(insights: RoofInsights) {
  const main = insights.faces[0];
  return [
    `Room for about ${insights.panelsThatFit} panels`,
    main ? `mostly ${facing(main.azimuth).toLowerCase()}` : null,
    main ? `${main.pitch}° pitch` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export const ROOF_FIT_NOTE: Record<RoofFit, string> = {
  comfortable: "Your system fits comfortably.",
  snug: "It's a snug fit. Your installation partner will confirm the panel layout on your call.",
  check: "Your roof looks tight for this many panels. We'll check the layout together on your call before anything is locked in.",
};
