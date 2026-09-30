"use client";

import Link from "next/link";
import { CONSENT_MISSING, CONTACT_CONSENT, FOLLOW_UP_CONSENT, MARKETING_CONSENT, type ConsentKind } from "@/lib/domain/legal";
import { cn } from "@/components/ui/primitives";

export interface ConsentState {
  terms: boolean;
  marketing: boolean;
}

export const NO_CONSENT: ConsentState = { terms: false, marketing: false };

/**
 * The two tickboxes: the required one (Terms, Privacy and contact about their
 * plan) and an optional one for tips and offers. Neither is ticked for them.
 */
export function ConsentBoxes({
  kind,
  value,
  onChange,
  missing,
  className,
}: {
  kind: ConsentKind;
  value: ConsentState;
  onChange: (next: ConsentState) => void;
  /** The customer tried to continue without the required tick. */
  missing?: boolean;
  className?: string;
}) {
  const box = "mt-px h-4 w-4 shrink-0 accent-[var(--primary)]";
  const link = "underline underline-offset-4 hover:text-ink";
  return (
    <div className={cn("space-y-2.5", className)}>
      <label
        className={cn(
          "flex cursor-pointer items-start gap-2.5 rounded-xl px-3.5 py-3 text-[11.5px] leading-snug text-ink-2",
          missing && !value.terms ? "bg-surface-2 ring-2 ring-danger/60" : "bg-surface-2",
        )}
      >
        <input
          type="checkbox"
          checked={value.terms}
          onChange={(e) => onChange({ ...value, terms: e.target.checked })}
          aria-invalid={missing && !value.terms ? true : undefined}
          className={box}
        />
        <span>
          I&apos;ve read and accept the{" "}
          <Link href="/terms" target="_blank" className={link}>
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className={link}>
            Privacy Policy
          </Link>
          . {kind === "reserve" ? CONTACT_CONSENT : FOLLOW_UP_CONSENT}
        </span>
      </label>
      {missing && !value.terms && (
        <p className="text-[12px] text-danger" role="alert">
          {CONSENT_MISSING}
        </p>
      )}
      <label className="flex cursor-pointer items-start gap-2.5 px-3.5 text-[11.5px] leading-snug text-muted">
        <input
          type="checkbox"
          checked={value.marketing}
          onChange={(e) => onChange({ ...value, marketing: e.target.checked })}
          className={box}
        />
        <span>
          {MARKETING_CONSENT} <span className="text-muted">(Optional)</span>
        </span>
      </label>
    </div>
  );
}
