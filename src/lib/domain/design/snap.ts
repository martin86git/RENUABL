/**
 * Panels clicking into place (Martin, 18 Oct 2026: lining a new row up flush against another by eye is tedious, it
 * either overlaps or leaves a gap). Pure, tested.
 *
 * When panels being moved or laid come within `SNAP_REACH` of a panel already on the roof that runs the same way (or
 * a quarter turn round: a landscape row above a portrait one), the whole group is shifted so they sit edge to edge
 * with the usual gap, one above the other or side by side, and lined up along the row too: centred, edge to edge, or
 * panel over panel, whichever is nearest. Sizes are as drawn from above (`planSize`).
 */
import { looseCorners, planSize, type LoosePanel, type PanelSize, type Point } from "./roof-design";

/** How near panels must come to click into place, metres. */
export const SNAP_REACH = 0.35;
/** How far off square two panels may be and still click together, degrees. */
const SNAP_ANGLE = 3;

const rad = (d: number) => (d * Math.PI) / 180;
const turnGap = (a: number, b: number) => {
  const d = (((a - b) % 90) + 90) % 90;
  return Math.min(d, 90 - d);
};

/**
 * The shift that brings a group of panels flush against the panels around them, or null when none is near enough.
 * `group` is where the moving panels are now; `others` are the panels that stay where they are.
 */
export function snapShift(group: LoosePanel[], others: LoosePanel[], size: PanelSize, reach = SNAP_REACH): Point | null {
  let best: { shift: Point; cost: number } | null = null;
  for (const o of others) {
    const a = rad(o.angle);
    // The other panel's own frame: x across its short side, y along its long side (as `looseCorners` draws it).
    const ax = { x: Math.cos(a), y: Math.sin(a) };
    const ay = { x: -Math.sin(a), y: Math.cos(a) };
    const op = planSize(o, size);
    for (const m of group) {
      if (turnGap(m.angle, o.angle) > SNAP_ANGLE) continue;
      const dx = m.x - o.x;
      const dy = m.y - o.y;
      // Quickly past panels nowhere near.
      if (Math.hypot(dx, dy) > Math.max(op.w, op.h) * 2 + reach) continue;
      const lx = dx * ax.x + dy * ax.y;
      const ly = dx * ay.x + dy * ay.y;
      const mp = planSize(m, size);
      // The moving panel's half sizes along the other's axes: swapped when it is turned a quarter round.
      const quarter = Math.round(((((m.angle - o.angle) % 180) + 180) % 180) / 90) % 2 === 1;
      const mw = (quarter ? mp.h : mp.w) / 2;
      const mh = (quarter ? mp.w : mp.h) / 2;
      const ow = op.w / 2;
      const oh = op.h / 2;
      const along = (offset: number, mine: number, theirs: number, step: number) => {
        // Where along the row it may sit: centred, either edge in line, or on the other's column.
        const targets = [0, mine - theirs, theirs - mine];
        if (step > 0) targets.push(Math.round(offset / step) * step);
        return targets.map((t) => t - offset).reduce((p, q) => (Math.abs(q) < Math.abs(p) ? q : p));
      };
      const candidates: Point[] = [];
      // One above the other: edge to edge down the slope, lined up across.
      if (Math.abs(lx) < ow + mw + reach) {
        const sy = Math.sign(ly || 1) * (oh + mh + size.gap) - ly;
        candidates.push({ x: along(lx, mw, ow, quarter ? 0 : 2 * ow + size.gap), y: sy });
      }
      // Side by side: edge to edge along the row, lined up down the slope.
      if (Math.abs(ly) < oh + mh + reach) {
        const sx = Math.sign(lx || 1) * (ow + mw + size.gap) - lx;
        candidates.push({ x: sx, y: along(ly, mh, oh, 0) });
      }
      for (const c of candidates) {
        if (Math.abs(c.x) > reach || Math.abs(c.y) > reach) continue;
        const cost = Math.hypot(c.x, c.y);
        if (!best || cost < best.cost) best = { shift: { x: c.x * ax.x + c.y * ay.x, y: c.x * ax.y + c.y * ay.y }, cost };
      }
    }
  }
  if (!best) return null;
  // A shift that would put the group on top of another panel isn't a fit.
  const moved = group.map((m) => ({ ...m, x: m.x + best!.shift.x, y: m.y + best!.shift.y }));
  const clash = moved.some((m) =>
    others.some((o) => {
      const mp = planSize(m, size);
      const op = planSize(o, size);
      return Math.hypot(m.x - o.x, m.y - o.y) < (Math.min(mp.w, mp.h) + Math.min(op.w, op.h)) / 2 - 0.01;
    }),
  );
  return clash ? null : { x: Math.round(best.shift.x * 100) / 100, y: Math.round(best.shift.y * 100) / 100 };
}

/** A straight edge on the roof: a side of a traced face, or a guide line. */
export interface Edge {
  a: Point;
  b: Point;
}

/**
 * The shift that sets a group of panels at `clearance` from a roof edge they have come near (Martin: the same click
 * into place as against other panels, for the roof's edge), or null when none is near enough. Only an edge the
 * panels run along (square to it, or along it) counts, and only where they sit beside it; the group moves straight
 * towards or away from the edge.
 */
export function edgeShift(group: LoosePanel[], edges: Edge[], size: PanelSize, clearance: number, reach = SNAP_REACH): Point | null {
  if (!group.length) return null;
  let best: { shift: Point; cost: number } | null = null;
  const centre = { x: group.reduce((t, p) => t + p.x, 0) / group.length, y: group.reduce((t, p) => t + p.y, 0) / group.length };
  for (const { a, b } of edges) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 0.2) continue;
    const d = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const n = { x: -d.y, y: d.x };
    const bearing = (Math.atan2(d.y, d.x) * 180) / Math.PI;
    if (!group.some((p) => turnGap(p.angle, bearing) <= SNAP_ANGLE)) continue;
    // Which side of the edge the panels are on, and how close their nearest corner comes.
    const side = Math.sign((centre.x - a.x) * n.x + (centre.y - a.y) * n.y) || 1;
    let nearest = Infinity;
    let beside = false;
    for (const p of group) {
      for (const c of looseCorners(p, size)) {
        const off = side * ((c.x - a.x) * n.x + (c.y - a.y) * n.y);
        const along = (c.x - a.x) * d.x + (c.y - a.y) * d.y;
        if (along >= -0.1 && along <= length + 0.1) beside = true;
        nearest = Math.min(nearest, off);
      }
    }
    if (!beside) continue;
    const move = clearance - nearest;
    if (Math.abs(move) > reach) continue;
    if (!best || Math.abs(move) < best.cost) best = { shift: { x: n.x * side * move, y: n.y * side * move }, cost: Math.abs(move) };
  }
  return best ? { x: Math.round(best.shift.x * 100) / 100, y: Math.round(best.shift.y * 100) / 100 } : null;
}
