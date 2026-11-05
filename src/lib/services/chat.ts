/**
 * The conversation between a business and its customer, as the screens ask
 * for it. The customer's side goes by their proposal's private link
 * (`/api/proposal/<token>/chat`); the business's side by the signed-in
 * member (`/api/design/jobs/<id>/chat`, `/api/design/messages`). Who a line
 * is from is the server's to decide on both. Each call answers with what
 * was asked for, or a plain message to show.
 */
import type { ChatLine, ChatThread, PublicChat, ReplyEmail } from "@/lib/domain/design/chat";
import { withFiles } from "./form";

export type Answer<T> = ({ ok: true } & T) | { ok: false; message: string };

const UNREACHABLE = "We couldn't reach the server just now. Try again in a moment.";

async function ask<T>(path: string, init?: { method: string; body?: unknown }): Promise<Answer<T>> {
  try {
    const res = await fetch(path, {
      method: init?.method ?? "GET",
      // A form (an email with files) goes as it is, so the browser sets its own multipart header.
      ...(init?.body instanceof FormData
        ? { body: init.body }
        : init?.body !== undefined
          ? { headers: { "content-type": "application/json" }, body: JSON.stringify(init.body) }
          : {}),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as (Record<string, unknown> & { ok?: boolean; message?: string }) | null;
    if (res.ok && json?.ok) return json as { ok: true } & T;
    return { ok: false, message: json?.message ?? UNREACHABLE };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

// The customer's side.
const linkChat = (token: string) => `/api/proposal/${encodeURIComponent(token)}/chat`;
export const loadCustomerChat = (token: string) => ask<PublicChat>(linkChat(token));
export const sendCustomerLine = (token: string, text: string) => ask<PublicChat>(linkChat(token), { method: "POST", body: { text } });

// The business's side.
export interface DealChat {
  lines: ChatLine[];
  /** How many of the customer's latest lines have had no answer. */
  unanswered: number;
  customer: string;
  /** Whether the customer has a proposal out to read replies on. */
  hasProposal: boolean;
}
const jobChat = (jobId: string) => `/api/design/jobs/${encodeURIComponent(jobId)}/chat`;
export const loadDealChat = (jobId: string) => ask<DealChat>(jobChat(jobId));
export const sendReply = (jobId: string, text: string, files: readonly File[] = []) =>
  ask<{ lines: ChatLine[]; unanswered: number; email: ReplyEmail; outcome: string }>(jobChat(jobId), {
    method: "POST",
    body: files.length ? withFiles({ text }, files) : { text },
  });
/** Sol writes a reply as the member asked, for them to change and send; nothing is sent by asking. */
export const draftReply = (jobId: string, words: string) =>
  ask<{ text: string }>(`${jobChat(jobId)}/draft`, { method: "POST", body: { ask: words } });
export const markChatRead = (jobId: string) => ask<{ marked: number }>(jobChat(jobId), { method: "PUT" });

export const loadMessages = () => ask<{ unread: number; threads: ChatThread[] }>("/api/design/messages");
export const loadUnreadCount = () => ask<{ unread: number }>("/api/design/messages?count=1");

/** Tells every part of the screen that shows the unread count to ask again (the nav's badge, after a chat is opened or answered). */
export const UNREAD_CHANGED = "renuabl:design-unread";
export const unreadChanged = () => window.dispatchEvent(new Event(UNREAD_CHANGED));

/** "9:41 am, 12 Oct" for a line's time. */
export const lineTime = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" });
