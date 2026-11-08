/**
 * Each member's own Gmail inbox, as the screens reach it (/api/design/inbox): read, marked read, unread or archived in
 * Gmail itself, its notes, and Sol on an email.
 */
import type { ComposeHelp, EmailAction, EmailSize, EmailSummary, InboxEmail } from "@/lib/domain/design/inbox";
import type { OpenedEmail, SharedEmail } from "@/lib/server/design-inbox-repo";
import { ask } from "./crm";

export type { OpenedEmail, SharedEmail };

export interface InboxAnswer {
  connected: boolean;
  address?: string;
  /** Every mailbox this member has connected (5 Nov 2026: one or more). */
  addresses?: string[];
  /** The mailboxes RENUABL may mark read and archive in; the rest were connected read only, before. */
  changeable?: string[];
  /** Whether another may be connected (under `MAX_MAILBOXES`). */
  more?: boolean;
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
const boxQuery = (box?: string) => (box ? `&box=${encodeURIComponent(box)}` : "");
export const openInboxEmail = (id: string, owner?: string, box?: string) =>
  ask<{ email: OpenedEmail }>(`${INBOX}?id=${encodeURIComponent(id)}${owner ? `&owner=${encodeURIComponent(owner)}` : boxQuery(box)}`);
export const emailFileHref = (id: string, n: number, box?: string) => `${INBOX}?id=${encodeURIComponent(id)}&file=${n}${boxQuery(box)}`;
export const noteOnEmail = (id: string, owner: string, text: string) =>
  ask<{ told: string[]; email: OpenedEmail }>(INBOX, { method: "POST", body: { do: "note", id, owner, text } });
/** Sol on an email: a summary for the team in its three parts, or a reply drafted to check and send. Nothing is sent. */
export const solOnEmail = (id: string, owner: string, mode: "summary" | "reply") =>
  ask<{ text?: string; summary?: EmailSummary }>(INBOX, { method: "POST", body: { do: "sol", id, owner, mode } });
/** Marks an email read or unread, or archives it, in Gmail itself; tells the shell's unread count. */
export async function changeInboxEmail(id: string, box: string | undefined, action: EmailAction) {
  const res = await ask<object>(INBOX, { method: "POST", body: { do: action, id, box } });
  if (res.ok) window.dispatchEvent(new Event("renuabl:inbox"));
  return res;
}
/**
 * Sends a new email from one of this person's own mailboxes, through Gmail (it lands in their Sent): the words, the text
 * size, and any pictures (shown inside it) and files (attached), as a form.
 */
export function sendNewEmail(
  mail: { box?: string; to: string; cc: string; subject: string; body: string; size: EmailSize },
  files: readonly File[] = [],
) {
  const form = new FormData();
  form.set("do", "send");
  for (const [k, v] of Object.entries(mail)) if (v) form.set(k, v);
  for (const f of files) form.append("file", f, f.name);
  return ask<{ from: string }>(INBOX, { method: "POST", body: form });
}
/** Sol tidies the words up (polish), or writes the email from what the person asked (write). Nothing is sent. */
export const solOnNewEmail = (input: { mode: ComposeHelp; to: string; subject: string; body: string; instructions?: string }) =>
  ask<{ subject: string; body: string }>(INBOX, { method: "POST", body: { do: "compose-sol", ...input } });
/** Disconnects one mailbox, or every one with none named. */
export const disconnectGmail = (address?: string) =>
  ask<object>(address ? `${INBOX}?address=${encodeURIComponent(address)}` : INBOX, { method: "DELETE" });
export const CONNECT_GMAIL = "/api/auth/gmail";
/** Connect a further mailbox: Google asks which account. */
export const ADD_GMAIL = "/api/auth/gmail?add=1";

export type GmailOutcome = "connected" | "failed" | "full" | "off" | "signed-out" | "read-only" | "closed";

/**
 * Connects a Gmail then and there (5 Nov 2026, Martin: never leave the page to do it): Google's sign-in opens in a
 * small window over the page, which tells this page how it went and closes itself. Answers "closed" when the person
 * shuts the window first. Where the browser blocks the window, the page goes to Google and comes back instead.
 */
export function connectGmailHere(add = false): Promise<GmailOutcome> {
  const url = `${CONNECT_GMAIL}?popup=1${add ? "&add=1" : ""}`;
  const w = 500;
  const h = 640;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
  const popup = window.open(url, "renuabl-gmail", `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
  if (!popup) {
    window.location.assign(add ? ADD_GMAIL : CONNECT_GMAIL);
    return new Promise(() => {});
  }
  popup.focus();
  return new Promise((resolve) => {
    const finish = (outcome: GmailOutcome) => {
      window.removeEventListener("message", heard);
      clearInterval(watch);
      resolve(outcome);
    };
    const heard = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { source?: string; outcome?: GmailOutcome } | null;
      if (data?.source === "renuabl-gmail" && data.outcome) finish(data.outcome);
    };
    window.addEventListener("message", heard);
    // Shut before Google finished: nothing changed.
    const watch = setInterval(() => popup.closed && finish("closed"), 500);
  });
}
