/**
 * How big the calendar is on a computer (23 Nov 2026, Martin: "on desktop allow me to size the calendar wider and
 * taller at my discretion"). Two calendars are sized this way: the Calendar page (`page`) and the one over the page
 * from the date tile (`pop`). Each is dragged by its edges and kept on the device; these keep what is asked for
 * inside sensible limits and the room there is. The height is the calendar's body (the hours, the month's weeks, the
 * day's list), not its bar. Pure, tested.
 */

export type CalSize = { width: number; height: number };

export type CalLimits = { width: number; height: number; minWidth: number; minHeight: number; maxHeight: number };

export const CALENDAR_SIZES = {
  /** The Calendar page: 48rem across (as it was), the hours 36rem tall. */
  page: { width: 768, height: 576, minWidth: 520, minHeight: 320, maxHeight: 2400 },
  /** Over the page from the date tile: 21rem across, the hours 22rem tall (as it was). */
  pop: { width: 336, height: 352, minWidth: 300, minHeight: 240, maxHeight: 1400 },
} as const satisfies Record<string, CalLimits>;

export const CALENDAR_SIZE_KEYS = {
  page: "renuabl.design.calendar-size",
  pop: "renuabl.design.calendar-pop-size",
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)));

/** The size asked for, inside its limits and the room there is (`room`: the most width and height it may take). */
export function calendarSize(asked: CalSize | null, limits: CalLimits, room: CalSize): CalSize {
  const w = asked && Number.isFinite(asked.width) ? asked.width : limits.width;
  const h = asked && Number.isFinite(asked.height) ? asked.height : limits.height;
  const maxW = Math.max(limits.minWidth, Math.floor(room.width));
  const maxH = Math.max(limits.minHeight, Math.min(limits.maxHeight, Math.floor(room.height)));
  return { width: clamp(w, limits.minWidth, maxW), height: clamp(h, limits.minHeight, maxH) };
}

/** A size kept on the device, read back safely: anything that isn't two numbers is no size at all. */
export function readCalendarSize(raw: string | null): CalSize | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { width?: unknown; height?: unknown };
    return typeof v.width === "number" && typeof v.height === "number" && Number.isFinite(v.width) && Number.isFinite(v.height)
      ? { width: v.width, height: v.height }
      : null;
  } catch {
    return null;
  }
}

/** How tall each week of the month is, so the weeks fill the height asked for (never under 5.5rem). */
export function monthRowHeight(bodyHeight: number, weeks: number, head = 37): number {
  return Math.max(88, Math.floor((bodyHeight - head) / Math.max(1, weeks)));
}
