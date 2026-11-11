"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useState } from "react";
import type { GuideStepId, GuideTarget } from "@/lib/domain/design/sol-guide";
import { reachedWords, targetWords } from "@/lib/domain/design/sol-guide";
import { SolIcon } from "./sol-icon";

type Phase = "single" | "three";
type Storeys = "single" | "double";
type Roof = "tile" | "tin" | "flat";

/**
 * Sol leading the design (11 Nov 2026, Martin; `sol-guide.ts`): one card over Ask Sol for the step at hand, its
 * answers as buttons, typing kept to the size to aim for. Every step has a way on that says no.
 */
export function SolGuide(props: {
  step: GuideStepId | null;
  /** Placing towards the target: how many are down, of how many. */
  placing: { panels: number; of: number | null; kw: number } | null;
  first: string | null;
  home: { phase: Phase; storeys: Storeys; roof: Roof };
  suggested: (GuideTarget & { spend: string | null }) | null;
  target: GuideTarget | null;
  /** On a deal, Sol can look for the bill in the customer's file. */
  canFind: boolean;
  finding: boolean;
  panelName: string;
  inverterName: string | null;
  batteryName: string | null;
  kw: number;
  onHome: (home: { phase: Phase; storeys: Storeys; roof: Roof }) => void;
  onFlat: (answer: { kliplok: boolean; tilt: number | null }) => void;
  onTarget: (target: GuideTarget | null) => void;
  onFind: () => void;
  onPanel: (use: boolean) => void;
  onPlace: (blocks: boolean) => void;
  onReached: (done: boolean) => void;
  onInverter: (use: boolean | "choose") => void;
  onString: (yes: boolean) => void;
  onBattery: (add: boolean | "choose") => void;
  onBackup: (yes: boolean) => void;
  onStop: () => void;
}) {
  const [home, setHome] = useState(props.home);
  const [kliplok, setKliplok] = useState(true);
  const [tilt, setTilt] = useState<number | null>(null);
  // The boxes show the size Sol suggests (it fills in once the bill arrives) until they are typed in.
  const start = props.target ?? props.suggested;
  const [typedKw, setKw] = useState<string | null>(null);
  const [typedKwh, setKwh] = useState<string | null>(null);
  const kw = typedKw ?? (start ? String(start.kw) : "");
  const kwh = typedKwh ?? (start ? String(start.kwh) : "0");

  const body = (() => {
    if (props.placing && !props.step)
      return (
        <p>
          Place the panels: tap a face for each block.{" "}
          <span className="tabular-nums text-sun-line">
            {props.placing.kw} kW{props.placing.of ? ` of ${props.target?.kw} kW` : ""}
          </span>{" "}
          down.
        </p>
      );
    switch (props.step) {
      case "home":
        return (
          <>
            <p>First, the home.</p>
            <div className="mt-2 grid gap-1.5">
              <Choice
                options={[
                  ["single", "Single phase"],
                  ["three", "Three phase"],
                ]}
                value={home.phase}
                onPick={(phase) => setHome({ ...home, phase: phase as Phase })}
              />
              <Choice
                options={[
                  ["single", "Single storey"],
                  ["double", "Double storey"],
                ]}
                value={home.storeys}
                onPick={(storeys) => setHome({ ...home, storeys: storeys as Storeys })}
              />
              <Choice
                options={[
                  ["tile", "Tile"],
                  ["tin", "Tin"],
                  ["flat", "Flat"],
                ]}
                value={home.roof}
                onPick={(roof) => setHome({ ...home, roof: roof as Roof })}
              />
            </div>
            <Actions>
              <Main onClick={() => props.onHome(home)}>Next</Main>
            </Actions>
          </>
        );
      case "flat":
        return (
          <>
            <p>A flat roof.</p>
            <div className="mt-2 grid gap-1.5">
              <Choice
                options={[
                  ["yes", "Kliplok interfaces"],
                  ["no", "No Kliplok"],
                ]}
                value={kliplok ? "yes" : "no"}
                onPick={(v) => setKliplok(v === "yes")}
              />
              <Choice
                options={[
                  ["0", "Lay them flat"],
                  ["10", "Tilt 10°"],
                  ["15", "Tilt 15°"],
                ]}
                value={String(tilt ?? 0)}
                onPick={(v) => setTilt(v === "0" ? null : Number(v))}
              />
            </div>
            <Actions>
              <Main onClick={() => props.onFlat({ kliplok, tilt })}>Next</Main>
            </Actions>
          </>
        );
      case "target":
        return (
          <>
            <p>{targetWords(props.first, props.suggested)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Field label="kW of panels" value={kw} onChange={setKw} />
              <Field label="kWh battery" value={kwh} onChange={setKwh} />
            </div>
            <Actions>
              <Main
                disabled={!(Number(kw) > 0)}
                onClick={() => props.onTarget({ kw: Math.round(Number(kw) * 100) / 100, kwh: Math.max(0, Number(kwh) || 0) })}
              >
                Aim for this
              </Main>
              {!props.suggested && props.canFind && (
                <Quiet onClick={props.onFind}>{props.finding ? "Looking…" : "Find their bill in the file"}</Quiet>
              )}
              <Quiet onClick={() => props.onTarget(null)}>No target</Quiet>
            </Actions>
          </>
        );
      case "panel":
        return (
          <>
            <p>Let&apos;s use the {props.panelName}.</p>
            <Actions>
              <Main onClick={() => props.onPanel(true)}>Use it</Main>
              <Quiet onClick={() => props.onPanel(false)}>Something else</Quiet>
            </Actions>
          </>
        );
      case "place":
        return (
          <>
            <p>
              {props.target
                ? `Let's place the panels: about ${props.target.kw} kW. I'll hand them over as blocks; tap the face for each.`
                : "Let's place the panels. I'll hand them over as blocks; tap the face for each."}
            </p>
            <Actions>
              <Main onClick={() => props.onPlace(true)}>Proceed</Main>
              <Quiet onClick={() => props.onPlace(false)}>I&apos;ll place them myself</Quiet>
            </Actions>
          </>
        );
      case "reached":
        return (
          <>
            <p>{reachedWords(props.kw, props.target)}</p>
            <Actions>
              <Main onClick={() => props.onReached(true)}>Done placing</Main>
              <Quiet onClick={() => props.onReached(false)}>Keep adding</Quiet>
            </Actions>
          </>
        );
      case "inverter":
        return (
          <>
            <p>{props.inverterName ? `The inverter: the ${props.inverterName} suits these panels.` : "Now the inverter."}</p>
            <Actions>
              {props.inverterName && <Main onClick={() => props.onInverter(true)}>Use it</Main>}
              <Quiet onClick={() => props.onInverter("choose")}>Choose one</Quiet>
              <Quiet onClick={() => props.onInverter(false)}>Not now</Quiet>
            </Actions>
          </>
        );
      case "string":
        return (
          <>
            <p>Ready for me to string them?</p>
            <Actions>
              <Main onClick={() => props.onString(true)}>Yes, string them</Main>
              <Quiet onClick={() => props.onString(false)}>No, I&apos;ll string them</Quiet>
            </Actions>
          </>
        );
      case "battery":
        return (
          <>
            <p>
              {props.batteryName
                ? `The battery: the ${props.batteryName}, about ${props.target?.kwh} kWh.`
                : `Now the battery: about ${props.target?.kwh} kWh.`}
            </p>
            <Actions>
              {props.batteryName && <Main onClick={() => props.onBattery(true)}>Add it</Main>}
              <Quiet onClick={() => props.onBattery("choose")}>Choose one</Quiet>
              <Quiet onClick={() => props.onBattery(false)}>No battery</Quiet>
            </Actions>
          </>
        );
      case "backup":
        return (
          <>
            <p>Add blackout backup?</p>
            <Actions>
              <Main onClick={() => props.onBackup(true)}>Yes, add backup</Main>
              <Quiet onClick={() => props.onBackup(false)}>No</Quiet>
            </Actions>
          </>
        );
      default:
        return null;
    }
  })();
  if (!body) return null;
  return (
    <div className="pointer-events-auto w-[min(32rem,calc(100vw-2rem))] rounded-[22px] bg-primary/95 px-4 py-3 text-[14px] text-white shadow-[0_18px_50px_rgba(11,11,12,0.4)] ring-1 ring-white/10 backdrop-blur-md">
      <div className="flex items-start gap-2.5">
        <SolIcon className="mt-0.5 size-4 shrink-0 text-sun-line" />
        <div className="min-w-0 flex-1 leading-relaxed">{body}</div>
        <button
          type="button"
          onClick={props.onStop}
          aria-label="Stop leading the design"
          title="Stop: I'll design it myself"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-white/55 hover:text-white"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Choice({ options, value, onPick }: { options: [string, string][]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          aria-pressed={value === v}
          className={clsx(
            "rounded-full px-3 py-1 text-[13px] font-medium",
            value === v ? "bg-white text-ink" : "text-white/80 ring-1 ring-white/20 hover:bg-white/10",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-[12.5px] text-white/70">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, "").slice(0, 6))}
        inputMode="decimal"
        className="h-9 w-20 rounded-xl bg-white/10 px-2.5 text-[15px] tabular-nums text-white outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-sun-line"
      />
      {label}
    </label>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-2.5 flex flex-wrap gap-1.5">{children}</div>;
}

function Main({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-sun-line px-3.5 py-1.5 text-[13px] font-medium text-white hover:brightness-110 disabled:bg-white/15 disabled:text-white/50"
    >
      {children}
    </button>
  );
}

function Quiet({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[13px] font-medium text-white/80 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}
