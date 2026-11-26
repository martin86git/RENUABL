/**
 * A business's own sign-in page (22 Nov 2026, Martin: "www.renuabl.com.au/primerosolar … that page has a login window
 * along with that businesses logo… it should also add some sort of a key to the business name in the url for
 * privacy"). The address is the business's name made plain, a hyphen and a short random key:
 * `/primerosolar-k7m3qx`. The name makes it the business's own; the key means nobody can find a business's page by
 * guessing its name, so who uses RENUABL isn't given away. The owner can make a new key, which closes the old address.
 */

/** Letters and digits that can't be mistaken for each other when read aloud or typed (no 0/o, 1/l/i). */
export const KEY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const KEY_LENGTH = 6;
export const SLUG_MAX = 30;
/** What a name with no letters or digits becomes. */
export const SLUG_FALLBACK = "team";

/** The business's name made plain for an address: lower case letters and digits only, at most `SLUG_MAX`. */
export function slugOf(name: string): string {
  const plain = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, SLUG_MAX);
  return plain.length >= 2 ? plain : SLUG_FALLBACK;
}

/** A new key, from random bytes the caller supplies (so this stays pure and testable). */
export function keyFrom(bytes: Uint8Array): string {
  let key = "";
  for (let i = 0; i < KEY_LENGTH; i++) key += KEY_ALPHABET[(bytes[i] ?? 0) % KEY_ALPHABET.length];
  return key;
}

/**
 * The device's own sign-in page, remembered for a year (25 Nov 2026, Martin: "the dedicated company page isn't
 * sticking. I'm taken to the main Renuabl.com.au page"). Signed out on this device, the front page, /design and
 * /design/sign-in send it back there. Holds only the address's last part (/<name>-<key>).
 */
export const TEAM_COOKIE = "renuabl_team";
export const TEAM_COOKIE_DAYS = 365;

export function signInPath(slug: string, key: string): string {
  return `/${slug}-${key}`;
}

const SEGMENT = new RegExp(`^([a-z0-9]{2,${SLUG_MAX}})-([${KEY_ALPHABET}]{${KEY_LENGTH}})$`);

/** Reads an address's first part as a sign-in page's name and key, or null when it can't be one. */
export function readSignInSegment(segment: string): { slug: string; key: string } | null {
  let raw = segment;
  try {
    raw = decodeURIComponent(segment);
  } catch {
    return null;
  }
  const m = SEGMENT.exec(raw.toLowerCase());
  return m ? { slug: m[1], key: m[2] } : null;
}

export const SIGN_IN_PAGE_WORDS = {
  title: "Your team's sign-in page",
  about:
    "Your own address for your team to sign in, with your logo on it. The short code on the end keeps it private: nobody can find it by guessing your name.",
  copy: "Copy link",
  copied: "Copied",
  open: "Open it",
  renew: "Make a new link",
  renewAsk: "The old link will stop working. Anyone who saved it will need the new one.",
  renewYes: "Yes, make a new link",
  logoMissing: "It shows the logo from Settings, Brand.",
  heading: (name: string) => `Sign in to ${name}`,
  poweredBy: "Powered by RENUABL",
} as const;
