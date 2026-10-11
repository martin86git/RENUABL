"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import clsx from "clsx";
import { MAX_LINE, POLL_SECONDS, teamName, type ChatThread, type PublicLine } from "@/lib/domain/design/chat";
import {
  UNREAD_CHANGED,
  lineTime,
  loadCustomerChat,
  loadDealChat,
  loadMessages,
  loadUnreadCount,
  markChatRead,
  sendCustomerLine,
  sendReply,
  unreadChanged,
  type DealChat as DealChatData,
} from "@/lib/services/chat";
import { useDesignAccount } from "./design-account";
import { PATHS, ui } from "./design-shell";

/**
 * The lines of a conversation, like a phone's messages: the reader's own on
 * the right, the other side's on the left, the newest at the foot (and kept
 * in view as lines arrive). Each run of lines from one side is headed with
 * that side's name. Uses colour tokens only, so it takes the business's
 * colours on the customer's page and the product's own on the business's.
 */
function Bubbles(props: {
  lines: readonly PublicLine[];
  mine: "customer" | "business";
  names: { customer: string; business: string };
  empty: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const count = props.lines.length;
  useEffect(() => {
    // The newest line at the foot of the list. The list is scrolled, never the page it sits on.
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [count]);
  return (
    <div ref={list} className="max-h-96 min-h-32 space-y-1.5 overflow-y-auto px-1 py-2" role="log" aria-live="polite" aria-label="Messages">
      {count === 0 && <p className="px-2 py-6 text-center text-sm text-muted">{props.empty}</p>}
      {props.lines.map((line, i) => {
        const own = line.from === props.mine;
        const first = i === 0 || props.lines[i - 1].from !== line.from;
        return (
          <div key={line.id} className={clsx("flex flex-col", own ? "items-end" : "items-start", first && i > 0 && "pt-2")}>
            {first && <span className="px-1 pb-0.5 text-[11px] font-medium text-muted">{props.names[line.from]}</span>}
            <p
              title={lineTime(line.at)}
              className={clsx(
                "max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-[14px] leading-snug",
                own ? "rounded-br-md bg-primary text-primary-ink" : "rounded-bl-md border border-line bg-surface text-ink",
              )}
            >
              {line.text}
            </p>
            {i === count - 1 && <span className="px-1 pt-0.5 text-[10.5px] text-muted">{lineTime(line.at)}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Where a line is typed: Enter sends it, Shift+Enter starts a new line. */
function Compose(props: { onSend: (text: string) => Promise<boolean>; placeholder: string; disabled?: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const typed = text.trim();
    if (!typed || busy || props.disabled) return;
    setBusy(true);
    if (await props.onSend(typed)) setText("");
    setBusy(false);
  };
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <textarea
        rows={1}
        value={text}
        maxLength={MAX_LINE}
        disabled={props.disabled}
        placeholder={props.placeholder}
        aria-label={props.placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send();
          }
        }}
        className="block max-h-40 min-h-11 w-full resize-y rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-[16px] text-ink outline-none focus:border-[var(--primary)] disabled:bg-surface-2 sm:text-sm"
      />
      <button
        type="submit"
        disabled={busy || props.disabled || !text.trim()}
        aria-label="Send"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-ink disabled:bg-surface-2 disabled:text-muted"
      >
        <Send className="size-4" aria-hidden />
      </button>
    </form>
  );
}

/**
 * The customer's side, on their proposal: their lines on the right under
 * their first name, the business's on the left under "<Business> team" (never
 * a person's name). It asks for new lines every 20 seconds while the page is
 * in view. In the business's own preview (`token` left out) it is shown
 * empty and takes nothing.
 */
export function CustomerChat({ token, business, phone }: { token?: string; business: string; phone?: string }) {
  const [lines, setLines] = useState<PublicLine[]>([]);
  const [names, setNames] = useState({ customer: "You", business: teamName(business) });
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!token) return;
    let gone = false;
    const look = async () => {
      const res = await loadCustomerChat(token);
      if (gone || !res.ok) return;
      setLines(res.messages);
      setNames(res.names);
      setOpen(res.open);
    };
    // Asked once on arrival, then every 20 seconds, but not while the page is behind another tab (nobody is
    // reading it); coming back to the page asks straight away.
    const whenSeen = () => void (document.visibilityState === "visible" && look());
    void look();
    const timer = window.setInterval(whenSeen, POLL_SECONDS * 1000);
    document.addEventListener("visibilitychange", whenSeen);
    return () => {
      gone = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", whenSeen);
    };
  }, [token]);
  // The link in an email ends in #chat: bring the chat into view. Done a moment after the page arrives, and again
  // once more has loaded above it, because the page's own scrolling to the top on arrival otherwise wins.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.location.hash !== "#chat") return;
    const show = () => box.current?.scrollIntoView({ block: "center" });
    const timers = [100, 700].map((ms) => window.setTimeout(show, ms));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  if (!open) return null;
  return (
    <div id="chat" ref={box} className="scroll-mt-6 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h3 className="text-[18px] text-ink">Questions? Message {business}</h3>
      <p className="mt-1 text-sm text-muted">
        Write here and {business} will answer here{phone ? `. Or call ${phone}` : ""}.
      </p>
      <div className="mt-3 rounded-lg bg-canvas px-2">
        <Bubbles lines={lines} mine="customer" names={names} empty="No messages yet. Ask anything about your proposal." />
      </div>
      {problem && (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      <div className="mt-3">
        <Compose
          placeholder="Write a message"
          disabled={!token}
          onSend={async (text) => {
            if (!token) return false;
            const res = await sendCustomerLine(token, text);
            if (!res.ok) {
              setProblem(res.message);
              return false;
            }
            setProblem(null);
            setLines(res.messages);
            setNames(res.names);
            return true;
          }}
        />
      </div>
      {!token && <p className="mt-2 text-[12.5px] text-muted">A preview: your customer writes to you from their own link.</p>}
    </div>
  );
}

/**
 * The business's side of one job's conversation: the customer's lines on the
 * left, the business's own on the right, and a box to reply. Opening it marks
 * the customer's lines as read; a reply says whether the customer was also
 * emailed. It looks for new lines every 20 seconds while it is in view.
 */
export function DealChat({ jobId, compact }: { jobId: string; compact?: boolean }) {
  const [account] = useDesignAccount();
  const business = (account?.signedIn && account.business?.name) || "Your";
  const [chat, setChat] = useState<DealChatData | null>(null);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const look = useCallback(async () => {
    const res = await loadDealChat(jobId);
    if (!res.ok) return setStatus({ text: res.message, error: true });
    setChat(res);
    // Seen: the lines are on the screen in front of someone at the business (not when the page is behind another tab).
    if (document.visibilityState === "visible" && res.lines.some((l) => l.from === "customer" && !l.read))
      void markChatRead(jobId).then(unreadChanged);
  }, [jobId]);
  useEffect(() => {
    // Asked once on arrival, then every 20 seconds while the page is in view, and on coming back to it.
    const whenSeen = () => void (document.visibilityState === "visible" && look());
    // The conversation is asked of the server: its state is set when the answer arrives, not in the effect itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void look();
    const timer = window.setInterval(whenSeen, POLL_SECONDS * 1000);
    document.addEventListener("visibilitychange", whenSeen);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", whenSeen);
    };
  }, [look]);

  if (!chat)
    return <p className={clsx("text-sm", status?.error ? "text-danger" : "text-muted")}>{status?.text ?? "Loading the conversation…"}</p>;
  const names = { customer: chat.customer, business: teamName(business) };
  return (
    <div className={clsx(!compact && ui.card, !compact && "p-4 sm:p-5")}>
      {!chat.hasProposal && (
        <p className="mb-3 rounded-md border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-2">
          This customer has no proposal out, so they have nowhere to read a reply. Publish the proposal and send them its link first.
        </p>
      )}
      <div className="rounded-lg bg-canvas px-2">
        <Bubbles
          lines={chat.lines}
          mine="business"
          names={names}
          empty="No messages yet. The customer can write to you from their proposal, and you can write first from here."
        />
      </div>
      {status && (
        <p className={clsx("mt-2 text-xs", status.error ? "text-danger" : "text-positive")} role="status">
          {status.text}
        </p>
      )}
      <div className="mt-3">
        <Compose
          placeholder={`Reply to ${chat.customer}`}
          onSend={async (text) => {
            const res = await sendReply(jobId, text);
            if (!res.ok) {
              setStatus({ text: res.message, error: true });
              return false;
            }
            setChat({ ...chat, lines: res.lines, unanswered: 0 });
            setStatus({ text: res.outcome });
            unreadChanged();
            return true;
          }}
        />
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
        The customer sees your reply as from &ldquo;{names.business}&rdquo;, never your own name or email. Enter sends; Shift and Enter
        starts a new line.
      </p>
    </div>
  );
}

/** How many of the business's customers' lines nobody has seen, kept up to date: asked on arrival, every minute, and whenever a chat is read. */
export function useUnreadMessages(on: boolean): number {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!on) return;
    let gone = false;
    const look = async () => {
      const res = await loadUnreadCount();
      if (!gone && res.ok) setUnread(res.unread);
    };
    void look();
    // Each minute, but not while the page is behind another tab.
    const timer = window.setInterval(() => void (document.visibilityState === "visible" && look()), 60_000);
    window.addEventListener(UNREAD_CHANGED, look);
    return () => {
      gone = true;
      window.clearInterval(timer);
      window.removeEventListener(UNREAD_CHANGED, look);
    };
  }, [on]);
  return on ? unread : 0;
}

/**
 * "Chat" on the design tool's top bar, for a roof opened from a deal: the
 * same conversation as on the deal, in a panel under the button, with a count
 * while the customer's latest lines are unanswered.
 */
export function ChatButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let gone = false;
    const look = async () => {
      const res = await loadDealChat(jobId);
      if (!gone && res.ok) setWaiting(res.unanswered);
    };
    void look();
    const timer = window.setInterval(() => void (document.visibilityState === "visible" && look()), 60_000);
    window.addEventListener(UNREAD_CHANGED, look);
    return () => {
      gone = true;
      window.clearInterval(timer);
      window.removeEventListener(UNREAD_CHANGED, look);
    };
  }, [jobId]);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={clsx(
          "inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium text-ink",
          open ? "border-primary bg-surface-2" : "border-line bg-surface hover:border-forest",
        )}
      >
        <MessageSquare className="size-4" aria-hidden /> Chat
        {waiting > 0 && (
          <span
            className="rounded-full bg-sun-line px-1.5 text-[11px] font-semibold leading-5 text-white"
            aria-label={`${waiting} unanswered`}
          >
            {waiting}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg bg-surface p-4 shadow-[var(--shadow-lift)] ring-1 ring-line">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-ink">Conversation with the customer</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the chat"
              className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <DealChat jobId={jobId} compact />
        </div>
      )}
    </div>
  );
}

/** Messages (/design/messages): every conversation a customer has written in, the most recent first, each opening its deal's chat. */
export function MessagesPage() {
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const look = useCallback(async () => {
    const res = await loadMessages();
    if (!res.ok) return setProblem(res.message);
    setThreads(res.threads);
  }, []);
  useEffect(() => {
    // Asked of the server: its state is set when the answer arrives, not in the effect itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void look();
  }, [look]);
  const read = async (jobId: string) => {
    await markChatRead(jobId);
    unreadChanged();
    void look();
  };
  return (
    <div className={clsx(ui.page, "max-w-3xl")}>
      <p className={ui.eyebrow}>Messages</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Messages from your customers</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
        What customers have written to you from their proposals, the most recent first. Open one to read the whole conversation and reply.
      </p>
      {problem && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {problem}
        </p>
      )}
      {threads && threads.length === 0 && (
        <div className={clsx(ui.card, "mt-6 p-5 text-sm text-ink-2")}>
          Nothing yet. A customer can write to you from the chat on their proposal; you can write first from a deal&apos;s Chat tab.
        </div>
      )}
      {threads && threads.length > 0 && (
        <ul className={clsx(ui.card, "mt-6 divide-y divide-line")}>
          {threads.map((t) => (
            <li key={t.jobId} className="flex items-center gap-3 px-4 py-3">
              <Link href={`${PATHS.deals}/${t.jobId}?tab=chat`} className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm text-ink">
                  <span className={clsx("truncate", t.unread > 0 && "font-semibold")}>{t.customerName}</span>
                  <span className="shrink-0 text-xs text-muted">· {t.title}</span>
                  {t.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-sun-line px-1.5 text-[11px] font-semibold leading-5 text-white">
                      {t.unread} new
                    </span>
                  )}
                </p>
                <p className={clsx("mt-0.5 truncate text-[13px]", t.unread > 0 ? "text-ink" : "text-ink-2")}>{t.last}</p>
              </Link>
              <span className="shrink-0 text-xs tabular-nums text-muted">{lineTime(t.at)}</span>
              {t.unread > 0 && (
                <button type="button" onClick={() => void read(t.jobId)} className={clsx(ui.quiet, "h-8 shrink-0 px-3 text-xs")}>
                  Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
