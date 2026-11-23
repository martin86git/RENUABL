"use client";

import { useState, type RefObject } from "react";
import { nameAt, withName, type NameSpan } from "@/lib/domain/design/name-hint";
import { NameHints, useContactBook } from "./coach-ring";

/**
 * Customers' names offered as one is typed in any box (23 Nov 2026, Martin, typing "Where is customer Jordan" to Sol on
 * Today: the chips the voice agent's chat has should come up there too). `typed` is called from the box's onChange;
 * `chips` goes over the box; `escape` lets Escape put them away. The customers are read once, the first time a name is
 * typed.
 */
export function useNameHintBox(text: string, setText: (t: string) => void, box: RefObject<HTMLTextAreaElement | HTMLInputElement | null>) {
  const [span, setSpan] = useState<NameSpan | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [wanted, setWanted] = useState(false);
  const book = useContactBook(wanted);
  const shown = span && span.start !== dismissed ? span : null;
  return {
    typed(value: string, caret: number | null) {
      const s = nameAt(value, caret ?? value.length);
      setSpan(s);
      if (s) setWanted(true);
      else setDismissed(null);
    },
    clear() {
      setSpan(null);
      setDismissed(null);
    },
    /** True when Escape put the chips away (so the box shouldn't act on it too). */
    escape() {
      if (!shown || !book) return false;
      setDismissed(shown.start);
      return true;
    },
    chips: (
      <NameHints
        book={book}
        span={shown}
        onPick={(full) => {
          if (!shown) return;
          const next = withName(text, shown, full);
          setText(next.text);
          setSpan(null);
          requestAnimationFrame(() => {
            box.current?.focus();
            box.current?.setSelectionRange(next.caret, next.caret);
          });
        }}
        onDismiss={() => setDismissed(shown?.start ?? null)}
      />
    ),
  };
}
