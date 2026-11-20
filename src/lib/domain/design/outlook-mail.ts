/**
 * Outlook mailboxes in the inbox (20 Nov 2026, Martin: "we should have an outlook email connector"). An Outlook email
 * as Microsoft Graph gives it, turned into the shape the inbox already reads for Gmail (inbox.ts `MailPart`), so the
 * list, an opened email, its files, notes and Sol's summary work for either without knowing which it is. Pure: the
 * calls to Graph are in server/outlook-mail.ts.
 */
import type { EmailAction, MailPart } from "./inbox";

export type MailProvider = "google" | "outlook";
export const MAIL_PROVIDERS: readonly MailProvider[] = ["google", "outlook"];
export const cleanMailProvider = (v: unknown): MailProvider => (v === "outlook" ? "outlook" : "google");

/** The delegated Graph permissions asked for: read and organise the mailbox, and send from it. */
export const OUTLOOK_MAIL_SCOPES = "Mail.ReadWrite Mail.Send";
export const OUTLOOK_MAIL_SIGN_IN = `openid email profile offline_access ${OUTLOOK_MAIL_SCOPES}`;

/** Whether Microsoft granted both (its consent is all or nothing, but the answer is still checked). */
export function outlookMailGranted(scope: string | undefined): boolean {
  const have = (scope ?? "").toLowerCase().split(/\s+/);
  const has = (s: string) => have.some((h) => h === s || h.endsWith(`/${s}`));
  return has("mail.readwrite") && has("mail.send");
}

/** A Gmail message id is short hex; an Outlook one is long and never only that. Tells which kind of mailbox holds an id. */
export const providerOfId = (id: string): MailProvider => (/^[a-f0-9]{8,40}$/i.test(id) ? "google" : "outlook");

interface GraphAddress {
  emailAddress?: { name?: string; address?: string };
}
export interface GraphMessage {
  id?: string;
  conversationId?: string;
  subject?: string | null;
  from?: GraphAddress | null;
  toRecipients?: GraphAddress[] | null;
  receivedDateTime?: string | null;
  isRead?: boolean;
  bodyPreview?: string | null;
  body?: { contentType?: string; content?: string } | null;
}
export interface GraphAttachment {
  "@odata.type"?: string;
  id?: string;
  name?: string | null;
  contentType?: string | null;
  size?: number;
  isInline?: boolean;
  contentId?: string | null;
  contentBytes?: string;
}

/** How many of an email's own pictures are fetched whole to show in it, and how large each may be. */
export const INLINE_LIMITS = { count: 8, bytes: 4 * 1024 * 1024 } as const;

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
const b64url = (text: string) => Buffer.from(text, "utf8").toString("base64url");

/** `"Name" <address>` as an email header writes it, from Graph's pair. */
export function headerAddress(a: GraphAddress | null | undefined): string {
  const address = oneLine(a?.emailAddress?.address ?? "");
  const name = oneLine(a?.emailAddress?.name ?? "").replace(/["<>]/g, "");
  if (!address) return name;
  return name && name.toLowerCase() !== address.toLowerCase() ? `"${name}" <${address}>` : address;
}

/** A file Graph can hand over as bytes (not another email or a link to a file kept elsewhere). */
export const isFileAttachment = (a: GraphAttachment) => !a["@odata.type"] || a["@odata.type"].toLowerCase().endsWith("fileattachment");

/** An attachment that is one of the email's own pictures, small enough to fetch whole and show in place. */
export const isInlinePicture = (a: GraphAttachment) =>
  isFileAttachment(a) &&
  a.isInline === true &&
  (a.contentType ?? "").toLowerCase().startsWith("image/") &&
  (a.size ?? 0) <= INLINE_LIMITS.bytes;

/** The Outlook message as the inbox reads a Gmail one. `attachments` may carry bytes for the email's own pictures. */
export function asMailShape(
  m: GraphMessage,
  attachments: readonly GraphAttachment[] = [],
): { id: string; threadId: string; snippet: string; labelIds: string[]; internalDate: string; payload: MailPart } {
  const at = Date.parse(m.receivedDateTime ?? "");
  const parts: MailPart[] = [];
  const content = m.body?.content ?? "";
  if (content)
    parts.push({ mimeType: m.body?.contentType?.toLowerCase() === "html" ? "text/html" : "text/plain", body: { data: b64url(content) } });
  for (const a of attachments) {
    if (!a.id || !isFileAttachment(a)) continue;
    const type = (a.contentType ?? "application/octet-stream").toLowerCase();
    if (a.contentBytes && a.contentId && type.startsWith("image/")) {
      parts.push({
        mimeType: type,
        headers: [{ name: "Content-ID", value: `<${a.contentId.replace(/[<>]/g, "")}>` }],
        body: { data: Buffer.from(a.contentBytes, "base64").toString("base64url") },
      });
      continue;
    }
    // A picture shown inside the email whose bytes weren't fetched isn't listed as a file to download.
    if (a.isInline && type.startsWith("image/")) continue;
    parts.push({ filename: oneLine(a.name ?? "") || "file", mimeType: type, body: { attachmentId: a.id, size: a.size ?? 0 } });
  }
  return {
    id: m.id ?? "",
    threadId: m.conversationId ?? m.id ?? "",
    snippet: oneLine(m.bodyPreview ?? "").slice(0, 200),
    labelIds: m.isRead === false ? ["UNREAD"] : [],
    internalDate: String(Number.isFinite(at) ? at : Date.now()),
    payload: {
      mimeType: "multipart/mixed",
      headers: [
        { name: "From", value: headerAddress(m.from) },
        { name: "To", value: (m.toRecipients ?? []).map(headerAddress).filter(Boolean).join(", ") },
        { name: "Subject", value: oneLine(m.subject ?? "") },
        { name: "Date", value: Number.isFinite(at) ? new Date(at).toUTCString() : "" },
      ],
      parts,
    },
  };
}

/** What Graph is asked to do for read, unread and archive: a field changed, or the email moved to the Archive folder. */
export function outlookChange(action: EmailAction): { method: "PATCH"; body: { isRead: boolean } } | { method: "POST"; move: "archive" } {
  if (action === "archive") return { method: "POST", move: "archive" };
  return { method: "PATCH", body: { isRead: action === "read" } };
}

/** Outlook on the web, opened on one email. */
export const outlookWebLink = (id: string) => `https://outlook.office.com/mail/inbox/id/${encodeURIComponent(id)}`;
