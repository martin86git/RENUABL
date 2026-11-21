/**
 * A row of panels dragged out from the first one (21 Nov 2026, Martin: "i add a panel and it automatically is pointing
 * in a direction, if i dont pull immediately sideways, and instead pull in another direction, this is when it should
 * pivot, however if i pull sideways - whichever way the panel is facing, this is when it should add panels").
 * Pure, tested in `array-pivot.test.ts`.
 *
 * A drag does one thing. Started sideways, along the way the panel's row runs, it adds panels and the direction stays
 * as it was. Started any other way, the panel pivots: its row points at the pointer and grows along that line, clicking
 * square to panels and roof lines it comes within a few degrees of. Which of the two is settled as the drag begins and
 * holds until the pointer is let go. Rows are added afterwards, from the array's own handles (`array-grow.ts`).
 */
import type { Point } from "./roof-design";

/** What the drag is doing, once it has begun: adding panels along the row as it lay, or pivoting to the pointer. */
export interface PivotState {
  mode: "row" | "pivot";
}

export const PIVOT = {
  /** The pointer must be this share of a panel's step away before the drag has begun. */
  start: 0.6,
  /** Begun within this many degrees of the way the row runs, the drag adds panels and never turns. */
  cone: 20,
  /** Pivoting, within this many degrees of square to a panel or roof line the row clicks square to it. */
  snap: 4,
};

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
 * `stepX` is a panel's step along its row (its width from above plus the gap); `squareTo` are the angles of panels
 * and roof lines to click square to while pivoting (any convention: only square-ness counts).
 */
export function pivotDrag(
  anchor: { x: number; y: number; angle: number },
  p: Point,
  stepX: number,
  state: PivotState | null,
  squareTo: readonly number[] = [],
): { angle: number; state: PivotState | null } {
  const dx = p.x - anchor.x;
  const dy = p.y - anchor.y;
  if (Math.hypot(dx, dy) < stepX * PIVOT.start) return { angle: turn360(anchor.angle), state: null };
  const to = nearer((Math.atan2(dy, dx) * 180) / Math.PI, anchor.angle);
  const mode = state?.mode ?? (Math.abs(to - anchor.angle) <= PIVOT.cone ? "row" : "pivot");
  if (mode === "row") return { angle: turn360(anchor.angle), state: { mode } };
  let click: number | null = null;
  for (const s of [anchor.angle, ...squareTo]) {
    const off = offSquare(s - to);
    if (Math.abs(off) <= PIVOT.snap && (click === null || Math.abs(off) < Math.abs(click))) click = off;
  }
  return { angle: turn360(to + (click ?? 0)), state: { mode } };
}
