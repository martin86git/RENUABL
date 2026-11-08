"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Calculator, X } from "lucide-react";
import { BILL_PERIODS, QUICK_DEFAULTS, quickSize, sumOf, sumWords, type BillPeriod } from "@/lib/domain/design/quick-size";

const num = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const box =
  "w-full rounded-lg bg-surface px-3 py-2 text-[14px] tabular-nums text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-sun-line";

/**
 * The calculator round in the top bar (8 Nov 2026, Martin: on the phone and asked a question, the answer has to be
 * instant, not a wait for Sol and a long reply): plain sums, and a bill or a day's use turned into a rough system at
 * once (`quickSize`). Nothing is sent anywhere; it is worked out in the page.
 */
export function QuickCalc({ place = "top" }: { place?: "top" | "rail" }) {
  const rail = place === "rail";
  const [open, setOpen] = useState(false);
  const [sum, setSum] = useState("");
  const [from, setFrom] = useState<"bill" | "kwh">("bill");
  const [bill, setBill] = useState("");
  const [period, setPeriod] = useState<BillPeriod>("quarter");
  const [kwh, setKwh] = useState("");
  const [rate, setRate] = useState(String(QUICK_DEFAULTS.rateCents));
  const [supply, setSupply] = useState(QUICK_DEFAULTS.supplyPerDay.toFixed(2));
  const wrap = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const away = (e: PointerEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", key);
    document.addEventListener("pointerdown", away);
    return () => {
      window.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", away);
    };
  }, [open]);

  const answer = sum.trim() ? sumOf(sum) : null;
  const size = quickSize(
    from === "kwh"
      ? { kwhPerDay: num(kwh) }
      : { bill: num(bill), period, rateCents: num(rate) ?? QUICK_DEFAULTS.rateCents, supplyPerDay: Number(supply) || 0 },
  );

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Calculator"
        title="Calculator: sums, and a system from a bill"
        className={clsx(
          "flex items-center justify-center rounded-full transition-colors",
          // On the rail, a round like its others; in the top bar, ringed like the bar's.
          rail ? "size-10" : "size-9 ring-1",
          open
            ? "bg-ink text-sun-line ring-ink"
            : rail
              ? "text-ink-2 hover:bg-canvas hover:text-ink"
              : "bg-surface text-ink-2 ring-line hover:text-ink",
        )}
      >
        <Calculator className={rail ? "size-[18px]" : "size-4"} aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Calculator"
          className={clsx(
            // From the rail it opens to its left, beside the round; from the top bar, under it.
            rail ? "absolute right-full top-0 mr-3" : "absolute right-0 top-11",
            "z-[60] w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl bg-canvas p-4 shadow-[0_16px_48px_rgba(20,22,26,0.22)] ring-1 ring-line",
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-ink">Calculator</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 text-muted hover:text-ink">
              <X className="size-4" />
            </button>
          </div>

          <label className="mt-3 block">
            <span className="text-[11.5px] font-medium uppercase tracking-wide text-muted">A sum</span>
            <input
              ref={first}
              value={sum}
              onChange={(e) => setSum(e.target.value)}
              inputMode="decimal"
              placeholder="450 * 4 / 365"
              className={clsx(box, "mt-1 font-mono")}
            />
          </label>
          {sum.trim() && (
            <p className={clsx("mt-1.5 text-right font-mono text-[20px] tabular-nums", answer === null ? "text-muted" : "text-ink")}>
              {answer === null ? "…" : `= ${sumWords(answer)}`}
            </p>
          )}

          <div className="mt-4 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] font-medium uppercase tracking-wide text-muted">A system from</span>
              <div role="radiogroup" aria-label="Work it out from" className="flex rounded-full bg-surface-2 p-0.5 text-[12px] font-medium">
                {(
                  [
                    ["bill", "The bill"],
                    ["kwh", "kWh a day"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={from === id}
                    onClick={() => setFrom(id)}
                    className={clsx("rounded-full px-3 py-1", from === id ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {from === "bill" ? (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <label className="relative flex-1">
                    <span className="sr-only">The bill in dollars</span>
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted">$</span>
                    <input
                      value={bill}
                      onChange={(e) => setBill(e.target.value)}
                      inputMode="decimal"
                      placeholder="600"
                      className={clsx(box, "pl-6")}
                    />
                  </label>
                  <div role="radiogroup" aria-label="Billed every" className="flex rounded-lg bg-surface-2 p-0.5 text-[12px] font-medium">
                    {BILL_PERIODS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={period === p.id}
                        onClick={() => setPeriod(p.id)}
                        className={clsx("rounded-md px-2", period === p.id ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink")}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
                  at
                  <input
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    inputMode="decimal"
                    aria-label="Price per kWh in cents"
                    className="w-12 rounded-md bg-surface px-1.5 py-0.5 text-right tabular-nums ring-1 ring-line focus:outline-none focus:ring-sun-line"
                  />
                  c a kWh, $
                  <input
                    value={supply}
                    onChange={(e) => setSupply(e.target.value)}
                    inputMode="decimal"
                    aria-label="Supply charge a day in dollars"
                    className="w-14 rounded-md bg-surface px-1.5 py-0.5 text-right tabular-nums ring-1 ring-line focus:outline-none focus:ring-sun-line"
                  />
                  a day supply
                </p>
              </div>
            ) : (
              <label className="mt-2 block">
                <span className="sr-only">Use a day in kWh</span>
                <input
                  value={kwh}
                  onChange={(e) => setKwh(e.target.value)}
                  inputMode="decimal"
                  placeholder="18 kWh a day"
                  className={box}
                />
              </label>
            )}

            {size ? (
              <div className="mt-3 space-y-2" aria-live="polite">
                <p className="text-[12.5px] text-ink-2">
                  <span className="font-mono font-semibold text-ink">{size.kwhPerDay}</span> kWh a day ·{" "}
                  <span className="font-mono">{size.yearKwh.toLocaleString("en-AU")}</span> kWh a year
                  {size.fromBill ? " (from the bill)" : ""}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Result
                    title="Solar only"
                    big={`${size.solar.kw} kW`}
                    lines={[`${size.solar.panels} × ${QUICK_DEFAULTS.panelWatts} W panels`, `${size.solar.inverterKw} kW inverter`]}
                  />
                  <Result
                    title="With a battery"
                    big={`${size.withBattery.batteryKwh} kWh`}
                    lines={[
                      `${size.withBattery.kw} kW solar · ${size.withBattery.panels} panels`,
                      `${size.withBattery.inverterKw} kW hybrid inverter`,
                      `${size.withBattery.eveningKwh} kWh used after dark`,
                    ]}
                    lit
                  />
                </div>
                {size.capped && <p className="text-[12px] text-sun-ink">That&apos;s a large home: worth a proper look in the designer.</p>}
                <p className="text-[11px] leading-snug text-muted">
                  A rule of thumb on Melbourne&apos;s average sunshine, 40% used as it&apos;s made, the battery 90% usable. The design firms
                  it up.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[12.5px] text-muted">
                {from === "bill"
                  ? "Type the bill and it works out the system as you go."
                  : "Type a day's use and it works out the system as you go."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Result({ title, big, lines, lit }: { title: string; big: string; lines: string[]; lit?: boolean }) {
  return (
    <div className={clsx("rounded-xl p-3 ring-1", lit ? "bg-surface ring-sun-line/50" : "bg-surface ring-line")}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{title}</p>
      <p className={clsx("mt-0.5 font-mono text-[22px] font-semibold tabular-nums", lit ? "text-sun-line" : "text-ink")}>{big}</p>
      <ul className="mt-1 space-y-0.5 text-[11.5px] leading-snug text-ink-2">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
