/**
 * A row of panels dragged out from the first one (21 Nov 2026, Martin: "i add a panel and it automatically is pointing
 * in a direction, if i dont pull immediately sideways, and instead pull in another direction, this is when it should
 * pivot, however if i pull sideways - whichever way the panel is facing, this is when it should add panels").
 * Pure, tested in `array-pivot.test.ts`.
 *
 * A drag does one thing. Pulled sideways, along the way the panel's row runs, it adds panels and the direction stays
 * as it was. Once the pointer leaves that line the panel pivots: its row points at the pointer and grows along it,
 * clicking square to panels and roof lines it comes within a few degrees of, and it goes on pivoting until the pointer
 * is let go (the same day, Martin: "it wasnt pivoting… took some aggresive movement": it had been settled once, as the
 * drag began). The panel turns with the pointer, so a row swung half way round faces the other way ("if the panel
 * starts in the north pointing position, and i pivot 180 degrees, i would expect the pointer to face south").
 * Rows are added afterwards, from the array's own handles (`array-grow.ts`).
 */
import type { Point } from "./roof-design";

/** What the drag is doing, once it has begun: adding panels along the row as it lay, or pivoting to the pointer. */
export interface PivotState {
  mode: "row" | "pivot";
  /** Pivoting: the angle the panel was last turned to (before any click square), which the next move turns on from. */
  angle?: number;
}

export const PIVOT = {
  /** The pointer must be this share of a panel's step away before the drag has begun. */
  start: 0.6,
  /** Within this many degrees of the way the row runs, the drag adds panels and doesn't turn. */
  cone: 12,
  /** Pivoting, within this many degrees of square to a panel or roof line the row clicks square to it. */
  snap: 4,
};

/**
 * With a finger (25 Nov 2026, Martin, from his iPhone: "the pivot is too sensitive"): a fingertip wanders, so the drag
 * has to go further before it begins, may wander further off the row's line before it pivots, clicks square from
 * further off, and a pivot holds still until the finger has turned it a few degrees and is clear of the first panel.
 */
export const TOUCH_PIVOT = {
  start: 1.1,
  cone: 22,
  snap: 7,
  /** Pivoting, the row doesn't turn for less than this many degrees. */
  still: 4,
  /** Nor while the finger is nearer the first panel than this many steps (near it a small move is a big angle). */
  near: 1.6,
};

export interface PivotFeel {
  start: number;
  cone: number;
  snap: number;
  still?: number;
  near?: number;
}

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
  feel: PivotFeel = PIVOT,
): { angle: number; state: PivotState | null } {
  const dx = p.x - anchor.x;
  const dy = p.y - anchor.y;
  if (Math.hypot(dx, dy) < stepX * feel.start) return { angle: turn360(anchor.angle), state: state?.mode === "pivot" ? state : null };
  const raw = (Math.atan2(dy, dx) * 180) / Math.PI;
  const pivoting = state?.mode === "pivot";
  // Still along the row as it lay: panels are added and nothing turns. Once the pointer leaves that line it pivots,
  // and goes on pivoting until it is let go.
  if (!pivoting && Math.abs(nearer(raw, anchor.angle) - anchor.angle) <= feel.cone)
    return { angle: turn360(anchor.angle), state: { mode: "row" } };
  // The panel turns with the pointer from where it last was, so swinging the row half way round turns the way it
  // faces half way round too (a panel looks the same turned half way, but it then faces the other way).
  const was = pivoting && state.angle !== undefined ? state.angle : anchor.angle;
  let to = nearer(raw, was);
  // A finger holds the pivot still near the first panel and for a turn of only a few degrees.
  if (pivoting && state.angle !== undefined) {
    const close = feel.near !== undefined && Math.hypot(dx, dy) < stepX * feel.near;
    if (close || (feel.still !== undefined && Math.abs(to - was) < feel.still)) to = was;
  }
  let click: number | null = null;
  for (const s of [anchor.angle, ...squareTo]) {
    const off = offSquare(s - to);
    if (Math.abs(off) <= feel.snap && (click === null || Math.abs(off) < Math.abs(click))) click = off;
  }
  return { angle: turn360(to + (click ?? 0)), state: { mode: "pivot", angle: to } };
}
