/**
 * Server only. Sign-in by email link and the session cookie. Tokens and
 * session ids are stored hashed, so a database leak can't be used to sign in.
 */
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { LOGIN_LINK_MINUTES, SESSION_COOKIE, SESSION_DAYS, staffEmails, type AccountRole } from "@/lib/domain/accounts";
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
  const sessionId = randomToken(32);
  await query(
    `insert into sessions (id_hash, email, role, partner_id, expires_at) values ($1,$2,$3,$4, now() + ($5 || ' days')::interval)`,
    [hash(sessionId), t.email, t.role, partnerId, String(SESSION_DAYS)],
  );
  return { sessionId, role: t.role, next: t.next };
}

export interface Session {
  email: string;
  role: AccountRole;
  partner: PartnerRow | null;
}

/** The signed-in account, if any. Partners must still be approved; staff must still be listed. */
export async function currentSession(): Promise<Session | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return null;
  try {
    const s = (
      await query<{ email: string; role: AccountRole }>(`select email, role from sessions where id_hash = $1 and expires_at > now()`, [
        hash(id),
      ])
    )[0];
    if (!s) return null;
    if (s.role === "staff") return isStaff(s.email) ? { ...s, partner: null } : null;
    if (s.role === "partner") {
      const partner = await partnerByEmail(s.email);
      return partner && partner.status === "approved" ? { ...s, partner } : null;
    }
    return { ...s, partner: null };
  } catch (e) {
    console.error("session check failed", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function endSession(id: string | undefined) {
  if (id && /^[a-f0-9]{64}$/.test(id)) await query(`delete from sessions where id_hash = $1`, [hash(id)]);
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};
