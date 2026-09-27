"use client";

import { ArrowRight, Battery, Check, ChevronRight, Gauge, Gift, PlugZap, RotateCcw, Sun, X, type LucideIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { CareIncludedCard } from "@/components/consumer/care-upsell";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow, useSystem } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { Segmented, Stepper, Toggle } from "@/components/ui/controls";
import { Button, Card, StatRow, cn } from "@/components/ui/primitives";
import { CARE_FREE_MONTHS, CARE_INCLUDED_TIER, careIncludedFor, careIncludedValue } from "@/lib/domain/care";
import { formatCurrency, formatPercent } from "@/lib/domain/format";
import { ASSUMPTIONS, TIER_LABELS, isSameConfig, panelsToKw } from "@/lib/domain/recommendation";
import type { SystemConfig, SystemTier } from "@/lib/domain/types";

type Part = "solar" | "battery" | "ev" | "monitoring";

function Row({
  icon: Icon,
  title,
  subtitle,
  muted,
  onOpen,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  muted?: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-canvas/60 sm:px-5">
        <Icon className={cn("h-8 w-8 shrink-0", muted ? "text-muted" : "text-ink")} strokeWidth={1.2} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[15px]", muted ? "text-muted" : "text-ink")}>{title}</span>
          <span className="block truncate text-[12.5px] text-muted">{subtitle}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.5} />
      </button>
    </li>
  );
}

function PartSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[28px] bg-canvas p-6 pb-safe shadow-[var(--shadow-lift)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[460px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-[18px] font-medium">{title}</Dialog.Title>
            <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Adjust this part of your system</Dialog.Description>
          <div className="mt-4 space-y-5 text-[14px] leading-relaxed text-ink-2">{children}</div>
          <Dialog.Close asChild>
            <Button size="lg" className="mt-6 w-full">
              Done
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SystemScreen() {
  const router = useRouter();
  const { state, update } = useFlow();
  const { recommendation, tier, config, price, outcome } = useSystem();
  const [open, setOpen] = useState<Part | null>(null);
  const adjusted = !isSameConfig(config, tier.config);
  const set = (patch: Partial<SystemConfig>) => update({ config: { ...config, ...patch } });

  const estimate = (
    <Card className="p-5">
      <p className="text-[13px] text-muted">Estimated savings</p>
      <p className="mt-1 text-[30px] font-normal tracking-tight tabular-nums">
        {formatCurrency(outcome.annualSavings)}
        <span className="text-[14px] text-muted"> / year</span>
      </p>
      <p className="text-[13px] text-muted">About {formatPercent(outcome.selfPoweredShare)} of your home powered by the sun.</p>
      <div className="mt-3 divide-y divide-line border-t border-line">
        <StatRow label="Price after rebates" value={formatCurrency(price.total)} />
        <StatRow label="Pays for itself in" value={`~${outcome.paybackYears} years`} />
        <StatRow label="Due today" value={`${formatCurrency(price.deposit)} refundable`} />
      </div>
    </Card>
  );

  return (
    <FlowStep
      width="regular"
      title="Your recommended system."
      subtitle="A tailored system for your home and lifestyle."
      aside={<div className="sticky top-6 space-y-4">{estimate}</div>}
      ask={
        <AskRenuabl
          context="recommendation"
          title="Questions about your system?"
          subtitle="Ask RENUABL — do I need a battery?"
          arrow="light"
        />
      }
      cta={
        <Button size="lg" className="w-full lg:w-72" onClick={() => router.push(stepHref("extras"))}>
          Continue <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </Button>
      }
    >
      <div className="max-w-xl space-y-4">
        <Segmented<SystemTier>
          label="System option"
          value={state.tier}
          onChange={(t) => update({ tier: t, config: null })}
          options={(Object.keys(TIER_LABELS) as SystemTier[]).map((t) => ({ value: t, label: TIER_LABELS[t] }))}
        />
        {careIncludedFor(state.tier) ? (
          <CareIncludedCard />
        ) : (
          <button
            type="button"
            onClick={() => update({ tier: CARE_INCLUDED_TIER, config: null })}
            className="flex w-full items-center gap-2.5 rounded-2xl bg-sage/50 px-4 py-3 text-left text-[13px] text-forest hover:bg-sage/80"
          >
            <Gift className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden />
            <span>
              <span className="font-medium">{TIER_LABELS.independence}</span> includes {CARE_FREE_MONTHS} months of RENUABL Care free
              (valued at ${careIncludedValue()}).
            </span>
          </button>
        )}

        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            <Row icon={Sun} title="Solar System" subtitle={`${outcome.solarKw} kW · Premium panels`} onOpen={() => setOpen("solar")} />
            <Row
              icon={Battery}
              title="Battery Storage"
              subtitle={
                config.batteryKwh > 0 ? `${config.batteryKwh} kWh · Store and use more of your energy` : "Not included · Add any time"
              }
              muted={config.batteryKwh === 0}
              onOpen={() => setOpen("battery")}
            />
            <Row
              icon={PlugZap}
              title="EV Charger"
              subtitle={config.evCharger ? "Smart charging, ready when you are" : "Not included"}
              muted={!config.evCharger}
              onOpen={() => setOpen("ev")}
            />
            <Row icon={Gauge} title="Energy Monitoring" subtitle="Track and optimise in real time" onOpen={() => setOpen("monitoring")} />
          </ul>
          {adjusted && (
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px]">
              <span className="text-muted">Adjusted by you</span>
              <button
                type="button"
                onClick={() => update({ config: null })}
                className="flex items-center gap-1.5 text-ink-2 hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-[15px] text-ink">Why this system?</p>
          <ul className="mt-3 space-y-2">
            {tier.why.map((w) => (
              <li key={w} className="flex items-center gap-3 text-[14px] text-muted">
                <Check className="h-4 w-4 shrink-0 text-positive" strokeWidth={2} aria-hidden /> {w}
              </li>
            ))}
          </ul>
        </Card>

        <div className="xl:hidden">{estimate}</div>
      </div>

      <PartSheet open={open === "solar"} onOpenChange={(o) => setOpen(o ? "solar" : null)} title="Solar System">
        <p>
          {outcome.solarKw} kW from {config.panelCount} premium panels, generating about{" "}
          {outcome.annualGenerationKwh.toLocaleString("en-AU")} kWh a year. Your home uses around{" "}
          {recommendation.estimatedAnnualUsageKwh.toLocaleString("en-AU")} kWh.
        </p>
        <div className="flex items-center justify-between rounded-2xl bg-surface p-4">
          <span>Panels</span>
          <Stepper
            label="panels"
            value={config.panelCount}
            min={ASSUMPTIONS.minPanels}
            max={ASSUMPTIONS.maxPanels}
            onChange={(panelCount) => set({ panelCount })}
          />
        </div>
        <p className="text-[13px] text-muted">Each panel adds {panelsToKw(1)} kW. Your roof is confirmed on the 15-minute call.</p>
      </PartSheet>

      <PartSheet open={open === "battery"} onOpenChange={(o) => setOpen(o ? "battery" : null)} title="Battery Storage">
        <p>
          A battery stores the sunshine you don&apos;t use during the day, so your home can run on it in the evening and during outages.
        </p>
        <div className="flex items-center justify-between rounded-2xl bg-surface p-4">
          <span>Include a battery</span>
          <Toggle
            label="Include battery"
            checked={config.batteryKwh > 0}
            onChange={(on) => set({ batteryKwh: on ? tier.config.batteryKwh || 10 : 0 })}
          />
        </div>
        {config.batteryKwh > 0 && (
          <div className="flex gap-2" role="radiogroup" aria-label="Battery size">
            {ASSUMPTIONS.batterySizes.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={config.batteryKwh === s}
                onClick={() => set({ batteryKwh: s })}
                className={cn(
                  "h-11 flex-1 rounded-full text-[14px]",
                  config.batteryKwh === s ? "bg-primary text-primary-ink" : "bg-surface text-ink-2 shadow-[0_0_0_1px_var(--line)]",
                )}
              >
                {s} kWh
              </button>
            ))}
          </div>
        )}
      </PartSheet>

      <PartSheet open={open === "ev"} onOpenChange={(o) => setOpen(o ? "ev" : null)} title="EV Charger">
        <p>A smart charger fills your car from surplus solar first, and schedules the rest for the cheapest times.</p>
        <div className="flex items-center justify-between rounded-2xl bg-surface p-4">
          <span>Include an EV charger</span>
          <Toggle label="Include EV charger" checked={config.evCharger} onChange={(evCharger) => set({ evCharger })} />
        </div>
      </PartSheet>

      <PartSheet open={open === "monitoring"} onOpenChange={(o) => setOpen(o ? "monitoring" : null)} title="Energy Monitoring">
        <p>Included with every RENUABL system. See what your home makes and uses in the My RENUABL app, with plain-English insights.</p>
      </PartSheet>
    </FlowStep>
  );
}

export default function SystemPage() {
  return (
    <FlowGuard step="system">
      <SystemScreen />
    </FlowGuard>
  );
}
