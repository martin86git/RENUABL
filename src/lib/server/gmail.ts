/**
 * Server only. Each member's own Gmail, read only (domain/design/inbox.ts): Google's sign-in for the gmail.readonly
 * scope, the refresh token kept encrypted (AES-256-GCM, keyed from the Google client's own secret, so a copy of the
 * table alone opens nothing) and never sent to a browser, and the few Gmail API calls the inbox needs. Uses the same
 * Google client as "Continue with Google" (GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET), with
 * <site>/api/auth/gmail/callback as a second authorised redirect and the Gmail API enabled on that project.
 * A member may connect several mailboxes (5 Nov 2026, up to `MAX_MAILBOXES`): each is kept by its address, every
 * Gmail call names the mailbox, and the inbox reads them all as one.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { GMAIL_SCOPE, INBOX_SIZE, MAX_MAILBOXES, headerOf, mergeInboxes, type MailPart } from "@/lib/domain/design/inbox";
import { siteUrl } from "@/lib/domain/sms";
import { query } from "./db";

export const GMAIL_STATE_COOKIE = "renuabl_gmail_state";

type Who = { businessId: string; email: string };

export function gmailConfig(origin: string): { clientId: string; secret: string; redirect: string } | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !secret) return null;
  return { clientId, secret, redirect: `${siteUrl() ?? origin}/api/auth/gmail/callback` };
}

/** Google's sign-in for Gmail: suggested the member's own address, or (adding another mailbox, no hint) asking which account. */
export function gmailAuthUrl(config: { clientId: string; redirect: string }, state: string, hint: string | null): string {
  const q = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirect,
    response_type: "code",
    scope: `openid email ${GMAIL_SCOPE}`,
    access_type: "offline",
    prompt: hint ? "consent" : "consent select_account",
    include_granted_scopes: "true",
    ...(hint ? { login_hint: hint } : {}),
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

/**
 * Swaps Google's code for the tokens and keeps them for this member beside any mailbox they connected before (the same
 * mailbox again replaces its tokens). "full" past `MAX_MAILBOXES`; false when Google says no or gave no refresh token.
 */
export async function connectGmail(
  config: { clientId: string; secret: string; redirect: string },
  code: string,
  member: Who,
): Promise<boolean | "full"> {
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
  const address = (claims.email ?? member.email).toLowerCase();
  const have = await gmailAddresses(member);
  if (!have.includes(address) && have.length >= MAX_MAILBOXES) return "full";
  await query(
    `insert into design_gmail (business_id, email, address, token, access, expires_at) values ($1,$2,$3,$4,$5, now() + make_interval(secs => $6))
     on conflict (business_id, email, address) do update set token = excluded.token, access = excluded.access,
       expires_at = excluded.expires_at`,
    [
      member.businessId,
      member.email.toLowerCase(),
      address,
      seal(t.refresh_token),
      seal(t.access_token),
      Math.max(60, (t.expires_in ?? 3600) - 60),
    ],
  );
  return true;
}

/** The addresses of the mailboxes a member has connected, the first connected first. */
export async function gmailAddresses(member: Who): Promise<string[]> {
  const rows = await query<{ address: string }>(
    `select address from design_gmail where business_id = $1 and email = $2 order by created_at, address`,
    [member.businessId, member.email.toLowerCase()],
  );
  return rows.map((r) => r.address);
}

/** The first mailbox a member connected, or null. */
export const gmailAddress = async (member: Who): Promise<string | null> => (await gmailAddresses(member))[0] ?? null;

/** Disconnects one mailbox (or, with none named, every one): Google is told to forget each token, and it goes from here. */
export async function disconnectGmail(member: Who, address?: string): Promise<void> {
  const rows = await query<{ token: string }>(
    `delete from design_gmail where business_id = $1 and email = $2 and ($3::text is null or address = $3) returning token`,
    [member.businessId, member.email.toLowerCase(), address?.toLowerCase() ?? null],
  );
  for (const row of rows) {
    const token = open(row.token);
    if (token)
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => undefined);
  }
}

/** A working access token for one of the member's mailboxes, refreshed when it has run out. Null when not connected or revoked. */
async function accessToken(member: Who, address: string): Promise<string | null> {
  const rows = await query<{ token: string; access: string | null; fresh: boolean }>(
    `select token, access, (expires_at > now()) as fresh from design_gmail where business_id = $1 and email = $2 and address = $3`,
    [member.businessId, member.email.toLowerCase(), address],
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
  await query(
    `update design_gmail set access = $4, expires_at = now() + make_interval(secs => $5) where business_id = $1 and email = $2 and address = $3`,
    [member.businessId, member.email.toLowerCase(), address, seal(t.access_token), Math.max(60, (t.expires_in ?? 3600) - 60)],
  );
  return t.access_token;
}

export class GmailOff extends Error {}
/** Gmail has no such email in that mailbox (it may be in another of the member's). */
class NotThere extends Error {}

async function gmail<T>(member: Who, address: string, path: string): Promise<T> {
  const token = await accessToken(member, address);
  if (!token) throw new GmailOff(`Gmail (${address}) isn't connected.`);
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401 || res.status === 403) throw new GmailOff(`Gmail turned the request down for ${address}: connect it again.`);
  if (res.status === 404) throw new NotThere();
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
  /** The member's mailbox it was read from. */
  box: string;
}

/** One mailbox's newest emails, with their headers (not their bodies). */
async function boxMessages(member: Who, address: string): Promise<GmailMessage[]> {
  const list = await gmail<{ messages?: { id: string }[] }>(member, address, `messages?labelIds=INBOX&maxResults=${INBOX_SIZE}`);
  return Promise.all(
    (list.messages ?? []).map(async (m) => ({
      ...(await gmail<Omit<GmailMessage, "box">>(
        member,
        address,
        `messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      )),
      box: address,
    })),
  );
}

/**
 * The newest emails across every mailbox the member has connected, as one inbox. A mailbox that has stopped answering
 * is left out while the others still show; only when none answers is it said (GmailOff).
 */
export async function inboxMessages(member: Who): Promise<GmailMessage[]> {
  const boxes = await gmailAddresses(member);
  const got = await Promise.allSettled(boxes.map((b) => boxMessages(member, b)));
  const read = got.flatMap((g) => (g.status === "fulfilled" ? [g.value] : []));
  if (!read.length && got[0]?.status === "rejected") throw got[0].reason;
  return mergeInboxes(read.map((box) => box.map((m) => ({ m, at: atOf(m) })))).map((x) => x.m);
}

/** One email, whole, from the mailbox named (only one of the member's own), else whichever of their mailboxes holds it. */
export async function fullMessage(member: Who, id: string, box?: string): Promise<GmailMessage> {
  const mine = await gmailAddresses(member);
  const boxes = box ? mine.filter((b) => b === box.toLowerCase()) : mine;
  for (const b of boxes) {
    try {
      return { ...(await gmail<Omit<GmailMessage, "box">>(member, b, `messages/${id}?format=full`)), box: b };
    } catch (e) {
      if (!(e instanceof NotThere)) throw e;
    }
  }
  throw new Error("Gmail 404");
}

/** One of an email's files or pictures, as bytes, from the mailbox it is in. */
export async function attachment(member: Who, box: string, id: string, attachmentId: string): Promise<Buffer> {
  const a = await gmail<{ data?: string }>(member, box, `messages/${id}/attachments/${encodeURIComponent(attachmentId)}`);
  return Buffer.from(a.data ?? "", "base64url");
}

/** The unread count of every mailbox the member has connected together, as Gmail keeps each. */
export async function unreadCount(member: Who): Promise<number> {
  const boxes = await gmailAddresses(member);
  const got = await Promise.allSettled(boxes.map((b) => gmail<{ messagesUnread?: number }>(member, b, "labels/INBOX")));
  return got.reduce((n, g) => n + (g.status === "fulfilled" ? (g.value.messagesUnread ?? 0) : 0), 0);
}

export const subjectOf = (m: GmailMessage) => (m.payload ? headerOf(m.payload, "Subject") : "") || "(no subject)";
export const fromOf = (m: GmailMessage) => (m.payload ? headerOf(m.payload, "From") : "");
export const atOf = (m: GmailMessage) => new Date(Number(m.internalDate ?? 0) || Date.now()).toISOString();
