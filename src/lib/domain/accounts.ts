/**
 * Accounts: customers, partners, RENUABL staff and the businesses that use
 * the roof designer sign in with a one-time link sent to their email. No
 * passwords. Pure: the server keeps the tokens and sessions.
 */

/** "business" is someone in a business that uses the roof designer (/design): not a RENUABL installation partner. */
export type AccountRole = "customer" | "partner" | "staff" | "business";

/** A sign-in link works once, for this long. */
export const LOGIN_LINK_MINUTES = 30;
/** How long someone stays signed in. */
export const SESSION_DAYS = 30;
export const SESSION_COOKIE = "renuabl_session";
/** Preview only: browsing the sample portal without an account. */
export const DEMO_COOKIE = "renuabl_demo";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 200 && EMAIL.test(e) ? e : null;
}

/** RENUABL staff, from ADMIN_EMAILS (comma or space separated; quote marks and <> pasted around addresses are ignored). */
export function staffEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[\s,;]+/)
      .map((e) => normaliseEmail(e.replace(/["'`<>\u2018\u2019\u201c\u201d]/g, "")))
      .filter((e): e is string => Boolean(e)),
  );
}

/** Where each kind of account lands after signing in. */
export const HOME_FOR: Record<AccountRole, string> = {
  customer: "/my",
  partner: "/installer",
  staff: "/admin",
  business: "/design",
};

/** A place to go after signing in: only our own pages for that account. */
export function safeNext(next: unknown, role: AccountRole): string {
  const home = HOME_FOR[role];
  if (typeof next !== "string" || !next.startsWith(home) || next.startsWith("//") || /[\s\\]/.test(next)) return home;
  return next.slice(0, 200);
}

/** How a sign-in link reaches the person asking for it. */
export type SignInDelivery = { by: "email"; site: string } | { by: "terminal"; site: string } | { by: "none" };

/**
 * Email whenever it's set up. On a developer's own computer with no email
 * service, the link is printed in the terminal running the site instead, and
 * only ever for an address on that computer. Anywhere else, with no email,
 * no link is made at all.
 */
export function signInDelivery(o: {
  /** An email service and a sender are set up. */
  emailReady: boolean;
  /** The site's public address, when it has one (SITE_URL). */
  site: string | null;
  /** NODE_ENV: "development" only under . */
  nodeEnv: string | undefined;
  /** Whether this is running on Vercel (any of its environments). */
  hosted: boolean;
  /** The address this request came to. */
  origin: string;
}): SignInDelivery {
  if (o.emailReady && o.site) return { by: "email", site: o.site };
  if (o.nodeEnv !== "development" || o.hosted) return { by: "none" };
  try {
    const u = new URL(o.origin);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
    return local && u.protocol === "http:" ? { by: "terminal", site: u.origin } : { by: "none" };
  } catch {
    return { by: "none" };
  }
}
