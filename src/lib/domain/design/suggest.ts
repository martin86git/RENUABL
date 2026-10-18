/**
 * "Suggest a layout": a first set of panels for a roof from Google's roof
 * model, laid the way an installer would. Pure, tested.
 *
 * Google's model says where on the roof a panel can go (every spot it found,
 * each on a roof face with that face's direction and pitch). Those spots are
 * used only as the area panels may cover: the panels themselves are laid
 * afresh, all portrait, in long straight rows along each face (the fewest rows
 * that hold them, `bestBlock`), every one wholly inside that area. Google's
 * own spots are often landscape and laid at odd angles on flat roofs; copying
 * them gave blocks stacked at angles and panels hanging off the roof. Faces
 * flatter than `FLAT_FACE` are taken together as one flat roof, with rows
 * along its longer side. The sunniest face is filled first; the rest go on
 * the next, never a group of fewer than `MIN_ARRAY_PANELS` unless nothing
 * else fits.
 *
 * Google's model can be older than the roof (2 Hanwell Court, Glen Waverley:
 * the 2018 house), so the designer checks it lines up with today's photo
 * before using it. Whatever comes out is a starting point to check against
 * the picture: it knows nothing of vents, skylights or setbacks it isn't shown.
 */
import { MIN_ARRAY_PANELS, type RoofModel } from "../roof-layout";
import { metresPerPixel, type LoosePanel, type PanelSize } from "./roof-design";
import { bestBlock } from "./rows";
import { TILT } from "./tilt";

/** The most panels a suggestion lays out. */
export const MAX_SUGGESTED = 60;
/** Faces flatter than this many degrees are taken together as one flat roof. */
export const FLAT_FACE = 5;

const cm = (n: number) => Math.round(n * 100) / 100;
const rad = (d: number) => (d * Math.PI) / 180;
const turn360 = (d: number) => ((d % 360) + 360) % 360;

interface Pt {
  x: number;
  y: number;
}

/** One of Google's spots on the ground (metres east and south of the picture's middle), as the area it covers. */
interface Footprint {
  centre: Pt;
  /** Down its face's slope, and across it, as unit vectors on the ground. */
  down: Pt;
  side: Pt;
  /** Half its length down the slope (seen from above) and across. */
  halfDown: number;
  halfSide: number;
  kwh: number;
}

/** A group of spots panels are laid on together: one sloped face, or every flat one. */
interface Group {
  /** The way the panels look, clockwise from north. */
  facing: number;
  pitch: number;
  spots: Footprint[];
}

const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
/** On the ground, east and south: the way down a slope that looks towards `bearing`. */
const downOf = (bearing: number): Pt => ({ x: Math.sin(rad(bearing)), y: -Math.cos(rad(bearing)) });
const sideOf = (bearing: number): Pt => ({ x: Math.cos(rad(bearing)), y: Math.sin(rad(bearing)) });

/** Whether a point is on one of the spots (a couple of centimetres' grace for rounding). */
const covered = (p: Pt, spots: Footprint[]) =>
  spots.some((s) => {
    const d = { x: p.x - s.centre.x, y: p.y - s.centre.y };
    return Math.abs(dot(d, s.down)) <= s.halfDown + 0.06 && Math.abs(dot(d, s.side)) <= s.halfSide + 0.06;
  });

/** The direction of the longer side of a scatter of points, as a bearing (0 to 180). */
function longAxis(points: Pt[]): number {
  const n = points.length;
  const mx = points.reduce((t, p) => t + p.x, 0) / n;
  const my = points.reduce((t, p) => t + p.y, 0) / n;
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const p of points) {
    xx += (p.x - mx) ** 2;
    xy += (p.x - mx) * (p.y - my);
    yy += (p.y - my) ** 2;
  }
  // The main axis of the spread, as an angle from east (y is south, so clockwise), then as a bearing.
  const fromEast = 0.5 * Math.atan2(2 * xy, xx - yy);
  return turn360(90 + (fromEast * 180) / Math.PI) % 180;
}

/** Google's spots, grouped: each sloped face on its own, the flat ones together. */
function groupsOf(model: RoofModel, centre: { lat: number; lng: number }, offset: Pt): Group[] {
  const mLat = 111_132.954 - 559.822 * Math.cos(2 * rad(centre.lat));
  const mLng = 111_412.84 * Math.cos(rad(centre.lat));
  const bySegment = new Map<number, Footprint[]>();
  for (const s of model.slots) {
    const face = model.faces[s.segment];
    if (!face) continue;
    const portrait = s.orientation === "PORTRAIT";
    const along = portrait ? model.panel.heightM : model.panel.widthM;
    const across = portrait ? model.panel.widthM : model.panel.heightM;
    const spot: Footprint = {
      centre: { x: (s.lng - centre.lng) * mLng + offset.x, y: -(s.lat - centre.lat) * mLat + offset.y },
      down: downOf(face.azimuth),
      side: sideOf(face.azimuth),
      halfDown: (along * Math.cos(rad(face.pitch))) / 2,
      halfSide: across / 2,
      kwh: s.kwh,
    };
    bySegment.set(s.segment, [...(bySegment.get(s.segment) ?? []), spot]);
  }
  const groups: Group[] = [];
  const flat: Footprint[] = [];
  const flatPitches: number[] = [];
  for (const [segment, spots] of bySegment) {
    const face = model.faces[segment];
    if (face.pitch < FLAT_FACE) {
      flat.push(...spots);
      flatPitches.push(face.pitch);
    } else groups.push({ facing: turn360(face.azimuth), pitch: face.pitch, spots });
  }
  if (flat.length) {
    // Rows along the flat roof's longer side, the panels looking whichever way across it is nearer north.
    const axis = longAxis(flat.map((s) => s.centre));
    const facing = [turn360(axis - 90), turn360(axis + 90)].reduce((a, b) => (Math.min(b, 360 - b) < Math.min(a, 360 - a) ? b : a));
    groups.push({ facing, pitch: Math.max(...flatPitches), spots: flat });
  }
  return groups;
}

/** Panels laid on a group in the fewest straight rows, at most `n`: portrait (long edge down the slope) or landscape. */
function layGroup(group: Group, n: number, size: PanelSize, newId: () => string, landscape = false): LoosePanel[] {
  const down = downOf(group.facing);
  const side = sideOf(group.facing);
  const along = landscape ? size.short : size.long;
  const across = landscape ? size.long : size.short;
  // Spaced at full size, as the designer draws every panel from above, so drawn panels never overlap.
  const stepDown = along + size.gap;
  const stepSide = across + size.gap;
  const corners = group.spots.flatMap((s) =>
    [-1, 1].flatMap((a) =>
      [-1, 1].map((b) => ({
        x: s.centre.x + a * s.halfDown * s.down.x + b * s.halfSide * s.side.x,
        y: s.centre.y + a * s.halfDown * s.down.y + b * s.halfSide * s.side.y,
      })),
    ),
  );
  const us = corners.map((p) => dot(p, side));
  const vs = corners.map((p) => dot(p, down));
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  const cols = Math.floor((u1 - u0) / stepSide) + 1;
  const rows = Math.floor((v1 - v0) / stepDown) + 1;
  if (cols < 1 || rows < 1 || cols * rows > 6000) return [];
  const at = (u: number, v: number): Pt => ({ x: u * side.x + v * down.x, y: u * side.y + v * down.y });
  const hw = across / 2 - 0.02;
  // Seen from above, a panel on a slope is shorter down it: what it really covers of the roof is what must fit.
  const hl = (along * Math.cos(rad(group.pitch))) / 2 - 0.02;
  // The grid can start anywhere within a step: try a few starts each way and keep the one where most panels fit.
  let best: { fits: boolean[]; kwh: number[]; start: Pt; count: number } | null = null;
  for (const fu of [0, 0.25, 0.5, 0.75])
    for (const fv of [0, 0.25, 0.5, 0.75]) {
      const start = { x: u0 + fu * stepSide + across / 2, y: v0 + fv * stepDown + along / 2 };
      const fits: boolean[] = [];
      const kwh: number[] = [];
      let count = 0;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const u = start.x + c * stepSide;
          const v = start.y + r * stepDown;
          const probe = [-1, 0, 1].flatMap((a) => [-1, 0, 1].map((b) => at(u + a * hw, v + b * hl)));
          const ok = probe.every((p) => covered(p, group.spots));
          fits.push(ok);
          const mid = at(u, v);
          const near = group.spots.reduce((a, s) =>
            (s.centre.x - mid.x) ** 2 + (s.centre.y - mid.y) ** 2 < (a.centre.x - mid.x) ** 2 + (a.centre.y - mid.y) ** 2 ? s : a,
          );
          kwh.push(near.kwh);
          if (ok) count++;
        }
      if (!best || count > best.count) best = { fits, kwh, start, count };
    }
  if (!best?.count) return [];
  const { fits, kwh, start } = best;
  const block = bestBlock(
    (r, c) => fits[r * cols + c],
    rows,
    cols,
    n,
    (r, c) => kwh[r * cols + c],
  );
  const tilt = Math.max(0, Math.min(TILT.max, Math.round(group.pitch)));
  const facing = Math.round(group.facing) % 360;
  return block.cells.map(({ row, col }) => {
    const p = at(start.x + col * stepSide, start.y + row * stepDown);
    // On its side, a panel's angle is a quarter turn back from the way it looks (`panelFacing`).
    return landscape
      ? { id: newId(), x: cm(p.x), y: cm(p.y), angle: (facing + 270) % 360, across: true, tilt }
      : { id: newId(), x: cm(p.x), y: cm(p.y), angle: facing, tilt };
  });
}

/** The way a group is laid: portrait when that holds the panels wanted (or as many as landscape would), else landscape. */
function bestWay(group: Group, n: number, size: PanelSize, newId: () => string): LoosePanel[] {
  const upright = layGroup(group, n, size, newId);
  if (upright.length >= n) return upright;
  const onSide = layGroup(group, n, size, newId, true);
  return onSide.length > upright.length ? onSide : upright;
}

/** Faces steeper than this are walls or gables in Google's model, never a place for panels. */
const STEEPEST = 45;
/** A face gets at least this share of the sunniest face's sun to be used. */
const SUNNY_ENOUGH = 0.8;

export function suggestPanels(
  model: RoofModel,
  /** The middle of the picture: panels are placed in metres from it. */
  centre: { lat: number; lng: number },
  count: number,
  size: PanelSize,
  newId: () => string,
  /** Where Google's model sits on the picture, in metres east and south: from lining it up with today's photo. */
  offset: Pt = { x: 0, y: 0 },
): LoosePanel[] {
  const want = Math.min(MAX_SUGGESTED, Math.max(0, Math.round(count)));
  if (!want) return [];
  const sun = (g: Group) => g.spots.reduce((t, s) => t + s.kwh, 0) / g.spots.length;
  const groups = groupsOf(model, centre, offset)
    .filter((g) => g.pitch <= STEEPEST)
    .sort((a, b) => sun(b) - sun(a));
  if (!groups.length) return [];
  const top = sun(groups[0]);
  const sunny = groups.filter((g) => sun(g) >= top * SUNNY_ENOUGH);
  // How many each face holds in one tidy block: one id for every panel tried, so the count of ids stays honest.
  let tried = 0;
  const probeId = () => `t${tried++}`;
  const room = new Map(sunny.map((g) => [g, bestWay(g, MAX_SUGGESTED, size, probeId).length]));

  // One array when a face nearly as sunny as the best (within 5%) holds them all: the sunniest that does.
  const whole = sunny.find((g) => (room.get(g) ?? 0) >= want && sun(g) >= top * 0.95);
  if (whole) return bestWay(whole, want, size, newId);

  // Else the fewest arrays (two, or three above 18 panels, as pricing allows), the sunniest faces first, none under
  // `MIN_ARRAY_PANELS`: a remainder too small for an array of its own is left off rather than scattered.
  const most = want > 18 ? 3 : 2;
  const out: LoosePanel[] = [];
  let left = want;
  let arrays = 0;
  // The sunniest faces first (`sunny` is in order of sun).
  const order = sunny;
  order.forEach((g, i) => {
    if (!left || arrays >= most) return;
    let take = Math.min(left, room.get(g) ?? 0);
    // Leave enough for a proper array on a face still to come, rather than a remainder too small to lay.
    const rest = left - take;
    const later = order.slice(i + 1).some((h) => (room.get(h) ?? 0) >= MIN_ARRAY_PANELS);
    if (rest > 0 && rest < MIN_ARRAY_PANELS && later && arrays + 1 < most && take - (MIN_ARRAY_PANELS - rest) >= MIN_ARRAY_PANELS)
      take -= MIN_ARRAY_PANELS - rest;
    if (take < MIN_ARRAY_PANELS) return;
    const panels = bestWay(g, take, size, newId);
    if (panels.length < MIN_ARRAY_PANELS) return;
    out.push(...panels);
    arrays += 1;
    left -= panels.length;
  });
  return out;
}

/**
 * Where Google's model sits on the designer's photo, in metres east and south, from the shift that lines the
 * satellite photo up with Google Solar's own (`satelliteShift`, in the photo's pixels at 2x): a true point shows
 * on the satellite photo the shift's opposite away.
 */
export function modelOffset(shift: { x: number; y: number }, lat: number): Pt {
  const perPixel = metresPerPixel(lat) / 2;
  return { x: cm(-shift.x * perPixel) || 0, y: cm(-shift.y * perPixel) || 0 };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** When Google photographed a roof, in words ("December 2018"), from its "2018-12"; null when it doesn't say. */
export function imageryWhen(date: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(date ?? "");
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Why panels aren't placed from Google's model when its photo of the roof doesn't match today's. */
export function mismatchNote(date: string | null | undefined): string {
  const when = imageryWhen(date);
  return (
    `Google's roof data${when ? ` (photographed ${when})` : ""} doesn't line up with today's photo, so the roof may have changed since. ` +
    "Trace the roof faces on the picture and ask again: panels are laid on what you trace."
  );
}
