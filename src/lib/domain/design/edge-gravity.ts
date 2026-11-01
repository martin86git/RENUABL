/**
 * Panels settling against the roof's edges, like gravity (Martin, 28 Oct 2026: "when I've laid panels on a roof top,
 * can they automatically pull into symmetry with the roof edges"). Pure, tested in `edge-gravity.test.ts`.
 *
 * When a group of panels is let go near a traced roof edge or a guide line, and lies within a few degrees of square
 * to it, the group is turned square to it and pulled in to sit the face's setback from it. When it then sits nearly
 * in the middle between the two ends of the face along that edge, it is centred. Only edges the team has drawn
 * count: the picture itself isn't read.
 */
import { looseCorners, PANEL, type LoosePanel, type PanelSize, type Point } from "./roof-design";

export interface RoofEdge {
  a: Point;
  b: Point;
  /** How far in from this edge panels sit, in metres. */
  setback: number;
  /** The face the edge belongs to, when it is a traced face's: its outline, for centring between its ends. */
  face?: Point[];
}

/** Within this many degrees of square, a group is turned square to the edge. */
export const SQUARE_WITHIN = 8;
/** A group whose nearest side is within this of where it should sit is pulled in. */
export const PULL_WITHIN = 0.5;
/** A group within this of the middle between the face's ends is centred. */
export const CENTRE_WITHIN = 0.4;

export interface Settle {
  /** Degrees to turn the group, about `centre`. */
  turn: number;
  centre: Point;
  /** Then moved by this. */
  dx: number;
  dy: number;
  /** The edge it settled against. */
  edge: RoofEdge;
  centred: boolean;
}

const rad = (d: number) => (d * Math.PI) / 180;
const rot = (p: Point, about: Point, deg: number): Point => {
  const t = rad(deg);
  const x = p.x - about.x;
  const y = p.y - about.y;
  return { x: about.x + x * Math.cos(t) - y * Math.sin(t), y: about.y + x * Math.sin(t) + y * Math.cos(t) };
};
/** An angle brought into (-45, 45]: how far from square two directions are. */
const offSquare = (deg: number) => {
  let d = ((deg % 90) + 90) % 90;
  if (d > 45) d -= 90;
  return d;
};

/** Where a ray from `from` along unit `way` first meets the outline, as a distance; Infinity when it doesn't. */
function rayToOutline(from: Point, way: Point, outline: Point[]): number {
  let best = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const den = way.x * ey - way.y * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a.x - from.x) * ey - (a.y - from.y) * ex) / den;
    const s = ((a.x - from.x) * way.y - (a.y - from.y) * way.x) / den;
    if (t >= -1e-9 && s >= -1e-9 && s <= 1 + 1e-9) best = Math.min(best, t);
  }
  return best;
}

/** How a group of panels would settle against the nearest edge, or null when it is too far or too skew. */
export function settleToEdges(group: readonly LoosePanel[], edges: readonly RoofEdge[], size: PanelSize = PANEL): Settle | null {
  if (!group.length || !edges.length) return null;
  const a0 = group[0].angle;
  if (!group.every((p) => Math.abs(offSquare(p.angle - a0)) < 1)) return null;
  const corners = group.flatMap((p) => [...looseCorners(p, size)]);
  const centre = {
    x: corners.reduce((n, c) => n + c.x, 0) / corners.length,
    y: corners.reduce((n, c) => n + c.y, 0) / corners.length,
  };
  let best: (Settle & { off: number }) | null = null;
  for (const edge of edges) {
    const ex = edge.b.x - edge.a.x;
    const ey = edge.b.y - edge.a.y;
    const len = Math.hypot(ex, ey);
    if (len < 0.3) continue;
    const dir = { x: ex / len, y: ey / len };
    // The group must lie alongside the edge, not off past its ends.
    const along = (centre.x - edge.a.x) * dir.x + (centre.y - edge.a.y) * dir.y;
    if (along < -1 || along > len + 1) continue;
    const turn = offSquare((Math.atan2(ey, ex) * 180) / Math.PI - a0);
    if (Math.abs(turn) > SQUARE_WITHIN) continue;
    const normal = { x: -dir.y, y: dir.x };
    const side = Math.sign((centre.x - edge.a.x) * normal.x + (centre.y - edge.a.y) * normal.y) || 1;
    const turned = corners.map((c) => rot(c, centre, turn));
    const near = Math.min(...turned.map((c) => side * ((c.x - edge.a.x) * normal.x + (c.y - edge.a.y) * normal.y)));
    const off = near - edge.setback;
    if (off < -0.3 || off > 1.5) continue;
    const pull = Math.abs(off) <= PULL_WITHIN ? -off : 0;
    const settle = { turn, centre, dx: side * normal.x * pull, dy: side * normal.y * pull, edge, centred: false, off: Math.abs(off) };
    if (!best || settle.off < best.off) best = settle;
  }
  if (!best) return null;
  const { off: _off, ...settle } = best;
  void _off;
  // Centred between the face's ends along the edge, when it nearly is.
  if (settle.edge.face) {
    const len = Math.hypot(settle.edge.b.x - settle.edge.a.x, settle.edge.b.y - settle.edge.a.y);
    const dir = { x: (settle.edge.b.x - settle.edge.a.x) / len, y: (settle.edge.b.y - settle.edge.a.y) / len };
    const moved = corners.map((c) => {
      const r = rot(c, centre, settle.turn);
      return { x: r.x + settle.dx, y: r.y + settle.dy };
    });
    const at = moved.map((c) => c.x * dir.x + c.y * dir.y);
    const mid = { x: centre.x + settle.dx, y: centre.y + settle.dy };
    const lo = Math.min(...at);
    const hi = Math.max(...at);
    const midAt = mid.x * dir.x + mid.y * dir.y;
    const ahead = rayToOutline(mid, dir, settle.edge.face) - (hi - midAt);
    const behind = rayToOutline(mid, { x: -dir.x, y: -dir.y }, settle.edge.face) - (midAt - lo);
    if (Number.isFinite(ahead) && Number.isFinite(behind) && ahead > 0 && behind > 0 && Math.abs(ahead - behind) <= CENTRE_WITHIN) {
      const shift = (ahead - behind) / 2;
      settle.dx += dir.x * shift;
      settle.dy += dir.y * shift;
      settle.centred = Math.abs(shift) > 0.005 || settle.centred;
    }
  }
  if (Math.abs(settle.turn) < 0.05 && Math.hypot(settle.dx, settle.dy) < 0.005) return null;
  return settle;
}

/** A group moved as a settle says: turned about its centre, then moved. Each panel keeps its own facing to the group. */
export function applySettle<T extends LoosePanel>(group: readonly T[], s: Settle): T[] {
  return group.map((p) => {
    const at = rot(p, s.centre, s.turn);
    return {
      ...p,
      x: Math.round((at.x + s.dx) * 100) / 100,
      y: Math.round((at.y + s.dy) * 100) / 100,
      angle: (((p.angle + s.turn) % 360) + 360) % 360,
    };
  });
}
