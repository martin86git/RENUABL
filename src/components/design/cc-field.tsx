"use client";

import { useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { MAX_CC } from "@/lib/domain/design/deal-email";

const LOOKS_LIKE_EMAIL = /^[^\s@<>,;"]{1,64}@[^\s@<>,;"]{1,190}\.[a-z]{2,24}$/i;

/**
 * The Cc box, where each address locks in as a pill (27 Nov 2026, Martin: "i cant tell if the email address that i
 * enter in cc requires a , after one email - because it doesnt 'lock' it in"). A space, comma, semicolon, Enter, Tab
 * or leaving the box locks in what was typed; Backspace in the empty box takes the last one off; several pasted at
 * once lock in together. What isn't an email address stays in the box with a line saying so. `onChange` is given the
 * addresses joined by commas, with anything still being typed last, so nothing typed is ever left out of what is sent
 * (the server checks every address again).
 */
export function CcField({ onChange, disabled }: { onChange: (cc: string) => void; disabled?: boolean }) {
  const [locked, setLocked] = useState<string[]>([]);
  const [typing, setTyping] = useState("");
  const [bad, setBad] = useState("");
  const tell = (list: string[], text: string) => onChange([...list, text.trim()].filter(Boolean).join(", "));
  const full = locked.length >= MAX_CC;

  /** Locks in every whole address in `text`; what doesn't read as one stays in the box. */
  const lock = (text: string, list = locked) => {
    const next = [...list];
    const left: string[] = [];
    for (const raw of text.split(/[\s,;]+/)) {
      const a = raw.trim().replace(/^<|>$/g, "").toLowerCase();
      if (!a) continue;
      if (!LOOKS_LIKE_EMAIL.test(a)) left.push(raw.trim());
      else if (next.includes(a)) continue;
      else if (next.length >= MAX_CC) left.push(a);
      else next.push(a);
    }
    const rest = left.join(" ");
    setLocked(next);
    setTyping(rest);
    setBad(
      rest
        ? next.length >= MAX_CC && LOOKS_LIKE_EMAIL.test(left[0])
          ? `Copy in at most ${MAX_CC} people.`
          : `"${left[0].slice(0, 60)}" doesn't look like an email address.`
        : "",
    );
    tell(next, rest);
  };
  const remove = (a: string) => {
    const next = locked.filter((x) => x !== a);
    setLocked(next);
    setBad("");
    tell(next, typing);
  };

  return (
    <div>
      <label
        className={clsx(
          "flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border bg-surface px-2 py-1 text-sm focus-within:border-[var(--primary)]",
          bad ? "border-danger" : "border-line",
        )}
      >
        <span className="pl-1 text-xs text-muted">Cc</span>
        {locked.map((a) => (
          <span
            key={a}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-2.5 pr-1 text-xs text-ink ring-1 ring-line"
          >
            <span className="truncate">{a}</span>
            <button
              type="button"
              onClick={() => remove(a)}
              disabled={disabled}
              aria-label={`Remove ${a}`}
              className="grid size-4 place-items-center rounded-full text-muted hover:bg-line hover:text-ink"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          aria-label="Cc"
          aria-invalid={Boolean(bad)}
          className="h-7 min-w-32 flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-muted"
          type="text"
          inputMode="email"
          autoComplete="off"
          disabled={disabled}
          value={typing}
          placeholder={locked.length ? (full ? "" : "Add another") : `Optional, up to ${MAX_CC}`}
          onChange={(e) => {
            const v = e.target.value;
            // A space, comma or semicolon ends an address; so does pasting several at once.
            if (/[\s,;]/.test(v)) return lock(v);
            setTyping(v);
            setBad("");
            tell(locked, v);
          }}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === "Tab") && typing.trim()) {
              e.preventDefault();
              lock(typing);
            } else if (e.key === "Backspace" && !typing && locked.length) {
              remove(locked[locked.length - 1]);
            }
          }}
          onBlur={() => typing.trim() && lock(typing)}
        />
      </label>
      {bad && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {bad}
        </p>
      )}
    </div>
  );
}
