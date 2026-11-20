/**
 * Server only. The Microsoft Graph calls an Outlook mailbox needs in the inbox (domain/design/outlook-mail.ts), each
 * given a working access token by gmail.ts, which keeps every mailbox's tokens whichever provider it is. Uses the same
 * Microsoft Entra app as the Outlook calendar (MICROSOFT_OAUTH_CLIENT_ID, MICROSOFT_OAUTH_CLIENT_SECRET) with the
 * delegated permissions Mail.ReadWrite and Mail.Send and <site>/api/auth/outlook/callback as a redirect.
 * Every call asks for immutable ids, so an email keeps its id (and its notes) when it is archived.
 */
import { INBOX_SIZE, rawEmail, type ComposedEmail, type ComposedFile, type EmailAction } from "@/lib/domain/design/inbox";
import {
  INLINE_LIMITS,
  OUTLOOK_MAIL_SIGN_IN,
  asMailShape,
  isInlinePicture,
  outlookChange,
  outlookMailGranted,
  type GraphAttachment,
  type GraphMessage,
} from "@/lib/domain/design/outlook-mail";
import { siteUrl } from "@/lib/domain/sms";

export const OUTLOOK_STATE_COOKIE = "renuabl_outlook_state";
const MICROSOFT = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0/me";

export interface OutlookConfig {
  clientId: string;
  secret: string;
  redirect: string;
}

export function outlookMailConfig(origin: string): OutlookConfig | null {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID?.trim();
  const secret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !secret) return null;
  return { clientId, secret, redirect: `${siteUrl() ?? origin}/api/auth/outlook/callback` };
}

/** Microsoft's sign-in for the mailbox: it always asks which account, since people keep several. */
export function outlookAuthUrl(config: OutlookConfig, state: string, hint: string | null): string {
  const q = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirect,
    response_type: "code",
    response_mode: "query",
    scope: OUTLOOK_MAIL_SIGN_IN,
    prompt: "select_account",
    ...(hint ? { login_hint: hint } : {}),
    state,
  });
  return `${MICROSOFT}/authorize?${q}`;
}

export interface OutlookTokens {
  refresh: string | null;
  access: string;
  expiresIn: number;
  /** The mailbox's own address, when the sign-in said it. */
  address: string | null;
  granted: boolean;
}

async function tokens(config: Pick<OutlookConfig, "clientId" | "secret">, body: Record<string, string>): Promise<OutlookTokens | null> {
  const res = await fetch(`${MICROSOFT}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.secret, scope: OUTLOOK_MAIL_SIGN_IN, ...body }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const t = (await res.json()) as { refresh_token?: string; access_token?: string; expires_in?: number; id_token?: string; scope?: string };
  if (!t.access_token) return null;
  let claims: { email?: string; preferred_username?: string } = {};
  try {
    if (t.id_token) claims = JSON.parse(Buffer.from(t.id_token.split(".")[1] ?? "", "base64url").toString("utf8"));
  } catch {
    claims = {};
  }
  const address = (claims.email ?? claims.preferred_username ?? "").toLowerCase();
  return {
    refresh: t.refresh_token ?? null,
    access: t.access_token,
    expiresIn: Math.max(60, (t.expires_in ?? 3600) - 60),
    address: address.includes("@") ? address : null,
    granted: outlookMailGranted(t.scope),
  };
}

export const outlookTokensFromCode = (config: OutlookConfig, code: string) =>
  tokens(config, { code, redirect_uri: config.redirect, grant_type: "authorization_code" });

/** A fresh access token; Microsoft hands out a new refresh token each time, which the caller keeps. */
export function refreshOutlook(refresh: string): Promise<OutlookTokens | null> {
  const config = outlookMailConfig("http://localhost");
  return config ? tokens(config, { refresh_token: refresh, grant_type: "refresh_token" }) : Promise.resolve(null);
}

/** The mailbox turned the request down (signed out, permission taken away): connect it again. */
export class OutlookOff extends Error {}
/** No such email in that mailbox. */
export class OutlookNotThere extends Error {}

async function graph<T>(token: string, path: string, init: { method?: string; body?: BodyInit; type?: string } = {}): Promise<T> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: init.method ?? "GET",
    ...(init.body !== undefined ? { body: init.body } : {}),
    headers: {
      authorization: `Bearer ${token}`,
      prefer: 'IdType="ImmutableId"',
      ...(init.body !== undefined ? { "content-type": init.type ?? "application/json" } : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 401 || res.status === 403) throw new OutlookOff("Outlook turned the request down: connect it again.");
  // An id that isn't this mailbox's reads as not found or as a badly formed id.
  if (res.status === 404 || (res.status === 400 && !init.method)) throw new OutlookNotThere();
  if (!res.ok) throw new Error(`Outlook ${res.status}`);
  if (res.status === 202 || res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const FIELDS = "id,conversationId,subject,from,toRecipients,receivedDateTime,isRead,bodyPreview";
const idPath = (id: string) => encodeURIComponent(id);

/** The mailbox's newest emails in its inbox, with who, what and when (not their bodies). */
export async function outlookInbox(token: string): Promise<ReturnType<typeof asMailShape>[]> {
  const q = new URLSearchParams({ $top: String(INBOX_SIZE), $orderby: "receivedDateTime desc", $select: FIELDS });
  const list = await graph<{ value?: GraphMessage[] }>(token, `mailFolders/inbox/messages?${q}`);
  return (list.value ?? []).filter((m) => m.id).map((m) => asMailShape(m));
}

/** One email whole: its words, the files it carries, and its own pictures fetched to show in place. */
export async function outlookMessage(token: string, id: string): Promise<ReturnType<typeof asMailShape>> {
  const [m, files] = await Promise.all([
    graph<GraphMessage>(token, `messages/${idPath(id)}?$select=${FIELDS},body`),
    graph<{ value?: GraphAttachment[] }>(token, `messages/${idPath(id)}/attachments?$select=id,name,contentType,size,isInline`).catch(
      (e) => {
        if (e instanceof OutlookOff) throw e;
        return { value: [] as GraphAttachment[] };
      },
    ),
  ]);
  const listed = files.value ?? [];
  const inline = listed.filter(isInlinePicture).slice(0, INLINE_LIMITS.count);
  const whole = await Promise.all(
    inline.map((a) => graph<GraphAttachment>(token, `messages/${idPath(id)}/attachments/${idPath(a.id ?? "")}`).catch(() => null)),
  );
  const byId = new Map(whole.flatMap((a) => (a?.id ? [[a.id, a] as const] : [])));
  return asMailShape(
    m,
    listed.map((a) => (a.id && byId.has(a.id) ? { ...a, ...byId.get(a.id) } : a)),
  );
}

/** One of an email's files, as bytes. */
export async function outlookAttachment(token: string, id: string, attachmentId: string): Promise<Buffer> {
  const a = await graph<GraphAttachment>(token, `messages/${idPath(id)}/attachments/${idPath(attachmentId)}`);
  return Buffer.from(a.contentBytes ?? "", "base64");
}

/** Marks an email read or unread, or moves it to the mailbox's Archive folder. Nothing is deleted. */
export async function outlookChangeEmail(token: string, id: string, action: EmailAction): Promise<void> {
  const change = outlookChange(action);
  if (change.method === "PATCH") await graph(token, `messages/${idPath(id)}`, { method: "PATCH", body: JSON.stringify(change.body) });
  else await graph(token, `messages/${idPath(id)}/move`, { method: "POST", body: JSON.stringify({ destinationId: change.move }) });
}

/** Sends a new email from the mailbox, as written (Graph takes the whole email, base64), and keeps it in its Sent. */
export async function outlookSend(
  token: string,
  address: string,
  mail: ComposedEmail,
  files: readonly ComposedFile[],
  picturesHtml: string,
): Promise<void> {
  await graph(token, "sendMail", {
    method: "POST",
    type: "text/plain",
    body: rawEmail(address, mail, files, picturesHtml).toString("base64"),
  });
}

/** How many emails in the mailbox's inbox are unread. */
export async function outlookUnread(token: string): Promise<number> {
  const f = await graph<{ unreadItemCount?: number }>(token, "mailFolders/inbox?$select=unreadItemCount");
  return f.unreadItemCount ?? 0;
}
