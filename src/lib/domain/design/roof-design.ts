/**
 * The roof designer: panels laid out on a roof seen from above. This file is
 * the geometry and the arithmetic; the screen is
 * `components/design/roof-designer.tsx`. Pure, tested.
 *
 * A design is a handful of roof faces. Each face is an outline traced on the
 * image, plus how its panels sit (the direction the rows run, portrait or
 * landscape, how far in from the edge). The panels themselves aren't stored:
 * they're worked out from the face every time, so a face can be reshaped and
 * its panels follow. Only the panels someone has switched off are remembered.
 *
 * What it is not: it knows nothing about shade or the roof's real height, so
 * the output figure is rough and says so. It doesn't replace a site check.
 * VERIFY: the panel's size, the gap between panels, the default
 * setback, and the pitch a new face starts at. What a panel makes at its tilt
 * and direction is worked out in `tilt.ts`.
 */
import { MONTH_DAYS, TILT, sunOnPlane, yearOnPlane } from "./tilt";

/** What the layout needs to know about a panel: its output, and its size in metres with the gap left between panels. */
export interface PanelSize {
  watts: number;
  long: number;
  short: number;
  gap: number;
}

/** The panel the costing uses unless a design names another, in metres. */
export const PANEL: PanelSize = { watts: 475, long: 1.762, short: 1.134, gap: 0.02 };

/**
 * The panel a design is drawn with, chosen from the price list (`panelCatalogue` in `pricing.ts`). It is kept
 * in the design as it was when chosen, so a design reads the same after the price list changes, and so the
 * customer's page can count kilowatts without ever seeing the price list.
 */
export interface PanelSpec {
  sku: string;
  name: string;
  watts: number;
  long: number;
  short: number;
}

/** The size and output of the panel a design is drawn with: its own, or the costing's. */
export function panelOf(design: { panel?: PanelSpec }): PanelSize {
  return design.panel ? { watts: design.panel.watts, long: design.panel.long, short: design.panel.short, gap: PANEL.gap } : PANEL;
}

/** The satellite picture the design sits on (`/api/project/roof`): its size in CSS pixels and its zoom. */
export const ROOF_IMAGE = { width: 640, height: 400, zoom: 20 } as const;

/** Metres on the ground for each pixel of the picture, at a latitude (Web Mercator). */
export function metresPerPixel(lat: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** ROOF_IMAGE.zoom;
}

/** A point on the roof, in metres from the middle of the picture: x to the east, y to the south. */
export interface Point {
  x: number;
  y: number;
}

export const FACINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Facing = (typeof FACINGS)[number];

const turn360 = (degrees: number) => ((degrees % 360) + 360) % 360;

export interface Face {
  id: string;
  /** Its outline, in order. */
  points: Point[];
  /** The direction the rows of panels run, in degrees clockwise from east-west. */
  angle: number;
  /** Panels on their sides (long edge along the row). */
  landscape: boolean;
  /** Clear distance kept from the face's edges, in metres. */
  setback: number;
  /** Roughly which way the face slopes down. The exact direction is square to the rows, on this side: see `faceFacing`. */
  facing: Facing;
  /** The roof's pitch here, in degrees up from flat. A face saved before this existed takes `TILT.roof`. */
  tilt?: number;
  /** Places in the grid where a panel has been taken out. */
  off: number[];
  /**
   * Its grid drawn at the panels' true size from above (shorter down the slope by the cosine of the pitch), as
   * panels placed by hand are (`planSize`). Faces traced before this have full-length places, so the places
   * switched off and the strings saved with them still mean the same panels.
   */
  plan?: boolean;
}

/**
 * A panel placed by hand: anywhere, at any angle. A face's grid is the quick way to fill a roof; these are
 * for everything a grid can't do (one panel turned to fit beside a skylight, a short row on a dormer). A grid
 * panel becomes one of these the moment it is moved or turned.
 */
export interface LoosePanel {
  id: string;
  /** Its centre, in metres from the middle of the picture. */
  x: number;
  y: number;
  /**
   * Degrees clockwise that its long edge is turned from north-south, all the way round: a panel looks the same
   * turned half way, but it then faces the other way. It faces along its long edge, towards `angle`.
   */
  angle: number;
  /** On its side on the roof: it faces across its long edge instead, a quarter turn clockwise of `angle`. */
  across?: boolean;
  /** Degrees up from flat. One placed before this existed takes `TILT.roof`. */
  tilt?: number;
}

/**
 * The compass direction a face's panels look, in degrees clockwise from north: square to the rows (panels sit
 * along the gutter and look down the slope), on whichever side is nearer the way the face is said to point.
 */
export function faceFacing(face: Pick<Face, "angle" | "facing">): number {
  const said = FACINGS.indexOf(face.facing) * 45;
  const away = (bearing: number) => Math.abs(((bearing - said + 540) % 360) - 180);
  const one = turn360(face.angle);
  const other = turn360(face.angle + 180);
  return away(one) <= away(other) ? one : other;
}

/** The compass direction a panel placed by hand looks. */
export function panelFacing(panel: Pick<LoosePanel, "angle" | "across">): number {
  return turn360(panel.angle + (panel.across ? 90 : 0));
}

const tiltOf = (thing: { tilt?: number }) => thing.tilt ?? TILT.roof;

export interface RoofDesign {
  lat: number;
  lng: number;
  faces: Face[];
  /** Panels placed by hand. Designs saved before these existed have none. */
  loose?: LoosePanel[];
  /** How the panels are wired: each string is its panels in the order they are joined. */
  strings?: PanelString[];
  /** Labels on the drawing: where the inverter, battery and switchboard go, and notes. */
  labels?: DesignLabel[];
  /** The team's discussion, pinned to spots on the drawing. Saved the moment something is said, not with "Save design". */
  comments?: DesignComment[];
  /** The panel it is drawn with. Without one it is the costing's panel (`PANEL`). */
  panel?: PanelSpec;
  /**
   * The inverters its strings are checked against and its quote is costed with: one, or more on a larger system
   * (the same model twice is two entries). With none the costing picks one by size.
   */
  inverters?: InverterSpec[];
  /** The battery, when the design has one. */
  battery?: DesignBattery;
  /** A few words to tell this design from the roof's others ("All on the north face"). */
  label?: string;
  /** What "Design it for me" made it for (`self-design.ts`): kept even when the label is changed. */
  goal?: DesignGoal;
  /** The design the business recommends among those offered (1 Nov 2026, as Primero's): marked "Recommended" for the customer. One at most. */
  recommended?: true;
  /** Offered to the customer as an option beside the primary on the next proposal published (as Primero's), up to five in all. */
  offer?: true;
  /** Guide lines drawn along roof edges, to line panels up with and measure from. Never shown to the customer. */
  guides?: GuideLine[];
  /** Where the main switchboard (MSB) is, marked on the drawing like the inverter and battery (Martin). */
  switchboard?: Point;
}

/** The outcomes "Design it for me" designs for: the quickest payback, the best return, the most independence. */
export const DESIGN_GOALS = ["payback", "return", "independence"] as const;
export type DesignGoal = (typeof DESIGN_GOALS)[number];

/** A straight line between two points on the roof: a reference to lay panels out against. */
export interface GuideLine {
  id: string;
  a: Point;
  b: Point;
}

/** The parts of a design that say where its panels are and what they are. */
export type Layout = Pick<RoofDesign, "faces" | "loose" | "panel">;

/** One thing someone said in a comment's thread. */
export interface CommentNote {
  /** The signed-in admin who said it, as the server knows them: never taken from the browser. */
  by: string;
  /** When, as an ISO date and time. */
  at: string;
  text: string;
}

/** A speech bubble pinned to a spot on the drawing: a short thread between the people working on the design. */
export interface DesignComment {
  id: string;
  x: number;
  y: number;
  resolved: boolean;
  notes: CommentNote[];
}

export type CommentOp =
  | { do: "add"; x: number; y: number; text: string }
  | { do: "reply"; id: string; text: string }
  | { do: "resolve"; id: string; resolved: boolean }
  | { do: "remove"; id: string };

const COMMENT_LIMITS = { threads: 60, notes: 30, text: 500 } as const;
const said = (text: unknown) =>
  typeof text === "string"
    ? text
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, COMMENT_LIMITS.text)
    : "";

/**
 * One change to the discussion, applied to the comments as saved: a new bubble, a reply, resolving or
 * removing one. `by` and `at` come from the server. Returns null when the change makes no sense
 * (nothing said, a bubble that isn't there, or the discussion is full).
 */
export function applyCommentOp(comments: DesignComment[], op: unknown, by: string, at: string, id: string): DesignComment[] | null {
  if (!op || typeof op !== "object") return null;
  const o = op as Record<string, unknown>;
  if (o.do === "add") {
    const x = finite(o.x, -LIMITS.metres, LIMITS.metres);
    const y = finite(o.y, -LIMITS.metres, LIMITS.metres);
    const text = said(o.text);
    if (x === null || y === null || !text || comments.length >= COMMENT_LIMITS.threads) return null;
    return [...comments, { id, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, resolved: false, notes: [{ by, at, text }] }];
  }
  const target = comments.find((c) => c.id === o.id);
  if (!target) return null;
  if (o.do === "remove") return comments.filter((c) => c !== target);
  if (o.do === "resolve") return comments.map((c) => (c === target ? { ...c, resolved: o.resolved === true } : c));
  if (o.do === "reply") {
    const text = said(o.text);
    if (!text || target.notes.length >= COMMENT_LIMITS.notes) return null;
    // Saying something more reopens a resolved bubble: the conversation isn't over.
    return comments.map((c) => (c === target ? { ...c, resolved: false, notes: [...c.notes, { by, at, text }] } : c));
  }
  return null;
}

/** A string of panels, in wiring order. A panel is named the way `designPanels` names it, and is in one string at most. */
export interface PanelString {
  id: string;
  panels: string[];
  /** Which of the design's inverters it is wired to, counting from 0. Without one it is on the first. */
  inverter?: number;
  /** Which of that inverter's inputs (MPPTs), counting from 0. Without one it is on the first. */
  mppt?: number;
}

/** The inverter a design is drawn for, chosen from the price list and kept as it was when chosen. */
export const MAX_INVERTERS = 6;

/**
 * The battery a design is drawn with, chosen from the price list and kept as it was when chosen: the product,
 * how many of it (modules, for a modular one), and the spot on the picture where it will stand.
 */
export interface DesignBattery {
  sku: string;
  name: string;
  /** What one of it holds, kWh. */
  kwh: number;
  qty: number;
  x: number;
  y: number;
  /**
   * Wired to keep chosen circuits on in a blackout, with one of its modules held back for it: that module isn't
   * counted in the evenings it covers (`shiftingKwhOf`), and the quote adds the backup wiring.
   */
  backup?: boolean;
}
export const MAX_BATTERY_QTY = 16;

export interface InverterSpec {
  sku: string;
  name: string;
  kw: number;
  /** Where it stands on the drawing, in metres from the middle of the picture, once it has been put in its place. */
  x?: number;
  y?: number;
}

/** Where an inverter is drawn: where it was put, or until then a place of its own to the right of the picture, one under the next. */
export function inverterSpot(spec: Pick<InverterSpec, "x" | "y">, index: number, lat: number): Point {
  if (typeof spec.x === "number" && typeof spec.y === "number") return { x: spec.x, y: spec.y };
  const k = metresPerPixel(lat);
  return {
    x: Math.round(ROOF_IMAGE.width * 0.3 * k * 100) / 100,
    y: Math.round((-0.3 + index * 0.11) * ROOF_IMAGE.height * k * 100) / 100,
  };
}

export const LABEL_KINDS = ["Inverter", "Battery", "Switchboard", "Meter", "Note"] as const;
export type LabelKind = (typeof LABEL_KINDS)[number];

/** A label pinned to a spot on the drawing. A note carries its own words; the others are named by their kind. */
export interface DesignLabel {
  id: string;
  x: number;
  y: number;
  kind: LabelKind;
  text: string;
}

export interface PlacedPanel {
  /** Its place in the face's grid: stable while the face's outline and angle don't change. */
  index: number;
  corners: [Point, Point, Point, Point];
}

const rotate = (p: Point, degrees: number): Point => {
  const a = (degrees * Math.PI) / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
};

export function inside(p: Point, polygon: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

function distanceToEdge(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Whether a point is inside an outline and at least `margin` metres from each of its edges. */
export const clearOf = (p: Point, polygon: Point[], margin: number) =>
  inside(p, polygon) && polygon.every((a, i) => distanceToEdge(p, a, polygon[(i + 1) % polygon.length]) >= margin - 1e-9);

/** The four corners of a panel placed by hand. */
/**
 * A panel placed by hand, as seen from above: on a slope (or a tilt frame) the edge running down it is shorter by
 * the cosine of its tilt, so a panel is drawn where it really sits on the roof in the photo (`w` across its long
 * edge's side, `h` along it, before it is turned). Two rows of full-length panels on a 25° roof otherwise reach
 * past the ridge on the picture while the real ones don't (Martin, 3 Bill Place).
 */
export function planSize(panel: Pick<LoosePanel, "across" | "tilt">, size: PanelSize = PANEL): { w: number; h: number } {
  const k = Math.cos(((panel.tilt ?? TILT.roof) * Math.PI) / 180);
  return panel.across ? { w: size.short * k, h: size.long } : { w: size.short, h: size.long * k };
}

export function looseCorners(panel: LoosePanel, size: PanelSize = PANEL): PlacedPanel["corners"] {
  const plan = planSize(panel, size);
  const w = plan.w / 2;
  const h = plan.h / 2;
  return [
    { x: -w, y: -h },
    { x: w, y: -h },
    { x: w, y: h },
    { x: -w, y: h },
  ].map((c) => {
    const turned = rotate(c, panel.angle);
    return { x: turned.x + panel.x, y: turned.y + panel.y };
  }) as PlacedPanel["corners"];
}

/**
 * A panel lying exactly where it lies, but facing `facing` (as Primero's: a panel turned on its side with the 90°
 * button and clicked onto a portrait array kept its turned arrow, so one array faced two ways). Its long edge stays
 * put: along the facing it is upright, square to it it is on its side. Null when it lies neither way to the facing.
 */
export function facingLike(panel: Pick<LoosePanel, "angle">, facing: number, within = 3): Pick<LoosePanel, "angle" | "across"> | null {
  const turn = squareTurn(panel, { angle: facing }, within);
  if (turn === null) return null;
  return turn === 0 ? { angle: turn360(facing), across: false } : { angle: turn360(facing + 270), across: true };
}

/** Whether two panels lie square to each other: the same way round (0), or a quarter turn apart (90). Null otherwise. */
export function squareTurn(a: Pick<LoosePanel, "angle">, b: Pick<LoosePanel, "angle">, within = 3): 0 | 90 | null {
  const turn = (((a.angle - b.angle) % 180) + 180) % 180;
  if (Math.min(turn, 180 - turn) <= within) return 0;
  if (Math.abs(turn - 90) <= within) return 90;
  return null;
}

/** Where a panel can sit flush against another, in the other's own frame (x across its short side, y along its long side). */
export interface FlushSpot {
  x: number;
  y: number;
  /** The edge the two share, in the same frame: where the join is drawn. */
  join: [Point, Point];
}

/**
 * Every place `mover` can sit flush against `from` (as Primero's: a landscape panel clicks against a portrait one like a
 * magnet), each drawn at its true size from above (`planSize`): beside it, against its long sides, or a row on,
 * against its short sides, a gap apart, its edge lined up with the other's end or middle; and, when both lie the same
 * way round, at its corners. `mover` lies the way it will be laid: the same way round as `from`, or a quarter turn.
 */
export function flushSpots(
  from: Pick<LoosePanel, "across" | "tilt">,
  mover: Pick<LoosePanel, "across" | "tilt">,
  size: PanelSize = PANEL,
): FlushSpot[] {
  const quarter = Boolean(from.across) !== Boolean(mover.across);
  const op = planSize(from, size);
  const mp = planSize(mover, size);
  const ow = op.w / 2;
  const oh = op.h / 2;
  const mw = (quarter ? mp.h : mp.w) / 2;
  const mh = (quarter ? mp.w : mp.h) / 2;
  const out: FlushSpot[] = [];
  const add = (x: number, y: number, join: [Point, Point]) => {
    if (!out.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6)) out.push({ x, y, join });
  };
  for (const side of [-1, 1]) {
    const bx = side * (ow + mw + size.gap);
    for (const y of [0, oh - mh, mh - oh])
      add(bx, y, [
        { x: side * (ow + size.gap / 2), y: Math.max(-oh, y - mh) },
        { x: side * (ow + size.gap / 2), y: Math.min(oh, y + mh) },
      ]);
    const ry = side * (oh + mh + size.gap);
    for (const x of [0, ow - mw, mw - ow])
      add(x, ry, [
        { x: Math.max(-ow, x - mw), y: side * (oh + size.gap / 2) },
        { x: Math.min(ow, x + mw), y: side * (oh + size.gap / 2) },
      ]);
  }
  if (!quarter)
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const c = { x: sx * (ow + size.gap / 2), y: sy * (oh + size.gap / 2) };
        add(sx * (2 * ow + size.gap), sy * (2 * oh + size.gap), [c, c]);
      }
  return out;
}

/**
 * Where a new panel laid `landscape` (or not) clicks flush against a panel near the pointer that lies the other way
 * (as Primero's): the nearest flush spot within `reach` metres of the pointer that overlaps nothing, facing the way that
 * panel faces, with the edge they share for drawing. Null when there is none, or the panels near lie the same way.
 */
export function flushGhostAt(
  p: Point,
  standing: readonly LoosePanel[],
  landscape: boolean,
  size: PanelSize = PANEL,
  reach = 1.2,
): { ghost: LoosePanel; join: [Point, Point]; away: number } | null {
  let best: { ghost: LoosePanel; join: [Point, Point]; away: number } | null = null;
  for (const from of standing) {
    if (Boolean(from.across) === landscape) continue;
    const facing = panelFacing(from);
    const local = toPanelFrame(from, p);
    for (const spot of flushSpots(from, { across: landscape, tilt: from.tilt }, size)) {
      const away = Math.hypot(local.x - spot.x, local.y - spot.y);
      if (away > reach || (best && away >= best.away)) continue;
      const at = fromPanelFrame(from, spot);
      const { across: _was, ...rest } = from;
      void _was;
      const ghost: LoosePanel = {
        ...rest,
        id: "ghost",
        x: Math.round(at.x * 100) / 100,
        y: Math.round(at.y * 100) / 100,
        angle: landscape ? turn360(facing + 270) : turn360(facing),
        ...(landscape ? { across: true } : {}),
      };
      if (standing.some((other) => panelsOverlap(ghost, other, size))) continue;
      best = { ghost, join: [fromPanelFrame(from, spot.join[0]), fromPanelFrame(from, spot.join[1])], away };
    }
  }
  return best;
}

/** A point in a panel's own frame, on the roof. */
export function fromPanelFrame(panel: Pick<LoosePanel, "x" | "y" | "angle">, local: Point): Point {
  const turned = rotate(local, panel.angle);
  return { x: turned.x + panel.x, y: turned.y + panel.y };
}

/** A point on the roof, in a panel's own frame. */
export function toPanelFrame(panel: Pick<LoosePanel, "x" | "y" | "angle">, p: Point): Point {
  return rotate({ x: p.x - panel.x, y: p.y - panel.y }, -panel.angle);
}

/** Whether two panels overlap (touching or a gap apart doesn't count), whichever way each is turned. */
export function panelsOverlap(a: LoosePanel, b: LoosePanel, size: PanelSize = PANEL): boolean {
  const pa = looseCorners(a, size);
  const pb = looseCorners(b, size);
  const slack = size.gap / 2;
  for (const poly of [pa, pb])
    for (let i = 0; i < 4; i++) {
      const e = { x: poly[(i + 1) % 4].x - poly[i].x, y: poly[(i + 1) % 4].y - poly[i].y };
      const n = Math.hypot(e.x, e.y) || 1;
      const axis = { x: -e.y / n, y: e.x / n };
      const on = (pts: readonly Point[]) => pts.map((p) => p.x * axis.x + p.y * axis.y);
      const ra = on(pa);
      const rb = on(pb);
      if (Math.max(...ra) <= Math.min(...rb) + slack || Math.max(...rb) <= Math.min(...ra) + slack) return false;
    }
  return true;
}

/**
 * A grid panel as one placed by hand, exactly where it stands: what it becomes when someone moves or turns
 * it. The caller also switches its place in the grid off.
 */
export function freed(face: Face, place: PlacedPanel, id: string): LoosePanel {
  const x = place.corners.reduce((n, c) => n + c.x, 0) / 4;
  const y = place.corners.reduce((n, c) => n + c.y, 0) / 4;
  // It keeps looking the way the face does, at the face's pitch. On its side, that is across its long edge.
  const facing = faceFacing(face);
  return {
    id,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    angle: turn360(facing - (face.landscape ? 90 : 0)),
    across: face.landscape,
    tilt: tiltOf(face),
  };
}

/** The area of a face seen from above, in square metres. */
export function faceArea(face: Pick<Face, "points">): number {
  const p = face.points;
  return Math.abs(p.reduce((sum, a, i) => sum + a.x * p[(i + 1) % p.length].y - p[(i + 1) % p.length].x * a.y, 0)) / 2;
}

/**
 * Every place a panel fits on a face: a grid laid along the face's rows, kept
 * `setback` in from every edge. Includes the places switched off (`face.off`):
 * the caller decides whether to draw them.
 */
/** How much shorter a face's places are down its slope, seen from above: by the cosine of its pitch, for faces drawn that way (`plan`). */
const downSlope = (face: Pick<Face, "plan" | "tilt">) => (face.plan ? Math.cos(((face.tilt ?? TILT.roof) * Math.PI) / 180) : 1);

/** How many rows and columns a face's grid has: a place's `index` is its row × `columns` + its column. */
export function faceGrid(face: Face, size: PanelSize = PANEL): { rows: number; columns: number } {
  if (face.points.length < 3) return { rows: 0, columns: 0 };
  const turned = face.points.map((p) => rotate(p, -face.angle));
  const width = face.landscape ? size.long : size.short;
  const height = (face.landscape ? size.short : size.long) * downSlope(face);
  const xs = turned.map((p) => p.x);
  const ys = turned.map((p) => p.y);
  return {
    columns: Math.max(0, Math.floor((Math.max(...xs) - Math.min(...xs)) / (width + size.gap))),
    rows: Math.max(0, Math.floor((Math.max(...ys) - Math.min(...ys)) / (height + size.gap))),
  };
}

export function panelPlaces(face: Face, size: PanelSize = PANEL): PlacedPanel[] {
  if (face.points.length < 3) return [];
  // Work in the face's own frame, where the rows run straight across.
  const turned = face.points.map((p) => rotate(p, -face.angle));
  const width = face.landscape ? size.long : size.short;
  const height = (face.landscape ? size.short : size.long) * downSlope(face);
  const minX = Math.min(...turned.map((p) => p.x));
  const maxX = Math.max(...turned.map((p) => p.x));
  const minY = Math.min(...turned.map((p) => p.y));
  const maxY = Math.max(...turned.map((p) => p.y));
  const { columns, rows } = faceGrid(face, size);
  if (columns < 1 || rows < 1 || columns * rows > 4000) return [];
  // Centre the grid in the face's bounds, so the spare room is shared between both sides.
  const startX = minX + (maxX - minX - (columns * (width + size.gap) - size.gap)) / 2;
  const startY = minY + (maxY - minY - (rows * (height + size.gap) - size.gap)) / 2;
  const places: PlacedPanel[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = startX + column * (width + size.gap);
      const y = startY + row * (height + size.gap);
      const corners = [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ];
      if (!corners.every((corner) => clearOf(corner, turned, face.setback))) continue;
      places.push({ index: row * columns + column, corners: corners.map((c) => rotate(c, face.angle)) as PlacedPanel["corners"] });
    }
  }
  return places;
}

/** The panels actually on a face: every place that fits, less the ones switched off. */
export function facePanels(face: Face, size: PanelSize = PANEL): PlacedPanel[] {
  const off = new Set(face.off);
  return panelPlaces(face, size).filter((p) => !off.has(p.index));
}

export interface DesignSummary {
  panels: number;
  /** Rounded to two places, as a system size is quoted. */
  kw: number;
  /** A rough daily figure averaged over a year, for each panel's tilt and direction: no shade, a first read only. */
  kwhPerDay: number;
  faces: { id: string; facing: Facing; panels: number; kw: number }[];
}

/** How every panel in a design sits: its tilt and the direction it looks. A panel in a row sits as its face does. */
export function panelAspects(design: Layout): { tilt: number; facing: number }[] {
  return [
    ...design.faces.flatMap((face) => facePanels(face, panelOf(design)).map(() => ({ tilt: tiltOf(face), facing: faceFacing(face) }))),
    ...(design.loose ?? []).map((panel) => ({ tilt: tiltOf(panel), facing: panelFacing(panel) })),
  ];
}

/**
 * What a design makes in an average day of each month, in kilowatt-hours, before rounding. `yieldPerKwDay` is
 * the site's setting: what a kilowatt of panels makes a day over a year, taken to be for a north roof at
 * `TILT.roof`. Every panel is that, scaled by the sunshine on its own tilt and direction (`tilt.ts`).
 */
function dailyByMonth(design: Layout, yieldPerKwDay: number): number[] {
  const perSun = ((panelOf(design).watts / 1000) * yieldPerKwDay) / yearOnPlane(TILT.roof, 0);
  const months = new Array<number>(12).fill(0);
  for (const { tilt, facing } of panelAspects(design)) sunOnPlane(tilt, facing).forEach((sun, m) => (months[m] += sun * perSun));
  return months;
}

export function designSummary(design: Layout, yieldPerKwDay = 3.6): DesignSummary {
  const size = panelOf(design);
  const faces = design.faces.map((face) => {
    const panels = facePanels(face, size).length;
    return { id: face.id, facing: face.facing, panels, kw: Math.round(panels * size.watts) / 1000 };
  });
  // A panel placed by hand is counted with the face it stands on. What it makes goes by its own tilt and direction.
  let stray = 0;
  for (const panel of design.loose ?? []) {
    const on = design.faces.findIndex((face) => inside(panel, face.points));
    if (on < 0) stray += 1;
    else {
      faces[on].panels += 1;
      faces[on].kw = Math.round(faces[on].panels * size.watts) / 1000;
    }
  }
  const panels = faces.reduce((n, f) => n + f.panels, 0) + stray;
  const kwh = dailyByMonth(design, yieldPerKwDay).reduce((n, day, m) => n + day * MONTH_DAYS[m], 0) / 365;
  return { panels, kw: Math.round(panels * size.watts) / 1000, kwhPerDay: Math.floor(kwh * 10) / 10, faces };
}

/**
 * The direction of a face's longest edge, as a row angle. On nearly every roof face the longest edge is the
 * gutter or the ridge, which is what panels are lined up with, so this is where a new face's rows start:
 * whichever corner the tracing began at. (It first followed the first edge drawn, which sent the rows up a
 * hip whenever someone started there.)
 */
export function angleOfLongestEdge(face: Pick<Face, "points">): number {
  const p = face.points;
  let best = 0;
  let degrees = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > best) {
      best = length;
      degrees = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    }
  }
  // Rows are the same either way round: keep the angle between -90 and 90.
  if (degrees > 90) degrees -= 180;
  if (degrees <= -90) degrees += 180;
  return Math.round(degrees);
}

const LIMITS = { faces: 16, points: 16, metres: 80, off: 400, loose: 300 } as const;

const finite = (n: unknown, min: number, max: number): number | null =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max ? n : null;

/** A design from outside (the browser, or a saved copy), checked and trimmed. Null when it isn't one. */
export function cleanDesign(raw: unknown): RoofDesign | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as {
    lat?: unknown;
    lng?: unknown;
    faces?: unknown;
    panel?: unknown;
    inverter?: unknown;
    inverters?: unknown;
    battery?: unknown;
    label?: unknown;
    goal?: unknown;
    recommended?: unknown;
    offer?: unknown;
  };
  const battery = cleanBattery(r.battery);
  const panel = cleanPanel(r.panel);
  // A design saved when there could only be one inverter kept it as `inverter`.
  const inverters = (Array.isArray(r.inverters) ? r.inverters : [r.inverter])
    .slice(0, MAX_INVERTERS)
    .map(cleanInverter)
    .filter((i): i is InverterSpec => i !== undefined);
  const label =
    typeof r.label === "string"
      ? r.label
          .replace(/[\u0000-\u001f\u007f]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 40)
      : "";
  const lat = finite(r.lat, -39.3, -33.9);
  const lng = finite(r.lng, 140.9, 150.1);
  if (lat === null || lng === null || !Array.isArray(r.faces)) return null;
  const faces: Face[] = [];
  for (const f of r.faces.slice(0, LIMITS.faces) as Record<string, unknown>[]) {
    if (!f || typeof f !== "object" || !Array.isArray(f.points)) return null;
    const points: Point[] = [];
    for (const p of f.points.slice(0, LIMITS.points) as Record<string, unknown>[]) {
      const x = finite(p?.x, -LIMITS.metres, LIMITS.metres);
      const y = finite(p?.y, -LIMITS.metres, LIMITS.metres);
      if (x === null || y === null) return null;
      points.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    }
    if (points.length < 3) continue;
    const off = Array.isArray(f.off)
      ? [...new Set(f.off.filter((n): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 4000))].slice(
          0,
          LIMITS.off,
        )
      : [];
    faces.push({
      id: typeof f.id === "string" && /^[a-z0-9]{1,12}$/.test(f.id) ? f.id : `f${faces.length + 1}`,
      points,
      angle: Math.round(finite(f.angle, -90, 90) ?? 0),
      landscape: f.landscape === true,
      setback: Math.round((finite(f.setback, 0, 2) ?? 0.3) * 10) / 10,
      facing: FACINGS.includes(f.facing as Facing) ? (f.facing as Facing) : "N",
      tilt: Math.round(finite(f.tilt, 0, TILT.max) ?? TILT.roof),
      off: off.sort((a, b) => a - b),
      ...(f.plan === true ? { plan: true } : {}),
    });
  }
  const loose: LoosePanel[] = [];
  for (const p of (Array.isArray((r as { loose?: unknown }).loose) ? (r as { loose: unknown[] }).loose : []).slice(
    0,
    LIMITS.loose,
  ) as Record<string, unknown>[]) {
    const x = finite(p?.x, -LIMITS.metres, LIMITS.metres);
    const y = finite(p?.y, -LIMITS.metres, LIMITS.metres);
    const angle = finite(p?.angle, -360, 360);
    if (x === null || y === null || angle === null) continue;
    const tilt = finite(p?.tilt, 0, TILT.max);
    const panel: LoosePanel = {
      id: typeof p.id === "string" && /^[a-z0-9]{1,12}$/.test(p.id) ? p.id : `p${loose.length + 1}`,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      angle: turn360(Math.round(angle)),
      across: p.across === true,
      tilt: Math.round(tilt ?? TILT.roof),
    };
    if (tilt === null) {
      // Placed before panels had a direction of their own: it looks the way the face under it does (north, off
      // every face), as nearly as it can without being turned, at that face's pitch.
      const on = faces.find((face) => inside(panel, face.points));
      const want = on ? faceFacing(on) : 0;
      const away = (quarters: number) => Math.abs(((panel.angle + quarters * 90 - want + 540) % 360) - 180);
      const quarters = [0, 1, 2, 3].reduce((best, q) => (away(q) < away(best) ? q : best), 0);
      panel.angle = turn360(panel.angle + (quarters >= 2 ? 180 : 0));
      panel.across = quarters % 2 === 1;
      panel.tilt = on ? tiltOf(on) : TILT.roof;
    }
    loose.push(panel);
  }
  // Strings: only panels that are really in the design, each in one string at most, in the order given.
  const real = new Set(designPanels({ faces, loose, panel }).map((p) => p.key));
  const strings: PanelString[] = [];
  for (const s of (Array.isArray((r as { strings?: unknown }).strings) ? (r as { strings: unknown[] }).strings : []).slice(0, 24) as Record<
    string,
    unknown
  >[]) {
    if (!s || !Array.isArray(s.panels)) continue;
    const panels: string[] = [];
    for (const k of s.panels) {
      if (typeof k !== "string" || !real.has(k)) continue;
      real.delete(k);
      panels.push(k);
    }
    if (panels.length)
      strings.push({
        id: typeof s.id === "string" && /^[a-z0-9]{1,12}$/.test(s.id) ? s.id : `s${strings.length + 1}`,
        panels,
        ...(Number.isInteger(s.inverter) && (s.inverter as number) > 0 && (s.inverter as number) < MAX_INVERTERS
          ? { inverter: s.inverter as number }
          : {}),
        ...(Number.isInteger(s.mppt) && (s.mppt as number) >= 0 && (s.mppt as number) < 12 ? { mppt: s.mppt as number } : {}),
      });
  }
  const labels: DesignLabel[] = [];
  for (const l of (Array.isArray((r as { labels?: unknown }).labels) ? (r as { labels: unknown[] }).labels : []).slice(0, 40) as Record<
    string,
    unknown
  >[]) {
    const x = finite(l?.x, -LIMITS.metres, LIMITS.metres);
    const y = finite(l?.y, -LIMITS.metres, LIMITS.metres);
    if (x === null || y === null) continue;
    labels.push({
      id: typeof l.id === "string" && /^[a-z0-9]{1,12}$/.test(l.id) ? l.id : `n${labels.length + 1}`,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      kind: LABEL_KINDS.includes(l.kind as LabelKind) ? (l.kind as LabelKind) : "Note",
      text:
        typeof l.text === "string"
          ? l.text
              .replace(/[\u0000-\u001f\u007f]+/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 80)
          : "",
    });
  }
  const comments: DesignComment[] = [];
  for (const c of (Array.isArray((r as { comments?: unknown }).comments) ? (r as { comments: unknown[] }).comments : []).slice(
    0,
    COMMENT_LIMITS.threads,
  ) as Record<string, unknown>[]) {
    const x = finite(c?.x, -LIMITS.metres, LIMITS.metres);
    const y = finite(c?.y, -LIMITS.metres, LIMITS.metres);
    if (x === null || y === null || !Array.isArray(c.notes)) continue;
    const notes: CommentNote[] = [];
    for (const n of c.notes.slice(0, COMMENT_LIMITS.notes) as Record<string, unknown>[]) {
      const text = said(n?.text);
      if (text) notes.push({ by: said(n.by).slice(0, 120), at: typeof n.at === "string" ? n.at.slice(0, 30) : "", text });
    }
    if (!notes.length) continue;
    comments.push({
      id: typeof c.id === "string" && /^[a-z0-9]{1,12}$/.test(c.id) ? c.id : `c${comments.length + 1}`,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      resolved: c.resolved === true,
      notes,
    });
  }
  const guides: GuideLine[] = [];
  for (const g of (Array.isArray((r as { guides?: unknown }).guides) ? (r as { guides: unknown[] }).guides : []).slice(0, 24) as Record<
    string,
    { x?: unknown; y?: unknown } | undefined
  >[]) {
    const at = [g?.a?.x, g?.a?.y, g?.b?.x, g?.b?.y].map((n) => finite(n, -LIMITS.metres, LIMITS.metres));
    if (at.some((n) => n === null)) continue;
    const [ax, ay, bx, by] = at.map((n) => Math.round((n as number) * 100) / 100);
    if (Math.hypot(bx - ax, by - ay) < 0.2) continue;
    const id = (g as { id?: unknown }).id;
    guides.push({
      id: typeof id === "string" && /^[a-z0-9]{1,12}$/.test(id) ? id : `r${guides.length + 1}`,
      a: { x: ax, y: ay },
      b: { x: bx, y: by },
    });
  }
  const sx = finite((r as { switchboard?: { x?: unknown } }).switchboard?.x, -LIMITS.metres, LIMITS.metres);
  const sy = finite((r as { switchboard?: { y?: unknown } }).switchboard?.y, -LIMITS.metres, LIMITS.metres);
  return {
    lat,
    lng,
    faces,
    loose,
    strings,
    labels,
    comments,
    ...(guides.length ? { guides } : {}),
    ...(sx !== null && sy !== null ? { switchboard: { x: Math.round(sx * 100) / 100, y: Math.round(sy * 100) / 100 } } : {}),
    ...(panel ? { panel } : {}),
    ...(inverters.length ? { inverters } : {}),
    ...(battery ? { battery } : {}),
    ...(label ? { label } : {}),
    ...(DESIGN_GOALS.includes(r.goal as DesignGoal) ? { goal: r.goal as DesignGoal } : {}),
    ...(r.recommended === true ? { recommended: true as const } : {}),
    ...(r.offer === true ? { offer: true as const } : {}),
  };
}

function cleanBattery(raw: unknown): DesignBattery | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const p = raw as Record<string, unknown>;
  const kwh = finite(p.kwh, 0.5, 100);
  const qty = finite(p.qty, 1, MAX_BATTERY_QTY);
  const x = finite(p.x, -LIMITS.metres, LIMITS.metres);
  const y = finite(p.y, -LIMITS.metres, LIMITS.metres);
  if (typeof p.sku !== "string" || !/^[\w.+/ -]{1,40}$/.test(p.sku) || kwh === null || qty === null || x === null || y === null)
    return undefined;
  const name =
    typeof p.name === "string"
      ? p.name
          .replace(/[\u0000-\u001f\u007f]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 100)
      : "";
  return {
    sku: p.sku,
    name: name || p.sku,
    kwh,
    qty: Math.round(qty),
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    ...(p.backup === true ? { backup: true } : {}),
  };
}

function cleanInverter(raw: unknown): InverterSpec | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const p = raw as Record<string, unknown>;
  const kw = finite(p.kw, 0.2, 200);
  if (typeof p.sku !== "string" || !/^[\w.+/ -]{1,40}$/.test(p.sku) || kw === null) return undefined;
  const name =
    typeof p.name === "string"
      ? p.name
          .replace(/[\u0000-\u001f\u007f]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 100)
      : "";
  const x = finite(p.x, -200, 200);
  const y = finite(p.y, -200, 200);
  return { sku: p.sku, name: name || p.sku, kw, ...(x !== null && y !== null ? { x, y } : {}) };
}

/** Whether a string's panels all look the same way at the same tilt: a string on one input should. */
export function stringIsMixed(design: Layout, string: PanelString): boolean {
  const faces = new Map(design.faces.map((f) => [f.id, f]));
  const loose = new Map((design.loose ?? []).map((p) => [p.id, p]));
  const seen = new Set<string>();
  for (const key of string.panels) {
    const [kind, a] = key.split(":");
    const face = kind === "g" ? faces.get(a) : undefined;
    const panel = kind === "l" ? loose.get(a) : undefined;
    if (face) seen.add(`${tiltOf(face)}|${tiltOf(face) === 0 ? 0 : faceFacing(face)}`);
    else if (panel) seen.add(`${tiltOf(panel)}|${tiltOf(panel) === 0 ? 0 : panelFacing(panel)}`);
  }
  return seen.size > 1;
}

/** A panel from outside, checked: a product code, a name, and an output and size a real panel could have. */
function cleanPanel(raw: unknown): PanelSpec | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const p = raw as Record<string, unknown>;
  const watts = finite(p.watts, 250, 800);
  const long = finite(p.long, 1.2, 2.6);
  const short = finite(p.short, 0.8, 1.5);
  if (typeof p.sku !== "string" || !/^[\w.+/ -]{1,40}$/.test(p.sku) || watts === null || long === null || short === null) return undefined;
  const name =
    typeof p.name === "string"
      ? p.name
          .replace(/[\u0000-\u001f\u007f]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 100)
      : "";
  return { sku: p.sku, name: name || p.sku, watts: Math.round(watts), long, short };
}

/**
 * A roof's designs: up to ten (five until 1 Nov 2026), with one marked primary. They are options for the same roof: each has its own
 * faces, panels, strings, labels and choice of panel. The discussion is pinned to the roof, not to a design,
 * so it shows on all of them.
 *
 * Packed (`packDesignSet`), the primary is written the way a single design is (so `parseDesign` reads it) and
 * the others beside it in `others`, `slot` being the primary's place in the order.
 */
export const MAX_DESIGNS = 10;

export interface DesignSet {
  designs: RoofDesign[];
  /** Which of `designs` is the primary. */
  primary: number;
  comments: DesignComment[];
}

const bare = (design: RoofDesign): RoofDesign => ({ ...design, comments: undefined });

export function cleanDesignSet(raw: unknown): DesignSet | null {
  const first = cleanDesign(raw);
  if (!first) return null;
  const r = raw as { others?: unknown; slot?: unknown };
  const others: RoofDesign[] = [];
  for (const other of (Array.isArray(r.others) ? r.others : []).slice(0, MAX_DESIGNS - 1)) {
    // Every design is of the same roof, so they share the primary's place on the map.
    const design = other && typeof other === "object" ? cleanDesign({ ...other, lat: first.lat, lng: first.lng }) : null;
    if (design) others.push(bare(design));
  }
  const slot = Math.min(others.length, Math.max(0, Number.isInteger(r.slot) ? (r.slot as number) : 0));
  return { designs: [...others.slice(0, slot), bare(first), ...others.slice(slot)], primary: slot, comments: first.comments ?? [] };
}

/** A roof's saved designs, read back. One saved as a single design reads as a set of one. */
export function parseDesignSet(saved: string | null | undefined): DesignSet | null {
  if (!saved) return null;
  try {
    return cleanDesignSet(JSON.parse(saved));
  } catch {
    return null;
  }
}

/** A set as it is saved: see `DesignSet`. */
export function packDesignSet(set: DesignSet): Record<string, unknown> {
  const designs = set.designs.slice(0, MAX_DESIGNS);
  const slot = Math.min(designs.length - 1, Math.max(0, set.primary));
  return { ...bare(designs[slot]), comments: set.comments, slot, others: designs.filter((_, i) => i !== slot).map(bare) };
}

/** A saved design, read back. Null when there isn't one or it can't be read. */
export function parseDesign(saved: string | null | undefined): RoofDesign | null {
  if (!saved) return null;
  try {
    return cleanDesign(JSON.parse(saved));
  } catch {
    return null;
  }
}

export interface DesignPanel {
  /** "g:<face>:<place>" for a panel in a row, "l:<id>" for one placed by hand. */
  key: string;
  corners: PlacedPanel["corners"];
}

/** Every panel in a design, each with a name that stays the same while the design does. */
export function designPanels(design: Layout): DesignPanel[] {
  return [
    ...design.faces.flatMap((face) =>
      facePanels(face, panelOf(design)).map((p) => ({ key: `g:${face.id}:${p.index}`, corners: p.corners })),
    ),
    ...(design.loose ?? []).map((p) => ({ key: `l:${p.id}`, corners: looseCorners(p, panelOf(design)) })),
  ];
}

/**
 * What a design makes in each month of the year, in kilowatt-hours: Melbourne's sunshine record, turned onto
 * each panel's tilt and direction a month at a time. A tilted north panel loses a little in summer and gains
 * a lot in winter, so tilt evens the year out as well as adding to it. Still rough: no shade in it.
 */
export function monthlyProduction(design: Layout, yieldPerKwDay: number): number[] {
  return dailyByMonth(design, yieldPerKwDay).map((day, m) => Math.round(day * MONTH_DAYS[m]));
}

/** The shortest distance between two panels' outlines, in metres (0 when they overlap). */
export function panelGap(a: readonly Point[], b: readonly Point[]): number {
  if (a.some((p) => inside(p, [...b])) || b.some((p) => inside(p, [...a]))) return 0;
  let least = Infinity;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      least = Math.min(least, distanceToEdge(a[i], b[j], b[(j + 1) % 4]), distanceToEdge(b[j], a[i], a[(i + 1) % 4]));
    }
  return least;
}

/** Panels within this of each other are one array: a row's own gap, with room for a hand-placed panel a little off. */
export const ARRAY_GAP = 0.25;

/**
 * How many separate arrays a design is: groups of panels that touch, or as good as (`ARRAY_GAP`). The installer
 * prices arrays beyond the two allowed for, so the quote counts them from the drawing rather than assuming.
 */
export function arrayCount(design: Layout): number {
  const panels = designPanels(design);
  const group = panels.map((_, i) => i);
  const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])));
  for (let i = 0; i < panels.length; i++)
    for (let j = i + 1; j < panels.length; j++) if (panelGap(panels[i].corners, panels[j].corners) <= ARRAY_GAP) group[find(i)] = find(j);
  return new Set(panels.map((_, i) => find(i))).size;
}

/**
 * On a flat roof a panel only sits at a tilt on a tilt frame. Panels at more than this many degrees are taken to
 * need one when the quote's roof is flat (Martin, 18 Oct 2026: over 5°; it was 10° or more).
 */
export const TILT_FRAME_ABOVE = 5;

/** The panels sitting at a tilt that would need a frame on a flat roof, and the steepest of them. */
export function tiltedPanels(design: Layout): { count: number; steepest: number } {
  const tilts = panelAspects(design)
    .map((p) => p.tilt)
    .filter((tilt) => tilt > TILT_FRAME_ABOVE);
  return { count: tilts.length, steepest: tilts.length ? Math.max(...tilts) : 0 };
}
