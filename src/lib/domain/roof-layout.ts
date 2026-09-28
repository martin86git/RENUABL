/**
 * Panel layouts on the roof. Google's Solar API models each roof (its faces,
 * and every spot a panel fits, best spots first); we draw that on a satellite
 * image of the home. The auto-layout groups the system's panels on the
 * sunniest faces; partners can add or remove spots. Pure and tested.
 *
 * The satellite image is a Web Mercator map at a known centre and zoom, so a
 * point's latitude and longitude map to an exact pixel.
 */

export interface PanelSlot {
  lat: number;
  lng: number;
  /** PORTRAIT: the long edge runs down the slope. */
  orientation: "PORTRAIT" | "LANDSCAPE";
  /** Which roof face (index into faces). */
  segment: number;
  /** Google's yearly estimate for its own reference panel, kWh (DC). */
  kwh: number;
}

export interface RoofModel {
  /** Google's reference panel, metres. */
  panel: { heightM: number; widthM: number; watts: number };
  faces: { azimuth: number; pitch: number }[];
  /** Every spot a panel fits, best first (Google's order). */
  slots: PanelSlot[];
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The panel spots from a buildingInsights response. Null without any. */
export function parseRoofModel(raw: unknown): RoofModel | null {
  const sp = ((raw ?? {}) as { solarPotential?: Record<string, unknown> }).solarPotential;
  if (!sp || !Array.isArray(sp.solarPanels)) return null;
  const faces = (Array.isArray(sp.roofSegmentStats) ? sp.roofSegmentStats : []).map((s) => {
    const seg = (s ?? {}) as Record<string, unknown>;
    return { azimuth: num(seg.azimuthDegrees) ?? 0, pitch: num(seg.pitchDegrees) ?? 0 };
  });
  const slots: PanelSlot[] = [];
  for (const p of sp.solarPanels.slice(0, 400)) {
    const panel = (p ?? {}) as Record<string, unknown>;
    const c = (panel.center ?? {}) as Record<string, unknown>;
    const lat = num(c.latitude);
    const lng = num(c.longitude);
    const segment = num(panel.segmentIndex) ?? 0;
    if (lat === null || lng === null || !faces[segment]) continue;
    slots.push({
      lat,
      lng,
      orientation: panel.orientation === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT",
      segment,
      kwh: Math.round(num(panel.yearlyEnergyDcKwh) ?? 0),
    });
  }
  if (!slots.length) return null;
  return {
    panel: {
      heightM: num(sp.panelHeightMeters) ?? 1.879,
      widthM: num(sp.panelWidthMeters) ?? 1.045,
      watts: num(sp.panelCapacityWatts) ?? 400,
    },
    faces,
    slots,
  };
}

// ---------------------------------------------------------------------------
// Map projection (Web Mercator, as Google's Maps Static API uses)
// ---------------------------------------------------------------------------

export interface MapView {
  centre: { lat: number; lng: number };
  zoom: number;
  /** The image's logical size (before Google's 2x scale), px. */
  size: number;
  scale: number;
}

/** The design image: 640 px square at 2x, zoom 20 (about 6 cm a pixel in Melbourne). */
export function designView(centre: { lat: number; lng: number }): MapView {
  return { centre, zoom: 20, size: 640, scale: 2 };
}

function world(lat: number, lng: number, zoom: number) {
  const size = 256 * 2 ** zoom;
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * size, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size };
}

/** A point's pixel on the (scaled) image. */
export function toPixel(lat: number, lng: number, view: MapView) {
  const c = world(view.centre.lat, view.centre.lng, view.zoom);
  const p = world(lat, lng, view.zoom);
  const half = (view.size * view.scale) / 2;
  return { x: half + (p.x - c.x) * view.scale, y: half + (p.y - c.y) * view.scale };
}

/** Ground metres per (scaled) pixel at the centre. */
export function metresPerPixel(view: MapView) {
  return (156_543.033_92 * Math.cos((view.centre.lat * Math.PI) / 180)) / 2 ** view.zoom / view.scale;
}

/**
 * A panel's outline on the image: its footprint seen from above (the slope
 * foreshortens the edge that runs down the roof), turned to face the roof's direction.
 */
export function panelOutline(slot: PanelSlot, model: RoofModel, view: MapView): { x: number; y: number }[] {
  const face = model.faces[slot.segment] ?? { azimuth: 0, pitch: 0 };
  const m = metresPerPixel(view);
  const along = slot.orientation === "PORTRAIT" ? model.panel.heightM : model.panel.widthM; // down the slope
  const across = slot.orientation === "PORTRAIT" ? model.panel.widthM : model.panel.heightM;
  const a = (along * Math.cos((face.pitch * Math.PI) / 180)) / m / 2;
  const b = across / m / 2;
  const c = toPixel(slot.lat, slot.lng, view);
  // Azimuth is clockwise from north; on the image, north is up (-y).
  const t = (face.azimuth * Math.PI) / 180;
  const down = { x: Math.sin(t), y: -Math.cos(t) };
  const side = { x: Math.cos(t), y: Math.sin(t) };
  return [
    { x: c.x + down.x * a + side.x * b, y: c.y + down.y * a + side.y * b },
    { x: c.x + down.x * a - side.x * b, y: c.y + down.y * a - side.y * b },
    { x: c.x - down.x * a - side.x * b, y: c.y - down.y * a - side.y * b },
    { x: c.x - down.x * a + side.x * b, y: c.y - down.y * a + side.y * b },
  ].map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
}

/** The part of the image to show: the roof's panel spots, with a margin. */
export function framing(model: RoofModel, view: MapView, marginPx = 90) {
  const pts = model.slots.map((s) => toPixel(s.lat, s.lng, view));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const full = view.size * view.scale;
  const x0 = Math.max(0, Math.min(...xs) - marginPx);
  const y0 = Math.max(0, Math.min(...ys) - marginPx);
  const x1 = Math.min(full, Math.max(...xs) + marginPx);
  const y1 = Math.min(full, Math.max(...ys) + marginPx);
  // Keep it no narrower than 4:3, so small roofs aren't blown up too far.
  const w = Math.max(x1 - x0, (y1 - y0) * 1.33, 360);
  const h = Math.max(y1 - y0, w * 0.6);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return {
    x: Math.round(Math.max(0, Math.min(full - w, cx - w / 2))),
    y: Math.round(Math.max(0, Math.min(full - h, cy - h / 2))),
    w: Math.round(Math.min(w, full)),
    h: Math.round(Math.min(h, full)),
  };
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

/** The best spots for this many panels (Google lists them best first). */
/** The smallest group worth putting on a face of its own (no lone panels). */
export const MIN_ARRAY_PANELS = 4;

/**
 * The first layout: tidy groups on as few roof faces as possible (pricing allows
 * for two, or three above 18 panels), each face filled with its sunniest spots. A face
 * that can take every remaining panel wins when it's within 5% of the sunniest
 * option; faces too small for a proper group are used only when nothing else fits.
 */
export function autoLayout(model: RoofModel, panelCount: number): number[] {
  const want = Math.max(0, Math.min(Math.round(panelCount), model.slots.length));
  const faces = new Map<number, number[]>();
  model.slots.forEach((s, i) => faces.set(s.segment, [...(faces.get(s.segment) ?? []), i]));
  for (const spots of faces.values()) spots.sort((a, b) => model.slots[b].kwh - model.slots[a].kwh);

  const chosen: number[] = [];
  while (chosen.length < want && faces.size) {
    const remaining = want - chosen.length;
    const options = [...faces.entries()].map(([segment, spots]) => {
      const take = spots.slice(0, remaining);
      return { segment, take, score: take.reduce((t, i) => t + model.slots[i].kwh, 0) / take.length };
    });
    const proper = options.filter((o) => o.take.length >= Math.min(remaining, MIN_ARRAY_PANELS));
    const pool = proper.length ? proper : options;
    const best = Math.max(...pool.map((o) => o.score));
    const fitsAll = pool.filter((o) => o.take.length === remaining && o.score >= best * 0.95);
    const pick = (fitsAll.length ? fitsAll : pool).reduce((a, b) => (b.score > a.score ? b : a));
    chosen.push(...pick.take);
    faces.delete(pick.segment);
  }
  return chosen.sort((a, b) => a - b);
}

/** Arrays in a layout: one per roof face used. */
export function layoutArrays(model: RoofModel, selected: number[]) {
  return new Set(selected.map((i) => model.slots[i]?.segment).filter((s) => s !== undefined)).size;
}

/** Google's yearly estimate for the layout, re-stated for our panels' wattage (before inverter and wiring losses). */
export function layoutYearlyKwh(model: RoofModel, selected: number[], ourWatts: number) {
  const google = selected.reduce((s, i) => s + (model.slots[i]?.kwh ?? 0), 0);
  return Math.round((google * ourWatts) / model.panel.watts);
}

/** A saved layout from the browser: known spot numbers, no repeats, in order. */
export function cleanLayout(raw: unknown, slotCount: number): number[] | null {
  if (!Array.isArray(raw) || raw.length > 400) return null;
  const out = [...new Set(raw.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < slotCount))].sort((a, b) => a - b);
  return out;
}

export function toggleSlot(selected: number[], index: number): number[] {
  return selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index].sort((a, b) => a - b);
}
