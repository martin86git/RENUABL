"use client";

/**
 * A question as a part of the customer's proposal comes into view (26 Nov 2026, Martin: "an element of live ai in the
 * proposal possibly asking questions after certain information is revealed on screen"). The questions are fixed by rule
 * (`REVEAL_QUESTIONS`); a tap sends the answer into the chat with the business, where Sol answers live when the business
 * has him answering customers, else the team does. At most `REVEAL_MOST` a visit; never while the chat is open.
 */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { REVEAL_DWELL_MS, revealFor, type RevealQuestion } from "@/lib/domain/design/proposal-reveal";
import type { CustomerConversation } from "./chat-panel";
import { SolBadge } from "./sol-sun";

const KEPT = "renuabl.proposal.asked";

function askedSoFar(token: string): string[] {
  try {
    const all = JSON.parse(sessionStorage.getItem(KEPT) ?? "{}") as Record<string, string[]>;
    return Array.isArray(all[token]) ? all[token] : [];
  } catch {
    return [];
  }
}

function keepAsked(token: string, asked: string[]) {
  try {
    const all = JSON.parse(sessionStorage.getItem(KEPT) ?? "{}") as Record<string, string[]>;
    all[token] = asked;
    sessionStorage.setItem(KEPT, JSON.stringify(all));
  } catch {
    // A private window: the questions just aren't remembered.
  }
}

export function ProposalReveal({ token, chat }: { token: string; chat: CustomerConversation }) {
  const [question, setQuestion] = useState<RevealQuestion | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    busy.current = chat.shown || question !== null;
  }, [chat.shown, question]);

  useEffect(() => {
    if (!chat.open) return;
    const timers = new Map<Element, number>();
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const key = (e.target as HTMLElement).dataset.block ?? "";
          if (e.isIntersecting) {
            if (timers.has(e.target)) continue;
            timers.set(
              e.target,
              window.setTimeout(() => {
                timers.delete(e.target);
                if (busy.current) return;
                const asked = askedSoFar(token);
                const q = revealFor(key, asked);
                if (!q) return;
                keepAsked(token, [...asked, key]);
                setQuestion(q);
              }, REVEAL_DWELL_MS),
            );
          } else {
            window.clearTimeout(timers.get(e.target));
            timers.delete(e.target);
          }
        }
      },
      { threshold: 0.5 },
    );
    document.querySelectorAll("[data-block]").forEach((el) => seen.observe(el));
    return () => {
      seen.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [token, chat.open]);

  // The chat opened another way: put the question away.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (chat.shown) setQuestion(null);
  }, [chat.shown]);

  if (!question || !chat.open || chat.shown) return null;
  const who = chat.assistant ? "Sol · AI assistant" : chat.names.business;
  const answer = async (text: string) => {
    setQuestion(null);
    chat.show(true);
    await chat.send(text);
  };

  return (
    <div
      role="dialog"
      aria-label={question.ask}
      className="fixed bottom-24 left-3 z-40 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-surface p-3.5 shadow-lg"
    >
      <div className="flex items-start gap-2">
        {chat.assistant && <SolBadge className="mt-0.5 size-[22px] shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-muted">{who}</p>
          <p className="mt-0.5 text-[14px] font-medium text-ink">{question.ask}</p>
        </div>
        <button
          type="button"
          onClick={() => setQuestion(null)}
          aria-label="Not now"
          className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {question.replies.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => void answer(r)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-ink hover:border-primary"
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
