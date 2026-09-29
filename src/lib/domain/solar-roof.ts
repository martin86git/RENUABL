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
  /** The middle of the building Google matched (older cached lookups don't have it). */
  center?: { lat: number; lng: number } | null;
}

/**
 * Google returns the building closest to the address point, which can be a
 * neighbour's when the point sits off the home (e.g. on the street). Farther
 * than this from the address, the building isn't trusted to be the home.
 */
export const HOME_MATCH_METRES = 30;

/** Metres between two nearby points (flat-earth approximation, fine at house scale). */
export function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dy = (a.lat - b.lat) * 111_320;
  const dx = (a.lng - b.lng) * 111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

/** The most panels to recommend: the inverter limit, or fewer when the roof data says fewer fit (never below the minimum system). */
export function roofPanelLimit(inverterLimit: number, panelsThatFit: number | null | undefined, minPanels = 0) {
  return typeof panelsThatFit === "number" && panelsThatFit > 0
    ? Math.max(minPanels, Math.min(inverterLimit, panelsThatFit))
    : inverterLimit;
}

/** Whether the building Google matched is plausibly the home at this address. */
export function isThisHome(insights: Pick<RoofInsights, "center">, lat: number, lng: number) {
  return !insights.center || metresBetween(insights.center, { lat, lng }) <= HOME_MATCH_METRES;
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
  const c = (r.center ?? {}) as Record<string, unknown>;
  const [clat, clng] = [num(c.latitude), num(c.longitude)];
  return {
    center: clat !== null && clng !== null ? { lat: clat, lng: clng } : null,
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

/**
 * The roof in one line for customers: "Mostly north-facing · 20° pitch". No
 * panel count: how many fit is worked out on the confirmation call.
 */
export function roofSummary(insights: RoofInsights) {
  const main = insights.faces[0];
  if (!main) return "";
  return `Mostly ${facing(main.azimuth).toLowerCase()} · ${main.pitch}° pitch`;
}

/**
 * Typical sunshine on the parts of the roof panels would go: the faces that get
 * at least 70% of the sunniest face's sun, weighted by their area.
 */
export function usableRoofSunHours(insights: RoofInsights): number | null {
  const lit = insights.faces.filter((f) => f.sunshineHours);
  if (!lit.length) return insights.sunshineHoursPerYear;
  const best = Math.max(...lit.map((f) => f.sunshineHours!));
  const good = lit.filter((f) => f.sunshineHours! >= best * 0.7);
  const area = good.reduce((s, f) => s + f.areaM2, 0);
  return area ? Math.round(good.reduce((s, f) => s + f.sunshineHours! * f.areaM2, 0) / area) : null;
}

/** "1/112 Leopold St", "Unit 3, …", "Apt 4 …": the roof is probably shared with neighbours. */
export function isUnitAddress(line: string | undefined): boolean {
  return /^\s*\w+\s*\/\s*\d/.test(line ?? "") || /\b(unit|apartment|apt|flat|townhouse|suite)\b/i.test(line ?? "");
}

export const SHARED_ROOF_NOTE =
  "Live in a unit or townhouse? The roof may be shared, so we'll confirm which part is yours (and any owners corporation approval) on your call.";
