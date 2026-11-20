"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { PLAN_CODE_WORDS } from "@/lib/domain/design/plan-codes";
import { checkPlanCode } from "@/lib/services/billing";

/** A code applied: what was typed, in capitals, and what it gives. */
export type AppliedCode = { code: string; words: string; free: boolean };

/**
 * "Have a code?" (domain/design/plan-codes.ts): folded to a link until pressed, then a box and Apply. The code is looked
 * up before going to Stripe, so a wrong one is said here, not on the payment page.
 */
export function PlanCodeField({
  applied,
  onApply,
  dark = false,
}: {
  applied: AppliedCode | null;
  onApply: (code: AppliedCode | null) => void;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const quiet = dark ? "text-white/70" : "text-muted";

  if (applied)
    return (
      <p className={clsx("flex flex-wrap items-center gap-2 text-sm", dark ? "text-white" : "text-ink")}>
        <Check className={clsx("size-4", dark ? "text-sun-bright" : "text-positive")} aria-hidden />
        <span>
          Code <span className="font-semibold">{applied.code}</span>: {applied.words}
        </span>
        <button type="button" className={clsx("underline underline-offset-2", quiet)} onClick={() => onApply(null)}>
          Remove
        </button>
      </p>
    );

  if (!open)
    return (
      <button type="button" className={clsx("text-sm underline underline-offset-2", quiet)} onClick={() => setOpen(true)}>
        {PLAN_CODE_WORDS.field}
      </button>
    );

  const apply = async () => {
    setBusy(true);
    setProblem(null);
    const a = await checkPlanCode(typed);
    setBusy(false);
    if (a.ok) onApply({ code: String(a.code), words: String(a.words), free: a.free === true });
    else setProblem(a.message ?? PLAN_CODE_WORDS.notFound);
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (typed.trim()) void apply();
            }
          }}
          placeholder={PLAN_CODE_WORDS.placeholder}
          aria-label="Code"
          autoFocus
          spellCheck={false}
          className={clsx(
            "h-10 w-40 rounded-lg px-3 font-mono text-[15px] uppercase outline-none",
            dark ? "bg-white/10 text-white ring-1 ring-white/20 placeholder:text-white/40" : "bg-surface text-ink ring-1 ring-line",
          )}
        />
        <button
          type="button"
          disabled={busy || !typed.trim()}
          onClick={() => void apply()}
          className={clsx(
            "h-10 rounded-lg px-4 text-sm font-medium disabled:opacity-60",
            dark ? "bg-white text-ink" : "bg-primary text-primary-ink",
          )}
        >
          {busy ? "Checking…" : PLAN_CODE_WORDS.apply}
        </button>
      </div>
      {problem && <p className={clsx("mt-1.5 text-sm", dark ? "text-sun-bright" : "text-danger")}>{problem}</p>}
    </div>
  );
}
