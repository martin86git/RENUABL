import clsx, { type ClassValue } from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...values: ClassValue[]) {
  return clsx(values);
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background,transform,opacity,box-shadow,border-color] duration-150 active:scale-[0.98] disabled:pointer-events-none select-none";

const buttonVariants: Record<ButtonVariant, string> = {
  // Disabled buttons use solid muted colours, not transparency, so nothing shows through a pinned button.
  primary: "bg-primary text-primary-ink hover:opacity-90 disabled:bg-line-strong disabled:text-muted",
  secondary: "bg-surface text-ink border border-line-strong hover:border-ink/40 disabled:border-line disabled:text-muted",
  ghost: "text-ink hover:bg-surface-2 disabled:text-muted",
  quiet: "text-muted hover:text-ink underline-offset-4 hover:underline disabled:text-muted/60",
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

/** Soft white card — no hard borders, as in the brand sheet. A `bg-…` in className replaces the white (cn doesn't merge classes). */
export function Card({ className, ...props }: ComponentProps<"div">) {
  const ownBackground = /(^|\s)bg-/.test(className ?? "");
  return (
    <div className={cn("rounded-[var(--radius-card)] shadow-[var(--shadow-soft)]", !ownBackground && "bg-surface", className)} {...props} />
  );
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

export function Wordmark({ className, tone = "ink" }: { className?: string; tone?: "ink" | "light" }) {
  return (
    <span
      className={cn("select-none text-[20px] font-normal tracking-[0.28em]", tone === "light" ? "text-white" : "text-ink", className)}
      aria-label="RENUABL"
    >
      RENUABL
    </span>
  );
}

/** Handwritten accent, e.g. "The future lives here." */
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
