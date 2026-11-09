/**
 * Shade on a roof design, worked out from the heights of what stands around
 * it (other roofs, trees, the ground): where the sun is through the year,
 * whether anything stands between it and each panel, and so how much of the
 * year's direct sun each panel is open to. Pure, tested.
 *
 * The heights are Google's surface model for the place, on a grid in the
 * designer's own metres. It is an estimate to design with: the model can be
 * older than the roof, it knows a tree only as it was measured, and it is no
 * substitute for a shade assessment on site.
 */

/** The size of one cell of the grid of heights, metres. */
export const TERRAIN_CELL = 0.25;

/** Heights over the designer's picture: row by row from its top-left corner, each the surface's height in metres. */
export interface Terrain {
  cols: number;
  rows: number;
  /** Metres a cell. */
  cell: number;
  /** The picture's width and height on the ground, metres. */
  widthM: number;
  heightM: number;
  heights: Float32Array;
}

// ---------------------------------------------------------------------------
// Sending it to the browser
// ---------------------------------------------------------------------------

const HEADER = 6;

/** The grid as bytes: six numbers (cols, rows, cell, width, height, lowest height), then each height in centimetres above the lowest. */
export function packTerrain(t: Terrain): Uint8Array {
  let low = Infinity;
  for (const h of t.heights) if (h < low) low = h;
  if (!Number.isFinite(low)) low = 0;
  const out = new Uint8Array(HEADER * 4 + t.heights.length * 2);
  const view = new DataView(out.buffer);
  [t.cols, t.rows, t.cell, t.widthM, t.heightM, low].forEach((n, i) => view.setFloat32(i * 4, n, true));
  for (let i = 0; i < t.heights.length; i++)
    view.setUint16(HEADER * 4 + i * 2, Math.max(0, Math.min(65_535, Math.round((t.heights[i] - low) * 100))), true);
  return out;
}

/** The grid read back. Heights come back measured from the lowest point (so the lowest is 0). Null when the bytes aren't one. */
export function unpackTerrain(bytes: ArrayBuffer | Uint8Array): Terrain | null {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.byteLength < HEADER * 4) return null;
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const [cols, rows, cell, widthM, heightM] = Array.from({ length: 5 }, (_, i) => view.getFloat32(i * 4, true));
  const whole = Number.isInteger(cols) && Number.isInteger(rows) && cols > 0 && rows > 0 && cols * rows <= 4_000_000;
  if (!whole || !(cell > 0) || !(widthM > 0) || !(heightM > 0) || u8.byteLength !== HEADER * 4 + cols * rows * 2) return null;
  const heights = new Float32Array(cols * rows);
  for (let i = 0; i < heights.length; i++) heights[i] = view.getUint16(HEADER * 4 + i * 2, true) / 100;
  return { cols, rows, cell, widthM, heightM, heights };
}

/**
 * The surface's height at a point given in the designer's metres from the
 * middle of the picture (x east, y south). Outside the grid it is the height
 * at the nearest edge.
 */
export function heightAt(t: Terrain, x: number, y: number): number {
  const c = Math.min(t.cols - 1, Math.max(0, Math.floor((x + t.widthM / 2) / t.cell)));
  const r = Math.min(t.rows - 1, Math.max(0, Math.floor((y + t.heightM / 2) / t.cell)));
  return t.heights[r * t.cols + c];
}

// ---------------------------------------------------------------------------
// Where the sun is
// ---------------------------------------------------------------------------

export interface SunPosition {
  /** Degrees clockwise from north. */
  azimuth: number;
  /** Degrees above the horizon (negative: below it). */
  elevation: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Where the sun is, for a latitude (south is negative), a day of the year
 * (1 to 365) and an hour of the solar day (12 is the sun at its highest).
 * The standard declination and hour-angle formulas: good to about a degree,
 * which is finer than the heights it is used with.
 */
export function sunPosition(latitude: number, dayOfYear: number, solarHour: number): SunPosition {
  const declination = rad(23.44) * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365);
  const phi = rad(latitude);
  const hourAngle = rad(15 * (solarHour - 12));
  const sinEl = Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  // From south, positive to the west; then turned to clockwise from north.
  const fromSouth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi));
  return { azimuth: (deg(fromSouth) + 180 + 360) % 360, elevation: deg(elevation) };
}

/** The middle day of each month, as a day of the year, and how many days the month has. */
export const MONTH_MID_DAYS = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349] as const;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export interface SunSample extends SunPosition {
  /** 0 to 11. */
  month: number;
  hour: number;
  /** How much direct sun this moment stands for over the year: the beam's strength through the air, times the days it stands for. */
  weight: number;
}

/**
 * The sun through a year at a latitude, as moments to test: the middle day
 * of each month, every half hour the sun is more than 5° up. Each carries
 * the strength of the direct beam then (weaker low in the sky, through more
 * air) and the days it stands for.
 */
export function sunSamples(latitude: number): SunSample[] {
  const out: SunSample[] = [];
  MONTH_MID_DAYS.forEach((day, month) => {
    for (let hour = 4; hour <= 20; hour += 0.5) {
      const at = sunPosition(latitude, day, hour);
      if (at.elevation <= 5) continue;
      const airMass = 1 / Math.sin(rad(at.elevation));
      out.push({ ...at, month, hour, weight: 0.7 ** (airMass ** 0.678) * MONTH_LENGTHS[month] });
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Whether something stands in the way
// ---------------------------------------------------------------------------

/** How far a ray is followed looking for something in its way, metres. */
export const SHADE_REACH = 70;
/** How far from the panel the looking starts, and how far above the ray something must stand to count: so a panel's own roof, and the noise in the heights, don't shade it. */
const START = 0.9;
const CLEARANCE = 0.35;

/**
 * Whether the sun at this position is hidden from a point (the designer's
 * metres; `z` its height on the same scale as the grid) by anything on the
 * grid: the ray to the sun is followed outwards, and the point is in shade
 * if the surface stands above the ray anywhere along it.
 */
export function shadedAt(t: Terrain, x: number, y: number, z: number, sun: SunPosition): boolean {
  if (sun.elevation <= 0) return true;
  const a = rad(sun.azimuth);
  // On the picture, east is +x and south is +y: north is -y.
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const rise = Math.tan(rad(sun.elevation));
  const halfW = t.widthM / 2;
  const halfH = t.heightM / 2;
  for (let d = START; d <= SHADE_REACH; d += t.cell) {
    const px = x + dx * d;
    const py = y + dy * d;
    if (px < -halfW || px > halfW || py < -halfH || py > halfH) return false;
    if (heightAt(t, px, py) > z + d * rise + CLEARANCE) return true;
  }
  return false;
}

export interface PanelAspect {
  x: number;
  y: number;
  /** Degrees up from flat. */
  tilt: number;
  /** The way it faces, degrees clockwise from north. */
  facing: number;
}

export interface SunAccess {
  /** The share of the year's direct sun on the panel that reaches it: 1 is never shaded, 0 always. */
  access: number;
  /** The same, month by month (January first). A month with no sun on the panel at all reads 1. */
  byMonth: number[];
}

/**
 * How open a panel is to the sun over a year: of all the direct sun that
 * would fall on it (each moment weighed by the beam's strength and by how
 * squarely it meets the panel), the share that isn't blocked by anything on
 * the grid. The panel is taken to sit a little above the surface under it.
 */
export function sunAccess(t: Terrain, panel: PanelAspect, samples: readonly SunSample[]): SunAccess {
  const z = heightAt(t, panel.x, panel.y) + 0.15;
  const tilt = rad(panel.tilt);
  const facing = rad(panel.facing);
  // The panel's normal: up, leaning towards the way it faces.
  const n = { x: Math.sin(tilt) * Math.sin(facing), y: -Math.sin(tilt) * Math.cos(facing), z: Math.cos(tilt) };
  const total = new Array<number>(12).fill(0);
  const open = new Array<number>(12).fill(0);
  for (const s of samples) {
    const el = rad(s.elevation);
    const az = rad(s.azimuth);
    const sun = { x: Math.cos(el) * Math.sin(az), y: -Math.cos(el) * Math.cos(az), z: Math.sin(el) };
    const square = n.x * sun.x + n.y * sun.y + n.z * sun.z;
    if (square <= 0) continue;
    const worth = s.weight * square;
    total[s.month] += worth;
    if (!shadedAt(t, panel.x, panel.y, z, s)) open[s.month] += worth;
  }
  const all = total.reduce((a, b) => a + b, 0);
  return {
    access: all > 0 ? open.reduce((a, b) => a + b, 0) / all : 1,
    byMonth: total.map((sum, m) => (sum > 0 ? open[m] / sum : 1)),
  };
}

export interface ShadeReport {
  /** Each panel's access, in the order given. */
  panels: SunAccess[];
  /** The whole design's: every panel's direct sun together. */
  access: number;
  byMonth: number[];
  /** The least open panel's access, and how many panels lose more than a tenth of their direct sun. */
  worst: number;
  shaded: number;
}

/** The shade on a whole design: each panel's access to the sun, and the design's as a whole. */
export function shadeReport(t: Terrain, panels: readonly PanelAspect[], latitude: number): ShadeReport {
  const samples = sunSamples(latitude);
  const each = panels.map((p) => sunAccess(t, p, samples));
  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 1);
  return {
    panels: each,
    access: mean(each.map((p) => p.access)),
    byMonth: Array.from({ length: 12 }, (_, m) => mean(each.map((p) => p.byMonth[m]))),
    worst: each.length ? Math.min(...each.map((p) => p.access)) : 1,
    shaded: each.filter((p) => p.access < 0.9).length,
  };
}

/** The colour a panel is tinted by its access: green when open, through amber, to red when mostly shaded. */
export function accessColour(access: number): string {
  const a = Math.max(0, Math.min(1, access));
  // 1 → green (#22c55e), 0.8 → amber (#f59e0b), 0.5 and under → red (#ef4444).
  const stops: [number, [number, number, number]][] = [
    [0.5, [239, 68, 68]],
    [0.8, [245, 158, 11]],
    [1, [34, 197, 94]],
  ];
  if (a <= stops[0][0]) return `rgb(${stops[0][1].join(",")})`;
  for (let i = 1; i < stops.length; i++) {
    if (a <= stops[i][0]) {
      const [a0, c0] = stops[i - 1];
      const [a1, c1] = stops[i];
      const k = (a - a0) / (a1 - a0);
      return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * k)).join(",")})`;
    }
  }
  return `rgb(${stops[2][1].join(",")})`;
}

/** Panels with less than this share of the year's sun are tinted as they are laid, with no button pressed. */
export const SHADE_HINT_BELOW = 0.92;

/**
 * How strongly a panel is tinted as it is laid (10 Nov 2026, Martin: shaded panels should show as they go down, not
 * only once the shade view is opened): nothing for a panel open to the sun, more the more shaded, never so much the
 * panel can't be seen. A number from 0 to 1 for the tint's opacity, or null for none.
 */
export function shadeHint(access: number | null | undefined): number | null {
  if (access === null || access === undefined || !Number.isFinite(access) || access >= SHADE_HINT_BELOW) return null;
  return Math.round(Math.min(0.6, 0.15 + (SHADE_HINT_BELOW - access) * 1.5) * 100) / 100;
}
