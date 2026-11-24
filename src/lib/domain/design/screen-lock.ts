/**
 * The screen lock (23 Nov 2026, Martin: a 90-day sign-in is a risk on a shared computer or a phone left unlocked; "when
 * a computer locks you can just enter a pin"). A session stays signed in for SESSION_DAYS, but after a while unused it
 * locks: the server refuses the business's data until it is unlocked with a passkey (Face ID, Touch ID, Windows Hello),
 * the person's lock PIN, or by signing in again. Only real use counts as use (a press, a key, a scroll), never the
 * page's own polling, so a tab left open still locks.
 */

export type LockDevice = "phone" | "computer";

/** How long unused before it locks, by device. A phone is behind its own lock screen; a computer may be shared. */
export const LOCK_MINUTES: Record<LockDevice, number> = { phone: 240, computer: 30 };

/** Wrong PINs or failed passkeys on one session before it is ended outright and a full sign-in is needed. */
export const UNLOCK_TRIES = 5;

/** How often real use is told to the server at most (well inside the shortest lock time). */
export const ACTIVE_PING_MS = 2 * 60_000;

export const PIN_MIN = 4;
export const PIN_MAX = 6;

/** Phones and tablets that say so; anything else counts as a computer (the stricter time). */
export function lockDeviceOf(userAgent: string | null | undefined): LockDevice {
  return /iPhone|iPod|Android|Mobile|iPad/i.test(userAgent ?? "") ? "phone" : "computer";
}

/**
 * Face ID (a passkey) unlocks only on a phone (24 Nov 2026, Martin: "face id should not appear on desktop ... mobile
 * only"); a computer unlocks with the PIN. A passkey saved on the phone would otherwise send a computer's browser off
 * to find that phone.
 */
export const faceIdOn = (device: LockDevice) => device === "phone";

/** Locked once unused for its device's time. A session with no use recorded yet (from before the lock) isn't. */
export function isLocked(activeAt: Date | null | undefined, device: LockDevice, now: Date = new Date()): boolean {
  if (!activeAt) return false;
  return now.getTime() - activeAt.getTime() >= LOCK_MINUTES[device] * 60_000;
}

/** A lock PIN: 4 to 6 digits, not one digit over and over, not a straight run. */
export function cleanLockPin(raw: unknown): { ok: true; pin: string } | { ok: false; message: string } {
  const typed = typeof raw === "string" ? raw.trim() : "";
  if (!new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(typed))
    return { ok: false, message: `Your PIN is ${PIN_MIN} to ${PIN_MAX} digits.` };
  if (/^(\d)\1+$/.test(typed)) return { ok: false, message: "Pick a PIN that isn't one digit over and over." };
  const steps = [...typed].slice(1).map((d, i) => Number(d) - Number(typed[i]));
  if (steps.every((s) => s === 1) || steps.every((s) => s === -1))
    return { ok: false, message: "Pick a PIN that isn't a straight run like 1234." };
  return { ok: true, pin: typed };
}

/** A name for a passkey from the browser that made it, so the list says which device each is. */
export function passkeyName(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android phone"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows computer"
            : /CrOS/.test(ua)
              ? "Chromebook"
              : "This device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  return browser ? `${device} · ${browser}` : device;
}

/** The passkey's relying party: the site's own host, "www." taken off so one passkey works with or without it. */
export function relyingParty(host: string): string {
  return host
    .replace(/:\d+$/, "")
    .replace(/^www\./, "")
    .toLowerCase();
}

/** How the lock is worded to the person. */
export const LOCK_WORDS = {
  title: "RENUABL is locked",
  why: (minutes: number) =>
    `It locks after ${minutes >= 60 ? `${minutes / 60} hours` : `${minutes} minutes`} without use, so nobody else can open your business on this device.`,
  passkey: "Unlock with Face ID",
  passkeyHint: "Or your phone's passcode.",
  noPinYet: "You haven't set a PIN yet. Sign in another way, then set one in Your account → Screen lock.",
  pinHere: "Unlock this computer with your PIN. Face ID is for your phone.",
  pin: "Enter your PIN",
  another: "Sign in another way",
  signOut: "Sign out",
  noMethod: "Sign in again to carry on. Set up Face ID or a PIN in Your account and next time it's one glance or a few digits.",
  noPinComputer: "Sign in again to carry on. Set a PIN in Your account and next time on this computer it's a few digits.",
  tooMany: "Too many tries. Sign in again to carry on.",
  nudge: "Unlock with Face ID or a PIN next time, not a full sign-in.",
} as const;

/** The answer the server gives a locked session (HTTP 423), which the product reads to show the lock. */
export const LOCKED_STATUS = 423;
export const LOCKED_MESSAGE = "RENUABL is locked. Unlock it to carry on.";
