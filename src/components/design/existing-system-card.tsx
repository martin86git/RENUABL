"use client";

/**
 * The system a home already has, in the designer (27 Nov 2026, Martin; rules in `existing-system.ts`): the card beside
 * the picture, and the fields Sol asks with when he sees panels on the roof already.
 */

import { useState } from "react";
import {
  EXISTING_DETAILS_QUESTION,
  EXISTING_KEPT,
  EXISTING_LIMITS,
  EXISTING_REMOVED,
  cleanExisting,
  inverterWords,
  type ExistingSystem,
} from "@/lib/domain/design/existing-system";

type Typed = { kw: string; inverterKw: string; inverter: string; batteryKwh: string };

const typedFrom = (e: ExistingSystem | null | undefined): Typed => ({
  kw: e?.kw ? String(e.kw) : "",
  inverterKw: e?.inverterKw ? String(e.inverterKw) : "",
  inverter: e?.inverter ?? "",
  batteryKwh: e?.batteryKwh ? String(e.batteryKwh) : "",
});

const figure = (v: string) => v.replace(/[^0-9.]/g, "").slice(0, 6);

/** The four fields, typed; `onChange` is given what they come to (null while nothing is known). */
function useTyped(start: ExistingSystem | null | undefined, onChange?: (e: ExistingSystem | null) => void) {
  const [typed, setTyped] = useState<Typed>(() => typedFrom(start));
  const set = (part: Partial<Typed>) => {
    const next = { ...typed, ...part };
    setTyped(next);
    onChange?.(cleanExisting(next));
  };
  return { typed, set, now: cleanExisting(typed) };
}

/**
 * The card beside the picture: on or off, what is there (the home's, the same on every design), and whether this design
 * keeps it or takes it off.
 */
export function ExistingSystemCard(props: {
  existing: ExistingSystem | null;
  /** This design takes it off. */
  out: boolean;
  /** What it makes on an average day while kept, kWh; null when nothing of it makes power. */
  dailyKwh: number | null;
  /** Sol saw panels on the roof in the picture, and nothing has been filled in yet. */
  seen?: boolean;
  onChange: (existing: ExistingSystem | null) => void;
  onOut: (out: boolean) => void;
}) {
  const [open, setOpen] = useState(Boolean(props.existing));
  const { typed, set, now } = useTyped(props.existing, props.onChange);
  const on = open || Boolean(props.existing);
  const box =
    "mt-1 h-9 w-full rounded-md border border-line bg-surface px-2.5 text-[16px] text-ink outline-none focus:border-ink sm:text-sm tabular-nums";
  return (
    <section className="rounded-lg border border-line bg-surface p-3" aria-label="Existing system on the home">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Existing system on the home</p>
          <p className="text-xs text-muted">
            {props.seen && !on ? "Sol sees panels on this roof already: fill in what is there." : "Solar or a battery the home already has"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="The home has a system already"
          onClick={() => {
            if (on) {
              setOpen(false);
              set({ kw: "", inverterKw: "", inverter: "", batteryKwh: "" });
            } else setOpen(true);
          }}
          className={`tap-area relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-line"}`}
        >
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
        </button>
      </div>
      {on && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-ink-2">
              Solar (kW of panels)
              <input value={typed.kw} onChange={(e) => set({ kw: figure(e.target.value) })} inputMode="decimal" className={box} />
            </label>
            <label className="text-xs font-medium text-ink-2">
              Inverter (kW)
              <input
                value={typed.inverterKw}
                onChange={(e) => set({ inverterKw: figure(e.target.value) })}
                inputMode="decimal"
                className={box}
              />
            </label>
            <label className="col-span-2 text-xs font-medium text-ink-2">
              Inverter, as written on it
              <input
                value={typed.inverter}
                onChange={(e) => set({ inverter: e.target.value.slice(0, EXISTING_LIMITS.inverter) })}
                placeholder="Maker and model"
                className={box.replace(" tabular-nums", "")}
              />
            </label>
            <label className="text-xs font-medium text-ink-2">
              Battery (kWh)
              <input
                value={typed.batteryKwh}
                onChange={(e) => set({ batteryKwh: figure(e.target.value) })}
                inputMode="decimal"
                className={box}
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-muted">For the home: the same on every design. Saved with the design.</p>
          {now && inverterWords(now) && <p className="mt-2 rounded-md bg-canvas px-2.5 py-2 text-xs text-ink-2">{inverterWords(now)}</p>}
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">This design</p>
            <div className="flex rounded-full border border-line p-0.5" role="group" aria-label="This design keeps it or removes it">
              {(
                [
                  [false, "Keeps it"],
                  [true, "Removes it"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={props.out === value}
                  onClick={() => props.onOut(value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${props.out === value ? "bg-primary text-white" : "text-ink-2 hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            {props.out ? EXISTING_REMOVED : EXISTING_KEPT}
            {!props.out && props.dailyKwh
              ? ` About ${props.dailyKwh} kWh a day from its panels, taken as a north roof with no shade: an estimate.`
              : ""}
          </p>
        </>
      )}
    </section>
  );
}

/**
 * What Sol asks once the existing panels are staying: what is there. On his dark card. `onDone` is given what was typed
 * (null when nothing was, or "I don't know yet").
 */
export function ExistingAsk(props: { existing: ExistingSystem | null; onDone: (existing: ExistingSystem | null) => void }) {
  const { typed, set, now } = useTyped(props.existing);
  const box = "h-9 rounded-xl bg-white/10 px-2.5 text-[15px] text-white outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-sun-line";
  const label = "flex items-center gap-1.5 text-[12.5px] text-white/70";
  return (
    <>
      <p>{EXISTING_DETAILS_QUESTION}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className={label}>
          <input
            value={typed.kw}
            onChange={(e) => set({ kw: figure(e.target.value) })}
            inputMode="decimal"
            className={`${box} w-20 tabular-nums`}
          />
          kW of panels
        </label>
        <label className={label}>
          <input
            value={typed.inverterKw}
            onChange={(e) => set({ inverterKw: figure(e.target.value) })}
            inputMode="decimal"
            className={`${box} w-20 tabular-nums`}
          />
          kW inverter
        </label>
        <label className={label}>
          <input
            value={typed.batteryKwh}
            onChange={(e) => set({ batteryKwh: figure(e.target.value) })}
            inputMode="decimal"
            className={`${box} w-20 tabular-nums`}
          />
          kWh battery, if any
        </label>
        <label className={`${label} w-full`}>
          <input
            value={typed.inverter}
            onChange={(e) => set({ inverter: e.target.value.slice(0, EXISTING_LIMITS.inverter) })}
            placeholder="Inverter, as written on it"
            className={`${box} min-w-0 flex-1 placeholder:text-white/40`}
          />
        </label>
      </div>
      {now && inverterWords(now) && <p className="mt-2 text-[12.5px] text-white/70">{inverterWords(now)}</p>}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={!now}
          onClick={() => props.onDone(now)}
          className="rounded-full bg-sun-line px-3.5 py-1.5 text-[13px] font-medium text-white hover:brightness-110 disabled:bg-white/15 disabled:text-white/50"
        >
          Count it in
        </button>
        <button
          type="button"
          onClick={() => props.onDone(null)}
          className="rounded-full px-3 py-1.5 text-[13px] font-medium text-white/80 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
        >
          I don&apos;t know yet
        </button>
      </div>
    </>
  );
}
