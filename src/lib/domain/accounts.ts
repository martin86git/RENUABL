/**
 * Accounts: customers, partners and RENUABL staff sign in with a one-time
 * link sent to their email. No passwords. Pure: the server keeps the tokens
 * and sessions.
 */

export type AccountRole = "customer" | "partner" | "staff";

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

/** RENUABL staff, from ADMIN_EMAILS (comma or space separated). */
export function staffEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[\s,;]+/)
      .map((e) => normaliseEmail(e))
      .filter((e): e is string => Boolean(e)),
  );
}

/** Where each kind of account lands after signing in. */
export const HOME_FOR: Record<AccountRole, string> = { customer: "/my", partner: "/installer", staff: "/admin" };

/** A place to go after signing in: only our own pages for that account. */
export function safeNext(next: unknown, role: AccountRole): string {
  const home = HOME_FOR[role];
  if (typeof next !== "string" || !next.startsWith(home) || next.startsWith("//") || /[\s\\]/.test(next)) return home;
  return next.slice(0, 200);
}
