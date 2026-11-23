/**
 * Server only. Sign-in by email link and the session cookie. Tokens and
 * session ids are stored hashed, so a database leak can't be used to sign in.
 */
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import {
  LOGIN_LINK_MINUTES,
  SESSION_COOKIE,
  SESSION_DAYS,
  sessionNeedsRenewing,
  staffEmails,
  type AccountRole,
} from "@/lib/domain/accounts";
import { query, randomToken } from "./db";
import { partnerByEmail, type PartnerRow } from "./partners-repo";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export function isStaff(email: string) {
  return staffEmails(process.env.ADMIN_EMAILS).has(email.toLowerCase());
}

/** A one-time sign-in token for this email and role; the link is emailed, never shown. */
export async function createLoginToken(email: string, role: AccountRole, next: string | null): Promise<string> {
  const token = randomToken(32);
  await query(
    `insert into login_tokens (token_hash, email, role, next, expires_at) values ($1,$2,$3,$4, now() + ($5 || ' minutes')::interval)`,
    [hash(token), email.toLowerCase(), role, next, String(LOGIN_LINK_MINUTES)],
  );
  return token;
}

/** Uses a sign-in token (once) and starts a session. Null when it's unknown, used or expired. */
export async function redeemLoginToken(token: string): Promise<{ sessionId: string; role: AccountRole; next: string | null } | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await query<{ email: string; role: AccountRole; next: string | null }>(
    `update login_tokens set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning email, role, next`,
    [hash(token)],
  );
  const t = rows[0];
  if (!t) return null;
  let partnerId: string | null = null;
  if (t.role === "partner") {
    const p = await partnerByEmail(t.email);
    if (!p || p.status !== "approved") return null;
    partnerId = p.id;
  }
  if (t.role === "staff" && !isStaff(t.email)) return null;
  return { sessionId: await openSession(t.email, t.role, partnerId), role: t.role, next: t.next };
}

/**
 * Starts a session for an email whose owner has just proven it (a link, a password set while signed in, or Google).
 * Answers the session id for the cookie; only its hash is kept.
 */
export async function openSession(email: string, role: AccountRole, partnerId: string | null = null): Promise<string> {
  const sessionId = randomToken(32);
  await query(
    `insert into sessions (id_hash, email, role, partner_id, expires_at) values ($1,$2,$3,$4, now() + ($5 || ' days')::interval)`,
    [hash(sessionId), email.toLowerCase(), role, partnerId, String(SESSION_DAYS)],
  );
  return sessionId;
}

export interface Session {
  email: string;
  role: AccountRole;
  partner: PartnerRow | null;
  /** When the session was last really used, for the screen lock (null before it was first recorded). */
  activeAt?: Date | null;
}

/** The signed-in account, if any. Partners must still be approved; staff must still be listed. */
export async function currentSession(): Promise<Session | null> {
  // Read outside the try: Next's signal that a page is dynamic must not be caught.
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    return await readSession(id);
  } catch (e) {
    console.error("session check failed", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Thrown when the session couldn't be checked (the database didn't answer): not the same as signed out. */
export class SessionUnknown extends Error {}

/**
 * The signed-in session, asked three times before giving up (22 Nov 2026, Martin: a database hiccup on the first load after
 * signing in read as signed out, and Today said "Sign in to your business"). A failure throws `SessionUnknown`, so a
 * route answers "couldn't reach your account" and the page tries again, instead of saying nobody is signed in.
 */
export async function readSession(sessionId?: string): Promise<Session | null> {
  const id = sessionId ?? (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return null;
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const s = (
        await query<{ email: string; role: AccountRole; expires_at: Date; active_at: Date | null }>(
          `select email, role, expires_at, active_at from sessions where id_hash = $1 and expires_at > now()`,
          [hash(id)],
        )
      )[0];
      if (!s) return null;
      // Rolling: a session in use is pushed out again (never fails the check if the write doesn't go through).
      if (sessionNeedsRenewing(new Date(s.expires_at)))
        await query(`update sessions set expires_at = now() + ($2 || ' days')::interval where id_hash = $1`, [
          hash(id),
          String(SESSION_DAYS),
        ]).catch(() => undefined);
      // The screen lock counts from now for a session from before it (never fails the check).
      if (!s.active_at) await query(`update sessions set active_at = now() where id_hash = $1`, [hash(id)]).catch(() => undefined);
      const who = { email: s.email, role: s.role, activeAt: s.active_at ? new Date(s.active_at) : null };
      if (s.role === "staff") return isStaff(s.email) ? { ...who, partner: null } : null;
      if (s.role === "partner") {
        const partner = await partnerByEmail(s.email);
        return partner && partner.status === "approved" ? { ...who, partner } : null;
      }
      return { ...who, partner: null };
    } catch (e) {
      last = e;
      // A database waking from sleep: give it a moment, then longer (23 Nov 2026).
      if (attempt < 2) await new Promise((r) => setTimeout(r, attempt === 0 ? 400 : 1_500));
    }
  }
  throw new SessionUnknown(last instanceof Error ? last.message : "session check failed");
}

/** Whose session an id is, while it lasts: for a session kept aside (staff looking through a sample business). */
export async function sessionEmail(id: string | undefined): Promise<string | null> {
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return null;
  const rows = await query<{ email: string }>(`select email from sessions where id_hash = $1 and expires_at > now()`, [hash(id)]);
  return rows[0]?.email ?? null;
}

export async function endSession(id: string | undefined) {
  if (id && /^[a-f0-9]{64}$/.test(id)) await query(`delete from sessions where id_hash = $1`, [hash(id)]);
}

/** Sends the session cookie again with its full life, so the browser keeps it as long as the server does. Route handlers only. */
export async function renewSessionCookie() {
  try {
    const jar = await cookies();
    const id = jar.get(SESSION_COOKIE)?.value;
    if (id && /^[a-f0-9]{64}$/.test(id)) jar.set(SESSION_COOKIE, id, SESSION_COOKIE_OPTIONS);
  } catch {
    // Not somewhere a cookie can be set (a page): the next route call renews it.
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};
