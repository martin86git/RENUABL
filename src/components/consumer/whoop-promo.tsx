"use client";

import { Gift } from "lucide-react";
import Link from "next/link";
import { Button, cn } from "@/components/ui/primitives";
import { WHOOP_COPY } from "@/lib/domain/whoop-offer";
import { useWhoopOpen } from "@/lib/services/whoop";

/** Every WHOOP mention renders only while the server says claims are left. */

export function WhoopStrip({ className }: { className?: string }) {
  if (!useWhoopOpen()) return null;
  return (
    <p className={cn("flex items-start gap-2.5 rounded-2xl bg-sage px-4 py-3 text-[13.5px] leading-snug text-forest", className)}>
      <Gift className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden />
      <span>
        {WHOOP_COPY.strip} · <span className="font-medium">{WHOOP_COPY.first}</span>
      </span>
    </p>
  );
}

export function WhoopBanner() {
  if (!useWhoopOpen()) return null;
  const toPlan = () => {
    const el = document.getElementById("plan");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector("input")?.focus({ preventScroll: true });
  };
  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 pt-16 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-6 rounded-[var(--radius-card)] bg-primary px-6 py-8 text-primary-ink sm:px-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[13px] tracking-[0.02em] opacity-80">{WHOOP_COPY.bannerLabel}</p>
          <h2 className="mt-2 text-[28px] font-normal leading-tight tracking-[-0.03em] lg:text-[36px]">{WHOOP_COPY.bannerHeading}</h2>
          <p className="mt-3 text-[13px] leading-relaxed opacity-80">
            {WHOOP_COPY.bannerSmall}{" "}
            <Link href="/offer-terms" className="underline underline-offset-4">
              Terms apply
            </Link>
            .
          </p>
        </div>
        <div className="shrink-0">
          <Button variant="secondary" size="lg" onClick={toPlan}>
            Get my plan
          </Button>
        </div>
      </div>
    </section>
  );
}

/** On a plan option: the gift when it has a battery, a nudge when it doesn't. */
export function WhoopOptionNote({ hasBattery, className }: { hasBattery: boolean; className?: string }) {
  if (!useWhoopOpen()) return null;
  return hasBattery ? (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-sage px-2.5 py-1 text-[12px] text-forest", className)}>
      <Gift className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden /> {WHOOP_COPY.badge}
    </span>
  ) : (
    <span className={cn("block text-[12px] leading-snug text-muted", className)}>{WHOOP_COPY.addBattery}</span>
  );
}

/** At the end of the battery guides. */
export function WhoopGuideLine() {
  if (!useWhoopOpen()) return null;
  return (
    <p className="mt-8 flex gap-2.5 rounded-2xl bg-sage px-5 py-4 text-[14.5px] leading-relaxed text-forest">
      <Gift className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden />
      <span>
        {WHOOP_COPY.guideLine}{" "}
        <Link href="/#plan" className="underline underline-offset-4">
          Get my plan
        </Link>{" "}
        ·{" "}
        <Link href="/offer-terms" className="underline underline-offset-4">
          Terms apply
        </Link>
      </span>
    </p>
  );
}

/** Whether to show WHOOP lines (checkout, confirmation) for an eligible order. */
export { useWhoopOpen };
