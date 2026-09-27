"use client";

import { ArrowRight, ArrowUp, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, type FormEvent } from "react";
import { askRenuabl, SUGGESTED_QUESTIONS, type AskContext, type AskSnapshot } from "@/lib/services/ask";
import { useFlow, useSystem } from "@/components/consumer/flow-state";
import { TIER_LABELS, describeSystem } from "@/lib/domain/recommendation";
import { formatDate } from "@/lib/domain/format";
import { getInstaller } from "@/lib/services/consumer";
import { MascotAvatar } from "@/components/ui/brand-art";
import { cn } from "@/components/ui/primitives";

/** The customer's own answers, so Ask RENUABL can talk about their home (none on My RENUABL's example home). */
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

interface Turn {
  q: string;
  a: string | null;
}

/**
 * "Ask RENUABL" — present as quiet intelligence, never labelled as AI.
 * variant="card" is the design's mascot card with an arrow button;
 * variant="link" is a small text prompt (e.g. under the address field).
 */
export function AskRenuabl({
  context,
  variant = "card",
  title = "Questions? Ask RENUABL",
  subtitle = "Get helpful answers about your home energy needs.",
  arrow = "dark",
  className,
}: {
  context: AskContext;
  variant?: "card" | "link";
  title?: string;
  subtitle?: string;
  arrow?: "dark" | "light";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [followUps, setFollowUps] = useState<string[]>(SUGGESTED_QUESTIONS[context]);
  const busy = turns.at(-1)?.a === null;
  const snapshot = useAskSnapshot(context);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setOpen(true);
    setDraft("");
    setTurns((t) => [...t, { q, a: null }]);
    const history = turns.filter((t): t is { q: string; a: string } => t.a !== null);
    const res = await askRenuabl(q, context, snapshot, history);
    setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, a: res.answer } : turn)));
    setFollowUps(res.followUps);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(draft);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {variant === "link" ? (
        <Dialog.Trigger asChild>
          <button type="button" className={cn("inline-flex items-center gap-2 text-[14px] text-ink-2 hover:text-ink", className)}>
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
              <MascotAvatar className="h-9 w-9" /> Ask RENUABL
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
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-ink">
                  {t.q}
                </p>
                <p className="max-w-[92%] rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-[15px] leading-relaxed shadow-[var(--shadow-soft)]">
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
                placeholder="Type a question"
                aria-label="Your question"
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
