"use client";

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export type SegmentOption<T extends string> = { value: T; label: string; icon?: LucideIcon };

/**
 * A switch between two or three ways of seeing the same thing (8 Nov 2026, Martin: Calendar | List and Month | Week
 * didn't read as switches). A grey track with a white thumb that slides under the choice, so it reads as one control
 * with one thing chosen, never as a row of buttons.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "md" | "sm";
}) {
  const at = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={clsx("relative inline-grid rounded-full bg-surface-2 p-1 ring-1 ring-inset ring-line", size === "sm" ? "h-9" : "h-10")}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {/* The thumb, slid under the chosen option. */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.06)] transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${at * 100}%)` }}
      />
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={clsx(
              "relative z-10 flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors",
              size === "sm" ? "px-3 text-[13px]" : "px-4 text-sm",
              on ? "text-ink" : "text-muted hover:text-ink-2",
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
