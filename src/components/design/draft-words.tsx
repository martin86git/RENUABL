"use client";

import { useRef, useState } from "react";
import { Link2 } from "lucide-react";
import { linkStart, putLink } from "@/lib/domain/design/inbox";

/**
 * The words of one of Sol's drafts, with a way to make a link (26 Nov 2026, Martin: "i need to be able to turn a written
 * link into a hyperlink"). Pick a written address (or put the caret in it) and press Link: the box asks for the words to
 * show; pick words and it asks for the address. The link is kept in the words as [words](address) and is a real link in
 * the email that goes (deal-email.ts). `links` off (a reply that only goes into a chat, which shows words) hides it.
 */
export function DraftWords(props: { value: string; onChange: (v: string) => void; label: string; className: string; links: boolean }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [linking, setLinking] = useState<{ start: number; end: number; words: string; url: string } | null>(null);
  const [problem, setProblem] = useState("");

  const open = () => {
    const el = area.current;
    if (!el) return;
    setProblem("");
    setLinking(linkStart(props.value, el.selectionStart ?? 0, el.selectionEnd ?? 0));
  };
  const add = () => {
    if (!linking) return;
    const done = putLink(props.value, linking.start, linking.end, linking.words, linking.url);
    if (!done) return setProblem("That doesn't look like a web address. Try one like www.example.com.au.");
    props.onChange(done.text);
    setLinking(null);
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(done.caret, done.caret);
    });
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      setLinking(null);
    }
  };
  const box = "h-7 min-w-0 flex-1 rounded-md bg-surface px-2 text-[12px] text-ink outline-none ring-1 ring-line focus:ring-sun-line";

  return (
    <div>
      <textarea
        ref={area}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={(e) => {
          if (props.links && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            open();
          }
        }}
        rows={7}
        aria-label={props.label}
        className={props.className}
      />
      {props.links && (
        <div className="border-t border-line bg-surface px-2 py-1 max-sm:px-1.5">
          {!linking ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={open}
              title="Pick a written address, or some words, then press this to make it a link (Ctrl K)"
              className="inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <Link2 className="size-3.5" aria-hidden /> Link
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 py-0.5">
              <input
                autoFocus={!linking.words}
                value={linking.words}
                onChange={(e) => setLinking({ ...linking, words: e.target.value })}
                onKeyDown={onKey}
                placeholder="Words to show, e.g. Open your proposal"
                aria-label="The words the link shows"
                className={box}
              />
              <input
                autoFocus={Boolean(linking.words)}
                value={linking.url}
                onChange={(e) => setLinking({ ...linking, url: e.target.value })}
                onKeyDown={onKey}
                placeholder="Address, e.g. www.example.com.au"
                aria-label="The address the link opens"
                inputMode="url"
                className={box}
              />
              <button
                type="button"
                onClick={add}
                disabled={!linking.url.trim()}
                className="h-7 rounded-full bg-primary px-3 text-[11.5px] font-medium text-primary-ink disabled:bg-surface-2 disabled:text-muted"
              >
                Add link
              </button>
              <button
                type="button"
                onClick={() => setLinking(null)}
                className="h-7 rounded-full px-2 text-[11.5px] text-muted hover:text-ink"
              >
                Cancel
              </button>
              {problem && (
                <p role="alert" className="w-full text-[11.5px] text-warning">
                  {problem}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
