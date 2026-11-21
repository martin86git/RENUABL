"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Copy, CornerUpLeft, X } from "lucide-react";
import { splitQuote } from "@/lib/domain/design/chat-quote";
import { replyLabel, solPlain, type SolReply } from "@/lib/domain/design/sol-format";

/**
 * Copy and Reply on a message in a chat with Sol (21 Nov 2026, Martin: "all chats with sol on hover on the text show a
 * copy icon … and a curved arrow to be able to reply to that same message"). Shown while the pointer is over the turn
 * (its wrapper carries `group/turn`), or while one of the buttons has focus, or always with `shown`.
 */
export function MessageTools({
  text,
  onReply,
  shown = false,
  className,
  children,
}: {
  /** The message as said; copied without Sol's layout marks. */
  text: string;
  onReply?: () => void;
  shown?: boolean;
  className?: string;
  /** More buttons after these two (Pin in his panel). */
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(solPlain(splitQuote(text).text)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };
  const button = "inline-flex size-7 items-center justify-center rounded-full hover:bg-ink/5 hover:text-ink";
  return (
    <div
      className={clsx(
        "flex items-center gap-0.5 text-muted transition-opacity",
        shown ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover/turn:opacity-100 [@media(hover:none)]:opacity-100",
        className,
      )}
    >
      <button type="button" onClick={copy} className={button} title={copied ? "Copied" : "Copy"} aria-label={copied ? "Copied" : "Copy"}>
        {copied ? <Check className="size-3.5 text-positive" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </button>
      {onReply && (
        <button type="button" onClick={onReply} className={button} title="Reply to this message" aria-label="Reply to this message">
          <CornerUpLeft className="size-3.5" aria-hidden />
        </button>
      )}
      {children}
    </div>
  );
}

/** The member's own words, with the message they replied to as a quiet line over them when there is one. */
export function QuotedWords({ text }: { text: string }) {
  const { quote, text: words } = splitQuote(text);
  if (!quote) return <>{text}</>;
  return (
    <>
      <span className="mb-1 block border-l-2 border-current/30 pl-2 text-[0.92em] italic opacity-70">{quote}</span>
      {words}
    </>
  );
}

/** The line over the box while it replies to something, with a cross to stop. */
export function ReplyBanner({ reply, onStop, className }: { reply: SolReply; onStop: () => void; className?: string }) {
  const { who, words } = replyLabel(reply);
  return (
    <div className={clsx("flex items-start gap-2 rounded-xl px-3 py-2 text-xs text-ink-2 ring-1 ring-sun-line/40", className)}>
      <CornerUpLeft className="mt-px size-3.5 shrink-0 text-sun-line" aria-hidden />
      <span className="min-w-0 flex-1">
        Replying to {who}: <span className="font-medium text-ink">{words}</span>
      </span>
      <button type="button" onClick={onStop} aria-label="Stop replying" className="shrink-0 hover:text-ink">
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
