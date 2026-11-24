"use client";

/**
 * How Sol's chat opens (24 Nov 2026, Martin, from HubSpot's Breeze): "Ready when you are, <name>" in large light
 * type, then a Suggested card of a few things to ask, then four topics as tiles. A tile opens that
 * topic's prompts in the Suggested card's place, with a cross back. A prompt is sent as it is pressed.
 * The words are in domain/design/sol-suggest.ts.
 */

import { useState } from "react";
import clsx from "clsx";
import { ClipboardList, Forward, Lightbulb, PenLine, Search, Wrench, X, type LucideIcon } from "lucide-react";
import { SolLibrary } from "./sol-library";
import { SolEtch } from "./sol-icon";
import { todayHeading } from "@/lib/domain/design/today-view";
import { todayInMarket } from "@/lib/domain/market";
import { SOL_SUGGESTED, SOL_TOPICS, solGreeting, topicOf, type SolTopic } from "@/lib/domain/design/sol-suggest";

const TOPIC_ICONS: Record<SolTopic, LucideIcon> = {
  summarise: ClipboardList,
  write: PenLine,
  find: Search,
  solar: Wrench,
};

export function SolStart({
  firstName,
  suggested,
  onAsk,
  compact = false,
  children,
}: {
  firstName?: string | null;
  /** The Suggested card shows for a person's first chats only (sol-history.ts `showStarters`); the topics always. */
  suggested: boolean;
  onAsk: (prompt: string) => void;
  /** Smaller type and tiles, for a narrow panel. */
  compact?: boolean;
  /** Put between the greeting and the cards (Continue your last chat). */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState<SolTopic | null>(null);
  const topic = topicOf(open);
  const list = topic ? topic.prompts : suggested ? SOL_SUGGESTED : null;
  const TopicIcon = topic ? TOPIC_ICONS[topic.id] : Lightbulb;
  return (
    <div className="flex min-h-full flex-col">
      <div className={clsx("pt-2", compact ? "pb-6" : "pb-10")}>
        {/* RENUABL's own, not Breeze's (24 Nov 2026, Martin: "more native to renuabl"): Sol's etched brain as on
            Today's heading (no sun), the day in the figures' face, then the greeting set light. */}
        <SolEtch className={clsx("text-[#c9ccd3]", compact ? "size-10" : "size-12")} width={1.6} />
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted" suppressHydrationWarning>
          {todayHeading(todayInMarket())}
        </p>
        <h2
          className={clsx("mt-1 font-sans font-light leading-[1.15] tracking-[-0.025em] text-ink", compact ? "text-[26px]" : "text-[32px]")}
        >
          {solGreeting(firstName)}
        </h2>
      </div>
      {children}
      <div className="mt-auto space-y-3">
        {list && (
          <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-line" aria-label={topic ? topic.label : "Suggested"}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary">
                <TopicIcon className="size-3.5 text-sun-line" strokeWidth={1.8} aria-hidden />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{topic ? topic.label : "Suggested"}</span>
              {topic && (
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  aria-label={`Close ${topic.label}`}
                  className="-mr-1.5 ml-auto inline-flex size-7 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>
            <ul>
              {list.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => onAsk(p)}
                    className="group flex w-full items-start gap-2.5 rounded-lg py-1.5 text-left text-[13.5px] text-ink-2 transition-colors hover:text-ink"
                  >
                    <Forward className="mt-0.5 size-4 shrink-0 text-sun-line" strokeWidth={1.7} aria-hidden />
                    <span className="group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">{p}</span>
                  </button>
                </li>
              ))}
            </ul>
            {/* The business's library under Technical (sol-library.tsx). */}
            {topic?.id === "solar" && <SolLibrary />}
          </div>
        )}
        {!topic && (
          <div className="grid grid-cols-2 gap-2.5">
            {SOL_TOPICS.map((t) => {
              const Icon = TOPIC_ICONS[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOpen(t.id)}
                  className={clsx(
                    "group flex flex-col items-start rounded-2xl bg-white text-left text-ink ring-1 ring-line transition hover:ring-sun-line/60",
                    compact ? "gap-3 px-3 py-3 text-[13px]" : "gap-4 px-4 py-3.5 text-[13.5px]",
                  )}
                >
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <Icon className="size-4 text-sun-line" strokeWidth={1.7} aria-hidden />
                  </span>
                  <span className="flex w-full items-baseline justify-between gap-2">
                    <span className="font-medium">{t.label}</span>
                    <span className="font-mono text-[10.5px] text-muted">{t.prompts.length}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
