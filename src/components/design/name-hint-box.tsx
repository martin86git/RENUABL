"use client";

import { useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { dealFor } from "@/lib/domain/design/contact-reach";
import { nameAt, withName, type NameSpan } from "@/lib/domain/design/name-hint";
import { useCallerInfo } from "@/lib/services/caller";
import { NameHints, useContactBook } from "./coach-ring";

/**
 * Customers' names offered as one is typed in any box (23 Nov 2026, Martin, typing "Where is customer Jordan" to Sol on
 * Today: the chips the voice agent's chat has should come up there too). `typed` is called from the box's onChange;
 * `chips` goes over the box; `escape` lets Escape put them away. The customers are read once, the first time a name is
 * typed.
 *
 * A chip opens that customer's deal (25 Nov 2026, Martin: "clicking on the name should take you to the deal"): their
 * newest deal not lost, else their newest, else their customer page. `leave` is called first (Sol's panel steps aside on
 * a phone so the deal is seen). What was typed is cleared. The voice agent's chat keeps chips that put the name in.
 */
export function useNameHintBox(
  text: string,
  setText: (t: string) => void,
  box: RefObject<HTMLTextAreaElement | HTMLInputElement | null>,
  leave?: () => void,
) {
  const router = useRouter();
  // The business's own voice agents come up too, and a press puts the name in as who is meant (26 Nov 2026, Martin).
  const info = useCallerInfo();
  const agents = [
    ...(info.caller.named ? [{ id: "sales", name: info.caller.name, job: "voice agent" }] : []),
    ...info.more.filter((c) => c.named).map((c, i) => ({ id: `more-${i}`, name: c.name, job: "voice agent" })),
    ...(info.admin.named ? [{ id: "admin", name: info.admin.name, job: "post-sale agent" }] : []),
  ];
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
        onPick={(_full, customerId) => {
          if (!book) return;
          const job = dealFor(customerId, book.jobs);
          setText("");
          setSpan(null);
          leave?.();
          router.push(job ? `/design/deals/${job.id}` : `/design/customers/${customerId}`);
        }}
        onDismiss={() => setDismissed(shown?.start ?? null)}
        agents={agents}
        onAgent={(name) => {
          if (!shown) return;
          const done = withName(text, shown, name);
          setText(done.text);
          setSpan(null);
          requestAnimationFrame(() => {
            const el = box.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(done.caret, done.caret);
          });
        }}
      />
    ),
  };
}
