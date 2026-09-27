"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark, cn } from "@/components/ui/primitives";
import { FLOW_STEPS, stepHref, stepIndex } from "./steps";
import { useFlow } from "./flow-state";
import { formatAddress } from "@/lib/mock/addresses";

/** Frame for the guided flow: progress navigation replaces the generic nav. */
export function FlowShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = stepIndex(pathname.split("/")[2] ?? "");
  const { state } = useFlow();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="RENUABL home">
          <Wordmark />
        </Link>
        {state.address && <p className="hidden max-w-sm truncate text-[13px] text-muted md:block">{formatAddress(state.address)}</p>}
        <Link href="/my/support" className="text-[14px] text-ink-2 hover:text-ink">
          Help
        </Link>
      </header>

      {/* Mobile progress: dots + current title */}
      <div className="px-5 pb-2 pt-1 lg:hidden">
        <ol className="flex gap-1.5" aria-label="Progress">
          {FLOW_STEPS.map((s, i) => (
            <li
              key={s.slug}
              aria-current={i === current ? "step" : undefined}
              className={cn("h-1 flex-1 rounded-full transition-colors", i <= current ? "bg-ink" : "bg-line")}
            >
              <span className="sr-only">{s.title}</span>
            </li>
          ))}
        </ol>
        {current >= 0 && (
          <p className="mt-3 text-[13px] font-medium text-muted">
            Step {current + 1} of {FLOW_STEPS.length} · {FLOW_STEPS[current].title}
          </p>
        )}
      </div>

      <div className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 gap-10 px-5 sm:px-8 lg:grid-cols-12 lg:px-12 lg:pt-8">
        {/* Desktop progress rail */}
        <nav className="hidden lg:col-span-3 lg:block xl:col-span-2" aria-label="Progress">
          <ol className="sticky top-8 space-y-1">
            {FLOW_STEPS.map((s, i) => {
              const done = i < current;
              const active = i === current;
              const content = (
                <>
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                      done && "border-ink bg-ink text-canvas",
                      active && "border-ink text-ink",
                      !done && !active && "border-line-strong text-muted",
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={cn("text-[14px]", active ? "font-semibold text-ink" : done ? "text-ink-2" : "text-muted")}>
                    {s.title}
                  </span>
                </>
              );
              return (
                <li key={s.slug} aria-current={active ? "step" : undefined}>
                  {done ? (
                    <Link href={stepHref(s.slug)} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-2.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="lg:col-span-9 xl:col-span-10">{children}</div>
      </div>
    </div>
  );
}

/**
 * A single step. Desktop: centre task + optional contextual aside.
 * Mobile: stacked, with the primary CTA in a sticky bottom bar.
 */
export function FlowStep({
  title,
  subtitle,
  children,
  aside,
  cta,
  wide = false,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  cta?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-10 pb-48 lg:grid-cols-10 lg:pb-16">
      <section className={cn("animate-fade-up", aside ? "lg:col-span-6" : wide ? "lg:col-span-10" : "lg:col-span-7")}>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px] lg:text-[40px]">{title}</h1>
        {subtitle && <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-muted lg:text-[17px]">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {cta && <div className="mt-10 hidden lg:block">{cta}</div>}
      </section>
      {aside && (
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-8 space-y-4">{aside}</div>
        </aside>
      )}
      {/* Kept outside the animated section: a transformed ancestor would break `position: fixed`. */}
      {cta && (
        <div className="flow-sticky-cta fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/90 px-5 pt-3 backdrop-blur-md pb-safe lg:hidden">
          {cta}
        </div>
      )}
    </div>
  );
}
