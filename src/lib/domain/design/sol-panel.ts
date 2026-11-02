/**
 * How wide Sol's side panel may be (2 Nov 2026, Martin: "allow me to adjust the width of the Sol chat box"). The member
 * drags its left edge; the width is kept on their device. The page always keeps at least `PAGE_SHARE` of the window,
 * so it never disappears behind him. Pure, tested.
 */

export const SOL_PANEL = {
  /** The panel as it opens until someone changes it (26rem). */
  standard: 416,
  min: 320,
  max: 960,
} as const;

/** The least of the window the page keeps beside the panel. */
export const PAGE_SHARE = 0.4;

/** A width asked for by dragging, kept inside the panel's limits and the room the window has. */
export function solPanelWidth(asked: number, windowWidth: number): number {
  const room = Math.floor(windowWidth * (1 - PAGE_SHARE));
  const max = Math.max(SOL_PANEL.min, Math.min(SOL_PANEL.max, room));
  if (!Number.isFinite(asked)) return Math.min(SOL_PANEL.standard, max);
  return Math.round(Math.min(max, Math.max(SOL_PANEL.min, asked)));
}
