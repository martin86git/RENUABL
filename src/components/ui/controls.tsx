"use client";

import { ChevronDown, Minus, Plus } from "lucide-react";
import { Collapsible, RadioGroup, Switch } from "radix-ui";
import { useState, type ReactNode } from "react";
import { cn } from "./primitives";

/** Yes / No pill toggle from the design. `undefined` = not answered yet. */
export function YesNo({ value, onChange, label }: { value: boolean | undefined; onChange: (v: boolean) => void; label: string }) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value === undefined ? "" : value ? "yes" : "no"}
      onValueChange={(v) => onChange(v === "yes")}
      className="inline-flex rounded-full bg-surface p-1 shadow-[0_0_0_1px_var(--line)]"
    >
      {(["yes", "no"] as const).map((v) => (
        <RadioGroup.Item
          key={v}
          value={v}
          className="h-9 min-w-[68px] rounded-full px-5 text-[13.5px] text-ink-2 transition data-[state=checked]:bg-primary data-[state=checked]:text-primary-ink"
        >
          {v === "yes" ? "Yes" : "No"}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

/** Segmented control, e.g. Essential / Recommended / Maximum. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className={cn("flex w-full rounded-full bg-surface-2 p-1", className)}
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          className="h-9 flex-1 whitespace-nowrap rounded-full px-3 text-[12.5px] text-muted transition data-[state=checked]:bg-primary data-[state=checked]:text-primary-ink sm:text-[13px]"
        >
          {o.label}
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
      className="relative h-7 w-12 shrink-0 rounded-full bg-line-strong transition data-[state=checked]:bg-primary"
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
    "grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-surface text-ink transition hover:border-ink/40 disabled:opacity-30";
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
