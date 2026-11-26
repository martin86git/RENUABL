"use client";

/**
 * Sol's predictive text, for every box that talks to him (26 Nov 2026, Martin: Today's box first, then his panel and a
 * deal's box). The rest of the sentence in grey behind the words; Tab or → at the end takes it, Escape puts it away for
 * those words, and on a touch screen a pill under the box takes it. The suggestions are the person's own questions,
 * then the team's, then the usual ones (domain/design/sol-complete.ts); a question sent is learnt at once.
 */
import { useMemo, useState } from "react";
import clsx from "clsx";
import { CornerDownRight } from "lucide-react";
import { completionFor, phrasesWith } from "@/lib/domain/design/sol-complete";
import { useLearnedPhrases } from "@/lib/services/sol";

type Field = HTMLTextAreaElement | HTMLInputElement;

export function useSolAhead(text: string, setText: (t: string) => void, field: React.RefObject<Field | null>, off = false, max = 4000) {
  const [dismissed, setDismissed] = useState("");
  const learned = useLearnedPhrases();
  const phrases = useMemo(() => phrasesWith(learned.own, learned.team), [learned.own, learned.team]);
  const ahead = !off && dismissed !== text ? completionFor(text, phrases) : "";
  const take = () => {
    if (!ahead) return;
    const next = (text + ahead).slice(0, max);
    setText(next);
    window.requestAnimationFrame(() => field.current?.setSelectionRange(next.length, next.length));
  };
  return {
    ahead,
    take,
    /** Call from the field's onChange: a new word brings suggestions back. */
    changed: () => setDismissed(""),
    /** Call first in the field's onKeyDown; true when the key was used. */
    key(e: React.KeyboardEvent<Field>): boolean {
      if (!ahead) return false;
      if (e.key === "Escape") {
        e.stopPropagation();
        setDismissed(text);
        return true;
      }
      const el = e.currentTarget;
      const atEnd = el.selectionStart === text.length && el.selectionEnd === text.length;
      if (atEnd && !e.shiftKey && (e.key === "Tab" || e.key === "ArrowRight")) {
        e.preventDefault();
        take();
        return true;
      }
      return false;
    },
    /** The grey words, laid behind the field: give it the field's own padding, size and line height. */
    ghost: (className: string, oneLine = false) =>
      ahead ? (
        <div
          aria-hidden
          className={clsx(
            "pointer-events-none absolute inset-0 overflow-hidden",
            oneLine ? "whitespace-pre" : "whitespace-pre-wrap break-words",
            className,
          )}
        >
          <span className="invisible">{text}</span>
          <span className="text-muted/70">{ahead}</span>
        </div>
      ) : null,
    /** A pill to take it on a touch screen, which has no Tab. */
    pill: (className = "") =>
      ahead ? (
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={take}
          className={clsx(
            "hidden max-w-full items-center gap-1.5 truncate rounded-full bg-canvas px-3 py-1 text-[13px] text-ink-2 ring-1 ring-line [@media(pointer:coarse)]:inline-flex",
            className,
          )}
        >
          <CornerDownRight className="size-3.5 shrink-0 text-sun-line" aria-hidden />
          <span className="truncate">…{ahead}</span>
        </button>
      ) : null,
  };
}
