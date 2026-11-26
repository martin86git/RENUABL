/**
 * The size of the phone assistant's window and its panels (14 Nov 2026, Martin: "i want to be able to resize the
 * panes"; 26 Nov 2026, Martin: "the chat should be on the left hand side, with a slim right hand panel emerging
 * depending on whats selected, and the ability of opening another panel to its right also… make the window taller").
 * The chat is on the left; its deals and its settings open as slim panels to its right, one or both, in that order.
 * The window's left edge widens the chat, the divider at a panel's left edge moves room between it and what is left of
 * it, and the top edge changes the height; what was chosen is kept on the device. Pure, tested.
 */

export const COACH_WINDOW = {
  pane: { min: 260, max: 720 },
  chat: { min: 340, max: 900 },
  height: { min: 420, max: 1400 },
  /** What each starts at, in pixels: slim panels, a roomy chat, a tall window. */
  start: { deals: 340, settings: 340, chat: 460, height: 860 },
  /** Kept clear either side of the window, and above and below it. */
  gutterX: 32,
  gutterY: 96,
} as const;

/** A new key: sizes kept for the old layout (a wide pane left of the chat) aren't carried into this one. */
export const COACH_WINDOW_KEY = "renuabl.design.coach-window-2";

export type CoachPane = "deals" | "settings";

/** The panels' order to the chat's right. */
export const PANE_ORDER: readonly CoachPane[] = ["deals", "settings"];

/** What the person chose, in pixels; null for a part never dragged. */
export interface CoachSizes {
  deals: number | null;
  settings: number | null;
  chat: number | null;
  height: number | null;
}

export const NO_SIZES: CoachSizes = { deals: null, settings: null, chat: null, height: null };

const px = (raw: unknown, lo: number, hi: number): number | null =>
  typeof raw === "number" && Number.isFinite(raw) ? Math.round(Math.min(hi, Math.max(lo, raw))) : null;

/** Sizes as read back from the device: only whole numbers inside their limits. */
export function cleanCoachSizes(raw: unknown): CoachSizes {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const { pane, chat, height } = COACH_WINDOW;
  return {
    deals: px(r.deals, pane.min, pane.max),
    settings: px(r.settings, pane.min, pane.max),
    chat: px(r.chat, chat.min, chat.max),
    height: px(r.height, height.min, height.max),
  };
}

export interface CoachLayout {
  chat: number;
  /** Each panel's width; 0 while it is closed. */
  deals: number;
  settings: number;
  height: number;
}

/** The panels open, in their order to the chat's right. */
export const openPanes = (open: readonly CoachPane[]): CoachPane[] => PANE_ORDER.filter((p) => open.includes(p));

/**
 * The window as it is drawn in a browser window of this size: each part inside its limits, and the whole inside the
 * screen. When they don't fit side by side the panels give way first (the furthest right first), then the chat.
 */
export function coachLayout(sizes: CoachSizes, open: readonly CoachPane[], view: { width: number; height: number }): CoachLayout {
  const { start, gutterX, gutterY } = COACH_WINDOW;
  const panes = openPanes(open);
  const room = Math.max(COACH_WINDOW.chat.min, view.width - gutterX);
  let chat = Math.min(sizes.chat ?? start.chat, room);
  const widths: Record<CoachPane, number> = { deals: 0, settings: 0 };
  for (const p of panes) widths[p] = sizes[p] ?? start[p];
  let over = chat + panes.reduce((n, p) => n + widths[p], 0) - room;
  for (const p of [...panes].reverse()) {
    if (over <= 0) break;
    const give = Math.min(over, widths[p] - COACH_WINDOW.pane.min);
    widths[p] -= give;
    over -= give;
  }
  if (over > 0) chat = Math.max(COACH_WINDOW.chat.min, chat - over);
  const height = Math.max(COACH_WINDOW.height.min, Math.min(sizes.height ?? start.height, view.height - gutterY));
  return { chat: Math.round(chat), deals: Math.round(widths.deals), settings: Math.round(widths.settings), height: Math.round(height) };
}

/**
 * The sizes after a drag. The window is held at its right edge: its left edge widens or narrows the chat; the divider
 * at a panel's left edge moves room between that panel and what is left of it (the chat, or the panel before), the
 * window keeping its width; the top edge changes the height. `dx` and `dy` are how far the pointer has moved right and
 * down since the press, from the layout it started at.
 */
export function dragCoach(
  sizes: CoachSizes,
  open: readonly CoachPane[],
  from: CoachLayout,
  grip: "left" | "top" | CoachPane,
  dx: number,
  dy: number,
): CoachSizes {
  const lim = COACH_WINDOW;
  const clamp = (v: number, r: { min: number; max: number }) => Math.round(Math.min(r.max, Math.max(r.min, v)));
  if (grip === "top") return { ...sizes, height: clamp(from.height - dy, lim.height) };
  if (grip === "left") return { ...sizes, chat: clamp(from.chat - dx, lim.chat) };
  const panes = openPanes(open);
  const at = panes.indexOf(grip);
  if (at < 0) return sizes;
  const left: "chat" | CoachPane = at === 0 ? "chat" : panes[at - 1];
  const leftLim = left === "chat" ? lim.chat : lim.pane;
  const total = from[left] + from[grip];
  const pane = Math.max(lim.pane.min, Math.min(lim.pane.max, from[grip] - dx, total - leftLim.min));
  const other = clamp(total - pane, leftLim);
  return { ...sizes, [left]: other, [grip]: clamp(total - other, lim.pane) };
}
