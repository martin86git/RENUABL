"use client";

/**
 * How Sol's chat opens (24 Nov 2026, Martin, from HubSpot's Breeze): his sun and "Ready when you are, <name>" in
 * large light type, then a Suggested card of a few things to ask, then four topics as tiles. A tile opens that
 * topic's prompts in the Suggested card's place, with a cross back. A prompt is sent as it is pressed.
 * The words are in domain/design/sol-suggest.ts.
 */

import { useState } from "react";
import clsx from "clsx";
import { ClipboardList, Forward, Lightbulb, PenLine, Search, Sun, X, type LucideIcon } from "lucide-react";
import { SOL_SUGGESTED, SOL_TOPICS, solGreeting, topicOf, type SolTopic } from "@/lib/domain/design/sol-suggest";
import { SolMark } from "./sol-sun";

const TOPIC_ICONS: Record<SolTopic, LucideIcon> = {
  summarise: ClipboardList,
  write: PenLine,
  find: Search,
  solar: Sun,
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
        <SolMark className={clsx(compact ? "size-9" : "size-11")} />
        <h2
          className={clsx("mt-3 font-serif font-normal leading-tight tracking-[-0.01em] text-ink", compact ? "text-[24px]" : "text-[30px]")}
        >
          {solGreeting(firstName)}
        </h2>
      </div>
      {children}
      <div className="mt-auto space-y-3">
        {list && (
          <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-line" aria-label={topic ? topic.label : "Suggested"}>
            <div className="mb-1 flex items-center gap-2 text-[13.5px] text-ink">
              <TopicIcon className="size-4 text-ink-2" strokeWidth={1.6} aria-hidden />
              <span>{topic ? topic.label : "Suggested"}</span>
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
                    "flex flex-col items-start rounded-2xl bg-white text-left text-ink ring-1 ring-line transition hover:ring-line-strong",
                    compact ? "gap-3 px-3.5 py-3 text-[13px]" : "gap-5 px-4 py-3.5 text-[13.5px]",
                  )}
                >
                  <Icon className="size-[18px] text-sun-line" strokeWidth={1.6} aria-hidden />
                  {t.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
