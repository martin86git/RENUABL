/**
 * The size of the phone assistant's window and its panes (14 Nov 2026, Martin: "i want to be able to resize the
 * panes"). The window is a chat with one pane to its left at a time (its deals, or its settings); the divider between
 * them and the window's left and top edges are dragged, and what was chosen is kept on the device. Pure, tested.
 */

export const COACH_WINDOW = {
  pane: { min: 280, max: 960 },
  chat: { min: 320, max: 760 },
  height: { min: 360, max: 1200 },
  /** What each starts at, in pixels. */
  start: { deals: 544, settings: 352, chat: 416, height: 640 },
  /** Kept clear either side of the window, and above and below it. */
  gutterX: 32,
  gutterY: 112,
} as const;

export const COACH_WINDOW_KEY = "renuabl.design.coach-window";

export type CoachPane = "deals" | "settings";

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
  /** The pane's width; 0 with none open. */
  pane: number;
  chat: number;
  height: number;
}

/**
 * The window as it is drawn in a browser window of this size: each part inside its limits, and the whole inside the
 * screen. When the two don't fit side by side the pane gives way first, then the chat.
 */
export function coachLayout(sizes: CoachSizes, pane: CoachPane | null, view: { width: number; height: number }): CoachLayout {
  const { start, gutterX, gutterY } = COACH_WINDOW;
  const room = Math.max(COACH_WINDOW.chat.min, view.width - gutterX);
  let chat = Math.min(sizes.chat ?? start.chat, room);
  let side = pane ? (sizes[pane] ?? start[pane]) : 0;
  if (pane && side + chat > room) {
    side = Math.max(COACH_WINDOW.pane.min, room - chat);
    if (side + chat > room) chat = Math.max(COACH_WINDOW.chat.min, room - side);
  }
  const height = Math.max(COACH_WINDOW.height.min, Math.min(sizes.height ?? start.height, view.height - gutterY));
  return { pane: Math.round(side), chat: Math.round(chat), height: Math.round(height) };
}

/**
 * The sizes after a drag. The divider moves room between the pane and the chat (the window keeps its width); the
 * window's left edge widens or narrows the pane (the chat, with no pane open); its top edge changes the height.
 * `dx` and `dy` are how far the pointer has moved right and down since the press, from the layout it started at.
 */
export function dragCoach(
  sizes: CoachSizes,
  pane: CoachPane | null,
  from: CoachLayout,
  grip: "divider" | "left" | "top",
  dx: number,
  dy: number,
): CoachSizes {
  const lim = COACH_WINDOW;
  const clamp = (v: number, r: { min: number; max: number }) => Math.round(Math.min(r.max, Math.max(r.min, v)));
  if (grip === "top") return { ...sizes, height: clamp(from.height - dy, lim.height) };
  if (grip === "left") {
    // The window is held at its right edge, so dragging left (dx below 0) widens it.
    return pane ? { ...sizes, [pane]: clamp(from.pane - dx, lim.pane) } : { ...sizes, chat: clamp(from.chat - dx, lim.chat) };
  }
  if (!pane) return sizes;
  const total = from.pane + from.chat;
  const side = Math.min(clamp(from.pane + dx, lim.pane), total - lim.chat.min);
  const chat = clamp(total - side, lim.chat);
  return { ...sizes, [pane]: clamp(total - chat, lim.pane), chat };
}
