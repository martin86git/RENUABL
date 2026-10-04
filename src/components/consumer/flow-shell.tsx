"use client";

import { ArrowLeft, CircleCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { revoContext, revoLine } from "@/lib/domain/revo";
import { getInstaller } from "@/lib/services/consumer";
import { AskRenuabl } from "./ask-renuabl";
import { ConsumerTopBar } from "./consumer-top-bar";
import { useFlow, useSystem } from "./flow-state";
import { FLOW_STEPS, previousHref, stepEntryHref, stepIndex } from "./steps";

function useCurrentStep() {
  const pathname = usePathname();
  const slug = pathname.split("/")[2] ?? "";
  return { slug, index: stepIndex(slug) };
}

/** Mobile progress: small dots joined by a line, as in the design. */
export function ProgressDots({ current, className }: { current: number; className?: string }) {
  return (
    <ol className={cn("flex items-center", className)} aria-label={`Step ${current + 1} of ${FLOW_STEPS.length}`}>
      {FLOW_STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center" aria-current={i === current ? "step" : undefined}>
          {i > 0 && <span className={cn("h-px w-5", i <= current ? "bg-ink/70" : "bg-line-strong")} />}
          {i < current ? (
            // Completed steps are tappable, with a generous hit area around the dot.
            <Link href={stepEntryHref(i)} aria-label={`Back to ${s.title}`} className="tap-area -m-2 grid place-items-center p-2">
              <span className="block h-2 w-2 rounded-full bg-ink" />
            </Link>
          ) : (
            <span
              className={cn(
                "block rounded-full",
                i === current ? "h-2 w-2 bg-ink ring-4 ring-ink/10" : "h-1.5 w-1.5 border border-line-strong bg-canvas",
              )}
            />
          )}
          <span className="sr-only">{s.title}</span>
        </li>
      ))}
    </ol>
  );
}

function StepRail({ current, address }: { current: number; address: string | null }) {
  return (
    <nav aria-label="Progress" className="sticky top-6">
      <ol className="relative space-y-1">
        <span aria-hidden className="absolute bottom-6 left-[27px] top-6 w-px bg-line" />
        {FLOW_STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const subtitle = i === 0 && address ? address : s.subtitle;
          const body = (
            <>
              <span
                className={cn(
                  "relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px]",
                  done || active ? "bg-leaf text-white" : "bg-surface-2 text-muted",
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[14px]", done || active ? "text-ink" : "text-muted")}>{s.title}</span>
                <span className="block truncate text-[12px] text-muted">{subtitle}</span>
              </span>
              {done && <CircleCheck className="h-[18px] w-[18px] shrink-0 text-leaf" strokeWidth={1.6} aria-label="Done" />}
            </>
          );
          return (
            <li key={s.key} aria-current={active ? "step" : undefined}>
              {done ? (
                <Link
                  href={stepEntryHref(i)}
                  title={`Go back to ${s.title}`}
                  className="flex items-center gap-3.5 rounded-2xl px-3.5 py-4 transition hover:bg-surface/70"
                >
                  {body}
                </Link>
              ) : (
                <div
                  className={cn("flex items-center gap-3.5 rounded-2xl px-3.5 py-4", active && "bg-surface shadow-[var(--shadow-soft)]")}
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Revo, on every step: narrates the journey and backs up each choice; tap to ask a question. */
function RevoGuide({ slug }: { slug: string }) {
  const { state } = useFlow();
  const { config } = useSystem();
  const line = revoLine({
    step: slug,
    suburb: state.address?.suburb,
    dailyKwh: state.bill?.dailyUsageKwh,
    indicative: Boolean(state.bill?.estimate),
    hasSolar: state.bill?.hasSolar,
    wantsBattery: state.profile.wantsBattery,
    tier: state.tier,
    batteryKwh: config.batteryKwh,
    evCharger: config.evCharger,
    backupAdded: state.addOns.includes("home-backup"),
    addOns: state.addOns.length,
    // Never name the partner while "Finding your installation partner" is still playing.
    partner:
      state.installerId && state.matchedPostcode === (state.address?.postcode ?? "") ? getInstaller(state.installerId)?.name : undefined,
    installDate: state.installDate ? formatDate(state.installDate, { weekday: "long", day: "numeric", month: "long" }) : undefined,
    firstName: state.contact?.firstName,
  });
  return <AskRenuabl context={revoContext(slug)} variant="revo" line={line} />;
}

/** Frame for the guided flow: progress navigation replaces generic navigation. */
export function FlowShell({ children }: { children: ReactNode }) {
  const { index, slug } = useCurrentStep();
  const { state, hydrated } = useFlow();
  const address = state.address ? `${state.address.line}, ${state.address.state}` : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <ConsumerTopBar className="hidden lg:flex" />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 lg:border-t lg:border-line">
        <aside className="hidden w-[272px] shrink-0 border-r border-line px-5 py-8 lg:block">
          <StepRail current={index} address={address} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {hydrated && <RevoGuide slug={slug} />}
    </div>
  );
}

/**
 * One step. Desktop: centre task (+ optional contextual aside), with the
 * Ask Revo card and primary CTA side by side at the bottom.
 * Mobile: back arrow + progress dots, stacked content, sticky CTA.
 */
export function FlowStep({
  title,
  subtitle,
  children,
  aside,
  ask,
  cta,
  hideMobileHeader = false,
  width = "regular",
  centered = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  ask?: ReactNode;
  cta?: ReactNode;
  hideMobileHeader?: boolean;
  /** Width of the centred content column on desktop. */
  width?: "narrow" | "regular" | "wide";
  /** Centre the heading and actions too (e.g. the confirmation screen). */
  centered?: boolean;
}) {
  const { slug, index } = useCurrentStep();

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1">
        {!hideMobileHeader && (
          <div className="flex items-center gap-4 px-5 pt-5 lg:hidden">
            <Link
              href={previousHref(slug)}
              aria-label="Back"
              className="-ml-1 grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={1.6} />
            </Link>
            <ProgressDots current={index} className="mx-auto pr-9" />
          </div>
        )}

        <section
          className={cn(
            // Centred column on desktop so wide screens don't leave a gap on the right.
            "animate-fade-up px-5 pb-40 pt-8 sm:px-8 lg:mx-auto lg:px-12 lg:pb-10 lg:pt-8",
            width === "narrow" && "lg:max-w-[680px]",
            width === "regular" && "lg:max-w-[860px]",
            width === "wide" && "lg:max-w-[1120px]",
            centered && "lg:text-center",
            cta ? "" : "pb-16",
          )}
        >
          <div className="mb-3 hidden lg:block">
            {!hideMobileHeader && (
              <Link href={previousHref(slug)} className="mb-4 inline-flex items-center gap-2 text-[13px] text-ink-2 hover:text-ink">
                <ArrowLeft className="h-4 w-4" strokeWidth={1.6} /> Back
              </Link>
            )}
            <span className={cn("block h-0.5 w-8 rounded-full bg-leaf", centered && "mx-auto")} />
            <p className="mt-2 text-[13px] text-muted">
              Step {index + 1} of {FLOW_STEPS.length}
            </p>
          </div>
          <h1 className="text-[34px] font-normal leading-[1.05] tracking-[-0.035em] sm:text-[38px] lg:text-[36px] xl:text-[40px]">
            {title}
          </h1>
          {subtitle && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted lg:mt-2">{subtitle}</p>}
          <div className="mt-7">{children}</div>

          {(ask || cta) && (
            <div className={cn("mt-8 hidden items-center gap-6 lg:flex", centered && "justify-center")}>
              {ask && <div className="max-w-md flex-1">{ask}</div>}
              {cta && <div className={cn("shrink-0", !ask && "min-w-72")}>{cta}</div>}
            </div>
          )}
          {ask && <div className="mt-6 lg:hidden">{ask}</div>}
        </section>

        {/* Kept outside the animated section: a transformed ancestor would break `position: fixed`. */}
        {cta && (
          <div className="flow-sticky-cta fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-canvas via-canvas to-canvas/0 px-5 pt-6 pb-safe lg:hidden [&_a]:rounded-xl [&_button]:rounded-xl">
            {cta}
          </div>
        )}
      </div>
      {aside && <aside className="hidden w-[300px] shrink-0 border-l border-line px-6 py-8 xl:block">{aside}</aside>}
    </div>
  );
}
