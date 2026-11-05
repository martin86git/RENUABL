/**
 * The designer's work kept as a draft as it goes (5 Nov 2026, Martin, as Primero's: started a design, interrupted half
 * way, "it should appear as where I left off"). A short while after the work stops changing, everything not yet saved
 * on a roof (its designs, the bill and the quotes) is kept on its own, apart from the saved roof, so nothing a customer
 * or the rest of the business sees changes until Publish saves it. Opening the roof again offers the draft ("Picked up
 * where you left off", with Discard). Each draft remembers which save it was drawn over (`base`), so once the roof has
 * been saved since, by anyone, an older draft is set aside rather than laid over the newer work. Pure, tested.
 */
import { cleanRoofWork, type RoofPlace, type RoofWork } from "./account";
import { LAUNCH_MARKET, todayInMarket } from "../market";

/** How long the work must stand still before it is kept: a drag isn't sent a dozen times. */
export const DRAFT_WAIT_MS = 3000;

/** The largest draft kept, in characters: the same as a saved roof. */
export const MAX_DRAFT_BYTES = 1_500_000;

/** A draft as kept: the work, which save it was drawn over, and when. */
export interface DesignDraft extends RoofWork {
  base: string;
  at: string;
}

/** Which save a draft is drawn over, as a short plain word: a saved roof's version ("v3"), a device's fingerprint, or "new". */
export const cleanBase = (v: unknown): string | null => (typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : null);

/** A draft from outside (a request, the database, this device's storage), put through the designer's own checks. */
export function cleanDraft(roof: RoofPlace, raw: unknown): DesignDraft | null {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const base = cleanBase(r.base);
  const work = cleanRoofWork(roof, r.design, r.extras);
  if (!base || !work) return null;
  const at = typeof r.at === "string" && !Number.isNaN(Date.parse(r.at)) ? new Date(r.at).toISOString() : new Date(0).toISOString();
  return { ...work, base, at };
}

/** Whether a draft is still the work to open on: only when nothing has been saved over the save it was drawn from. */
export const draftStillFits = (draft: Pick<DesignDraft, "base">, base: string) => draft.base === base;

/**
 * A short fingerprint of what is saved on this device for a roof (signed out there is no version number): the same
 * saved text gives the same fingerprint, so a draft knows whether the roof was saved since it was taken.
 */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `d${(h >>> 0).toString(36)}`;
}

/** When a draft was kept, in words: "today at 3:15 pm", "yesterday at 9:02 am", "on 3 Nov at 4:40 pm" (the market's time). */
export function keptWhen(at: string, now: Date = new Date()): string {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return "";
  const time = new Intl.DateTimeFormat("en-AU", { timeZone: LAUNCH_MARKET.timeZone, hour: "numeric", minute: "2-digit", hour12: true })
    .format(when)
    .replace(/\s?([ap])\.?m\.?/i, (_, p: string) => ` ${p.toLowerCase()}m`);
  const day = todayInMarket(when);
  const today = todayInMarket(now);
  const yesterday = todayInMarket(new Date(now.getTime() - 86_400_000));
  if (day === today) return `today at ${time}`;
  if (day === yesterday) return `yesterday at ${time}`;
  const date = new Intl.DateTimeFormat("en-AU", { timeZone: LAUNCH_MARKET.timeZone, day: "numeric", month: "short" }).format(when);
  return `on ${date} at ${time}`;
}
