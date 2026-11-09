"use client";

import { useState } from "react";
import clsx from "clsx";
import { Calculator, X } from "lucide-react";
import {
  BATTERY_CHOICES,
  QUICK_DEFAULTS,
  sizeFromKw,
  type BatteryChoice,
  type KwSize,
  type OpeningAdvice,
} from "@/lib/domain/design/quick-size";
import type { DesignGoal } from "@/lib/domain/design/roof-design";
import { SolIcon } from "./sol-icon";

/** What Sol has to say as a roof opens. */
export type Opening =
  | { kind: "looking"; customer?: string }
  | { kind: "advice"; advice: OpeningAdvice; found: string[]; customer?: string }
  | { kind: "ask"; customer?: string; note?: string };

const GOALS: { goal: DesignGoal; label: string; detail: string }[] = [
  { goal: "payback", label: "Fastest payback", detail: "Panels only, the quickest to pay for itself" },
  { goal: "return", label: "Best return", detail: "Panels and a battery, the most saved over the years" },
  { goal: "independence", label: "Most independence", detail: "The whole roof, a battery and blackout backup" },
];

const chip =
  "rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 ring-white/15 text-white/90 hover:bg-white/10 hover:text-white transition-colors";

/**
 * Sol speaks first as the designer opens (9 Nov 2026, Martin: "upon loading up the designer Sol should immediately be
 * proactive and ask what you want to achieve, or tell you that he's read the customer's consumption from the notes and
 * therefore recommends solar + battery, the size and why"). Drawn inside Sol's black panel at the foot of the picture.
 */
export function SolOpening({
  opening,
  onLead,
  onGoal,
  onCalc,
  onClose,
}: {
  opening: Opening;
  onLead: (lead: "battery" | "solar") => void;
  onGoal: (goal: DesignGoal) => void;
  onCalc: () => void;
  onClose: () => void;
}) {
  const hello = opening.customer ? `Let's design ${opening.customer}'s system.` : "Let's design this one.";
  return (
    <div className="px-2.5 pt-1.5" role="status">
      <div className="flex items-start gap-2.5">
        <SolIcon className={clsx("mt-0.5 size-4 shrink-0 text-sun-line", opening.kind === "looking" && "animate-pulse")} />
        <div className="min-w-0 flex-1 text-[14px] leading-relaxed text-white/90">
          {opening.kind === "looking" && (
            <p>
              {hello} I&apos;m reading {opening.customer ? `${opening.customer}'s` : "the"} notes for what the home uses…
            </p>
          )}
          {opening.kind === "advice" && (
            <>
              <p className="font-medium text-white">{opening.advice.headline}</p>
              <ul className="mt-1.5 space-y-1 text-[13px] text-white/75">
                {opening.advice.why.map((w) => (
                  <li key={w} className="flex gap-2">
                    <span aria-hidden className="mt-[0.55em] size-1 shrink-0 rounded-full bg-sun-line" />
                    {w}
                  </li>
                ))}
              </ul>
              {opening.found.length > 0 && <p className="mt-1.5 text-[12px] text-white/50">{opening.found.join(" ")}</p>}
            </>
          )}
          {opening.kind === "ask" && (
            <>
              <p className="font-medium text-white">{hello} What would you like it to achieve?</p>
              {opening.note && <p className="mt-0.5 text-[12.5px] text-white/55">{opening.note}</p>}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-white/60 hover:text-white"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      {opening.kind === "advice" && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 pl-6">
          <button
            type="button"
            onClick={() => onLead(opening.advice.lead)}
            className="rounded-full bg-sun-line px-3.5 py-1.5 text-[13px] font-medium text-white hover:brightness-110"
          >
            {opening.advice.lead === "battery" ? "Design solar + battery" : "Design solar only"}
          </button>
          <button type="button" onClick={() => onLead(opening.advice.lead === "battery" ? "solar" : "battery")} className={chip}>
            {opening.advice.lead === "battery" ? "Solar only" : "With a battery"}
          </button>
          <button type="button" onClick={onCalc} className={clsx(chip, "inline-flex items-center gap-1.5")}>
            <Calculator className="size-3.5" aria-hidden /> Size it myself
          </button>
        </div>
      )}
      {opening.kind === "ask" && (
        <div className="mt-2.5 grid gap-1.5 pl-6 sm:grid-cols-2">
          {GOALS.map((g) => (
            <button
              key={g.goal}
              type="button"
              onClick={() => onGoal(g.goal)}
              className="rounded-2xl px-3 py-2 text-left ring-1 ring-white/15 transition-colors hover:bg-white/10"
            >
              <span className="block text-[13px] font-medium text-white">{g.label}</span>
              <span className="block text-[11.5px] leading-snug text-white/55">{g.detail}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onCalc}
            className="flex items-start gap-2 rounded-2xl px-3 py-2 text-left ring-1 ring-sun-line/50 transition-colors hover:bg-white/10"
          >
            <Calculator className="mt-0.5 size-4 shrink-0 text-sun-line" aria-hidden />
            <span>
              <span className="block text-[13px] font-medium text-white">A size I have in mind</span>
              <span className="block text-[11.5px] leading-snug text-white/55">PV kW, a battery or backup: the calculator</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

const field =
  "w-full rounded-xl bg-white/10 px-3 py-2 text-[15px] tabular-nums text-white ring-1 ring-white/15 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sun-line";

/**
 * The calculator that comes out of Sol (9 Nov 2026, Martin: "a calculator that would emerge out of Sol, with input
 * fields: PV kW, battery yes / no, size the battery or allow for backup, whatever fields are needed to design a
 * system"): the solar's kW, the battery, the phase, and the home's use when known, worked out as it is typed
 * (`sizeFromKw`), with Design this to lay it on the roof.
 */
export function SolCalculator({
  kwhPerDay,
  phase: startPhase,
  startKw,
  onDesign,
  onClose,
}: {
  /** The home's use a day, from the bill box, when known. */
  kwhPerDay: number | null;
  phase: "single" | "three";
  startKw?: number;
  onDesign: (size: KwSize, battery: BatteryChoice, phase: "single" | "three") => void;
  onClose: () => void;
}) {
  const [kw, setKw] = useState(startKw ? String(startKw) : "");
  const [battery, setBattery] = useState<BatteryChoice>("solar");
  const [phase, setPhase] = useState(startPhase);
  const [use, setUse] = useState(kwhPerDay ? String(Math.round(kwhPerDay * 10) / 10) : "");
  const size = sizeFromKw({ kw: Number(kw) || 0, battery, phase, kwhPerDay: Number(use) || null });
  return (
    <div className="px-2.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <Calculator className="size-4 shrink-0 text-sun-line" aria-hidden />
        <p className="flex-1 text-[14px] font-medium text-white">Size a system</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the calculator"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-white/60 hover:text-white"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-white/50">PV</span>
          <span className="relative mt-1 block">
            <input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              inputMode="decimal"
              autoFocus
              placeholder="8"
              aria-label="Solar in kW"
              className={clsx(field, "pr-9")}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-white/50">kW</span>
          </span>
        </label>
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-white/50">Home uses</span>
          <span className="relative mt-1 block">
            <input
              value={use}
              onChange={(e) => setUse(e.target.value)}
              inputMode="decimal"
              placeholder="optional"
              aria-label="What the home uses a day, kWh"
              className={clsx(field, "pr-16")}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-white/50">kWh/day</span>
          </span>
        </label>
        <div className="col-span-2 sm:col-span-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-white/50">Phase</span>
          <div role="radiogroup" aria-label="Phase" className="mt-1 flex rounded-xl bg-white/10 p-0.5 ring-1 ring-white/15">
            {(["single", "three"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={phase === p}
                onClick={() => setPhase(p)}
                className={clsx(
                  "h-9 flex-1 rounded-[10px] px-3 text-[13px] font-medium",
                  phase === p ? "bg-white text-ink" : "text-white/70 hover:text-white",
                )}
              >
                {p === "single" ? "Single" : "Three"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div role="radiogroup" aria-label="Battery" className="mt-2 grid grid-cols-3 gap-1.5">
        {BATTERY_CHOICES.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={battery === b.id}
            onClick={() => setBattery(b.id)}
            className={clsx(
              "rounded-xl px-2.5 py-1.5 text-left ring-1 transition-colors",
              battery === b.id ? "bg-white/15 ring-sun-line" : "ring-white/15 hover:bg-white/10",
            )}
          >
            <span className="block text-[13px] font-medium text-white">{b.label}</span>
            <span className="block text-[11px] leading-snug text-white/55">{b.detail}</span>
          </button>
        ))}
      </div>
      {size ? (
        <div className="mt-2.5 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10" aria-live="polite">
          <div className="grid grid-cols-3 gap-2">
            <Figure label="Panels" big={`${size.panels}`} small={`${size.kw} kW · ${QUICK_DEFAULTS.panelWatts} W`} />
            <Figure label="Inverter" big={`${size.inverterKw} kW`} small={size.hybrid ? "Hybrid" : "String"} />
            <Figure
              label="Battery"
              big={size.batteryKwh ? `${size.batteryKwh} kWh` : "None"}
              small={size.backupKwh ? `${size.backupKwh} kWh held for blackouts` : size.batteryKwh ? "Filled on a winter day" : "—"}
              lit={Boolean(size.batteryKwh)}
            />
          </div>
          <p className="mt-2 text-[12px] text-white/65">
            Makes about <span className="font-mono text-white">{size.dayKwh}</span> kWh a day,{" "}
            <span className="font-mono text-white">{size.yearKwh.toLocaleString("en-AU")}</span> a year
            {size.yearShare !== null ? `: about ${size.yearShare}% of a year's use` : ""}.
          </p>
          {size.notes.map((n) => (
            <p key={n} className="mt-1 text-[12px] text-sun-line">
              {n}
            </p>
          ))}
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p className="text-[11px] leading-snug text-white/45">
              Rules of thumb on Melbourne&apos;s average sunshine. The design firms it up.
            </p>
            <button
              type="button"
              onClick={() => onDesign(size, battery, phase)}
              className="shrink-0 rounded-full bg-sun-line px-4 py-2 text-[13px] font-medium text-white hover:brightness-110"
            >
              Design this
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2.5 text-[12.5px] text-white/55">Type the solar&apos;s size and it works the rest out as you go.</p>
      )}
    </div>
  );
}

function Figure({ label, big, small, lit }: { label: string; big: string; small: string; lit?: boolean }) {
  return (
    <div>
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-white/45">{label}</p>
      <p className={clsx("font-mono text-[19px] font-semibold tabular-nums", lit ? "text-sun-line" : "text-white")}>{big}</p>
      <p className="text-[11px] leading-snug text-white/55">{small}</p>
    </div>
  );
}
