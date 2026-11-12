/**
 * How big team chat's window is, and how wide its list of conversations down the left (12 Nov 2026, Martin: the list
 * cut the deals' names off, and the window itself needs resizing). Both are dragged by the person and kept on their
 * device; these keep what is asked for inside sensible limits and the room the screen has. Pure, tested.
 */

export const TEAM_WINDOW = {
  /** As it opens until someone changes it: 50rem by 48rem. */
  width: 800,
  height: 768,
  minWidth: 560,
  minHeight: 420,
  /** Room kept between the window and the screen's edges: the rail on the right, a margin on the left. */
  sideRoom: 112,
  /** The window never goes taller than this share of the screen. */
  heightShare: 0.92,
} as const;

export const TEAM_LIST = {
  /** The list's width as it opens (12rem). */
  width: 192,
  min: 150,
  max: 420,
  /** The conversation beside it always keeps at least this much. */
  roomForChat: 320,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)));

/** The window's size asked for by dragging, inside its limits and the screen it is on. */
export function teamWindowSize(
  asked: { width: number; height: number } | null,
  screen: { width: number; height: number },
): { width: number; height: number } {
  const maxW = Math.max(TEAM_WINDOW.minWidth, screen.width - TEAM_WINDOW.sideRoom);
  const maxH = Math.max(TEAM_WINDOW.minHeight, Math.floor(screen.height * TEAM_WINDOW.heightShare));
  const w = asked && Number.isFinite(asked.width) ? asked.width : TEAM_WINDOW.width;
  const h = asked && Number.isFinite(asked.height) ? asked.height : TEAM_WINDOW.height;
  return { width: clamp(w, TEAM_WINDOW.minWidth, maxW), height: clamp(h, TEAM_WINDOW.minHeight, maxH) };
}

/** The list's width asked for by dragging, never so wide the conversation beside it loses its room. */
export function teamListWidth(asked: number, windowWidth: number): number {
  const max = Math.max(TEAM_LIST.min, Math.min(TEAM_LIST.max, windowWidth - TEAM_LIST.roomForChat));
  return clamp(Number.isFinite(asked) ? asked : TEAM_LIST.width, TEAM_LIST.min, max);
}

/** A size kept on the device, read back safely: anything that isn't two numbers is no size at all. */
export function readWindowSize(raw: string | null): { width: number; height: number } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { width?: unknown; height?: unknown };
    return typeof v.width === "number" && typeof v.height === "number" ? { width: v.width, height: v.height } : null;
  } catch {
    return null;
  }
}
