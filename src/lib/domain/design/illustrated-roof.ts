/**
 * The roof as an illustration, for the designer's Drawn view (10 Nov 2026,
 * Martin: a truer way to show panels on a roof than laying them on a photo).
 * Pure, tested.
 *
 * Nothing here asks a server for anything: the roof's faces are the ones the
 * design already holds, their colour is read from the photo already on the
 * page, and the surroundings are that same photo made small, grey and dim.
 * It is a picture to design and present on, not a survey.
 */

export type Rgb = [number, number, number];
type Px = readonly [number, number];

/** A photo's pixels, as a canvas gives them: four bytes a pixel, row by row. */
export interface Pixels {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const lum = ([r, g, b]: Rgb) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Whether a point is inside an outline (even-odd). */
export function inside(points: readonly Px[], x: number, y: number): boolean {
  let within = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) within = !within;
  }
  return within;
}

/** Anything darker than this on a roof is a shadow or a panel already there, not the roof's own colour. */
export const TOO_DARK = 55;

/**
 * The colour of the roof inside an outline: the mean of the photo's pixels
 * there, leaving out the very dark ones (shadows, panels already on it).
 * The outline is in the pixels' own frame. Null when it covers no pixel.
 */
export function colourInside(pixels: Pixels, points: readonly Px[]): Rgb | null {
  if (points.length < 3) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const x1 = Math.min(pixels.width - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(pixels.height - 1, Math.ceil(Math.max(...ys)));
  const sum = [0, 0, 0];
  const dark = [0, 0, 0];
  let n = 0;
  let nDark = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!inside(points, x + 0.5, y + 0.5)) continue;
      const i = (y * pixels.width + x) * 4;
      const c: Rgb = [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]];
      const into = lum(c) < TOO_DARK ? dark : sum;
      into[0] += c[0];
      into[1] += c[1];
      into[2] += c[2];
      if (into === dark) nDark += 1;
      else n += 1;
    }
  if (n > 0) return [sum[0] / n, sum[1] / n, sum[2] / n];
  if (nDark > 0) return [dark[0] / nDark, dark[1] / nDark, dark[2] / nDark];
  return null;
}

/** The roof colour used when the photo can't be read: a plain cool grey. */
export const PLAIN_ROOF: Rgb = [138, 142, 150];

/** A drawn roof is never darker or paler than this, so dark panels and white lines both read on it. */
export const ROOF_LIGHT = { low: 96, high: 178 };

/** How much a face looking at the light is lifted, and one looking away is dropped. */
export const FACE_LIGHT = 0.17;

/**
 * The colour a face is drawn in: its own colour from the photo mixed evenly
 * with the whole roof's (one roof is one material; the mix keeps a garage's
 * different roof different), brought into a middle range, then lit from the
 * north-west by the way it looks, so faces read as planes. A flat face takes
 * the colour unlit.
 */
export function faceColour(own: Rgb | null, roof: Rgb | null, azimuth: number, pitch: number): string {
  const whole = roof ?? own ?? PLAIN_ROOF;
  const mine = own ?? whole;
  let c: Rgb = [(mine[0] + whole[0]) / 2, (mine[1] + whole[1]) / 2, (mine[2] + whole[2]) / 2];
  const l = lum(c);
  const want = clamp(l, ROOF_LIGHT.low, ROOF_LIGHT.high);
  // Moved towards the wanted lightness by adding the same to each channel, which keeps its colour.
  c = [c[0] + (want - l), c[1] + (want - l), c[2] + (want - l)];
  const lit = pitch < 2 ? 0 : Math.cos(((azimuth - 315) * Math.PI) / 180);
  const by = 1 + lit * FACE_LIGHT;
  const hex = (v: number) =>
    Math.round(clamp(v * by, 0, 255))
      .toString(16)
      .padStart(2, "0");
  return `#${hex(c[0])}${hex(c[1])}${hex(c[2])}`;
}

/**
 * The gutter of a face: the edge of its outline lying furthest down the
 * slope (the way the face looks). Points are on the picture (x east, y
 * south). Null for a flat face, which has none to speak of.
 */
export function gutterOf(points: readonly Px[], azimuth: number, pitch: number): [Px, Px] | null {
  if (points.length < 3 || pitch < 3) return null;
  const t = (azimuth * Math.PI) / 180;
  const down = [Math.sin(t), -Math.cos(t)];
  let best: [Px, Px] | null = null;
  let most = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const along = [b[0] - a[0], b[1] - a[1]];
    const length = Math.hypot(along[0], along[1]);
    if (length < 1e-6) continue;
    // A gutter runs across the slope: an edge running down it (a hip, a barge) is passed over.
    const across = Math.abs(along[0] * down[0] + along[1] * down[1]) / length;
    if (across > 0.5) continue;
    const reach = ((a[0] + b[0]) / 2) * down[0] + ((a[1] + b[1]) / 2) * down[1];
    if (reach > most) {
      most = reach;
      best = [a, b];
    }
  }
  return best;
}

/**
 * The surroundings: the photo's pixels turned most of the way to grey and
 * dimmed, in place, so the neighbours are a rough presence and nothing more.
 * Done on a small copy of the photo, which the page then draws large (and so
 * soft).
 */
export function ghosted(data: Uint8ClampedArray | number[], keep = 0.3, dim = 0.5): void {
  for (let i = 0; i < data.length; i += 4) {
    const grey = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = (grey + (data[i] - grey) * keep) * dim;
    data[i + 1] = (grey + (data[i + 1] - grey) * keep) * dim;
    data[i + 2] = (grey + (data[i + 2] - grey) * keep) * dim + 6;
  }
}

/**
 * The lines of cells across a panel, from its four corners in order: one
 * down the middle of its length (panels are two halves) and `across` - 1
 * dividing it along its length. Returned as pairs of points.
 */
export function cellLines(corners: readonly Px[], across = 6): [Px, Px][] {
  if (corners.length !== 4) return [];
  const [a, b, c, d] = corners;
  const mix = (p: Px, q: Px, t: number): Px => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
  // The long sides are a→b and d→c, or b→c and a→d.
  const [l0, l1, r0, r1] = ab >= bc ? [a, b, d, c] : [b, c, a, d];
  const lines: [Px, Px][] = [[mix(l0, r0, 0.5), mix(l1, r1, 0.5)]];
  for (let i = 1; i < across; i++) lines.push([mix(l0, l1, i / across), mix(r0, r1, i / across)]);
  return lines;
}

/** Past this many panels the cells aren't drawn: on a big roof they are too small to see and only cost. */
export const CELLS_UP_TO = 160;

/** What stands on the wall, in order from the roof's cable to the house. */
export interface WallKit {
  inverters: { name: string; kw: number }[];
  battery: { name: string; kwh: number; qty: number; backup: boolean } | null;
  charger: { name: string; kw: number } | null;
  switchboard: boolean;
}

/** One thing drawn on the wall: where its box is (in the strip's own units) and what is written under it. */
export interface WallItem {
  kind: "inverter" | "battery" | "switchboard" | "charger";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** A battery's modules, stacked: how many are drawn, and how many of them are held back for blackouts. */
  modules?: number;
  held?: number;
}

/** The wall strip's own size, in its drawing's units. */
export const WALL = { height: 96, floor: 74, pad: 14, gap: 16, most: 8 };

const size1 = (n: number) => (Math.round(n * 10) / 10).toString();

/**
 * The wall laid out: inverters, then the battery as a stack of its modules
 * (at most `WALL.most` drawn), the switchboard, then the EV charger, left to
 * right standing on the floor line. Returns the items and the strip's width.
 * Nothing on the design gives an empty wall.
 */
export function wallLayout(kit: WallKit): { items: WallItem[]; width: number } {
  const items: WallItem[] = [];
  let x = WALL.pad + 22;
  const stand = (kind: WallItem["kind"], w: number, h: number, label: string, more: Partial<WallItem> = {}) => {
    items.push({ kind, x, y: WALL.floor - h, w, h, label, ...more });
    x += w + WALL.gap;
  };
  for (const inv of kit.inverters) stand("inverter", 22, 28, `${size1(inv.kw)} kW`);
  if (kit.battery) {
    const modules = clamp(Math.round(kit.battery.qty), 1, WALL.most);
    stand("battery", 26, 12 + modules * 6, `${size1(kit.battery.kwh * kit.battery.qty)} kWh`, {
      modules,
      held: kit.battery.backup && modules > 1 ? 1 : 0,
    });
  }
  if (kit.switchboard || items.length > 0) stand("switchboard", 18, 24, "MSB");
  if (kit.charger) stand("charger", 14, 22, `EV ${size1(kit.charger.kw)} kW`);
  if (items.length === 0) return { items, width: 0 };
  return { items, width: x - WALL.gap + WALL.pad + 22 };
}
