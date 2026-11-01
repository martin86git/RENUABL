/**
 * Each member's own Gmail inbox, as the screens reach it (/api/design/inbox): read only, its notes, and Sol on an email.
 */
import type { InboxEmail } from "@/lib/domain/design/inbox";
import type { OpenedEmail, SharedEmail } from "@/lib/server/design-inbox-repo";
import { ask } from "./crm";

export type { OpenedEmail, SharedEmail };

export interface InboxAnswer {
  connected: boolean;
  address?: string;
  /** Google's sign-in is set up here (without it, Connect Gmail can't work). */
  ready?: boolean;
  /** The owner is viewing as someone else: their mailbox isn't read. */
  viewing?: boolean;
  /** Gmail stopped answering for this member (revoked): connect again. */
  broken?: string;
  emails: InboxEmail[];
  shared: SharedEmail[];
}

export const INBOX = "/api/design/inbox";
export const loadInbox = () => ask<InboxAnswer>(INBOX);
export const inboxUnread = () => ask<{ unread: number }>(`${INBOX}?count=1`);
export const openInboxEmail = (id: string, owner?: string) =>
  ask<{ email: OpenedEmail }>(`${INBOX}?id=${encodeURIComponent(id)}${owner ? `&owner=${encodeURIComponent(owner)}` : ""}`);
export const emailFileHref = (id: string, n: number) => `${INBOX}?id=${encodeURIComponent(id)}&file=${n}`;
export const noteOnEmail = (id: string, owner: string, text: string) =>
  ask<{ told: string[]; email: OpenedEmail }>(INBOX, { method: "POST", body: { do: "note", id, owner, text } });
export const solOnEmail = (id: string, owner: string, mode: "summary" | "reply") =>
  ask<{ text: string }>(INBOX, { method: "POST", body: { do: "sol", id, owner, mode } });
export const disconnectGmail = () => ask<object>(INBOX, { method: "DELETE" });
export const CONNECT_GMAIL = "/api/auth/gmail";
