"use client";

import {
  ArrowRight,
  Battery,
  Check,
  ChevronRight,
  ClipboardCheck,
  Gauge,
  Gift,
  Info,
  PlugZap,
  RotateCcw,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { CareIncludedCard } from "@/components/consumer/care-upsell";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { PortalPreview, PortalTeaser } from "@/components/consumer/portal-preview";
import { RoofCheck } from "@/components/consumer/roof-check";
import { useFlow, useSystem } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { Disclosure, Segmented, Toggle } from "@/components/ui/controls";
import { Button, Card, StatRow, cn } from "@/components/ui/primitives";
import { CARE_ENABLED, CARE_FREE_MONTHS, CARE_INCLUDED_TIER, careIncludedFor, careIncludedValue } from "@/lib/domain/care";
import { expandNote, solarSituation } from "@/lib/domain/existing-solar";
import { formatCurrency, formatPercent } from "@/lib/domain/format";
import {
  ASSUMPTIONS,
  PRICE_INCLUDES,
  backupNote,
  DESIGN_ON_CALL,
  TIER_LABELS,
  isSameConfig,
  sizingExplanation,
  solarDay,
} from "@/lib/domain/recommendation";
import { BATTERY_RANGE, PANEL, PANEL_RANGE, batteryLabel, panelLabel } from "@/lib/domain/catalogue";
import { solarVictoriaApplies } from "@/lib/domain/rebates";
import type { SystemConfig, SystemTier } from "@/lib/domain/types";

type Part = "solar" | "battery" | "ev" | "monitoring";

/** "Panels we use" / "Batteries we use", from the product library. */
function ProductList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-[14px] text-ink">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((i) => (
          <li key={i} className="flex items-center gap-2.5 text-[14px] text-ink-2">
            <Check className="h-4 w-4 shrink-0 text-positive" strokeWidth={2} aria-hidden /> {i}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-muted">Your exact equipment is chosen in your design and shown on your 15-minute call.</p>
    </div>
  );
}

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
  const { recommendation, profile, tier, config, price, outcome } = useSystem();
  const [open, setOpen] = useState<Part | null>(null);
  const adjusted = !isSameConfig(config, tier.config);
  const set = (patch: Partial<SystemConfig>) => update({ config: { ...config, ...patch } });

  const existing = recommendation.usage.existingSolar;
  const home = state.address;
  // Google's roof is still on its way for this address.
  const roofLoading =
    typeof home?.lat === "number" &&
    typeof home.lng === "number" &&
    !(state.roof && Math.abs(state.roof.lat - home.lat) < 1e-5 && Math.abs(state.roof.lng - home.lng) < 1e-5);
  const replacing = state.bill ? solarSituation(state.bill, profile) === "replace" : false;
  const daily = recommendation.usage.dailyKwh;
  const subtitle = existing
    ? `Built around your existing solar: you buy about ${daily} kWh a day from the grid.`
    : replacing
      ? `A new system to replace your current one, sized to about ${daily} kWh a day (estimated from your bill).`
      : `Sized to your bill: about ${state.bill?.dailyUsageKwh ?? daily} kWh a day${profile.evPlanned ? ", plus your future EV" : ""}.`;
  const solarSubtitle = existing
    ? config.panelCount > 0
      ? `Your existing solar + ${outcome.solarKw} kW new panels`
      : "Keeping your existing solar"
    : `${outcome.solarKw} kW · ${PANEL.watts} W panels`;

  const estimate = (
    <Card className="p-5">
      <p className="text-[13px] text-muted">Estimated savings</p>
      <p className="mt-1 text-[30px] font-normal tracking-tight tabular-nums">
        {formatCurrency(outcome.annualSavings)}
        <span className="text-[14px] text-muted"> / year</span>
      </p>
      <p className="text-[13px] text-muted">
        {existing
          ? `Cuts about ${formatPercent(outcome.selfPoweredShare)} of the power you buy from the grid.`
          : `About ${formatPercent(outcome.selfPoweredShare)} of your home powered by the sun.`}
      </p>
      <div className="mt-3 divide-y divide-line border-t border-line">
        {price.rebateLines.length > 0 && <StatRow label="Price before rebates" value={formatCurrency(price.gross)} />}
        {price.rebateLines.map((r) => (
          <div key={r.id} className="flex items-baseline justify-between gap-3 py-2.5">
            <span className="text-[13.5px] font-medium text-positive">{r.label}</span>
            <span className="text-[14px] font-semibold tabular-nums text-positive">−{formatCurrency(r.amount)}</span>
          </div>
        ))}
        {!existing && solarVictoriaApplies(state.address?.state ?? null) && !price.rebateLines.some((r) => r.id.startsWith("sv-")) && (
          <p className="py-2.5 text-[13px] text-positive">
            <span className="font-medium">Solar Victoria Rebate:</span> you may also be eligible. Switch it on when you reserve.
          </p>
        )}
        <StatRow label="Price after rebates" value={formatCurrency(price.total)} />
        <StatRow label="Pays for itself in" value={`~${outcome.paybackYears} years`} />
        <StatRow label="Due today" value="$0 to reserve" />
      </div>
      <p className="mt-2 text-[12px] text-muted">{PRICE_INCLUDES}</p>
    </Card>
  );

  return (
    <FlowStep
      width="regular"
      title="Your recommended system."
      subtitle={subtitle}
      aside={
        <div className="sticky top-6 space-y-4">
          {estimate}
          <PortalTeaser />
        </div>
      }
      ask={
        <AskRenuabl
          context="recommendation"
          title="Questions about your system?"
          subtitle="Ask Revo — do I need a battery?"
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
        {!existing && (
          <RoofCheck
            roof={state.roof?.data}
            centre={state.address}
            panelCount={config.panelCount}
            reason={state.roof?.reason}
            loading={roofLoading}
          />
        )}

        <Segmented<SystemTier>
          label="System option"
          value={state.tier}
          onChange={(t) => update({ tier: t, config: null })}
          options={(Object.keys(TIER_LABELS) as SystemTier[]).map((t) => ({ value: t, label: TIER_LABELS[t] }))}
        />
        {!CARE_ENABLED ? null : careIncludedFor(state.tier) ? (
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

        {existing && (
          <p className="flex gap-2.5 rounded-2xl bg-canvas px-4 py-3 text-[13px] leading-snug text-ink-2 ring-1 ring-line" role="note">
            <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden />
            {expandNote(state.existingInverter)}
          </p>
        )}

        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            <Row icon={Sun} title="Solar System" subtitle={solarSubtitle} onOpen={() => setOpen("solar")} />
            <Row
              icon={Battery}
              title="Battery Storage"
              subtitle={
                config.batteryKwh > 0
                  ? `${config.batteryKwh} kWh · ${BATTERY_RANGE[0].manufacturer} · ${state.addOns.includes("home-backup") ? "With blackout backup" : "Blackout backup available"}`
                  : "Not included · Add any time"
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
        <div className="flex gap-3 rounded-2xl bg-sage/60 px-5 py-4 text-forest" role="note">
          <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.6} aria-hidden />
          <div>
            <p className="text-[15px]">{DESIGN_ON_CALL.title}</p>
            <p className="mt-1 text-[13px] leading-snug text-forest/85">{DESIGN_ON_CALL.body}</p>
          </div>
        </div>

        <Card className="p-5">
          <p className="text-[15px] text-ink">Why this system?</p>
          <ul className="mt-3 space-y-2">
            {tier.why.map((w) => (
              <li key={w} className="flex items-center gap-3 text-[14px] text-muted">
                <Check className="h-4 w-4 shrink-0 text-positive" strokeWidth={2} aria-hidden /> {w}
              </li>
            ))}
          </ul>
          {!existing && (
            <Disclosure title="How we worked this out" className="mt-3 border-t border-line">
              <ul className="space-y-2 text-[14px] text-muted">
                {sizingExplanation(recommendation.usage, config, { nasa: Boolean(state.sunshine), replacing }).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Disclosure>
          )}
        </Card>

        <div className="space-y-4 xl:hidden">
          {estimate}
          <PortalTeaser />
        </div>
      </div>

      <PartSheet open={open === "solar"} onOpenChange={(o) => setOpen(o ? "solar" : null)} title="Solar System">
        {existing ? (
          <>
            <p>
              We keep your existing panels. Your bill shows they export about {existing.exportedDailyKwh} kWh a day, which is what charges
              your battery.
            </p>
            <p>
              {config.panelCount > 0
                ? `That isn't quite enough to fill a ${config.batteryKwh} kWh battery on most days, so we add ${config.panelCount} panels (${outcome.solarKw} kW).`
                : "That's enough to fill your battery on most days, so you don't need more panels."}
            </p>
            <p className="text-[13px] text-muted">{expandNote(state.existingInverter)}</p>
          </>
        ) : (
          <>
            <p>
              {outcome.solarKw} kW from {config.panelCount} {PANEL.watts} W panels, generating about{" "}
              {outcome.annualGenerationKwh.toLocaleString("en-AU")} kWh a year.
            </p>
            <p>
              That&apos;s sized to what your home uses: about {daily} kWh a day ({recommendation.usage.annualKwh.toLocaleString("en-AU")}{" "}
              kWh a year) {replacing ? "estimated from your bill and what your current panels export" : "from your bill"}
              {profile.evPlanned ? ", plus your future EV" : ""}.
              {config.batteryKwh > 0
                ? " With your battery it's sized for winter, so the spare solar can fill the battery for the evening."
                : config.panelCount === ASSUMPTIONS.minPanels
                  ? ` That's covered by our smallest system (${ASSUMPTIONS.minSystemKw} kW), so you'll have a little spare to export.`
                  : " No bigger than you need."}
            </p>
            <ProductList title="Panels we use" items={PANEL_RANGE.map(panelLabel)} />
            <p className="text-[13px] text-muted">
              {replacing
                ? "Removing your current system, your roof and your switchboard are all confirmed on the 15-minute call."
                : "Your roof and switchboard are confirmed on the 15-minute call."}
            </p>
          </>
        )}
      </PartSheet>

      <PartSheet open={open === "battery"} onOpenChange={(o) => setOpen(o ? "battery" : null)} title="Battery Storage">
        <p>
          A battery stores the sunshine you don&apos;t use during the day, so your home can run on it in the evening and during outages.
        </p>
        {config.batteryKwh > 0 ? (
          <p>
            {existing
              ? `Your bill shows you buy about ${Math.round(daily * recommendation.usage.eveningShare * 10) / 10} kWh a day after the sun goes down`
              : `On a winter day your home uses about ${Math.round(solarDay(outcome.solarKw, recommendation.usage.winterYieldKwhPerKw, daily).afterDark * 10) / 10} kWh after the sun goes down`}
            , so we&apos;ve sized a {config.batteryKwh} kWh battery for your home.
          </p>
        ) : (
          <p>
            {TIER_LABELS.essential} doesn&apos;t include a battery, so there&apos;s no backup in a blackout. Choose{" "}
            {TIER_LABELS.recommended} for a battery sized to your evening use; blackout backup can be added to it.
          </p>
        )}
        <ProductList title="Batteries we use" items={BATTERY_RANGE.map(batteryLabel)} />
        {config.batteryKwh > 0 && <p>{backupNote(state.addOns.includes("home-backup"))}</p>}
      </PartSheet>

      <PartSheet open={open === "ev"} onOpenChange={(o) => setOpen(o ? "ev" : null)} title="EV Charger">
        <p>A smart charger fills your car from surplus solar first, and schedules the rest for the cheapest times.</p>
        <div className="flex items-center justify-between rounded-2xl bg-surface p-4">
          <span>Include an EV charger</span>
          <Toggle label="Include EV charger" checked={config.evCharger} onChange={(evCharger) => set({ evCharger })} />
        </div>
      </PartSheet>

      <PartSheet open={open === "monitoring"} onOpenChange={(o) => setOpen(o ? "monitoring" : null)} title="Energy Monitoring">
        <p>
          Included with every RENUABL system. Once you&apos;re switched on, the My RENUABL app shows what your home makes and uses, with
          plain-English insights.
        </p>
        <PortalPreview />
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
