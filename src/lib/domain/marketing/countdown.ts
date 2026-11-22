/**
 * The countdown block in a marketing email (22 Nov 2026, Martin: "add a countdown timer block to the email builder").
 * An email can't run anything, so the timer is a picture our server draws each time the email is opened: an animated
 * GIF of the minute from that moment, days, hours, minutes and seconds, playing once and resting on its last frame
 * (so it never runs backwards). Its labels, and the end in words, are the email's own text, so an inbox that blocks
 * pictures still says when it ends. Pure: the end's time, what's left, and each frame as SVG; the digits are drawn
 * as strokes, so no font is needed on the server.
 */

import { LAUNCH_MARKET, marketDateTime } from "../market";

/** The end as a wall-clock time in the market, "YYYY-MM-DDTHH:mm", or null when it isn't one. */
export function cleanEndsAt(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59) return null;
  const day = new Date(Date.UTC(y, mo - 1, d));
  if (day.getUTCMonth() !== mo - 1 || y < 2020 || y > 2100) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
}

/** When it ends, in milliseconds since 1970 (the market's daylight saving counted). */
export function endsAtMs(endsAt: string): number {
  const [date, time] = endsAt.split("T");
  const [h, m] = time.split(":").map(Number);
  return Date.parse(marketDateTime(date, h, m));
}

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** What's left from `now` to the end; all zeros once it has passed. Days stop at 999. */
export function timeLeft(endMs: number, nowMs: number): TimeLeft {
  const s = Math.max(0, Math.floor((endMs - nowMs) / 1000));
  return {
    days: Math.min(999, Math.floor(s / 86400)),
    hours: Math.floor(s / 3600) % 24,
    minutes: Math.floor(s / 60) % 60,
    seconds: s % 60,
  };
}

export const ended = (t: TimeLeft) => !t.days && !t.hours && !t.minutes && !t.seconds;

/** "Ends Sunday 30 November at 5:00 pm (Melbourne time)": said under the timer and in the text version. */
export function endsWords(endsAt: string): string {
  const at = new Date(endsAtMs(endsAt));
  const tz = LAUNCH_MARKET.timeZone;
  const day = new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(at);
  const time = new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true })
    .format(at)
    .replace(/\s?([ap])\.?m\.?/i, " $1m")
    .toLowerCase();
  return `Ends ${day.replace(",", "")} at ${time} (${LAUNCH_MARKET.capital} time)`;
}

export const COUNTDOWN_UNITS = ["Days", "Hours", "Minutes", "Seconds"] as const;

/** The picture's size as shown in the email (drawn at twice this). */
export const COUNTDOWN_WIDTH = 536;
export const COUNTDOWN_HEIGHT = 112;
/** How many seconds the picture plays. */
export const COUNTDOWN_FRAMES = 60;

/** Each digit as strokes in a 60 × 100 box. */
const DIGITS: string[] = [
  "M30 6C14 6 9 26 9 50S14 94 30 94 51 74 51 50 46 6 30 6Z",
  "M17 24 33 7V94",
  "M11 27C12 13 21 6 31 6 43 6 50 15 50 27 50 42 38 53 11 94H51",
  "M12 19C16 11 23 6 31 6 42 6 49 14 49 25 49 38 40 47 27 47 42 47 51 56 51 70 51 85 42 94 30 94 20 94 13 89 10 81",
  "M41 94V6L9 67H53",
  "M47 7H17L13 46C18 41 23 39 30 39 43 39 51 50 51 66 51 83 42 94 29 94 19 94 12 89 10 82",
  "M45 13C41 8 36 6 30 6 16 6 10 26 10 54 10 80 18 94 31 94 43 94 51 84 51 69 51 54 43 44 31 44 20 44 12 52 10 62",
  "M9 7H51L23 94",
  "M30 47C18 47 12 39 12 27 12 14 20 6 30 6S48 14 48 27 42 47 30 47C16 47 9 57 9 71 9 85 18 94 30 94S51 85 51 71 44 47 30 47Z",
  "M50 38C48 48 40 56 29 56 16 56 9 46 9 31 9 16 17 6 29 6 42 6 50 20 50 46 50 74 44 94 30 94 24 94 19 92 15 87",
];

/** Six hex digits, lower case, or null. */
export const hexOf = (raw: unknown): string | null => (typeof raw === "string" && /^[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : null);

/**
 * One frame: four rounded tiles in the colour with the figures in white, a colon between them; once ended, the tiles
 * are grey. Drawn at twice the size it shows.
 */
export function countdownSvg(left: TimeLeft, colour: string): string {
  const W = COUNTDOWN_WIDTH * 2;
  const H = COUNTDOWN_HEIGHT * 2;
  const gap = 40;
  const tile = (W - gap * 3) / 4;
  const fill = ended(left) ? "#a1a1aa" : `#${colour}`;
  const values = [left.days, left.hours, left.minutes, left.seconds];
  const digitH = 120;
  const scale = digitH / 100;
  const digitW = 60 * scale;
  const parts: string[] = [];
  values.forEach((v, i) => {
    const x = i * (tile + gap);
    parts.push(`<rect x="${x}" y="0" width="${tile}" height="${H}" rx="28" fill="${fill}"/>`);
    const text = String(v).padStart(2, "0");
    const step = digitW + 10;
    const width = text.length * step - 10;
    const startX = x + (tile - width) / 2;
    const y = (H - digitH) / 2;
    [...text].forEach((ch, j) => {
      const tx = (startX + j * step).toFixed(1);
      parts.push(
        `<path d="${DIGITS[Number(ch)]}" transform="translate(${tx} ${y}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="${(11 / scale).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    });
    if (i < 3) {
      const cx = x + tile + gap / 2;
      parts.push(
        `<circle cx="${cx}" cy="${H / 2 - 22}" r="6" fill="${fill}"/><circle cx="${cx}" cy="${H / 2 + 22}" r="6" fill="${fill}"/>`,
      );
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

/** Each second's time left, from `now` for the frames the picture plays (repeating zeros once ended). */
export function countdownFrames(endMs: number, nowMs: number, frames = COUNTDOWN_FRAMES): TimeLeft[] {
  return Array.from({ length: frames }, (_, i) => timeLeft(endMs, nowMs + i * 1000));
}
