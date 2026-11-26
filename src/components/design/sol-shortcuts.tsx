"use client";

/**
 * Sol's four topics as shortcuts inside Today's box (26 Nov 2026, Martin: "The technical and find icons should be
 * short[cuts] inside sol's text box in the today view"): small rounds after the +, each opening its questions in the
 * box, sent as pressed. The same topics as his chat's tiles (sol-start.tsx, domain/design/sol-suggest.ts).
 */
import { useEffect, useRef } from "react";
import clsx from "clsx";
import { ClipboardList, Forward, PenLine, Search, Wrench, X, type LucideIcon } from "lucide-react";
import { SOL_TOPICS, topicOf, type SolTopic } from "@/lib/domain/design/sol-suggest";

export const TOPIC_ICONS: Record<SolTopic, LucideIcon> = {
  summarise: ClipboardList,
  write: PenLine,
  find: Search,
  solar: Wrench,
};

/** The rounds along the box's foot. */
export function SolShortcutRounds({ open, onOpen }: { open: SolTopic | null; onOpen: (t: SolTopic | null) => void }) {
  return (
    <span className="flex items-center gap-1" role="group" aria-label="Shortcuts">
      {SOL_TOPICS.map((t) => {
        const Icon = TOPIC_ICONS[t.id];
        const on = open === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpen(on ? null : t.id)}
            onPointerDown={(e) => e.preventDefault()}
            aria-pressed={on}
            aria-label={t.label}
            title={t.label}
            className={clsx(
              "grid size-8 place-items-center rounded-full transition-colors",
              on ? "bg-primary text-sun-line" : "text-ink-2 hover:bg-ink/5 hover:text-ink",
            )}
          >
            <Icon className="size-[17px]" strokeWidth={1.7} aria-hidden />
          </button>
        );
      })}
    </span>
  );
}

/** The open topic's questions, inside the box above its foot; one press asks it. */
export function SolShortcutList({ open, onClose, onAsk }: { open: SolTopic | null; onClose: () => void; onAsk: (q: string) => void }) {
  const topic = topicOf(open);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!topic) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [topic, onClose]);
  if (!topic) return null;
  const Icon = TOPIC_ICONS[topic.id];
  return (
    <div ref={box} className="mb-1 mr-2 mt-1 rounded-2xl bg-canvas px-3 py-2" aria-label={topic.label}>
      <div className="flex items-center gap-2">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary">
          <Icon className="size-3.5 text-sun-line" strokeWidth={1.8} aria-hidden />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{topic.label}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${topic.label}`}
          className="-mr-1 ml-auto inline-flex size-7 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <ul className="mt-1">
        {topic.prompts.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => onAsk(p)}
              className="group flex w-full items-start gap-2.5 rounded-lg py-1.5 text-left text-[13.5px] text-ink-2 hover:text-ink"
            >
              <Forward className="mt-0.5 size-4 shrink-0 text-sun-line" strokeWidth={1.7} aria-hidden />
              <span className="group-hover:underline group-hover:underline-offset-4">{p}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
