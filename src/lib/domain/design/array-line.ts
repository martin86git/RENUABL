/**
 * The line a panel sits in: the panels joined to it one after another in a straight line, along one of its own sides
 * (24 Nov 2026, Martin: with one panel picked, a way to pick the column it is in "without selecting the row of
 * panels above it"; All picks the whole array, two columns side by side included).
 *
 * Read by rule from where the panels lie: panels joined (within `gap`) to the line so far whose middle sits on the
 * line through the picked panel's middle, along its width or its length. Of the two, the longer line wins (a column of
 * ten beats a row of two); a tie goes to the line along the panel's long side.
 */

import { panelGap, type Point } from "./roof-design";

type Corners = readonly Point[];

const centre = (c: Corners): Point => ({
  x: (c[0].x + c[1].x + c[2].x + c[3].x) / 4,
  y: (c[0].y + c[1].y + c[2].y + c[3].y) / 4,
});

/** How far off the line a panel's middle may sit, as a share of the picked panel's side across the line. */
const OFF_LINE = 0.4;

/** The panels (by index) in a straight line with `start`, joined one after another; null when it is on its own. */
export function lineOf(panels: readonly Corners[], start: number, gap: number): number[] | null {
  const first = panels[start];
  if (!first || first.length < 4) return null;
  const mid = centre(first);
  const sides = [
    { x: first[1].x - first[0].x, y: first[1].y - first[0].y },
    { x: first[2].x - first[1].x, y: first[2].y - first[1].y },
  ].map((v) => ({ ...v, len: Math.hypot(v.x, v.y) }));
  if (sides.some((s) => s.len === 0)) return null;

  const along = (side: number): number[] => {
    const dir = sides[side];
    const across = sides[1 - side].len;
    const onLine = (i: number) => {
      const c = centre(panels[i]);
      const off = Math.abs((c.x - mid.x) * dir.y - (c.y - mid.y) * dir.x) / dir.len;
      return off <= OFF_LINE * across;
    };
    const kept = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const i = queue.pop()!;
      for (let j = 0; j < panels.length; j++)
        if (!kept.has(j) && onLine(j) && panelGap(panels[i], panels[j]) <= gap) {
          kept.add(j);
          queue.push(j);
        }
    }
    return [...kept];
  };

  const lines = [along(0), along(1)];
  const longSide = sides[0].len >= sides[1].len ? 0 : 1;
  const best = lines[0].length === lines[1].length ? lines[longSide] : lines[0].length > lines[1].length ? lines[0] : lines[1];
  return best.length > 1 ? best : null;
}
