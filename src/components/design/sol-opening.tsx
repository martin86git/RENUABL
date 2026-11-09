"use client";

import { useState } from "react";
import clsx from "clsx";
import { Calculator, Moon, Sun, TriangleAlert, X } from "lucide-react";
import {
  BATTERY_CHOICES,
  QUICK_DEFAULTS,
  recommendKw,
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
  "h-12 w-full rounded-xl bg-white/10 px-3 text-[15px] tabular-nums text-white ring-1 ring-white/15 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sun-line";

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
  // Sol's pick follows the home's use and the battery until a kW is typed over it (10 Nov 2026, Martin).
  const [typedKw, setTypedKw] = useState<string | null>(startKw ? String(startKw) : null);
  const [battery, setBattery] = useState<BatteryChoice>("solar");
  const [phase, setPhase] = useState(startPhase);
  const [use, setUse] = useState(kwhPerDay ? String(Math.round(kwhPerDay * 10) / 10) : "");
  const pick = recommendKw(Number(use) || null, battery);
  const kw = typedKw ?? (pick ? String(pick.kw) : "");
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
      {/* The six boxes on one grid of three (10 Nov 2026, Martin: symmetry and clarity). */}
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        <Label>PV</Label>
        <Label>Home uses</Label>
        <Label>Phase</Label>
        <span className="relative block">
          <input
            value={kw}
            onChange={(e) => setTypedKw(e.target.value)}
            onFocus={(e) => e.target.select()}
            inputMode="decimal"
            autoFocus
            placeholder="8"
            aria-label="Solar in kW"
            className={clsx(field, "pr-9", typedKw === null && pick && "text-sun-line")}
          />
          <Unit>kW</Unit>
        </span>
        <span className="relative block">
          <input
            value={use}
            onChange={(e) => setUse(e.target.value)}
            inputMode="decimal"
            placeholder="optional"
            aria-label="What the home uses a day, kWh"
            className={clsx(field, "pr-16")}
          />
          <Unit>kWh/day</Unit>
        </span>
        <div role="radiogroup" aria-label="Phase" className="flex h-12 rounded-xl bg-white/10 p-1 ring-1 ring-white/15">
          {(["single", "three"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={phase === p}
              onClick={() => setPhase(p)}
              className={clsx(
                "flex-1 rounded-[9px] text-[13px] font-medium",
                phase === p ? "bg-white text-ink" : "text-white/70 hover:text-white",
              )}
            >
              {p === "single" ? "Single" : "Three"}
            </button>
          ))}
        </div>
        {BATTERY_CHOICES.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={battery === b.id}
            onClick={() => setBattery(b.id)}
            className={clsx(
              "h-12 rounded-xl px-3 text-left ring-1 transition-colors",
              battery === b.id ? "bg-white/15 ring-sun-line" : "ring-white/15 hover:bg-white/10",
            )}
          >
            <span className="block truncate text-[13px] font-medium text-white">{b.label}</span>
            <span className="block truncate text-[11px] text-white/55">{b.detail}</span>
          </button>
        ))}
      </div>
      {pick &&
        (typedKw === null ? (
          <p className="mt-2.5 flex items-start gap-2 text-[12.5px] leading-snug text-white/75">
            <SolIcon className="mt-0.5 size-3.5 shrink-0 text-sun-line" />
            <span>
              I&apos;d go <span className="font-mono text-sun-line">{pick.kw} kW</span>. {pick.why} Type over it to change it.
            </span>
          </p>
        ) : (
          Number(typedKw) !== pick.kw && (
            <p className="mt-2.5 text-[12.5px] text-white/60">
              Your size.{" "}
              <button type="button" onClick={() => setTypedKw(null)} className="font-medium text-sun-line hover:underline">
                Back to Sol&apos;s {pick.kw} kW
              </button>
            </p>
          )
        ))}
      {size ? (
        <div className="mt-2.5 rounded-2xl bg-white p-3 text-ink" aria-live="polite">
          {/* The result, on its own light card so it reads as the answer. */}
          <div className="grid grid-cols-3 gap-2">
            <Figure label="Panels" big={`${size.panels}`} small={`${size.kw} kW · ${QUICK_DEFAULTS.panelWatts} W`} />
            <Figure label="Inverter" big={`${size.inverterKw} kW`} small={size.hybrid ? "Hybrid" : "String"} />
            <Figure
              label="Battery"
              big={size.batteryKwh ? `${size.batteryKwh} kWh` : "None"}
              small={size.backupKwh ? `incl. ${size.backupKwh} for blackouts` : size.batteryKwh ? "Usable 90%" : "Solar only"}
              lit={Boolean(size.batteryKwh)}
            />
          </div>
          <ul className="mt-3 space-y-2 border-t border-line pt-3 text-[12.5px] leading-snug">
            <Point icon={<Sun className="size-3.5" aria-hidden />}>
              <span className="font-mono">{size.dayKwh}</span> kWh a day
              {size.yearShare !== null && (
                <>
                  <span className="text-muted"> · </span>
                  <span className="font-mono">{size.yearShare}%</span> of their use
                  <Bar share={size.yearShare} />
                </>
              )}
            </Point>
            {size.batteryKwh !== null && size.eveningKwh !== null && (
              <Point icon={<Moon className="size-3.5" aria-hidden />}>
                Covers the <span className="font-mono">{size.eveningKwh}</span> kWh they use after dark
                {size.toEvenings && <span className="text-muted"> (bigger wouldn&apos;t be used)</span>}
              </Point>
            )}
            {size.exportCheck && (
              <Point icon={<TriangleAlert className="size-3.5" aria-hidden />} warn>
                Over 5 kW single phase: network approval or an export limit
              </Point>
            )}
            {size.overMax && (
              <Point icon={<TriangleAlert className="size-3.5" aria-hidden />} warn>
                Kept to 20 kW here: design it to see more
              </Point>
            )}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] leading-snug text-muted">Rules of thumb, Melbourne&apos;s average sun.</p>
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
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={clsx("font-mono text-[20px] font-semibold tabular-nums", lit ? "text-sun-line" : "text-ink")}>{big}</p>
      <p className="text-[11px] leading-snug text-muted">{small}</p>
    </div>
  );
}

const Label = ({ children }: { children: string }) => (
  <span className="text-[11px] font-medium uppercase tracking-wide text-white/50">{children}</span>
);

const Unit = ({ children }: { children: string }) => (
  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-white/50">{children}</span>
);

/** One point of the result: an icon and a few words, amber when it is something to check. */
function Point({ icon, warn, children }: { icon: React.ReactNode; warn?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={clsx(
          "mt-px flex size-5 shrink-0 items-center justify-center rounded-full",
          warn ? "bg-sun text-sun-ink" : "bg-surface-2 text-ink-2",
        )}
      >
        {icon}
      </span>
      <span className={clsx("min-w-0 flex-1", warn ? "text-sun-ink" : "text-ink")}>{children}</span>
    </li>
  );
}

/** How much of a year's use the solar makes, as a fine line. */
const Bar = ({ share }: { share: number }) => (
  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
    <span className="block h-full rounded-full bg-sun-line" style={{ width: `${Math.min(100, share)}%` }} />
  </span>
);
