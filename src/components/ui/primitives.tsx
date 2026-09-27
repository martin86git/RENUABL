import clsx, { type ClassValue } from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...values: ClassValue[]) {
  return clsx(values);
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background,transform,opacity,box-shadow] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 select-none";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-ink hover:opacity-90 shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong",
  ghost: "text-ink hover:bg-surface-2",
  quiet: "text-muted hover:text-ink underline-offset-4 hover:underline",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-7 text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-[var(--radius-card)] bg-surface border border-line shadow-[var(--shadow-soft)]", className)} {...props} />
  );
}

export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-[13px] font-medium tracking-wide text-muted", className)} {...props} />;
}

export function Wordmark({ className, tone = "ink" }: { className?: string; tone?: "ink" | "light" }) {
  return (
    <span
      className={cn("font-semibold tracking-[0.22em] text-[15px] select-none", tone === "light" ? "text-white" : "text-ink", className)}
      aria-label="RENUABL"
    >
      RENUABL
    </span>
  );
}

type Tone = "positive" | "warning" | "info" | "neutral" | "danger";

const toneClass: Record<Tone, string> = {
  positive: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-2 text-ink-2",
  danger: "bg-warning-soft text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatRow({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3 text-[15px]", className)}>
      <span className="text-muted">{label}</span>
      <span className="text-ink font-medium text-right">{value}</span>
    </div>
  );
}
