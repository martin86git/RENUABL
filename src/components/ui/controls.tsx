"use client";

import { ChevronDown, Minus, Plus } from "lucide-react";
import { Collapsible, RadioGroup, Switch } from "radix-ui";
import { useState, type ReactNode } from "react";
import { cn } from "./primitives";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon?: ReactNode;
}

/** Large, tappable option cards (accessible radio group). */
export function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  label,
  columns = 2,
}: {
  value: T | undefined;
  onChange: (v: T) => void;
  options: ChoiceOption<T>[];
  label: string;
  columns?: 2 | 3 | 4;
}) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className={cn(
        "grid gap-3",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-2 lg:grid-cols-4",
      )}
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            "group relative flex min-h-[68px] flex-col items-start justify-center gap-1 rounded-2xl border bg-surface px-3 py-3 text-left transition sm:min-h-[76px] sm:px-4 sm:py-4 sm:pr-10",
            "border-line hover:border-line-strong data-[state=checked]:border-ink data-[state=checked]:shadow-[0_0_0_1px_var(--ink)]",
          )}
        >
          {o.icon && <span className="mb-1 text-ink-2">{o.icon}</span>}
          <span className="text-[14px] font-medium leading-snug text-ink sm:text-[15px]">{o.label}</span>
          {o.hint && <span className="text-[13px] text-muted">{o.hint}</span>}
          <span className="absolute right-3 top-3 hidden h-5 w-5 rounded-full sm:block border border-line-strong group-data-[state=checked]:border-[6px] group-data-[state=checked]:border-ink" />
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

export function Disclosure({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className={className}>
      <Collapsible.Trigger className="flex w-full items-center justify-between gap-3 py-3 text-left text-[15px] font-medium text-ink">
        {title}
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
      </Collapsible.Trigger>
      <Collapsible.Content className="pb-3 text-[15px] leading-relaxed text-ink-2">{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className="relative h-7 w-12 shrink-0 rounded-full bg-line-strong transition data-[state=checked]:bg-ink"
    >
      <Switch.Thumb className="block h-6 w-6 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </Switch.Root>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  format = (v: number) => String(v),
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  format?: (v: number) => string;
}) {
  const btn =
    "grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-ink transition hover:border-line-strong disabled:opacity-30";
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-12 text-center text-[15px] font-medium tabular-nums" aria-live="polite">
        {format(value)}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
