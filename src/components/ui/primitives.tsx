import clsx, { type ClassValue } from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...values: ClassValue[]) {
  return clsx(values);
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background,transform,opacity,box-shadow,border-color] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 select-none";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-ink hover:opacity-90",
  secondary: "bg-surface text-ink border border-line-strong hover:border-ink/40",
  ghost: "text-ink hover:bg-surface-2",
  quiet: "text-muted hover:text-ink underline-offset-4 hover:underline",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-6 text-[14px]",
  lg: "h-[52px] px-8 text-[15px]",
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

/** Soft white card — no hard borders, as in the brand sheet. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-soft)]", className)} {...props} />;
}

export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-[13px] text-muted", className)} {...props} />;
}

/** Headline style from the design: large, light-to-regular weight, tight tracking. */
export function Headline({ className, as: Tag = "h1", ...props }: ComponentProps<"h1"> & { as?: "h1" | "h2" }) {
  return (
    <Tag
      className={cn("text-[34px] font-normal leading-[1.05] tracking-[-0.035em] text-ink sm:text-[40px] lg:text-[44px]", className)}
      {...props}
    />
  );
}

/** Letter strokes of the RENUABL wordmark (the A is drawn as Λ, with a sage bar beneath). */
const WORDMARK_PATH =
  "M21 138V14h59a31 31 0 0 1 0 62H21M72 76l48 62" + // R
  "M214 5v133M205 14h100M214 71h86M205 129h100" + // E
  "M399 138V14l99 115V5" + // N
  "M601 5v77a47 47 0 0 0 94 0V5" + // U
  "M786 138l60.5-124L907 138" + // Λ
  "M1016 138V14h39a28 28 0 0 1 0 56h-39m39 0h7a29.5 29.5 0 0 1 0 59h-46" + // B
  "M1201 5v124h87"; // L

export function Wordmark({ className, tone = "ink" }: { className?: string; tone?: "ink" | "light" }) {
  return (
    <svg
      viewBox="0 0 1300 190"
      role="img"
      aria-label="RENUABL"
      className={cn("h-[22px] w-auto select-none", tone === "light" ? "text-white" : "text-ink", className)}
    >
      <path d={WORDMARK_PATH} fill="none" stroke="currentColor" strokeWidth="18" strokeLinejoin="miter" strokeMiterlimit="10" />
      <rect x="778" y="166" width="137" height="19" fill="#A7BCA8" />
    </svg>
  );
}

/** Handwritten accent, e.g. "Good energy lives here." */
export function Script({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("font-script text-[22px] leading-[1.05] text-ink-2 -rotate-[14deg] select-none", className)}>{children}</p>;
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
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium",
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
    <div className={cn("flex items-center justify-between gap-4 py-3 text-[14px]", className)}>
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
