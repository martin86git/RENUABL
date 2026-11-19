/**
 * A design's shade, kept with it and carried to the customer (19 Nov 2026, Martin: "how can we incorporate the shade
 * analysis (also into the proposal)"). The designer works the shade out in the browser from the heights round the roof
 * (`shadeReport` in shade.ts) whenever a design with panels is open; the figures are kept on that design's quote (so a
 * reading never marks a design changed) and go with its next save. Publishing reads them back for the proposal's
 * panels, only when every panel in it was read: a design changed since its last reading shows no shade, never a stale
 * one. What a customer is told is always an estimate from height data, never a site assessment, and the output and
 * savings figures don't take shade off. Pure, tested.
 */
import type { ShadeReport } from "./shade";

/** A design's shade as kept: each panel's share of the year's direct sun by its key, and the design's as a whole. */
export interface DesignShade {
  /** The design's whole: every panel's direct sun together, 0 to 1. */
  access: number;
  /** The same by month, January first. */
  byMonth: number[];
  /** Each panel's, by its key (`g:<face>:<index>` or `l:<id>`, as `designPanels` names them). */
  panels: Record<string, number>;
  /** Whose heights: Nearmap's (with its capture's day) or Google's. */
  from: "nearmap" | "google";
  captured?: string;
}

/** The shade on a proposal's panels, in the order of `ProposalView.roof.panels`. */
export interface RoofShade {
  access: number;
  byMonth: number[];
  /** Each panel's share of the year's direct sun, 0 to 1. */
  panels: number[];
  /** The least open panel's, and how many lose more than a tenth. */
  worst: number;
  shaded: number;
  from: "nearmap" | "google";
  captured?: string;
}

/** A panel's key as the designer and `designPanels` name it. */
export const SHADE_KEY = /^(g:[A-Za-z0-9_-]{1,40}:\d{1,4}|l:[A-Za-z0-9_-]{1,40})$/;
/** The most panels a design's shade is kept for. */
export const MAX_SHADE_PANELS = 400;

const share = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1 ? Math.round(n * 1000) / 1000 : null;

/** The designer's report on the panels open (`keys`, in the report's order) as kept on the design. */
export function shadeFromReport(report: ShadeReport, keys: readonly string[], from: "nearmap" | "google", captured?: string): DesignShade {
  const panels: Record<string, number> = {};
  keys.forEach((key, i) => {
    const access = share(report.panels[i]?.access);
    if (access !== null && SHADE_KEY.test(key)) panels[key] = access;
  });
  return {
    access: share(report.access) ?? 1,
    byMonth: report.byMonth.map((m) => share(m) ?? 1),
    panels,
    from,
    ...(captured && /^\d{4}-\d{2}-\d{2}$/.test(captured) ? { captured } : {}),
  };
}

/** A design's shade from a browser: every figure a share, keys as the designer names panels, or nothing. */
export function cleanDesignShade(raw: unknown): DesignShade | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const access = share(r.access);
  const byMonth = Array.isArray(r.byMonth) ? r.byMonth.map(share) : [];
  if (access === null || byMonth.length !== 12 || byMonth.some((m) => m === null)) return null;
  const panels: Record<string, number> = {};
  for (const [key, value] of Object.entries(r.panels && typeof r.panels === "object" ? r.panels : {}).slice(0, MAX_SHADE_PANELS)) {
    const v = share(value);
    if (v !== null && SHADE_KEY.test(key)) panels[key] = v;
  }
  if (!Object.keys(panels).length) return null;
  const from = r.from === "nearmap" ? "nearmap" : "google";
  const captured = typeof r.captured === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.captured) ? r.captured : undefined;
  return { access, byMonth: byMonth as number[], panels, from, ...(captured ? { captured } : {}) };
}

/**
 * The shade on a design's panels, in the order given (its `designPanels` keys), when every one of them was read; null
 * otherwise (a panel added or moved since, or no reading). A design worked back to fewer panels keeps the readings of
 * those it keeps, its whole worked again from them; the months stay the reading's own, for the panels as designed.
 */
export function roofShadeFor(shade: DesignShade | null | undefined, keys: readonly string[]): RoofShade | null {
  if (!shade || !keys.length) return null;
  const panels = keys.map((k) => shade.panels[k]);
  if (panels.some((p) => typeof p !== "number")) return null;
  const each = panels as number[];
  const whole = Math.round((each.reduce((a, b) => a + b, 0) / each.length) * 1000) / 1000;
  return {
    access: keys.length === Object.keys(shade.panels).length ? shade.access : whole,
    byMonth: shade.byMonth,
    panels: each,
    worst: Math.min(...each),
    shaded: each.filter((p) => p < 0.9).length,
    from: shade.from,
    ...(shade.captured ? { captured: shade.captured } : {}),
  };
}

/** The share as a whole percent, never rounded up to 100 while any sun is lost. */
export const shadePercent = (n: number) => `${n < 1 ? Math.min(99, Math.floor(n * 100)) : 100}%`;

/** What the customer is told about the shade on their panels: a headline, a line about the panels, and where it is from. */
export function shadeWords(s: RoofShade): { headline: string; panels: string; note: string } {
  const whose =
    s.from === "nearmap"
      ? `Nearmap's height data${s.captured ? ` (${new Date(`${s.captured}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })})` : ""}`
      : "Google's height data";
  return {
    headline: `${shadePercent(s.access)} of the year's direct sun reaches your panels`,
    panels: s.shaded
      ? `${s.shaded} of ${s.panels.length} panel${s.panels.length === 1 ? "" : "s"} lose more than a tenth of theirs; the least open gets ${shadePercent(s.worst)}.`
      : `Every panel gets at least 90% of its direct sun.`,
    note: `An estimate from ${whose} for your address: where the sun is through the year and what stands in its way. That data can be older than your roof and trees, and it is checked on site. The output and savings estimates don't take it off.`,
  };
}
