/**
 * An array pivoting as it is dragged out (21 Nov 2026, Martin: "it would be great if you could pivot it as you move your
 * mouse in a direction… the panels continue to lay in one direction… you are then forced to adjust them after releasing").
 * Pure, tested in `array-pivot.test.ts`.
 *
 * A panel put down in the open has no roof line to follow, so the row follows the drag: it runs from the first panel
 * towards the pointer, turning as the pointer swings. Pulling sideways by more than half a row holds the direction
 * where the row last grew and adds rows instead, so the gesture for a block is along, then down. The direction clicks
 * square to panels and roof lines it comes within a few degrees of.
 */
import type { Point } from "./roof-design";

/** Where the row's direction was last held: its angle, and how many panels long the row was then. */
export interface PivotState {
  ref: number;
  n: number;
}

export const PIVOT = {
  /** The pointer must be this share of a panel's step away before the row turns to it. */
  start: 0.6,
  /** Within this many degrees of square to a panel or roof line, the row clicks square to it. */
  snap: 4,
};

const rad = (d: number) => (d * Math.PI) / 180;
const turn360 = (d: number) => ((d % 360) + 360) % 360;
/** An angle brought into (-45, 45]: how far from square two directions are. */
const offSquare = (deg: number) => {
  let d = ((deg % 90) + 90) % 90;
  if (d > 45) d -= 90;
  return d;
};
/** Of a direction and its opposite, the one nearer `like`: a row dragged right to left still faces as one dragged left to right. */
const nearer = (deg: number, like: number) => {
  let d = (((deg - like) % 180) + 180) % 180;
  if (d > 90) d -= 180;
  return like + d;
};

/**
 * The angle the first panel takes for a drag out to `p`, and what to remember for the next move.
 * `steps` are a panel's step across and along (its size from above plus the gap); `squareTo` are the angles of panels
 * and roof lines to click square to (any convention: only square-ness counts).
 */
export function pivotDrag(
  anchor: { x: number; y: number; angle: number },
  p: Point,
  steps: { x: number; y: number },
  state: PivotState | null,
  squareTo: readonly number[] = [],
): { angle: number; state: PivotState | null } {
  const dx = p.x - anchor.x;
  const dy = p.y - anchor.y;
  const d = Math.hypot(dx, dy);
  if (d < steps.x * PIVOT.start) return { angle: turn360(anchor.angle), state: null };
  const raw = (Math.atan2(dy, dx) * 180) / Math.PI;
  let to = nearer(raw, anchor.angle);
  let click: number | null = null;
  for (const s of squareTo) {
    const off = offSquare(s - to);
    if (Math.abs(off) <= PIVOT.snap && (click === null || Math.abs(off) < Math.abs(click))) click = off;
  }
  if (click !== null) to += click;
  const n = Math.round(d / steps.x);
  if (!state) return { angle: turn360(to), state: { ref: to, n } };
  // How far the pointer has come off the line the row was held on.
  const off = Math.abs(d * Math.sin(rad(raw - state.ref)));
  if (off < steps.y / 2) return { angle: turn360(to), state: n === state.n ? state : { ref: to, n } };
  return { angle: turn360(state.ref), state };
}
