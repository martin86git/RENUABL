"use client";

import { BatteryCharging, PlugZap, RotateCcw, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow, useSystem } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { Disclosure, Stepper, Toggle } from "@/components/ui/controls";
import { Badge, Button, Card, StatRow, cn } from "@/components/ui/primitives";
import { ASSUMPTIONS, isSameConfig, panelsToKw } from "@/lib/domain/recommendation";
import { formatCurrency, formatPercent } from "@/lib/domain/format";
import type { SystemConfig } from "@/lib/domain/types";

const BATTERY_OPTIONS = ASSUMPTIONS.batterySizes.filter((s) => s > 0);

function SystemItem({
  icon,
  title,
  summary,
  control,
  why,
  muted = false,
  wideControl = false,
}: {
  icon: ReactNode;
  title: string;
  summary: string;
  control: ReactNode;
  why: ReactNode;
  muted?: boolean;
  /** Wide controls (steppers) drop below the text on phones. */
  wideControl?: boolean;
}) {
  return (
    <div className={cn("px-5 py-5 sm:px-6", muted && "opacity-60")}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-ink">{icon}</span>
        <div className={cn("min-w-0 flex-1", wideControl && "basis-40")}>
          <p className="text-[17px] font-semibold">{title}</p>
          <p className="text-[14px] text-muted">{summary}</p>
        </div>
        <div className={cn("ml-auto shrink-0", wideControl && "pl-15 sm:pl-0")}>{control}</div>
      </div>
      <div className="pl-15">
        <Disclosure title={<span className="text-[14px] text-ink-2">Why this?</span>}>{why}</Disclosure>
      </div>
    </div>
  );
}

function SystemScreen() {
  const router = useRouter();
  const { update } = useFlow();
  const { recommendation, config, price, outcome } = useSystem();
  const adjusted = !isSameConfig(config, recommendation.recommended);
  const set = (patch: Partial<SystemConfig>) => update({ config: { ...config, ...patch } });

  const outcomeCard = (
    <Card className="overflow-hidden">
      <div className="p-6" style={{ background: "linear-gradient(135deg, #FFF4DE, #FFE3D6 55%, #EEE8FF)" }}>
        <p className="text-[13px] font-medium text-ink-2">Estimated savings</p>
        <p className="mt-1 text-[40px] font-semibold tracking-tight tabular-nums text-[#15161a]">
          {formatCurrency(outcome.annualSavings)}
          <span className="text-[17px] font-medium text-ink-2"> / year</span>
        </p>
        <p className="text-[14px] text-ink-2">About {formatPercent(outcome.selfPoweredShare)} of your home powered by the sun.</p>
      </div>
      <div className="divide-y divide-line px-6">
        <StatRow label="Your price after rebates" value={formatCurrency(price.total)} />
        <StatRow label="Pays for itself in" value={`~${outcome.paybackYears} years`} />
        <StatRow label="Due today" value={`${formatCurrency(price.deposit)} refundable`} />
      </div>
    </Card>
  );

  return (
    <FlowStep
      title="Here's what we recommend"
      subtitle="One system, sized for your home. Adjust anything — we'll keep the numbers honest."
      cta={
        <div className="flex items-center gap-4">
          <div className="flex-1 lg:hidden">
            <p className="text-[13px] text-muted">After rebates</p>
            <p className="text-[17px] font-semibold tabular-nums">{formatCurrency(price.total)}</p>
          </div>
          <Button size="lg" onClick={() => router.push(stepHref("installer"))}>
            Continue
          </Button>
        </div>
      }
      aside={
        <>
          {outcomeCard}
          <AskRenuabl context="recommendation" prompt="Questions about your system?" />
        </>
      }
    >
      <Card>
        <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-semibold">RENUABL Home</p>
            {adjusted ? <Badge tone="info">Adjusted by you</Badge> : <Badge tone="positive">Recommended</Badge>}
          </div>
          {adjusted && (
            <button
              type="button"
              onClick={() => update({ config: null })}
              className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
        </div>
        <div className="divide-y divide-line">
          <SystemItem
            icon={<Sun className="h-5 w-5" />}
            title={`${outcome.solarKw} kW solar`}
            summary={`${config.panelCount} premium panels · ~${outcome.annualGenerationKwh.toLocaleString("en-AU")} kWh a year`}
            wideControl
            control={
              <Stepper
                label="panels"
                value={config.panelCount}
                min={ASSUMPTIONS.minPanels}
                max={ASSUMPTIONS.maxPanels}
                onChange={(panelCount) => set({ panelCount })}
              />
            }
            why={
              <>
                <p>{recommendation.reasons[0]}</p>
                <p className="mt-2 text-[14px] text-muted">
                  Each panel adds {panelsToKw(1)} kW. We recommended {recommendation.recommended.panelCount} panels; your roof will be
                  confirmed on the call.
                </p>
              </>
            }
          />
          <SystemItem
            icon={<BatteryCharging className="h-5 w-5" />}
            title={config.batteryKwh > 0 ? `${config.batteryKwh} kWh battery` : "Home battery"}
            summary={config.batteryKwh > 0 ? "Stores sunshine for evenings and backup" : "Not included"}
            muted={config.batteryKwh === 0}
            control={
              <Toggle
                label="Include battery"
                checked={config.batteryKwh > 0}
                onChange={(on) => set({ batteryKwh: on ? recommendation.recommended.batteryKwh || 10 : 0 })}
              />
            }
            why={
              <>
                <p>
                  {recommendation.recommended.batteryKwh > 0
                    ? recommendation.reasons.find((r) => r.includes("battery"))
                    : "Based on your answers, a battery wouldn't pay for itself quickly yet. You can add one now or later."}
                </p>
                {config.batteryKwh > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Battery size">
                    {BATTERY_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={config.batteryKwh === s}
                        onClick={() => set({ batteryKwh: s })}
                        className={cn(
                          "rounded-full border px-4 py-2 text-[14px] font-medium",
                          config.batteryKwh === s ? "border-ink bg-ink text-canvas" : "border-line bg-surface",
                        )}
                      >
                        {s} kWh
                      </button>
                    ))}
                  </div>
                )}
              </>
            }
          />
          <SystemItem
            icon={<PlugZap className="h-5 w-5" />}
            title="Smart EV charger"
            summary={config.evCharger ? "Charges from surplus solar first" : "Not included"}
            muted={!config.evCharger}
            control={<Toggle label="Include EV charger" checked={config.evCharger} onChange={(evCharger) => set({ evCharger })} />}
            why={
              <p>
                {recommendation.recommended.evCharger
                  ? recommendation.reasons.find((r) => r.includes("charger"))
                  : "You told us you don't have an electric car. It's easy to add a charger later."}
              </p>
            }
          />
        </div>
        <div className="border-t border-line px-5 sm:px-6">
          <Disclosure title={<span className="text-[14px] text-ink-2">Technical details</span>}>
            <div className="divide-y divide-line text-[14px]">
              {price.lines.map((l) => (
                <StatRow key={l.label} label={l.label} value={formatCurrency(l.amount)} className="text-[14px]" />
              ))}
              <StatRow label="Estimated government rebates" value={`−${formatCurrency(price.rebates)}`} className="text-[14px]" />
              <StatRow
                label="Estimated annual usage"
                value={`${recommendation.estimatedAnnualUsageKwh.toLocaleString("en-AU")} kWh`}
                className="text-[14px]"
              />
              <StatRow label="Inverter" value="Hybrid, sized to system" className="text-[14px]" />
              <StatRow label="Warranty" value="25 yr panels · 10 yr inverter & battery" className="text-[14px]" />
            </div>
          </Disclosure>
        </div>
      </Card>

      <div className="mt-6 space-y-4 lg:hidden">
        {outcomeCard}
        <AskRenuabl context="recommendation" prompt="Questions about your system?" />
      </div>
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
