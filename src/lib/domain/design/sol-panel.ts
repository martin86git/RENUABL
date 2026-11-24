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

/**
 * The least width the page's own content keeps beside the panel, in px (24 Nov 2026, Martin: "pages need to better
 * optimise when the right hand side sol drawer appears"): 54rem, which is the 64rem the page never narrows below less
 * the 10rem it will step in from under the panel (`--sol-room`, `--sol-over` in globals.css; keep them in step).
 * A panel no wider than the window less this never lies over anything on the page.
 */
export const PAGE_MIN = 864;

/** A width asked for by dragging, kept inside the panel's limits and the room the window has. */
export function solPanelWidth(asked: number, windowWidth: number): number {
  const share = Math.floor(windowWidth * (1 - PAGE_SHARE));
  // Beside the page it leaves the page its least width; on a window too small for both it lies over the page, as it
  // always has, and only the share holds.
  const beside = Math.floor(windowWidth - PAGE_MIN);
  const room = beside >= SOL_PANEL.min ? Math.min(share, beside) : share;
  const max = Math.max(SOL_PANEL.min, Math.min(SOL_PANEL.max, room));
  if (!Number.isFinite(asked)) return Math.min(SOL_PANEL.standard, max);
  return Math.round(Math.min(max, Math.max(SOL_PANEL.min, asked)));
}
