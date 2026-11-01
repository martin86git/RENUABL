"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, MessageSquare, X } from "lucide-react";
import clsx from "clsx";
import { MAX_LINE, POLL_SECONDS, teamName, type ChatThread, type PublicLine } from "@/lib/domain/design/chat";
import {
  SEND_TEMPLATES,
  fillTemplate,
  greetingOf,
  newFromBusiness,
  timeBreaks,
  type SendFill,
  type SendTemplateId,
} from "@/lib/domain/design/send-message";
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
 * The lines of a conversation, the way a phone's messages app shows them:
 * the reader's own on the right in the main colour, the other side's on the
 * left in grey, lines from one side close together in a run with a tail on
 * the last of each run, the time centred above a line that comes after a
 * pause (`timeBreaks`), "Sent" under the reader's latest line, and the
 * newest at the foot (kept in view as lines arrive). No names over the
 * runs: who the other side is says in the header around it. Colour tokens
 * only, so it takes the business's colours on the customer's page and the
 * product's own on the business's. The tails are cut out of the page colour
 * (`bg-canvas`), which is what the list always sits on.
 */
function Bubbles(props: {
  lines: readonly PublicLine[];
  mine: "customer" | "business";
  names: { customer: string; business: string };
  empty: string;
  /** The list's height, in place of the usual. */
  className?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const count = props.lines.length;
  useEffect(() => {
    // The newest line at the foot of the list. The list is scrolled, never the page it sits on.
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [count]);
  const breaks = timeBreaks(props.lines);
  const lastOwn = props.lines.findLastIndex((line) => line.from === props.mine);
  return (
    <div
      ref={list}
      className={clsx(props.className ?? "max-h-96 min-h-32", "overflow-y-auto overflow-x-hidden px-4 py-3")}
      role="log"
      aria-live="polite"
      aria-label="Messages"
    >
      {count === 0 && <p className="px-4 py-8 text-center text-[13px] text-muted">{props.empty}</p>}
      {props.lines.map((line, i) => {
        const own = line.from === props.mine;
        const next = props.lines[i + 1];
        const runStarts = i === 0 || breaks.has(i) || props.lines[i - 1].from !== line.from;
        const runEnds = !next || breaks.has(i + 1) || next.from !== line.from;
        return (
          <div key={line.id} className={clsx("flex flex-col", own ? "items-end" : "items-start", runStarts ? "mt-2.5" : "mt-0.5")}>
            {breaks.has(i) && <p className="w-full pb-1.5 pt-2 text-center text-[11px] font-medium text-muted">{lineTime(line.at)}</p>}
            <p
              title={lineTime(line.at)}
              className={clsx(
                "relative max-w-[78%] whitespace-pre-line break-words rounded-[18px] px-3 py-[7px] text-[15px] leading-[1.35]",
                own ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink",
                // The tail on the last line of a run: a curl of the bubble's colour, trimmed by a curl of the page's.
                runEnds &&
                  "before:absolute before:bottom-0 before:h-[17px] before:w-5 after:absolute after:bottom-0 after:h-[17px] after:w-[10px] after:bg-canvas",
                runEnds &&
                  (own
                    ? "before:-right-[7px] before:rounded-bl-[16px_14px] before:bg-primary after:-right-[10px] after:rounded-bl-[10px]"
                    : "before:-left-[7px] before:rounded-br-[16px_14px] before:bg-surface-2 after:-left-[10px] after:rounded-br-[10px]"),
              )}
            >
              <span className="sr-only">{props.names[line.from]}: </span>
              {line.text}
            </p>
            {i === lastOwn && <span className="px-1 pt-1 text-[11px] font-medium text-muted">Sent</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Where a message is typed: Enter sends it, Shift+Enter starts a new line. A rounded box with the send arrow inside it. */
function Compose(props: {
  onSend: (text: string) => Promise<boolean>;
  placeholder: string;
  disabled?: boolean;
  /** A draft to start with (give the box a new `key` to start again with another). */
  initial?: string;
  /** Room for a draft of several paragraphs: Enter is a new line there, and a labelled button sends it. */
  tall?: boolean;
  /** Words on that button. */
  sendLabel?: string;
}) {
  const [text, setText] = useState(props.initial ?? "");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const typed = text.trim();
    if (!typed || busy || props.disabled) return;
    setBusy(true);
    if (await props.onSend(typed)) setText("");
    setBusy(false);
  };
  const ready = Boolean(text.trim()) && !busy && !props.disabled;
  const box = (
    <textarea
      rows={props.tall ? 9 : 1}
      value={text}
      maxLength={MAX_LINE}
      disabled={props.disabled}
      placeholder={props.placeholder}
      aria-label={props.placeholder}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !props.tall) {
          e.preventDefault();
          void send();
        }
      }}
      className={clsx(
        "block w-full resize-none bg-transparent text-[16px] leading-[1.35] text-ink outline-none placeholder:text-muted sm:text-[15px]",
        props.tall
          ? "max-h-[50dvh] min-h-48 rounded-2xl border border-line px-3.5 py-2.5 focus:border-[var(--primary)]"
          : "max-h-32 py-[7px] pl-3.5 pr-10",
        // Grows with what is typed, a line at a time, as a phone's box does.
        !props.tall && "[field-sizing:content]",
      )}
    />
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      {props.tall ? (
        <div className="space-y-2">
          {box}
          <button
            type="submit"
            disabled={!ready}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-ink disabled:bg-surface-2 disabled:text-muted"
          >
            <ArrowUp className="size-4" aria-hidden /> {busy ? "Sending…" : (props.sendLabel ?? "Send")}
          </button>
        </div>
      ) : (
        <div className={clsx("relative rounded-[20px] border border-line bg-surface", props.disabled && "bg-surface-2")}>
          {box}
          <button
            type="submit"
            disabled={!ready}
            aria-label="Send"
            className={clsx(
              "absolute bottom-[5px] right-[5px] flex size-[26px] items-center justify-center rounded-full transition-opacity",
              ready ? "bg-primary text-primary-ink" : "bg-surface-2 text-muted opacity-0",
            )}
          >
            <ArrowUp className="size-4" strokeWidth={2.75} aria-hidden />
          </button>
        </div>
      )}
    </form>
  );
}

/** Initials for an avatar: the first letter of the first two words. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "?";

/** A round avatar of initials, in the grey of the other side's bubbles. */
function Avatar({ name, size = "size-10" }: { name: string; size?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-ink-2", size)}
    >
      {initials(name)}
    </span>
  );
}

/**
 * The customer's side of the conversation, on their proposal, kept in one
 * place and drawn in two: the business's latest message as a greeting at the
 * top of the proposal (`ChatGreeting`), and the chat itself in a dock that
 * stays at the foot of the screen as they scroll (`ChatDock`), so a note or
 * a question can be written from anywhere on the page. It asks for new lines
 * every 20 seconds while the page is in view. In the business's own preview
 * (`token` left out) it is shown empty and takes nothing.
 */
export interface CustomerConversation {
  token?: string;
  business: string;
  phone?: string;
  lines: PublicLine[];
  names: { customer: string; business: string };
  /** False once the proposal has been withdrawn: nothing is shown. */
  open: boolean;
  /** Whether the dock is open. */
  shown: boolean;
  show: (shown: boolean) => void;
  problem: string | null;
  send: (text: string) => Promise<boolean>;
}

export function useCustomerChat({ token, business, phone }: { token?: string; business: string; phone?: string }): CustomerConversation {
  const [lines, setLines] = useState<PublicLine[]>([]);
  const [names, setNames] = useState({ customer: "You", business: teamName(business) });
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [shown, show] = useState(false);
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
  // The link in an email ends in #chat: open the chat on arrival (the page itself stays at the top, on the greeting).
  useEffect(() => {
    // Read from the address once the page is in a browser, which the server's render can't know.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.location.hash === "#chat") show(true);
  }, []);
  const send = async (text: string) => {
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
  };
  // In the business's preview nothing is asked of the server: the names follow the business as the preview loads.
  const shownNames = token ? names : { customer: "You", business: teamName(business) };
  return { token, business, phone, lines, names: shownNames, open, shown, show, problem, send };
}

/**
 * The business's latest message, at the top of the proposal: how the
 * business greets the customer and says whatever it wants to say with it.
 * "Reply" opens the chat dock. Nothing before the business has written; in
 * the business's preview, a note of where its message will show.
 */
export function ChatGreeting({ chat }: { chat: CustomerConversation }) {
  const greeting = greetingOf(chat.lines);
  if (!chat.open) return null;
  if (!greeting)
    return chat.token ? null : (
      <p className="rounded-xl border border-dashed border-line px-4 py-3 text-[13px] text-muted">
        The message you send with this proposal shows here, at the top of your customer&apos;s page, and in the chat at the foot of their
        screen.
      </p>
    );
  // As it would arrive on a phone: the business's avatar and name, then its message in a grey bubble with a tail.
  return (
    <div>
      <div className="flex items-end gap-2.5">
        <Avatar name={chat.business} size="size-9" />
        <div className="min-w-0 max-w-2xl">
          <p className="pb-1 pl-3 text-[12px] text-muted">
            {chat.names.business} · {lineTime(greeting.at)}
          </p>
          <p className="relative whitespace-pre-line break-words rounded-[20px] bg-surface-2 px-4 py-2.5 text-[16px] leading-[1.4] text-ink before:absolute before:-left-[7px] before:bottom-0 before:h-[17px] before:w-5 before:rounded-br-[16px_14px] before:bg-surface-2 after:absolute after:-left-[10px] after:bottom-0 after:h-[17px] after:w-[10px] after:rounded-br-[10px] after:bg-canvas">
            {greeting.text}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => chat.show(true)}
        className="tap-area ml-[58px] mt-2 inline-flex items-center gap-1.5 text-[14px] font-medium text-ink underline-offset-4 hover:underline"
      >
        <MessageSquare className="size-4" aria-hidden /> Reply
      </button>
    </div>
  );
}

/**
 * The chat, at the foot of the screen wherever the customer is on the page:
 * a button ("Message <Business>", with a count of the business's messages
 * since they last wrote) that opens the conversation above it. It sits in a
 * sticky strip of no height at the end of the page, so it stays in view as
 * the page scrolls, takes no room of its own, and in the business's preview
 * stays inside the preview.
 */
export function ChatDock({ chat }: { chat: CustomerConversation }) {
  const waiting = newFromBusiness(chat.lines);
  const field = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Opened: straight to the box to type in.
    if (chat.shown) field.current?.querySelector("textarea")?.focus({ preventScroll: true });
  }, [chat.shown]);
  if (!chat.open) return null;
  return (
    <div className="pointer-events-none sticky bottom-0 z-40 h-0">
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
        {chat.shown && (
          <div
            role="dialog"
            aria-label={`Messages with ${chat.business}`}
            className="pointer-events-auto flex max-h-[min(38rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[22px] border border-line bg-canvas shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
          >
            {/* Headed as a phone's messages app heads a conversation: who it is with, centred under their avatar. */}
            <div className="relative border-b border-line bg-surface px-12 pb-2.5 pt-3 text-center">
              <div className="flex flex-col items-center">
                <Avatar name={chat.business} />
                <p className="mt-1 max-w-full truncate text-[13px] font-medium text-ink">{chat.business}</p>
                {chat.phone && (
                  <a href={`tel:${chat.phone.replace(/\s+/g, "")}`} className="text-[11.5px] text-muted underline-offset-2 hover:underline">
                    {chat.phone}
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => chat.show(false)}
                aria-label="Close the chat"
                className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-2"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 bg-canvas">
              <Bubbles
                lines={chat.lines}
                mine="customer"
                names={chat.names}
                empty="Ask anything about your proposal, or leave a note."
                className="h-full max-h-[22rem] min-h-40"
              />
            </div>
            <div ref={field} className="bg-canvas px-3 pb-3 pt-1">
              {chat.problem && (
                <p className="mb-2 text-[13px] text-danger" role="alert">
                  {chat.problem}
                </p>
              )}
              <Compose placeholder="Message" disabled={!chat.token} onSend={chat.send} />
              {!chat.token && <p className="mt-2 text-[12px] text-muted">A preview: your customer writes to you from their own link.</p>}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => chat.show(!chat.shown)}
          aria-expanded={chat.shown}
          className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-medium text-primary-ink shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
        >
          {chat.shown ? <X className="size-4" aria-hidden /> : <MessageSquare className="size-4" aria-hidden />}
          {chat.shown ? "Close" : `Message ${chat.business}`}
          {!chat.shown && waiting > 0 && (
            <span className="rounded-full bg-surface px-1.5 text-[12px] font-semibold leading-5 text-ink" aria-label={`${waiting} new`}>
              {waiting}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * The business's side of one job's conversation: the customer's lines on the
 * left, the business's own on the right, and a box to reply. Opening it marks
 * the customer's lines as read; a reply says whether the customer was also
 * emailed. It looks for new lines every 20 seconds while it is in view.
 */
export function DealChat({
  jobId,
  compact,
  drafts,
  onSent,
}: {
  jobId: string;
  compact?: boolean;
  /** Sending a proposal: the ready-written messages to start from, filled in for this customer, the first one in the box. */
  drafts?: { fill: SendFill; start: SendTemplateId };
  /** Told once a message has gone. */
  onSent?: () => void;
}) {
  const [draft, setDraft] = useState<{ id: SendTemplateId; n: number } | null>(drafts ? { id: drafts.start, n: 0 } : null);
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
      <div className="rounded-xl bg-canvas">
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
      {drafts && draft && (
        <div className="mt-4">
          <p className="text-xs font-medium text-ink">Start from</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Start from">
            {SEND_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={draft.id === t.id}
                onClick={() => setDraft({ id: t.id, n: draft.n + 1 })}
                className={clsx(
                  "min-h-9 rounded-full border px-3 text-xs font-medium",
                  draft.id === t.id ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-ink hover:border-line-strong",
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3">
        <Compose
          key={draft ? `${draft.id}:${draft.n}` : "reply"}
          initial={drafts && draft ? fillTemplate(draft.id, drafts.fill) : undefined}
          tall={Boolean(drafts && draft)}
          sendLabel={drafts && draft ? `Send to ${chat.customer}` : undefined}
          placeholder={drafts && draft ? `Message to ${chat.customer}` : "Message"}
          onSend={async (text) => {
            const res = await sendReply(jobId, text);
            if (!res.ok) {
              setStatus({ text: res.message, error: true });
              return false;
            }
            setChat({ ...chat, lines: res.lines, unanswered: 0 });
            setStatus({ text: res.outcome });
            unreadChanged();
            // Sent: the box is for replies from here on.
            setDraft(null);
            onSent?.();
            return true;
          }}
        />
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
        {drafts && draft ? (
          `Change anything before it goes. It shows at the top of ${chat.customer}'s proposal and in their chat, from “${names.business}”, and is emailed to them with the link when you have that on.`
        ) : (
          <>
            The customer sees your reply as from &ldquo;{names.business}&rdquo;, never your own name or email. Enter sends; Shift and Enter
            starts a new line.
          </>
        )}
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

/** How many of the customer's latest lines are unanswered on a job's conversation: asked each minute while in view. */
export function useChatWaiting(jobId: string | null): number {
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    if (!jobId) return;
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
  return jobId ? waiting : 0;
}

/**
 * "Chat" on the design tool's top bar, for a roof opened from a deal: the
 * same conversation as on the deal, in a panel under the button, with a count
 * while the customer's latest lines are unanswered.
 */
export function ChatButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const waiting = useChatWaiting(jobId);
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
