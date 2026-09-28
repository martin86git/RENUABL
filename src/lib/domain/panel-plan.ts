/**
 * The partner's panel plan: panels placed by hand on the satellite photo,
 * each with its own position and rotation (like Pylon), instead of Google's
 * automatic spots. Positions are latitude/longitude on the Maps Static photo
 * the partner sees; rotation is degrees clockwise, 0 = portrait (long edge
 * running north–south on the photo). Pure and tested.
 */
import { PANEL } from "./catalogue";
import { fromPixel, toPixel, type MapView } from "./roof-layout";

export interface PlacedPanel {
  lat: number;
  lng: number;
  /** Degrees clockwise, 0–359.9. 0 = portrait, 90 = landscape. */
  rotation: number;
}

/** Space left between neighbouring panels (clamps), metres. */
export const PANEL_GAP_M = 0.02;
/** A dragged panel snaps beside a neighbour when it's this close to a neat spot, metres. */
export const SNAP_M = 0.35;
/** …and turned within this many degrees of it. */
export const SNAP_DEG = 4;
export const MAX_PLAN_PANELS = 200;

const mLat = (lat: number) => 111_132.954 - 559.822 * Math.cos((2 * lat * Math.PI) / 180);
const mLng = (lat: number) => 111_412.84 * Math.cos((lat * Math.PI) / 180);

export const normaliseRotation = (deg: number) => Math.round((((deg % 360) + 360) % 360) * 10) / 10;

/** A point `east`/`north` metres from `at`. */
export function offset(at: { lat: number; lng: number }, east: number, north: number) {
  return { lat: at.lat + north / mLat(at.lat), lng: at.lng + east / mLng(at.lat) };
}

/** Metres east/north of `from` to `to`. */
export function metresBetween(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  return { east: (to.lng - from.lng) * mLng(from.lat), north: (to.lat - from.lat) * mLat(from.lat) };
}

/** The panel's own axes on the ground: `across` (its short side) and `along` (its long side), as east/north unit vectors. */
function axes(rotation: number) {
  const t = (rotation * Math.PI) / 180;
  // Rotating clockwise on a north-up photo: across starts pointing east, along starts pointing north.
  return { across: { e: Math.cos(t), n: -Math.sin(t) }, along: { e: Math.sin(t), n: Math.cos(t) } };
}

/** The panel's corners on the photo (pixels). */
export function panelCorners(p: PlacedPanel, view: MapView) {
  const { across, along } = axes(p.rotation);
  const a = PANEL.widthM / 2;
  const b = PANEL.heightM / 2;
  return [
    [-a, b],
    [a, b],
    [a, -b],
    [-a, -b],
  ].map(([x, y]) => {
    const g = offset(p, across.e * x + along.e * y, across.n * x + along.n * y);
    return toPixel(g.lat, g.lng, view);
  });
}

/** Where a new panel goes: beside the last one (same rotation), or at `start` when there's none. */
export function nextPanel(placed: PlacedPanel[], start: { lat: number; lng: number }): PlacedPanel {
  const last = placed[placed.length - 1];
  if (!last) return { ...start, rotation: 0 };
  const { across } = axes(last.rotation);
  const step = PANEL.widthM + PANEL_GAP_M;
  // Beside the last panel, in the first free spot along the row.
  for (let k = 1; k < 40; k++) {
    const at = offset(last, across.e * step * k, across.n * step * k);
    if (!placed.some((q) => distance(q, at) < PANEL.widthM * 0.6)) return { ...at, rotation: last.rotation };
  }
  return { ...offset(last, 0, -(PANEL.heightM + PANEL_GAP_M)), rotation: last.rotation };
}

function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const d = metresBetween(a, b);
  return Math.hypot(d.east, d.north);
}

const angleGap = (a: number, b: number) => {
  const d = Math.abs(normaliseRotation(a) - normaliseRotation(b)) % 180;
  return Math.min(d, 180 - d);
};

/**
 * Snaps a panel into line beside a neighbour (side by side or end to end,
 * same rotation) when it's within SNAP_M of that spot and SNAP_DEG of its
 * angle. Otherwise returns it as it is.
 */
export function snapPanel(p: PlacedPanel, others: PlacedPanel[]): PlacedPanel {
  let best: { d: number; at: PlacedPanel } | null = null;
  for (const o of others) {
    if (angleGap(o.rotation, p.rotation) > SNAP_DEG) continue;
    const { across, along } = axes(o.rotation);
    const w = PANEL.widthM + PANEL_GAP_M;
    const h = PANEL.heightM + PANEL_GAP_M;
    for (const [x, y] of [
      [w, 0],
      [-w, 0],
      [0, h],
      [0, -h],
    ]) {
      const spot = offset(o, across.e * x + along.e * y, across.n * x + along.n * y);
      const d = distance(p, spot);
      if (d <= SNAP_M && (!best || d < best.d) && !others.some((q) => q !== o && distance(q, spot) < PANEL.widthM * 0.6))
        best = { d, at: { ...spot, rotation: o.rotation } };
    }
  }
  return best ? best.at : p;
}

/** Arrays: groups of panels that touch (side by side or end to end) at about the same angle. */
export function planArrays(panels: PlacedPanel[]): number {
  const parent = panels.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const reach = Math.hypot(PANEL.widthM, PANEL.heightM) + 0.4;
  for (let i = 0; i < panels.length; i++)
    for (let j = i + 1; j < panels.length; j++)
      if (angleGap(panels[i].rotation, panels[j].rotation) <= 10 && distance(panels[i], panels[j]) <= reach) parent[find(i)] = find(j);
  return new Set(panels.map((_, i) => find(i))).size;
}

/** A plan from the portal, checked: at most 200 panels, each within 100 m of the home, with a real rotation. Null if unusable. */
export function cleanPlan(raw: unknown, home: { lat: number; lng: number }): PlacedPanel[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PLAN_PANELS) return null;
  const out: PlacedPanel[] = [];
  for (const r of raw) {
    const { lat, lng, rotation } = (r ?? {}) as Record<string, unknown>;
    if (typeof lat !== "number" || typeof lng !== "number" || typeof rotation !== "number") return null;
    if (![lat, lng, rotation].every(Number.isFinite) || distance(home, { lat, lng }) > 100) return null;
    out.push({ lat: Math.round(lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7, rotation: normaliseRotation(rotation) });
  }
  return out;
}

/** A panel dragged on the photo: its new centre from a pixel, keeping its rotation. */
export function panelAtPixel(p: PlacedPanel, x: number, y: number, view: MapView): PlacedPanel {
  return { ...fromPixel(x, y, view), rotation: p.rotation };
}

/** The rotation that points the panel's top towards a pixel (for the rotate handle), in whole degrees. */
export function rotationTowards(p: PlacedPanel, x: number, y: number, view: MapView): number {
  const c = toPixel(p.lat, p.lng, view);
  return normaliseRotation(Math.round((Math.atan2(x - c.x, -(y - c.y)) * 180) / Math.PI));
}

/** Panel spots (indexes) whose outline overlaps one of these boxes (pixels), with a margin. */
export function panelsInBoxes(
  panels: PlacedPanel[],
  view: MapView,
  boxes: { x0: number; y0: number; x1: number; y1: number }[],
  padPx: number,
) {
  return panels.flatMap((p, i) => {
    const c = panelCorners(p, view);
    const xs = c.map((q) => q.x);
    const ys = c.map((q) => q.y);
    const hit = boxes.some(
      (b) =>
        Math.min(...xs) < b.x1 + padPx &&
        Math.max(...xs) > b.x0 - padPx &&
        Math.min(...ys) < b.y1 + padPx &&
        Math.max(...ys) > b.y0 - padPx,
    );
    return hit ? [i] : [];
  });
}
