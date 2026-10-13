/**
 * The roof as a drawing, for the designer's drawing mode: the photo put
 * away and the roof's faces drawn plainly in its place. Pure, tested.
 *
 * A face comes from one of two places. The faces traced in the designer are
 * exact, and are drawn as they are. Where Google's roof model is to hand
 * (every spot a panel fits, face by face), each of its faces is drawn as the
 * outline round its spots: the part of that face panels can go on, which is
 * close to the face itself but never its exact edges. It is a picture to
 * design and present on, not a survey.
 */
import type { RoofModel } from "../roof-layout";

export interface DrawnFace {
  /** Its corners, in metres from the middle of the picture (east, south), in order round the face. */
  points: { x: number; y: number }[];
  /** The way it faces, degrees clockwise from north, and its pitch. */
  azimuth: number;
  pitch: number;
}

type P = { x: number; y: number };

/** The outline round a set of points (Andrew's monotone chain), anticlockwise, without the points in between. */
export function hull(points: readonly P[]): P[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: P[]) => {
    const out: P[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

/** How far a drawn face reaches past its outermost panel spots: a little, as a roof's edge does. */
const EDGE = 0.35;

/**
 * Google's roof model as faces to draw: for each of its faces with panel
 * spots, the outline round those spots (each spot the size of Google's own
 * panel, turned to the face and shortened down the slope as it is seen from
 * above), reaching `EDGE` past them. A face with no spots isn't drawn.
 */
export function facesFromModel(model: RoofModel, centre: { lat: number; lng: number }): DrawnFace[] {
  const mLat = 111_132.954 - 559.822 * Math.cos((2 * centre.lat * Math.PI) / 180);
  const mLng = 111_412.84 * Math.cos((centre.lat * Math.PI) / 180);
  const corners = new Map<number, P[]>();
  for (const s of model.slots) {
    const face = model.faces[s.segment];
    if (!face) continue;
    const t = (face.azimuth * Math.PI) / 180;
    // On the ground, east and south: down the slope (the way the face looks), and across it.
    const down = { x: Math.sin(t), y: -Math.cos(t) };
    const side = { x: Math.cos(t), y: Math.sin(t) };
    const portrait = s.orientation === "PORTRAIT";
    const alongDown = ((portrait ? model.panel.heightM : model.panel.widthM) * Math.cos((face.pitch * Math.PI) / 180)) / 2 + EDGE;
    const alongSide = (portrait ? model.panel.widthM : model.panel.heightM) / 2 + EDGE;
    const x = (s.lng - centre.lng) * mLng;
    const y = -(s.lat - centre.lat) * mLat;
    const list = corners.get(s.segment) ?? [];
    for (const [a, b] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])
      list.push({ x: x + a * alongDown * down.x + b * alongSide * side.x, y: y + a * alongDown * down.y + b * alongSide * side.y });
    corners.set(s.segment, list);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return [...corners.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([segment, list]) => ({
      points: hull(list).map((p) => ({ x: round(p.x), y: round(p.y) })),
      azimuth: model.faces[segment].azimuth,
      pitch: model.faces[segment].pitch,
    }))
    .filter((f) => f.points.length >= 3);
}

/**
 * The grey a face is drawn in: lit from the north-west, so faces that look
 * different ways read as different planes, as on a hipped roof seen from
 * above. A flat face takes the middle grey.
 */
export function faceShade(azimuth: number, pitch: number): string {
  const lit = pitch < 2 ? 0 : Math.cos(((azimuth - 315) * Math.PI) / 180);
  const level = Math.round(132 + lit * 16);
  const hex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${hex(level - 4)}${hex(level)}${hex(level + 7)}`;
}

// ---------------------------------------------------------------------------
// The ground around the roof: lawn, trees and paving, read from the photo's colours
// ---------------------------------------------------------------------------

/** What a patch of ground is drawn as. */
export type Ground = "lawn" | "tree" | "paved" | "built";

/** The flat colour each is drawn in. */
export const GROUND_COLOURS: Record<Ground, [number, number, number]> = {
  lawn: [76, 107, 69],
  tree: [52, 80, 49],
  paved: [169, 167, 161],
  built: [112, 117, 124],
};

/**
 * What one pixel of the photo from above most likely is, by its colour
 * alone: green is growing (dark green a tree's canopy, lighter green lawn),
 * pale and colourless is paving (a drive, a path, the road), and the rest is
 * taken to be built (roofs, sheds, cars). A reading of colour, not a survey:
 * a shadow reads as whatever is darkest near it, and a grey roof next door
 * reads as paving.
 */
export function groundOf(r: number, g: number, b: number): Ground {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const green = g >= r * 1.04 && g >= b * 1.04;
  if (green) return max < 92 ? "tree" : "lawn";
  // Deep shade with no colour of its own: under and beside trees far more often than not.
  if (max < 58) return "tree";
  if (max - min < 30 && max > 118) return "paved";
  return "built";
}

const KINDS: Ground[] = ["lawn", "tree", "paved", "built"];

/**
 * A grid of ground, tidied: each cell takes what most of the cells around
 * it are, so the picture is a few plain shapes rather than speckle. Done
 * `passes` times over a square `reach` cells out each way.
 */
export function tidyGround(cells: Ground[], width: number, height: number, reach = 3, passes = 3): Ground[] {
  let now = cells;
  for (let pass = 0; pass < passes; pass++) {
    const next = new Array<Ground>(now.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const count = [0, 0, 0, 0];
        for (let dy = -reach; dy <= reach; dy++)
          for (let dx = -reach; dx <= reach; dx++) {
            const yy = Math.min(height - 1, Math.max(0, y + dy));
            const xx = Math.min(width - 1, Math.max(0, x + dx));
            count[KINDS.indexOf(now[yy * width + xx])] += 1;
          }
        next[y * width + x] = KINDS[count.indexOf(Math.max(...count))];
      }
    now = next;
  }
  return now;
}
