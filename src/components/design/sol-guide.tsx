"use client";

import clsx from "clsx";
import { ChevronLeft, X } from "lucide-react";
import { useState } from "react";
import type { NearbyHome } from "@/lib/domain/design/property-lot";
import type { GuideStepId, GuideTarget, VersionBattery } from "@/lib/domain/design/sol-guide";
import {
  FREE_HOURS,
  batteryForKw,
  batteryWords,
  freeHoursWords,
  reachedWords,
  targetWords,
  unstrungWords,
  versionLines,
  wantsInputs,
} from "@/lib/domain/design/sol-guide";
import { SolIcon } from "./sol-icon";

type Phase = "single" | "three";

/** How long the shade analysis loads before it shows. */
const SHADE_LOAD_MS = 2500;
type Storeys = "single" | "double";
type Roof = "tile" | "tin" | "flat";

/**
 * Sol leading the design (11 Nov 2026, Martin; `sol-guide.ts`): one card over Ask Sol for the step at hand, its
 * answers as buttons, typing kept to the size to aim for. Every step has a way on that says no.
 */
export function SolGuide(props: {
  step: GuideStepId | null;
  /**
   * Is this the home? (18 Nov 2026, Martin): the lot outlined from the land register, by its address, why it may be in
   * doubt, and the homes round about for a no.
   */
  house: { address: string; doubt: string | null; nearby: NearbyHome[]; found: boolean } | null;
  /** Yes; another home round about; search for the address; or find it on the picture themselves. */
  onHouse: (answer: "yes" | "self" | "search" | NearbyHome) => void;
  /** Whether the address can be searched again from here (the strip under the picture). */
  canSearch: boolean;
  /** Placing towards the target: how many are down, of how many. */
  placing: { panels: number; of: number | null; kw: number } | null;
  first: string | null;
  home: { phase: Phase; storeys: Storeys; roof: Roof };
  suggested: (GuideTarget & { spend: string | null }) | null;
  target: GuideTarget | null;
  /** The designer's bill: its amount and how often, changed here as there. */
  bill: { amount: string; interval: "monthly" | "bimonthly" | "quarterly" | "annual" };
  onBill: (change: { amount?: string; interval?: "monthly" | "bimonthly" | "quarterly" }) => void;
  /** What the home uses a day, from the bill (null without one). */
  dailyKwh: number | null;
  /** A bill photo or PDF read into the bill. */
  onUpload: (file: File) => void;
  reading: { busy: boolean; error?: string } | null;
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
  /** The panels already on the roof: replaced (new ones may go where they are) or worked around. */
  /** Replaced, worked around, or "none": the check was wrong and there are no panels there. */
  onExisting: (replace: boolean | "none") => void;
  onPlace: () => void;
  onReached: (done: boolean) => void;
  /** Commence the shade analysis, or pass it by. */
  onShade: (yes: boolean) => void;
  onInverter: (use: boolean | "choose") => void;
  onString: (yes: boolean) => void;
  /** Panels still off a string after Sol strung them, and why. */
  unstrung: { left: number; why: string[] } | null;
  /** What to do with them: an inverter with more inputs, take them off, string them by hand, or leave them. */
  onUnstrung: (what: "inverter" | "remove" | "hand" | "leave") => void;
  /** "both": this design with the battery the panels fill, and a copy with the bigger one for the free hours. */
  onBattery: (add: boolean | "choose" | "both" | "pair") => void;
  /** The battery Sol would pick for the free-hours version, when there is one. */
  freeBatteryName: string | null;
  /** The two versions' batteries, counted, for the battery step's list. */
  batteryKit?: VersionBattery | null;
  freeBatteryKit?: VersionBattery | null;
  /** "both": two options on the proposal, with backup and without (19 Nov 2026, Martin). */
  onBackup: (yes: boolean | "both") => void;
  /** Back to the last question answered, to change the answer (19 Nov 2026, Martin). */
  onBack: (() => void) | null;
  onStop: () => void;
}) {
  // Nothing is chosen until it is pressed (11 Nov 2026, Martin: a lit answer reads as a decision already made).
  const [home, setHome] = useState<{ phase: Phase | null; storeys: Storeys | null; roof: Roof | null }>({
    phase: null,
    storeys: null,
    roof: null,
  });
  const [kliplok, setKliplok] = useState<boolean | null>(null);
  // Next stays pressable (18 Nov 2026, Martin: a greyed Next didn't say a row was still unpicked); pressed early, it says what.
  const [tried, setTried] = useState(false);
  // The target step in two parts (24 Nov 2026, Martin, from his iPhone: the bill and the battery in one card was "too
  // much in one instance"): first the bill and the size, then the battery.
  const [targetPart, setTargetPart] = useState<"size" | "battery">("size");
  const [triedStep, setTriedStep] = useState(props.step);
  if (triedStep !== props.step) {
    setTriedStep(props.step);
    setTried(false);
    setTargetPart("size");
  }
  const [tilt, setTilt] = useState<number | null | undefined>(undefined);
  // "No, it isn't": the homes round about, a search, or finding it themselves.
  const [notIt, setNotIt] = useState(false);
  // The kW box shows the size Sol suggests (it fills in once the bill arrives) until it is typed in.
  const start = props.target ?? props.suggested;
  const [typedKw, setKw] = useState<string | null>(null);
  const kw = typedKw ?? (start ? String(start.kw) : "");
  const [mode, setMode] = useState<"bill" | "size" | null>(null);
  const [battPick, setBattPick] = useState<"none" | "solar" | "free" | "both" | "other" | null>(null);
  // Another size of battery, typed (12 Nov 2026, Martin: pick a different storage amount).
  const [otherKwh, setOtherKwh] = useState("");
  // The shade analysis loading: a bar fills over SHADE_LOAD_MS, then it shows (19 Nov 2026, Martin: "a bar would load
  // purposely and 2.5 seconds later the shade analysis appears").
  const [shading, setShading] = useState(false);
  const commenceShade = () => {
    if (shading) return;
    setShading(true);
    window.setTimeout(() => {
      setShading(false);
      props.onShade(true);
    }, SHADE_LOAD_MS);
  };

  const body = (() => {
    if (props.placing && !props.step)
      return (
        <p>
          {props.placing.of && props.placing.of > props.placing.panels ? (
            <>
              Click to lay panels. <span className="tabular-nums text-sun-line">{props.placing.of - props.placing.panels} more</span> to
              reach {props.target?.kw} kW{" "}
              <span className="tabular-nums text-white/60">
                ({props.placing.panels} of {props.placing.of} down)
              </span>
              .
            </>
          ) : (
            <>
              Click to lay panels.{" "}
              <span className="tabular-nums text-sun-line">
                {props.placing.panels} panel{props.placing.panels === 1 ? "" : "s"}, {props.placing.kw} kW
              </span>{" "}
              down.
            </>
          )}
        </p>
      );
    switch (props.step) {
      case "house":
        if (!props.house) return null;
        return notIt || !props.house.found ? (
          <>
            <p>
              {props.house.found ? (
                "Which house is it?"
              ) : (
                <>
                  I can&apos;t find <span className="text-sun-line">{props.house.address}</span>: it isn&apos;t on the land register, and
                  Google&apos;s pin is on the street. Which house is it?
                </>
              )}
            </p>
            {props.house.nearby.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {props.house.nearby.map((h) => (
                  <button
                    key={`${h.line}|${h.lat}`}
                    type="button"
                    onClick={() => props.onHouse(h)}
                    className="flex items-baseline justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-white/90 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
                  >
                    <span className="truncate">{h.line}</span>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-white/50">{h.metres} m</span>
                  </button>
                ))}
              </div>
            )}
            <Actions>
              {props.canSearch && <Quiet onClick={() => props.onHouse("search")}>Search the address</Quiet>}
              <Quiet onClick={() => props.onHouse("self")}>I&apos;ll find the house myself</Quiet>
              {props.house.found && <Quiet onClick={() => setNotIt(false)}>Back</Quiet>}
            </Actions>
          </>
        ) : (
          <>
            <p>
              Is this the home? <span className="text-sun-line">{props.house.address}</span>
            </p>
            {props.house.doubt && <p className="mt-1 text-[12.5px] text-white/70">{props.house.doubt}</p>}
            <Actions>
              <Main onClick={() => props.onHouse("yes")}>Yes</Main>
              <Quiet onClick={() => setNotIt(true)}>No</Quiet>
            </Actions>
          </>
        );
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
              <Main
                onClick={() =>
                  home.phase && home.storeys && home.roof
                    ? props.onHome({ phase: home.phase, storeys: home.storeys, roof: home.roof })
                    : setTried(true)
                }
              >
                Next
              </Main>
              {tried && (!home.phase || !home.storeys || !home.roof) && (
                <span role="status" className="self-center text-[12.5px] text-sun-line">
                  Pick{" "}
                  {[!home.phase && "single or three phase", !home.storeys && "single or double storey", !home.roof && "the roof"]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  first.
                </span>
              )}
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
                value={kliplok === null ? null : kliplok ? "yes" : "no"}
                onPick={(v) => setKliplok(v === "yes")}
              />
              {/* A flat roof has a natural fall of about 2°, so laid flat reads as 2° (15 Nov 2026, Martin); the rest are tilt frames. */}
              <Choice
                options={[
                  ["2", "Flat · 2°"],
                  ["10", "Tilt 10°"],
                  ["15", "Tilt 15°"],
                  ["25", "Tilt 25°"],
                  ["30", "Tilt 30°"],
                ]}
                value={tilt === undefined ? null : String(tilt ?? 2)}
                onPick={(v) => setTilt(v === "2" ? null : Number(v))}
              />
            </div>
            <Actions>
              <Main onClick={() => (kliplok !== null && tilt !== undefined ? props.onFlat({ kliplok, tilt }) : setTried(true))}>Next</Main>
              {tried && (kliplok === null || tilt === undefined) && (
                <span role="status" className="self-center text-[12.5px] text-sun-line">
                  Pick {[kliplok === null && "Kliplok or not", tilt === undefined && "flat or a tilt"].filter(Boolean).join(", ")} first.
                </span>
              )}
            </Actions>
          </>
        );
      case "target": {
        // Their bill, or a system size (12 Nov 2026, Martin): the bill as an amount a month, two months or quarter, or
        // uploaded; the size as kW, the battery then proposing itself from the panels' spare.
        const kwNow = Number(kw);
        const batt = batteryForKw(kwNow, props.dailyKwh);
        const one = batt ? batt.freeKwh === batt.solarKwh : true;
        const aim = () => {
          if (!(kwNow > 0) || !battPick || !batt) return;
          const k = Math.round(kwNow * 100) / 100;
          if (battPick === "none") return props.onTarget({ kw: k, kwh: 0 });
          if (battPick === "other") return props.onTarget({ kw: k, kwh: Math.round(Number(otherKwh) * 10) / 10 });
          if (battPick === "free") return props.onTarget({ kw: k, kwh: batt.freeKwh });
          if (battPick === "both" && !one) return props.onTarget({ kw: k, kwh: batt.solarKwh, freeKwh: batt.freeKwh });
          return props.onTarget({ kw: k, kwh: batt.solarKwh });
        };
        if (targetPart === "battery" && batt && kwNow > 0)
          return (
            <>
              <p>
                {Math.round(kwNow * 100) / 100} kW of panels. Now the battery: {batteryWords(batt)}
              </p>
              <div className="mt-2 grid gap-2">
                <Choice
                  options={[
                    ["none", "No battery"],
                    ["solar", `${batt.solarKwh} kWh battery`],
                    ...(one
                      ? []
                      : ([
                          ["free", `${batt.freeKwh} kWh with the ${FREE_HOURS} free hours`],
                          ["both", "Both, as two options"],
                        ] as [string, string][])),
                    ["other", "Another size"],
                  ]}
                  value={battPick}
                  onPick={(v) => setBattPick(v as typeof battPick)}
                />
                {battPick === "other" && <Field label="kWh battery" value={otherKwh} onChange={setOtherKwh} />}
                <p className="text-[12px] text-white/55">
                  {one
                    ? `The ${FREE_HOURS} free hours wouldn't change it: this battery already holds their evenings.`
                    : `${freeHoursWords(batt)} Both makes an option of each, with its own price.`}
                </p>
              </div>
              <Actions>
                <Main disabled={!battPick || (battPick === "other" && !(Number(otherKwh) > 0))} onClick={aim}>
                  Aim for this
                </Main>
                <Quiet onClick={() => setTargetPart("size")}>Back</Quiet>
              </Actions>
            </>
          );
        return (
          <>
            <p>{targetWords(props.first, props.suggested)}</p>
            <div className="mt-2 grid gap-2">
              {/* With the bill known Sol has already said what it comes to: the only thing to offer is changing it
                  (12 Nov 2026, Martin: "Their bill" and "A system size" read as a question already answered). */}
              {props.suggested ? (
                mode !== "bill" && (
                  <div>
                    <Quiet onClick={() => setMode("bill")}>Update the bill</Quiet>
                  </div>
                )
              ) : (
                <Choice
                  options={[
                    ["bill", "Nominate bill amount"],
                    ["size", "Set system size"],
                  ]}
                  value={mode}
                  onPick={(v) => {
                    setMode(v as "bill" | "size");
                    setKw(null);
                  }}
                />
              )}
              {mode === "bill" && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-[15px] text-white/70">
                      $
                      <input
                        value={props.bill.amount}
                        onChange={(e) => {
                          setKw(null);
                          props.onBill({ amount: e.target.value.replace(/[^0-9.]/g, "").slice(0, 7) });
                        }}
                        inputMode="decimal"
                        placeholder="0"
                        aria-label="The bill's amount"
                        className="h-9 w-24 rounded-xl bg-white/10 px-2.5 text-[15px] tabular-nums text-white outline-none ring-1 ring-white/15 placeholder:text-white/35 focus:ring-2 focus:ring-sun-line"
                      />
                    </label>
                    <Choice
                      options={[
                        ["monthly", "Monthly"],
                        ["bimonthly", "2 monthly"],
                        ["quarterly", "Quarterly"],
                      ]}
                      value={props.bill.interval === "annual" ? null : props.bill.interval}
                      onPick={(v) => {
                        setKw(null);
                        props.onBill({ interval: v as "monthly" | "bimonthly" | "quarterly" });
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label className="cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium text-white/80 ring-1 ring-white/20 hover:bg-white/10 hover:text-white">
                      {props.reading?.busy ? "Reading the bill…" : "Upload the bill"}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="sr-only"
                        disabled={props.reading?.busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) props.onUpload(file);
                        }}
                      />
                    </label>
                    {props.canFind && <Quiet onClick={props.onFind}>{props.finding ? "Looking…" : "Find it in their file"}</Quiet>}
                  </div>
                  {props.reading?.error && <p className="text-[12.5px] text-[#ffb4a0]">{props.reading.error}</p>}
                  {props.dailyKwh !== null && (
                    <p className="text-[12.5px] text-white/70">
                      About {Math.round(props.dailyKwh * 10) / 10} kWh a day.
                      {props.suggested && ` I'd aim for ${props.suggested.kw} kW of panels.`}
                    </p>
                  )}
                </>
              )}
              {(mode === "size" || props.suggested) && <Field label="kW of panels" value={kw} onChange={setKw} />}
            </div>
            <Actions>
              {/* With no battery to offer (no use known for the size), the size alone is the target. */}
              <Main
                disabled={!(kwNow > 0)}
                onClick={() => (batt ? setTargetPart("battery") : props.onTarget({ kw: Math.round(kwNow * 100) / 100, kwh: 0 }))}
              >
                {batt ? "Next: the battery" : "Aim for this"}
              </Main>
              <Quiet onClick={() => props.onTarget(null)}>No target</Quiet>
            </Actions>
          </>
        );
      }
      case "existing":
        return (
          <>
            <p>
              I think there are panels on this roof already (marked on the picture). Are they being replaced, or do we work around them?
            </p>
            <Actions>
              <Quiet onClick={() => props.onExisting(true)}>Replace them</Quiet>
              <Quiet onClick={() => props.onExisting(false)}>Work around them</Quiet>
              <Quiet onClick={() => props.onExisting("none")}>There aren&apos;t any</Quiet>
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
                ? `Let's lay the panels: about ${props.target.kw} kW. Your pointer lays them, and I'll count down to the target.`
                : "Let's lay the panels. Your pointer lays them, and I'll keep count."}
            </p>
            <Actions>
              <Main onClick={() => props.onPlace()}>Start laying</Main>
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
      case "shade":
        return shading ? (
          <>
            <p>Running the shade analysis…</p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Shade analysis">
              <div className="sol-shade-bar h-full rounded-full bg-sun-line" style={{ animationDuration: `${SHADE_LOAD_MS}ms` }} />
            </div>
          </>
        ) : (
          <>
            <p>Commence the shade analysis? I&apos;ll show how much of the year&apos;s sun reaches each panel.</p>
            <Actions>
              <Main onClick={commenceShade}>Yes</Main>
              <Quiet onClick={() => props.onShade(false)}>No</Quiet>
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
      case "unstrung":
        if (!props.unstrung) return null;
        return (
          <>
            <p>{unstrungWords(props.unstrung.left, props.unstrung.why)}</p>
            <Actions>
              {wantsInputs(props.unstrung.why) && <Main onClick={() => props.onUnstrung("inverter")}>An inverter with more inputs</Main>}
              <Quiet onClick={() => props.onUnstrung("remove")}>Take them off</Quiet>
              <Quiet onClick={() => props.onUnstrung("hand")}>I&apos;ll string them</Quiet>
              <Quiet onClick={() => props.onUnstrung("leave")}>Leave them</Quiet>
            </Actions>
          </>
        );
      case "battery":
        if (props.target?.freeKwh && props.batteryName && props.batteryKit) {
          const lines = versionLines(props.batteryKit, props.freeBatteryKit ?? null, props.target.freeKwh);
          return (
            <>
              <p>Two versions:</p>
              <ul className="mt-1.5 space-y-1">
                <li className="flex gap-2">
                  <span className="shrink-0 font-semibold text-sun-line">v1</span>
                  <span>{lines.v1}</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-semibold text-sun-line">v2</span>
                  <span>{lines.v2}</span>
                </li>
              </ul>
              <p className="mt-1.5">Make a design for each?</p>
              <Actions>
                <Main onClick={() => props.onBattery("both")}>Make both</Main>
                <Quiet onClick={() => props.onBattery("pair")}>With and without a battery</Quiet>
                <Quiet onClick={() => props.onBattery(true)}>Just v1</Quiet>
                <Quiet onClick={() => props.onBattery("choose")}>Choose one</Quiet>
                <Quiet onClick={() => props.onBattery(false)}>No battery</Quiet>
              </Actions>
            </>
          );
        }
        return (
          <>
            <p>
              {props.batteryName
                ? `The battery: the ${props.batteryName}, about ${props.target?.kwh} kWh.`
                : `Now the battery: about ${props.target?.kwh} kWh.`}
            </p>
            <Actions>
              {props.batteryName && <Main onClick={() => props.onBattery(true)}>Add it</Main>}
              {props.batteryName && <Quiet onClick={() => props.onBattery("pair")}>With and without, as two options</Quiet>}
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
              <Quiet onClick={() => props.onBackup("both")}>Both, as two options</Quiet>
            </Actions>
          </>
        );
      default:
        return null;
    }
  })();
  if (!body) return null;
  return (
    <div
      data-popup
      className="pointer-events-auto w-[min(46rem,calc(100%-2rem))] rounded-[22px] bg-primary/95 px-4 py-2.5 text-[13px] text-white shadow-[0_18px_50px_rgba(11,11,12,0.4)] ring-1 ring-white/10 backdrop-blur-md"
    >
      <div className="flex items-start gap-2.5">
        <SolIcon className="mt-0.5 size-4 shrink-0 text-sun-line" />
        <div className="min-w-0 flex-1 leading-snug">{body}</div>
        {props.onBack && (
          <button
            type="button"
            onClick={props.onBack}
            aria-label="Back to the last question"
            title="Back: change the last answer"
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-white/55 hover:text-white"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        )}
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

function Choice({ options, value, onPick }: { options: [string, string][]; value: string | null; onPick: (v: string) => void }) {
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
            value === v ? "bg-sun-line text-white" : "text-white/80 ring-1 ring-white/20 hover:bg-white/10",
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
