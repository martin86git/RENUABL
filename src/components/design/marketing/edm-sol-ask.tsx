"use client";

import { Check, Loader2, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SolIcon } from "@/components/design/sol-icon";
import { EDM_SOL_LIMITS, EDM_SOL_STEERS, steerNote } from "@/lib/domain/marketing/edm-sol";
import { cn } from "@/components/ui/primitives";

export type SolAskResult = { ok: true; options?: string[] } | { ok: false; message: string };

const NAMES = { subject: "subject", preview: "preview line", heading: "heading", text: "words" } as const;

/**
 * Telling Sol what to change about one part of the email (20 Nov 2026, Martin: "im finding it difficult to provide sol
 * feedback so he can improve my subject line and preview text. instead i click on the sol icon and its like rolling the
 * dice. its not guided"). Opens under the field its Sol button belongs to: a few ways to steer him, a box for the
 * member's own words, and for a one-line part three options to choose from, with More like these to go again. The words
 * of the email are rewritten in place. Nothing is put in a one-line field until an option is pressed.
 */
export function SolAsk({
  part,
  current,
  onAsk,
  onPick,
  onUndo,
  onClose,
}: {
  part: keyof typeof NAMES;
  /** What the field holds now. */
  current: string;
  onAsk: (note: string, avoid: string[]) => Promise<SolAskResult>;
  onPick: (line: string) => void;
  /** Puts back what was there before the last pick or rewrite. */
  onUndo: () => void;
  onClose: () => void;
}) {
  const lines = part !== "text";
  const [steers, setSteers] = useState<string[]>([]);
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [changed, setChanged] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => box.current?.focus({ preventScroll: true }), []);

  async function go(again = false) {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const avoid = again ? [...seen, ...options].slice(-EDM_SOL_LIMITS.avoid) : [];
    const r = await onAsk(steerNote(steers, words), avoid);
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    if (lines) {
      setSeen(avoid);
      setOptions(r.options ?? []);
      setChanged(false);
    } else setChanged(true);
  }

  const name = NAMES[part];
  return (
    <div className="mt-2 rounded-xl border border-sun-line/40 bg-sun/40 p-3 text-ink">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <SolIcon className="size-4" />
        {current.trim() ? `What should Sol change about the ${name}?` : `What should the ${name} say?`}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="ml-auto grid size-7 place-items-center rounded-full hover:bg-surface"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EDM_SOL_STEERS.map((s) => {
          const on = steers.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              onClick={() => setSteers(on ? steers.filter((k) => k !== s.key) : [...steers, s.key])}
              className={cn(
                "h-8 rounded-full px-3 text-[12px] font-medium ring-1 ring-inset",
                on ? "bg-ink text-canvas ring-ink" : "bg-surface text-ink-2 ring-line hover:ring-ink/40",
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          ref={box}
          value={words}
          maxLength={EDM_SOL_LIMITS.note}
          onChange={(e) => setWords(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void go();
            }
            if (e.key === "Escape") onClose();
          }}
          placeholder="In your own words, e.g. mention that it books appointments for them"
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-ink/50"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void go()}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-canvas disabled:bg-line disabled:text-muted"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <SolIcon className="size-4" />}
          {lines ? "Show me 3 options" : "Rewrite the words"}
        </button>
      </div>

      {problem && <p className="mt-2 text-[12px] text-danger">{problem}</p>}

      {lines && options.length > 0 && (
        <div className="mt-3">
          <p className="text-[12px] text-ink-2">Press one to use it. You can still change it after.</p>
          <ul className="mt-1.5 space-y-1.5">
            {options.map((o) => {
              const on = o === current;
              return (
                <li key={o}>
                  <button
                    type="button"
                    onClick={() => onPick(o)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg bg-surface px-3 py-2 text-left text-[14px] ring-1 ring-inset",
                      on ? "ring-2 ring-ink" : "ring-line hover:ring-ink/40",
                    )}
                  >
                    <span className="min-w-0 flex-1">{o}</span>
                    <span className="shrink-0 pt-0.5 text-[11px] text-muted tabular-nums">{o.length}</span>
                    {on && <Check className="mt-0.5 size-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
            <button type="button" disabled={busy} onClick={() => void go(true)} className="font-medium underline underline-offset-4">
              None of these: show 3 more
            </button>
            {options.includes(current) && (
              <button
                type="button"
                onClick={onUndo}
                className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
              >
                <Undo2 className="size-3.5" /> Put the old one back
              </button>
            )}
          </div>
        </div>
      )}

      {!lines && changed && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
          <span>Rewritten. Not right yet? Say what to change and go again.</span>
          <button
            type="button"
            onClick={() => (onUndo(), setChanged(false))}
            className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
          >
            <Undo2 className="size-3.5" /> Put the old words back
          </button>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted">
        Each ask uses a Sol credit. Sol adds no figures, offers or promises you haven&apos;t given him.
      </p>
    </div>
  );
}
