"use client";

import { ArrowUp, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, type FormEvent } from "react";
import { askRenuabl, SUGGESTED_QUESTIONS, type AskContext } from "@/lib/services/ask";
import { cn } from "@/components/ui/primitives";

interface Turn {
  q: string;
  a: string | null;
}

function Spark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-6 w-6 shrink-0 rounded-full", className)}
      style={{ background: "radial-gradient(circle at 35% 30%, #FFF4DE, var(--sun) 40%, var(--coral) 70%, var(--lilac))" }}
    />
  );
}

/**
 * "Ask RENUABL" — present as quiet intelligence, never labelled as AI.
 * variant="bar" is the home/hero prompt; variant="card" is the compact
 * prompt used at moments of uncertainty inside the flow.
 */
export function AskRenuabl({
  context,
  variant = "card",
  prompt = "Ask RENUABL anything",
  className,
}: {
  context: AskContext;
  variant?: "bar" | "card";
  prompt?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [followUps, setFollowUps] = useState<string[]>(SUGGESTED_QUESTIONS[context]);
  const busy = turns.at(-1)?.a === null;

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setOpen(true);
    setDraft("");
    setTurns((t) => [...t, { q, a: null }]);
    const res = await askRenuabl(q, context);
    setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, a: res.answer } : turn)));
    setFollowUps(res.followUps);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(draft);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {variant === "bar" ? (
        <div className={cn("w-full", className)}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-full border border-line bg-surface/80 px-4 py-3 text-left text-[15px] text-muted shadow-[var(--shadow-soft)] backdrop-blur transition hover:border-line-strong"
            >
              <Spark />
              <span className="flex-1">{prompt}</span>
            </button>
          </Dialog.Trigger>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS[context].slice(0, 3).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void ask(q)}
                className="rounded-full bg-surface-2 px-3 py-1.5 text-[13px] text-ink-2 transition hover:bg-line"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Dialog.Trigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left transition hover:border-line-strong",
              className,
            )}
          >
            <Spark />
            <span className="flex-1">
              <span className="block text-[15px] font-medium text-ink">{prompt}</span>
              <span className="block text-[13px] text-muted">
                {SUGGESTED_QUESTIONS[context].find((q) => q !== prompt) ?? "Straight answers, anytime"}
              </span>
            </span>
          </button>
        </Dialog.Trigger>
      )}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[85dvh] flex-col bg-surface text-ink shadow-[var(--shadow-lift)] outline-none",
            "inset-x-0 bottom-0 rounded-t-[28px] pb-safe",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:pb-0",
          )}
        >
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
            <Dialog.Title className="flex items-center gap-2.5 text-[17px] font-semibold">
              <Spark /> Ask RENUABL
            </Dialog.Title>
            <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="px-5 pt-1 text-[13px] text-muted sm:px-6">
            Straight answers about your home, your system and what happens next.
          </Dialog.Description>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6" aria-live="polite">
            {turns.length === 0 && <p className="text-[15px] text-ink-2">What would you like to know?</p>}
            {turns.map((t, i) => (
              <div key={i} className="space-y-3 animate-fade-up">
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] text-canvas">{t.q}</p>
                <p className="max-w-[92%] rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] leading-relaxed">
                  {t.a ?? (
                    <span className="inline-flex gap-1 text-muted">
                      Thinking<span className="animate-pulse">…</span>
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-line px-5 pb-5 pt-3 sm:px-6">
            <div className="mb-3 flex flex-wrap gap-2">
              {followUps.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(q)}
                  className="rounded-full bg-surface-2 px-3 py-1.5 text-[13px] text-ink-2 hover:bg-line disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              onSubmit={onSubmit}
              className="flex items-center gap-2 rounded-full border border-line bg-canvas py-1.5 pl-4 pr-1.5 focus-within:border-ink"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a question"
                aria-label="Your question"
                className="flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted focus-visible:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy}
                aria-label="Send"
                className="grid h-9 w-9 place-items-center rounded-full bg-ink text-canvas disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
