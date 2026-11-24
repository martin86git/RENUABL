/**
 * Server only. Each member's own Gmail (domain/design/inbox.ts): Google's sign-in for the gmail.modify scope (read, and
 * labels changed to mark read, unread and archive; since 5 Nov 2026, older mailboxes read only until connected again), the refresh token kept encrypted (AES-256-GCM, keyed from the Google client's own secret, so a copy of the
 * table alone opens nothing) and never sent to a browser, and the few Gmail API calls the inbox needs. Uses the same
 * Google client as "Continue with Google" (GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET), with
 * <site>/api/auth/gmail/callback as a second authorised redirect and the Gmail API enabled on that project.
 * A member may connect several mailboxes (5 Nov 2026, up to `MAX_MAILBOXES`): each is kept by its address, every
 * Gmail call names the mailbox, and the inbox reads them all as one.
 * A mailbox may also be an Outlook one (20 Nov 2026, `provider` on its row; outlook-mail.ts makes the Graph calls): every
 * function here answers for either, an Outlook email handed back in the shape of a Gmail one.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  GMAIL_SCOPE,
  INBOX_SIZE,
  canChangeMail,
  canReadMail,
  MAX_MAILBOXES,
  headerOf,
  labelChange,
  mergeInboxes,
  rawEmail,
  type ComposedEmail,
  type ComposedFile,
  type EmailAction,
  type MailPart,
} from "@/lib/domain/design/inbox";
import { providerOfId, type MailProvider } from "@/lib/domain/design/outlook-mail";
import { gmailQueryFor } from "@/lib/domain/design/deal-mail";
import { siteUrl } from "@/lib/domain/sms";
import { query } from "./db";
import {
  OutlookNotThere,
  OutlookOff,
  outlookAttachment,
  outlookChangeEmail,
  outlookInbox,
  outlookMessage,
  outlookSend,
  outlookTokensFromCode,
  outlookUnread,
  outlookWith,
  refreshOutlook,
  type OutlookConfig,
} from "./outlook-mail";

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
 * mailbox again replaces its tokens). "full" past `MAX_MAILBOXES`; "read-only" when it is kept but Google left out the
 * permission to mark read and archive (its consent screen lets that box be unticked); false when Google says no or gave
 * no refresh token.
 */
export async function connectGmail(
  config: { clientId: string; secret: string; redirect: string },
  code: string,
  member: Who,
): Promise<boolean | "full" | "read-only"> {
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
  if (!t.refresh_token || !t.access_token || !canReadMail(t.scope)) return false;
  const claims = t.id_token
    ? (JSON.parse(Buffer.from(t.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: string })
    : {};
  const address = (claims.email ?? member.email).toLowerCase();
  const have = await gmailAddresses(member);
  if (!have.includes(address) && have.length >= MAX_MAILBOXES) return "full";
  await query(
    `insert into design_gmail (business_id, email, address, token, access, expires_at, can_modify)
       values ($1,$2,$3,$4,$5, now() + make_interval(secs => $6), $7)
     on conflict (business_id, email, address) do update set token = excluded.token, access = excluded.access,
       expires_at = excluded.expires_at, can_modify = excluded.can_modify`,
    [
      member.businessId,
      member.email.toLowerCase(),
      address,
      seal(t.refresh_token),
      seal(t.access_token),
      Math.max(60, (t.expires_in ?? 3600) - 60),
      canChangeMail(t.scope),
    ],
  );
  return canChangeMail(t.scope) ? true : "read-only";
}

/**
 * Keeps an Outlook mailbox for this member beside any mailbox they connected before (20 Nov 2026). "full" past
 * `MAX_MAILBOXES`; false when Microsoft says no, gave no refresh token, or left out reading or sending.
 */
export async function connectOutlookMail(config: OutlookConfig, code: string, member: Who): Promise<boolean | "full"> {
  const t = await outlookTokensFromCode(config, code);
  if (!t || !t.refresh || !t.granted) return false;
  const address = t.address ?? member.email.toLowerCase();
  const have = await gmailAddresses(member);
  if (!have.includes(address) && have.length >= MAX_MAILBOXES) return "full";
  await query(
    `insert into design_gmail (business_id, email, address, token, access, expires_at, can_modify, provider)
       values ($1,$2,$3,$4,$5, now() + make_interval(secs => $6), true, 'outlook')
     on conflict (business_id, email, address) do update set token = excluded.token, access = excluded.access,
       expires_at = excluded.expires_at, can_modify = true, provider = 'outlook'`,
    [member.businessId, member.email.toLowerCase(), address, seal(t.refresh), seal(t.access), t.expiresIn],
  );
  return true;
}

/** Each of a member's mailboxes with which provider it is, the first connected first. */
export async function mailboxes(member: Who): Promise<{ address: string; provider: MailProvider }[]> {
  return query<{ address: string; provider: MailProvider }>(
    `select address, provider from design_gmail where business_id = $1 and email = $2 order by created_at, address`,
    [member.businessId, member.email.toLowerCase()],
  );
}

/** The addresses of the mailboxes a member has connected, the first connected first. */
export async function gmailAddresses(member: Who): Promise<string[]> {
  const rows = await query<{ address: string }>(
    `select address from design_gmail where business_id = $1 and email = $2 order by created_at, address`,
    [member.businessId, member.email.toLowerCase()],
  );
  return rows.map((r) => r.address);
}

/** The member's mailboxes RENUABL may mark read and archive in (connected with gmail.modify). */
export async function changeableAddresses(member: Who): Promise<string[]> {
  const rows = await query<{ address: string }>(
    `select address from design_gmail where business_id = $1 and email = $2 and can_modify order by created_at, address`,
    [member.businessId, member.email.toLowerCase()],
  );
  return rows.map((r) => r.address);
}

/** The first mailbox a member connected, or null. */
export const gmailAddress = async (member: Who): Promise<string | null> => (await gmailAddresses(member))[0] ?? null;

/** Disconnects one mailbox (or, with none named, every one): Google is told to forget each token, and it goes from here. */
export async function disconnectGmail(member: Who, address?: string): Promise<void> {
  const rows = await query<{ token: string; provider: MailProvider }>(
    `delete from design_gmail where business_id = $1 and email = $2 and ($3::text is null or address = $3) returning token, provider`,
    [member.businessId, member.email.toLowerCase(), address?.toLowerCase() ?? null],
  );
  for (const row of rows) {
    // Microsoft has no call to forget a token: an Outlook mailbox simply goes from here.
    const token = row.provider === "outlook" ? null : open(row.token);
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
  return (await tokenFor(member, address))?.token ?? null;
}

/** The mailbox's working access token with which provider it is for. */
async function tokenFor(member: Who, address: string): Promise<{ token: string; provider: MailProvider } | null> {
  const rows = await query<{ token: string; access: string | null; fresh: boolean; provider: MailProvider }>(
    `select token, access, provider, (expires_at > now()) as fresh from design_gmail where business_id = $1 and email = $2 and address = $3`,
    [member.businessId, member.email.toLowerCase(), address],
  );
  const row = rows[0];
  if (!row) return null;
  const provider: MailProvider = row.provider === "outlook" ? "outlook" : "google";
  if (row.fresh && row.access) {
    const access = open(row.access);
    if (access) return { token: access, provider };
  }
  const refresh = open(row.token);
  if (!refresh) return null;
  if (provider === "outlook") {
    const t = await refreshOutlook(refresh);
    if (!t) return null;
    // Microsoft hands out a new refresh token each time: keep it, so the next refresh still works.
    await query(
      `update design_gmail set access = $4, expires_at = now() + make_interval(secs => $5), token = coalesce($6, token)
        where business_id = $1 and email = $2 and address = $3`,
      [member.businessId, member.email.toLowerCase(), address, seal(t.access), t.expiresIn, t.refresh ? seal(t.refresh) : null],
    );
    return { token: t.access, provider };
  }
  const google = await refreshGoogle(member, address, refresh);
  return google ? { token: google, provider } : null;
}

async function refreshGoogle(member: Who, address: string, refresh: string): Promise<string | null> {
  const config = gmailConfig("http://localhost");
  if (!config) return null;
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

/**
 * Runs a Graph call for one of the member's Outlook mailboxes, or answers null when the mailbox is a Gmail one (the
 * caller then goes on to Gmail). Outlook's refusals are said the way Gmail's are, so every screen handles one kind.
 */
async function viaOutlook<T>(member: Who, address: string, run: (token: string) => Promise<T>): Promise<{ got: T } | null> {
  const t = await tokenFor(member, address);
  if (!t) throw new GmailOff(`${address} isn't connected.`);
  if (t.provider !== "outlook") return null;
  try {
    return { got: await run(t.token) };
  } catch (e) {
    if (e instanceof OutlookOff) throw new GmailOff(`Outlook turned the request down for ${address}: connect it again.`);
    if (e instanceof OutlookNotThere) throw new NotThere();
    throw e;
  }
}

async function gmail<T>(member: Who, address: string, path: string, body?: object): Promise<T> {
  const token = await accessToken(member, address);
  if (!token) throw new GmailOff(`Gmail (${address}) isn't connected.`);
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
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
  const outlook = await viaOutlook(member, address, outlookInbox);
  if (outlook) return outlook.got.map((m) => ({ ...m, box: address }));
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
  // An id says which kind of mailbox it is from, so a Gmail id is never asked of Outlook or the other way round.
  const mine = (await mailboxes(member)).filter((m) => m.provider === providerOfId(id)).map((m) => m.address);
  const boxes = box ? mine.filter((b) => b === box.toLowerCase()) : mine;
  for (const b of boxes) {
    try {
      const outlook = await viaOutlook(member, b, (token) => outlookMessage(token, id));
      if (outlook) return { ...outlook.got, box: b };
      return { ...(await gmail<Omit<GmailMessage, "box">>(member, b, `messages/${id}?format=full`)), box: b };
    } catch (e) {
      if (!(e instanceof NotThere)) throw e;
    }
  }
  throw new Error("Gmail 404");
}

/** One of an email's files or pictures, as bytes, from the mailbox it is in. */
export async function attachment(member: Who, box: string, id: string, attachmentId: string): Promise<Buffer> {
  const outlook = await viaOutlook(member, box, (token) => outlookAttachment(token, id, attachmentId));
  if (outlook) return outlook.got;
  const a = await gmail<{ data?: string }>(member, box, `messages/${id}/attachments/${encodeURIComponent(attachmentId)}`);
  return Buffer.from(a.data ?? "", "base64url");
}

/**
 * Emails matching a Gmail search in one mailbox, whole (format=full), newest first, up to `max` (the lead inbox,
 * design-lead-inbox.ts). Only ever a mailbox the member connected.
 */
export async function searchMessages(member: Who, address: string, q: string, max: number): Promise<GmailMessage[]> {
  const box = address.toLowerCase();
  const list = await gmail<{ messages?: { id: string }[] }>(
    member,
    box,
    `messages?q=${encodeURIComponent(q)}&maxResults=${Math.max(1, Math.min(50, max))}`,
  );
  return Promise.all(
    (list.messages ?? []).map(async (m) => ({
      ...(await gmail<Omit<GmailMessage, "box">>(member, box, `messages/${m.id}?format=full`)),
      box,
    })),
  );
}

/**
 * Every email to or from one address across the member's own mailboxes (Gmail and Outlook), with headers and a
 * preview, not the words. A mailbox that doesn't answer is left out.
 */
export async function mailWith(member: Who, address: string, max: number): Promise<GmailMessage[]> {
  const boxes = await gmailAddresses(member);
  const got = await Promise.allSettled(
    boxes.map(async (box): Promise<GmailMessage[]> => {
      const outlook = await viaOutlook(member, box, (token) => outlookWith(token, address, max));
      if (outlook) return outlook.got.map((m) => ({ ...m, box }));
      const list = await gmail<{ messages?: { id: string }[] }>(
        member,
        box,
        `messages?q=${encodeURIComponent(gmailQueryFor(address))}&maxResults=${Math.max(1, Math.min(50, max))}`,
      );
      return Promise.all(
        (list.messages ?? []).map(async (m) => ({
          ...(await gmail<Omit<GmailMessage, "box">>(
            member,
            box,
            `messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject`,
          )),
          box,
        })),
      );
    }),
  );
  return got.flatMap((g) => (g.status === "fulfilled" ? g.value : []));
}

/** Read only: connected before RENUABL could mark read and archive; connecting it again allows it. */
export class ReadOnlyMailbox extends Error {}

/**
 * Marks one of the member's own emails read or unread, or archives it, in Gmail itself (only Gmail's labels change:
 * nothing is sent or deleted). Only in one of their own mailboxes connected with gmail.modify.
 */
export async function changeEmail(member: Who, box: string, id: string, action: EmailAction): Promise<void> {
  const address = box.toLowerCase();
  if (!(await changeableAddresses(member)).includes(address)) {
    if ((await gmailAddresses(member)).includes(address))
      throw new ReadOnlyMailbox(`Connect ${address} again to mark read and archive from here.`);
    throw new GmailOff(`Gmail (${address}) isn't connected.`);
  }
  if (await viaOutlook(member, address, (token) => outlookChangeEmail(token, id, action))) return;
  await gmail(member, address, `messages/${encodeURIComponent(id)}/modify`, labelChange(action));
}

/**
 * Sends a new email from one of the member's own mailboxes (8 Nov 2026, Martin: write an email from the inbox), so it
 * comes from their address and Gmail keeps it in their Sent. gmail.modify allows sending; a read-only one is refused.
 */
export async function sendFromGmail(
  member: Who,
  box: string,
  mail: ComposedEmail,
  files: readonly ComposedFile[] = [],
  picturesHtml = "",
): Promise<void> {
  const address = box.toLowerCase();
  if (!(await changeableAddresses(member)).includes(address)) {
    if ((await gmailAddresses(member)).includes(address)) throw new ReadOnlyMailbox(`Connect ${address} again to send from it here.`);
    throw new GmailOff(`Gmail (${address}) isn't connected.`);
  }
  if (await viaOutlook(member, address, (token) => outlookSend(token, address, mail, files, picturesHtml))) return;
  const token = await accessToken(member, address);
  if (!token) throw new GmailOff(`Gmail (${address}) isn't connected.`);
  // Gmail's upload address takes the email as it is (pictures and files included), with no JSON round it.
  const res = await fetch("https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "message/rfc822" },
    body: new Uint8Array(rawEmail(address, mail, files, picturesHtml)),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 401 || res.status === 403) throw new GmailOff(`Gmail turned the request down for ${address}: connect it again.`);
  if (!res.ok) throw new Error(`Gmail ${res.status}`);
}

/** The unread count of every mailbox the member has connected together, as Gmail keeps each. */
export async function unreadCount(member: Who): Promise<number> {
  const boxes = await gmailAddresses(member);
  const got = await Promise.allSettled(
    boxes.map(async (b) => {
      const outlook = await viaOutlook(member, b, outlookUnread);
      return outlook ? outlook.got : ((await gmail<{ messagesUnread?: number }>(member, b, "labels/INBOX")).messagesUnread ?? 0);
    }),
  );
  return got.reduce((n, g) => n + (g.status === "fulfilled" ? g.value : 0), 0);
}

export const subjectOf = (m: GmailMessage) => (m.payload ? headerOf(m.payload, "Subject") : "") || "(no subject)";
export const fromOf = (m: GmailMessage) => (m.payload ? headerOf(m.payload, "From") : "");
export const atOf = (m: GmailMessage) => new Date(Number(m.internalDate ?? 0) || Date.now()).toISOString();
