"use client";

import { Moon, Snowflake, Sun } from "lucide-react";
import { useState } from "react";
import { Toggle } from "@/components/ui/controls";
import { cn } from "@/components/ui/primitives";
import { houseShares, type HouseScenario } from "@/lib/domain/brief";
import { formatCurrency } from "@/lib/domain/format";
import { ASSUMPTIONS, panelsToKw, savingsFor } from "@/lib/domain/recommendation";
import { roundDownSavings } from "@/lib/domain/savings-preview";
import { SPEND_COPY } from "@/lib/domain/spend-estimate";
import type { SystemConfig } from "@/lib/domain/types";
import type { useSystem } from "@/components/consumer/flow-state";

type System = ReturnType<typeof useSystem>;

/**
 * Their home filling with a day's power: grid (clay), solar used as it's made
 * (green), the battery's stored sunshine after dark (forest). Switch solar on,
 * then a battery, and see the grid shrink. Figures from the same rule of
 * thumb as the savings; "indicative" when there's no bill.
 */
export function BriefHouse({ system, indicative }: { system: System; indicative: boolean }) {
  const { recommendation } = system;
  const usage = recommendation.usage;
  const withBattery: SystemConfig = recommendation.tiers.recommended.config;
  const solarOnly: SystemConfig = recommendation.tiers.essential.config;
  const hasBattery = withBattery.batteryKwh > 0;
  const [solar, setSolar] = useState(false);
  const [battery, setBattery] = useState(false);
  const [winter, setWinter] = useState(false);
  const scenario: HouseScenario = !solar ? "grid" : battery && hasBattery ? "battery" : "solar";
  const config = scenario === "battery" ? withBattery : solarOnly;
  const shares = houseShares(
    {
      dailyKwh: usage.dailyKwh,
      solarKw: panelsToKw(config.panelCount),
      yieldKwhPerKw: winter ? usage.winterYieldKwhPerKw : usage.dailyYieldKwhPerKw,
      batteryUsableKwh: config.batteryKwh * ASSUMPTIONS.batteryUsableShare,
    },
    scenario,
  );
  const saving = scenario === "grid" ? 0 : roundDownSavings(savingsFor(config, usage).annualSavings);
  const own = Math.round((1 - shares.grid) * 100);

  // The house fills from the floor: battery at the bottom (night), then solar, then the grid on top.
  const H = 120; // wall height in the drawing
  const top = 80; // wall top y
  const layer = (from: number, share: number) => ({ y: top + H * (1 - from - share), h: H * share });
  const bat = layer(0, shares.battery);
  const sol = layer(shares.battery, shares.solar);
  const grid = layer(shares.battery + shares.solar, shares.grid);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] text-ink-2">
          Your home uses about <span className="font-medium text-ink">{Math.round(usage.dailyKwh)} kWh a day</span>
          {indicative && <span className="ml-2 rounded-full bg-surface-2 px-2 py-px text-[11px] text-muted">{SPEND_COPY.indicative}</span>}
        </p>
        <button
          type="button"
          onClick={() => setWinter((w) => !w)}
          className="tap-area inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-2"
          aria-pressed={winter}
        >
          {winter ? <Snowflake className="h-3.5 w-3.5" aria-hidden /> : <Sun className="h-3.5 w-3.5" aria-hidden />}
          {winter ? "Winter day" : "Average day"}
        </button>
      </div>

      <svg
        viewBox="0 0 240 210"
        className="mx-auto mt-4 block w-full max-w-[320px]"
        role="img"
        aria-label={`About ${own}% of your power from your own system`}
      >
        <defs>
          <clipPath id="brief-walls">
            <rect x="40" y={top} width="160" height={H} />
          </clipPath>
        </defs>
        <polygon points="120,12 228,80 12,80" fill="var(--surface-2)" stroke="var(--line-strong)" strokeWidth="2" strokeLinejoin="round" />
        <g clipPath="url(#brief-walls)">
          <rect x="40" y={top} width="160" height={H} fill="var(--surface)" />
          <rect
            x="40"
            y={grid.y}
            width="160"
            height={grid.h}
            fill="#C9826B"
            className="transition-all duration-700 ease-out motion-reduce:transition-none"
          />
          <rect
            x="40"
            y={sol.y}
            width="160"
            height={sol.h}
            fill="var(--positive)"
            className="transition-all duration-700 ease-out motion-reduce:transition-none"
          />
          <rect
            x="40"
            y={bat.y}
            width="160"
            height={bat.h}
            fill="var(--forest)"
            className="transition-all duration-700 ease-out motion-reduce:transition-none"
          />
        </g>
        <rect x="40" y={top} width="160" height={H} fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        {solar && (
          <g aria-hidden>
            <rect x="140" y="38" width="50" height="22" rx="2" fill="var(--forest)" transform="rotate(32 165 49)" opacity="0.9" />
          </g>
        )}
      </svg>

      <ul className="mt-4 space-y-1.5 text-[13px]">
        <Legend colour="#C9826B" label="Bought from the grid" value={`${Math.round(shares.grid * 100)}%`} />
        {solar && <Legend colour="var(--positive)" label="Your solar, used as it's made" value={`${Math.round(shares.solar * 100)}%`} />}
        {scenario === "battery" && (
          <Legend colour="var(--forest)" label="Your battery, after dark" value={`${Math.round(shares.battery * 100)}%`} icon />
        )}
      </ul>

      <div className="mt-5 space-y-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-soft)]">
        <label className="flex items-center justify-between gap-3 text-[15px]">
          <span>Add solar ({panelsToKw(config.panelCount)} kW)</span>
          <Toggle
            label="Add solar"
            checked={solar}
            onChange={(on) => {
              setSolar(on);
              if (!on) setBattery(false);
            }}
          />
        </label>
        {hasBattery && (
          <label className={cn("flex items-center justify-between gap-3 text-[15px]", !solar && "opacity-60")}>
            <span>Add a battery ({withBattery.batteryKwh} kWh)</span>
            <Toggle label="Add a battery" checked={battery} onChange={(on) => solar && setBattery(on)} />
          </label>
        )}
      </div>

      {scenario === "battery" && withBattery.panelCount > solarOnly.panelCount && (
        <p className="mt-3 text-[12.5px] leading-snug text-muted">
          With a battery we size the solar for winter, so there&apos;s spare sunshine to fill it for the evening.
        </p>
      )}
      {solar ? (
        <p className="mt-4 text-[15px] text-ink" aria-live="polite">
          About <span className="font-medium">{own}%</span> of your power from your own system
          {saving > 0 && (
            <>
              , saving about <span className="font-medium text-positive">{formatCurrency(saving)}</span> a year
            </>
          )}
          .
        </p>
      ) : (
        <p className="mt-4 text-[14px] text-muted">Today, all of it comes from the grid. Switch on solar to see the difference.</p>
      )}
      <p className="mt-2 text-[12px] leading-snug text-muted">
        {indicative ? SPEND_COPY.savingsNote : "A first estimate from your bill."}
        {winter ? " In winter the panels make less, so you'd buy a little more from the grid." : ""}
      </p>
    </div>
  );
}

function Legend({ colour, label, value, icon }: { colour: string; label: string; value: string; icon?: boolean }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: colour }} aria-hidden />
      <span className="flex-1 text-ink-2">
        {label}
        {icon && <Moon className="ml-1 inline h-3 w-3 text-muted" aria-hidden />}
      </span>
      <span className="tabular-nums text-ink">{value}</span>
    </li>
  );
}
