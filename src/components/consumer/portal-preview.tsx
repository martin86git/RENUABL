"use client";

import { ArrowRight, CircleCheck, MessageCircle, Smartphone, Wrench, X, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { DayCurve, Sparkbars } from "@/components/consumer/energy-charts";
import { useFlow } from "@/components/consumer/flow-state";
import { Button, Card, cn } from "@/components/ui/primitives";
import { formatCurrency, formatPercent } from "@/lib/domain/format";
import { getToday } from "@/lib/services/home";

/**
 * My RENUABL, shown before purchase: what the customer gets once their system
 * is switched on. Always labelled as an example: the figures are a sample home.
 */

const FEATURES: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: Zap, title: "What your panels make", detail: "Every day, with what you used and saved" },
  { icon: CircleCheck, title: "System health", detail: "A heads-up if something needs a look" },
  { icon: Wrench, title: "Book a service", detail: "With your installation partner, at a time that suits" },
  { icon: MessageCircle, title: "Ask RENUABL", detail: "Plain-English answers about your home" },
];

const EXAMPLE_NOTE = "Example home. Your own figures appear once your system is switched on.";

/** A compact My RENUABL home screen with sample data. */
export function PortalPreview({ className }: { className?: string }) {
  const today = getToday();
  return (
    <div className={cn("space-y-3", className)}>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] text-muted">Your day</p>
          <span className="rounded-full bg-sage px-2.5 py-0.5 text-[11px] text-forest">Example</span>
        </div>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{today.narrative}</p>
        <div className="mt-3">
          <DayCurve points={today.curve} height={110} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3 text-[12.5px]">
          <div>
            <p className="text-muted">From the sun</p>
            <p className="mt-0.5 text-[16px] text-ink">{formatPercent(today.selfPoweredShare)}</p>
          </div>
          <div>
            <p className="text-muted">Battery</p>
            <p className="mt-0.5 text-[16px] text-ink">{today.batteryPercent}%</p>
          </div>
          <div>
            <p className="text-muted">Saved today</p>
            <p className="mt-0.5 text-[16px] text-ink">{formatCurrency(today.savedToday)}</p>
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {FEATURES.map(({ icon: Icon, title, detail }) => (
            <li key={title} className="flex items-center gap-3.5 px-5 py-3">
              <Icon className="h-5 w-5 shrink-0 text-ink" strokeWidth={1.4} aria-hidden />
              <span className="min-w-0">
                <span className="block text-[14px] text-ink">{title}</span>
                <span className="block text-[12.5px] text-muted">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-center text-[12px] text-muted">{EXAMPLE_NOTE}</p>
    </div>
  );
}

/** "Your home, in one app": a teaser card in the flow that opens the preview. */
export function PortalTeaser({ className, closeLabel = "Back to my system" }: { className?: string; closeLabel?: string }) {
  const [open, setOpen] = useState(false);
  const today = getToday();
  const daylight = today.curve.filter((p) => p.hour >= 6 && p.hour <= 19).map((p) => p.solar);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Card className={cn("overflow-hidden", className)}>
        <div className="flex items-start gap-4 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sage text-forest">
            <Smartphone className="h-5 w-5" strokeWidth={1.5} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-muted">Included with every system</p>
            <p className="text-[15px] text-ink">Your home, in one app</p>
            <p className="mt-1 text-[13px] leading-snug text-muted">
              Once you&apos;re switched on, My RENUABL shows what your panels make, your battery and what you&apos;ve saved, and books
              service with your installation partner.
            </p>
          </div>
        </div>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 border-t border-line bg-canvas/50 px-5 py-3 text-left hover:bg-canvas"
          >
            <span className="text-[13.5px] text-ink">See what it looks like</span>
            <span className="flex items-center gap-3">
              <Sparkbars values={daylight} className="!h-6" />
              <ArrowRight className="h-4 w-4 text-ink" strokeWidth={1.6} aria-hidden />
            </span>
          </button>
        </Dialog.Trigger>
      </Card>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[28px] bg-canvas shadow-[var(--shadow-lift)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]">
          <div className="flex items-center justify-between px-6 pt-5">
            <Dialog.Title className="text-[18px] font-medium">My RENUABL</Dialog.Title>
            <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="px-6 pt-1 text-[13px] text-muted">
            What you&apos;ll see after your system is installed and switched on.
          </Dialog.Description>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
            <PortalPreview />
            <Button size="lg" className="mt-5 w-full" onClick={() => setOpen(false)}>
              {closeLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * On My RENUABL, the screens are an example home: say so to everyone (no
 * customer has a switched-on system yet), in preview and live alike.
 */
export function PortalPreviewBanner() {
  const { state, hydrated } = useFlow();
  if (!hydrated) return null;
  if (!state.reservation) {
    return (
      <div className="mb-6 rounded-2xl bg-sage/70 px-5 py-4 text-forest lg:mb-10">
        <p className="text-[15px]">
          <span className="mr-2 rounded-full bg-surface px-2.5 py-0.5 text-[11px] align-middle">Example</span>
          This is what you can expect with RENUABL.
        </p>
        <p className="mt-1 text-[13px] text-forest/80">
          An example home: once your system is installed and switched on, you&apos;ll see your own solar, battery and savings here.{" "}
          <Link href="/" className="underline underline-offset-2">
            Start with your address
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="mb-6 rounded-2xl bg-sage/70 px-5 py-4 text-forest lg:mb-10">
      <p className="text-[15px]">This is what you can expect after your system is installed and switched on.</p>
      <p className="mt-0.5 text-[13px] text-forest/80">
        The figures here are an example home. Yours appear from switch-on
        {state.contact?.firstName ? `, ${state.contact.firstName}` : ""}. We&apos;ll walk you through it on your call.
      </p>
    </div>
  );
}

/** On the example home, greet a customer who has reserved by their own name. */
export function ExampleOwnerName({ fallback }: { fallback: string }) {
  const { state, hydrated } = useFlow();
  return <>{hydrated && state.reservation && state.contact?.firstName ? state.contact.firstName : fallback}</>;
}
