"use client";

import { ArrowRight, ArrowUp, RotateCcw, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { askRenuabl, REVO_GREETINGS, SUGGESTED_QUESTIONS, type AskContext, type AskSnapshot } from "@/lib/services/ask";
import { useRevoChat } from "@/lib/services/revo-chat";
import { useFlow, useSystem } from "@/components/consumer/flow-state";
import { TIER_LABELS, describeSystem } from "@/lib/domain/recommendation";
import { formatDate } from "@/lib/domain/format";
import { getInstaller } from "@/lib/services/consumer";
import { MascotAvatar } from "@/components/ui/brand-art";
import { cn } from "@/components/ui/primitives";

/** The customer's own answers, so Ask Revo can talk about their home (none on My RENUABL's example home). */
function useAskSnapshot(context: AskContext): AskSnapshot {
  const { state } = useFlow();
  const { config, price } = useSystem();
  if (context === "my") return {};
  const answered = Boolean(state.bill);
  const installer = state.installerId ? getInstaller(state.installerId) : undefined;
  return {
    suburb: state.address?.suburb,
    state: state.address?.state,
    dailyUsageKwh: state.bill?.dailyUsageKwh,
    hasSolar: state.bill?.hasSolar,
    roof: state.profile.roofType,
    flatMount: state.profile.roofType === "flat" ? (state.profile.flatMount ?? "flat") : undefined,
    storeys: state.profile.storeys,
    phase: state.profile.phase,
    wantsBattery: state.profile.wantsBattery,
    option: answered ? TIER_LABELS[state.tier] : undefined,
    system: answered ? describeSystem(config) : undefined,
    priceAfterRebates: answered ? price.total : undefined,
    rebates: answered ? price.rebateLines.map((r) => r.label) : undefined,
    installDate: state.installDate ? formatDate(state.installDate, { weekday: "long", day: "numeric", month: "long" }) : undefined,
    installer: installer?.name,
    reserved: Boolean(state.reservation),
  };
}

/**
 * Revo in the corner of every step: a speech bubble with a line about where
 * the customer is and what they've chosen, and Revo's avatar. Tapping either
 * opens Ask Revo. A new line brings the bubble back after it's closed.
 * Mobile: above the sticky Continue button; desktop: bottom right.
 */
function RevoCompanion({ line, page, className }: { line: string; page?: boolean; className?: string }) {
  const [closed, setClosed] = useState<string | null>(null);
  const showBubble = Boolean(line) && closed !== line;
  // On phones the bubble tucks away after a few seconds so it doesn't cover the step; each new line brings it back.
  useEffect(() => {
    // Outside the flow it tucks away on every screen size, so it doesn't cover the page.
    if (!line || typeof window === "undefined" || (!page && window.matchMedia("(min-width: 1024px)").matches)) return;
    const t = window.setTimeout(() => setClosed(line), 7000);
    return () => window.clearTimeout(t);
  }, [line, page]);
  return (
    <div
      className={cn(
        "pointer-events-none fixed right-4 z-30 flex max-w-[calc(100vw-2rem)] items-end gap-2 lg:bottom-6 lg:right-6",
        // Flow steps have a sticky Continue button on phones; other pages don't.
        page ? "bottom-4" : "bottom-[108px]",
        className,
      )}
    >
      {showBubble && (
        <div
          key={line}
          className="pointer-events-auto relative mb-2 max-w-[220px] animate-fade-up rounded-2xl rounded-br-md bg-surface py-2.5 pl-3.5 pr-8 text-[12.5px] leading-snug text-ink-2 shadow-[var(--shadow-lift)] lg:max-w-[290px] lg:py-3 lg:pl-4 lg:text-[13.5px]"
        >
          <Dialog.Trigger asChild>
            <button type="button" className="text-left" aria-label={`Revo says: ${line} Ask Revo a question`}>
              {line}
              <span className="mt-1.5 block text-[12px] font-medium text-forest">Ask me anything</span>
            </button>
          </Dialog.Trigger>
          <button
            type="button"
            onClick={() => setClosed(line)}
            aria-label="Hide Revo's message"
            className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Ask Revo"
          className="pointer-events-auto shrink-0 rounded-full bg-surface p-1 shadow-[var(--shadow-lift)] transition hover:scale-105"
        >
          <MascotAvatar className="h-11 w-11 lg:h-12 lg:w-12" />
        </button>
      </Dialog.Trigger>
    </div>
  );
}

/**
 * "Ask Revo" — present as quiet intelligence, never labelled as AI.
 * variant="card" is the design's mascot card with an arrow button;
 * variant="link" is a small text prompt (e.g. under the address field).
 */
export function AskRenuabl({
  context,
  variant = "card",
  title = "Questions? Ask Revo",
  subtitle = "Get helpful answers about your home energy needs.",
  arrow = "dark",
  className,
  line,
  page,
}: {
  context: AskContext;
  /** "revo": the persistent companion (a speech bubble with Revo's `line`, and Revo's avatar). */
  variant?: "card" | "link" | "revo";
  title?: string;
  subtitle?: string;
  arrow?: "dark" | "light";
  className?: string;
  line?: string;
  /** variant="revo" on a page without a sticky Continue button (home page, guides). */
  page?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const chat = useRevoChat();
  const { turns, busy } = chat;
  const [draft, setDraft] = useState("");
  const [followUps, setFollowUps] = useState<string[]>(SUGGESTED_QUESTIONS[context]);
  const snapshot = useAskSnapshot(context);
  const end = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "end" });
  }, [open, turns]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setOpen(true);
    setDraft("");
    const history = chat.history();
    chat.start(q);
    const res = await askRenuabl(q, context, snapshot, history);
    chat.finish(res.answer);
    setFollowUps(res.followUps);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(draft);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {variant === "revo" ? (
        <RevoCompanion line={line ?? ""} page={page} className={className} />
      ) : variant === "link" ? (
        <Dialog.Trigger asChild>
          <button type="button" className={cn("tap-area inline-flex items-center gap-2 text-[14px] text-ink-2 hover:text-ink", className)}>
            <MascotAvatar className="h-7 w-7" />
            <span className="underline-offset-4 hover:underline">{title}</span>
          </button>
        </Dialog.Trigger>
      ) : (
        <Dialog.Trigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-4 rounded-[var(--radius-card)] bg-surface px-4 py-3.5 text-left shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-lift)]",
              className,
            )}
          >
            <MascotAvatar className="h-12 w-12" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] text-ink">{title}</span>
              <span className="block text-[13px] leading-snug text-muted">{subtitle}</span>
            </span>
            <span
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                arrow === "dark" ? "bg-primary text-primary-ink" : "border border-line-strong text-ink",
              )}
            >
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </span>
          </button>
        </Dialog.Trigger>
      )}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[85dvh] flex-col bg-canvas text-ink shadow-[var(--shadow-lift)] outline-none",
            "inset-x-0 bottom-0 rounded-t-[28px] pb-safe",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:pb-0",
          )}
        >
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
            <Dialog.Title className="flex items-center gap-3 text-[17px] font-medium">
              <MascotAvatar className="h-9 w-9" /> Ask Revo
            </Dialog.Title>
            <div className="flex items-center gap-1">
              {turns.length > 0 && !busy && (
                <button
                  type="button"
                  onClick={() => {
                    chat.clear();
                    setFollowUps(SUGGESTED_QUESTIONS[context]);
                  }}
                  className="tap-area flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Start again
                </button>
              )}
              <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
          </div>
          <Dialog.Description className="px-5 pt-1 text-[13px] text-muted sm:px-6">
            Chat with Revo about your home, solar, batteries and rebates.
          </Dialog.Description>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6" aria-live="polite">
            <div className="flex items-end gap-2">
              <MascotAvatar className="h-7 w-7 shrink-0" />
              <p className="max-w-[88%] rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-[15px] leading-relaxed shadow-[var(--shadow-soft)]">
                {REVO_GREETINGS[context]}
              </p>
            </div>
            {turns.map((t, i) => (
              <div key={i} className="space-y-3 animate-fade-up">
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-ink">
                  {t.q}
                </p>
                <div className="flex items-end gap-2">
                  <MascotAvatar className="h-7 w-7 shrink-0" />
                  <p className="max-w-[88%] whitespace-pre-line rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-[15px] leading-relaxed shadow-[var(--shadow-soft)]">
                    {t.a ?? (
                      <span className="inline-flex gap-1 text-muted">
                        Revo is typing<span className="animate-pulse">…</span>
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>

          <div className="border-t border-line px-5 pb-5 pt-3 sm:px-6">
            <div className="mb-3 flex flex-wrap gap-2">
              {followUps.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(q)}
                  className="rounded-full bg-sage/60 px-3 py-1.5 text-[13px] text-ink-2 hover:bg-sage disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              onSubmit={onSubmit}
              className="flex items-center gap-2 rounded-full border border-line-strong bg-surface py-1.5 pl-4 pr-1.5 focus-within:border-ink"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message Revo"
                aria-label="Your message to Revo"
                className="flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted focus-visible:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy}
                aria-label="Send"
                className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-ink disabled:opacity-30"
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
