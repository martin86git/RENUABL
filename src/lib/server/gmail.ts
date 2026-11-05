/**
 * Server only. Each member's own Gmail, read only (domain/design/inbox.ts): Google's sign-in for the gmail.readonly
 * scope, the refresh token kept encrypted (AES-256-GCM, keyed from the Google client's own secret, so a copy of the
 * table alone opens nothing) and never sent to a browser, and the few Gmail API calls the inbox needs. Uses the same
 * Google client as "Continue with Google" (GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET), with
 * <site>/api/auth/gmail/callback as a second authorised redirect and the Gmail API enabled on that project.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { GMAIL_SCOPE, INBOX_SIZE, headerOf, type MailPart } from "@/lib/domain/design/inbox";
import { siteUrl } from "@/lib/domain/sms";
import { query } from "./db";

export const GMAIL_STATE_COOKIE = "renuabl_gmail_state";

export function gmailConfig(origin: string): { clientId: string; secret: string; redirect: string } | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !secret) return null;
  return { clientId, secret, redirect: `${siteUrl() ?? origin}/api/auth/gmail/callback` };
}

export function gmailAuthUrl(config: { clientId: string; redirect: string }, state: string, hint: string): string {
  const q = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirect,
    response_type: "code",
    scope: `openid email ${GMAIL_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    login_hint: hint,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

const key = () =>
  createHash("sha256")
    .update(`renuabl-gmail:${process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? ""}`)
    .digest();

export function seal(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function open(sealed: string): string | null {
  try {
    const [iv, tag, body] = sealed.split(".").map((s) => Buffer.from(s, "base64url"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Swaps Google's code for the tokens and keeps them for this member. False when Google says no or gave no refresh token. */
export async function connectGmail(
  config: { clientId: string; secret: string; redirect: string },
  code: string,
  member: { businessId: string; email: string },
): Promise<boolean> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.secret,
      redirect_uri: config.redirect,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return false;
  const t = (await res.json()) as { refresh_token?: string; access_token?: string; expires_in?: number; id_token?: string; scope?: string };
  if (!t.refresh_token || !t.access_token || !t.scope?.includes(GMAIL_SCOPE)) return false;
  const claims = t.id_token
    ? (JSON.parse(Buffer.from(t.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: string })
    : {};
  await query(
    `insert into design_gmail (business_id, email, address, token, access, expires_at) values ($1,$2,$3,$4,$5, now() + make_interval(secs => $6))
     on conflict (business_id, email) do update set address = excluded.address, token = excluded.token, access = excluded.access,
       expires_at = excluded.expires_at`,
    [
      member.businessId,
      member.email.toLowerCase(),
      (claims.email ?? member.email).toLowerCase(),
      seal(t.refresh_token),
      seal(t.access_token),
      Math.max(60, (t.expires_in ?? 3600) - 60),
    ],
  );
  return true;
}

/** The address a member's Gmail is connected as, or null. */
export async function gmailAddress(member: { businessId: string; email: string }): Promise<string | null> {
  const rows = await query<{ address: string }>(`select address from design_gmail where business_id = $1 and email = $2`, [
    member.businessId,
    member.email.toLowerCase(),
  ]);
  return rows[0]?.address ?? null;
}

/** Disconnects: Google is told to forget the token, and it goes from here. */
export async function disconnectGmail(member: { businessId: string; email: string }): Promise<void> {
  const rows = await query<{ token: string }>(`delete from design_gmail where business_id = $1 and email = $2 returning token`, [
    member.businessId,
    member.email.toLowerCase(),
  ]);
  const token = rows[0] && open(rows[0].token);
  if (token)
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
}

/** A working access token for the member's Gmail, refreshed when it has run out. Null when not connected or revoked. */
async function accessToken(member: { businessId: string; email: string }): Promise<string | null> {
  const rows = await query<{ token: string; access: string | null; fresh: boolean }>(
    `select token, access, (expires_at > now()) as fresh from design_gmail where business_id = $1 and email = $2`,
    [member.businessId, member.email.toLowerCase()],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.fresh && row.access) {
    const access = open(row.access);
    if (access) return access;
  }
  const config = gmailConfig("http://localhost");
  const refresh = open(row.token);
  if (!config || !refresh) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refresh,
      client_id: config.clientId,
      client_secret: config.secret,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const t = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!t.access_token) return null;
  await query(`update design_gmail set access = $3, expires_at = now() + make_interval(secs => $4) where business_id = $1 and email = $2`, [
    member.businessId,
    member.email.toLowerCase(),
    seal(t.access_token),
    Math.max(60, (t.expires_in ?? 3600) - 60),
  ]);
  return t.access_token;
}

export class GmailOff extends Error {}

async function gmail<T>(member: { businessId: string; email: string }, path: string): Promise<T> {
  const token = await accessToken(member);
  if (!token) throw new GmailOff("Gmail isn't connected.");
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401 || res.status === 403) throw new GmailOff("Gmail turned the request down: connect it again.");
  if (!res.ok) throw new Error(`Gmail ${res.status}`);
  return (await res.json()) as T;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: MailPart;
}

/** The newest emails in the member's inbox, with their headers (not their bodies). */
export async function inboxMessages(member: { businessId: string; email: string }): Promise<GmailMessage[]> {
  const list = await gmail<{ messages?: { id: string }[] }>(member, `messages?labelIds=INBOX&maxResults=${INBOX_SIZE}`);
  return Promise.all(
    (list.messages ?? []).map((m) =>
      gmail<GmailMessage>(member, `messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`),
    ),
  );
}

/** One email, whole. */
export const fullMessage = (member: { businessId: string; email: string }, id: string) =>
  gmail<GmailMessage>(member, `messages/${id}?format=full`);

/** One of an email's files or pictures, as bytes. */
export async function attachment(member: { businessId: string; email: string }, id: string, attachmentId: string): Promise<Buffer> {
  const a = await gmail<{ data?: string }>(member, `messages/${id}/attachments/${encodeURIComponent(attachmentId)}`);
  return Buffer.from(a.data ?? "", "base64url");
}

/** The inbox's unread count, as Gmail keeps it. */
export async function unreadCount(member: { businessId: string; email: string }): Promise<number> {
  const label = await gmail<{ messagesUnread?: number }>(member, "labels/INBOX");
  return label.messagesUnread ?? 0;
}

export const subjectOf = (m: GmailMessage) => (m.payload ? headerOf(m.payload, "Subject") : "") || "(no subject)";
export const fromOf = (m: GmailMessage) => (m.payload ? headerOf(m.payload, "From") : "");
export const atOf = (m: GmailMessage) => new Date(Number(m.internalDate ?? 0) || Date.now()).toISOString();
