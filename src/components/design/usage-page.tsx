"use client";

/**
 * Settings → Business → Usage (23 Nov 2026, Martin: usage "locatable for the admin", as instant.one's plan page and
 * Grok's Usage & Billing show it): this month's meters with how much is used, what happens beyond each allowance, and
 * Sol's use by day, by what it was for or who asked. Read only; buying more is the owner's, in Billing.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { beyondWords, daysOf, METER_WORDS, percentWords, stackSol, type Stack } from "@/lib/domain/design/usage";
import { loadUsage, type MeterNow, type UsageState } from "@/lib/services/usage";
import { settingsPath } from "./settings-list";
import { ui } from "./design-shell";

/** Categorical series in fixed order (the dataviz reference palette, validated): never cycled, an eighth is "Other". */
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];
const OTHER = "#9a9aa0";

const fullDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });

/** A meter's bar colour: graphite as it goes, the signal colour from 80%, red once used. */
const barTone = (p: number) => (p >= 100 ? "bg-danger" : p >= 80 ? "bg-sun-line" : "bg-primary");

export function UsagePage() {
  const [state, setState] = useState<UsageState | { error: string } | null>(null);
  useEffect(() => {
    void loadUsage().then(setState);
  }, []);
  return (
    <div className={clsx(ui.page, "max-w-4xl space-y-6")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={ui.eyebrow}>Settings</p>
          <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Usage</h1>
          {state && !("error" in state) && (
            <p className="mt-1 text-sm text-ink-2">
              This month · ends {state.ends} · {state.daysLeft} {state.daysLeft === 1 ? "day" : "days"} left
            </p>
          )}
        </div>
        <Link href={settingsPath("billing")} className={ui.quiet}>
          Billing and invoices
        </Link>
      </div>
      {!state ? (
        <div className="min-h-[30dvh]" aria-busy="true" />
      ) : "error" in state ? (
        <p className="text-sm text-ink-2">{state.error}</p>
      ) : (
        <Body s={state} />
      )}
    </div>
  );
}

function Body({ s }: { s: UsageState }) {
  return (
    <>
      {s.meters.length > 0 ? (
        <section
          className={clsx(ui.card, "grid divide-line p-0 sm:grid-cols-3 sm:divide-x max-sm:divide-y")}
          aria-label="This month's allowances"
        >
          {s.meters.map((m) => (
            <MeterTile key={m.key} m={m} s={s} />
          ))}
        </section>
      ) : (
        <p className={clsx(ui.card, "p-5 text-sm text-ink-2")}>
          Nothing here is counted against an allowance this month. Sol credits come with a plan, and free minutes and texts with Calls &amp;
          Texts.
        </p>
      )}
      <section className={clsx(ui.card, "flex flex-wrap items-baseline justify-between gap-3 p-5")}>
        <div>
          <h2 className="text-sm font-medium text-ink-2">Design credits</h2>
          <p className="mt-1 text-[26px] font-semibold tabular-nums text-ink">${Math.max(0, Math.floor(s.designCredits))}</p>
          <p className="text-xs text-muted">Taken as a roof is designed. They never expire.</p>
        </div>
        {s.owner && (
          <Link href={settingsPath("billing")} className={ui.quiet}>
            Buy design credits
          </Link>
        )}
      </section>
      {s.meters.some((m) => m.key === "sol") && <SolChart s={s} />}
      {s.voice.on && <VoiceCharts s={s} />}
      <p className="text-xs leading-relaxed text-muted">
        The owner is emailed as each allowance passes 50%, 80% and 100% in a month. Allowances start again on the 1st, in Melbourne&rsquo;s
        time.
      </p>
    </>
  );
}

function MeterTile({ m, s }: { m: MeterNow; s: UsageState }) {
  const w = METER_WORDS[m.key];
  const share = Math.min(100, (m.used / Math.max(1, m.included)) * 100);
  return (
    <div className="space-y-3 p-5">
      <h2 className="text-sm font-medium text-ink-2">{w.label}</h2>
      <p className="flex items-baseline gap-2">
        <span className="text-[30px] font-semibold leading-none tabular-nums text-ink">{percentWords(m)}</span>
        <span className="text-sm text-muted">of {m.included.toLocaleString("en-AU")}</span>
      </p>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-line"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={m.included}
        aria-valuenow={m.used}
        aria-label={w.label}
      >
        <div className={clsx("h-full rounded-full", barTone(m.percent))} style={{ width: `${share}%` }} />
      </div>
      <p className="flex justify-between gap-2 text-xs text-ink-2">
        <span className="tabular-nums">
          {m.used.toLocaleString("en-AU")} {w.units} used
        </span>
        {m.key === "sol" && s.solBought > 0 && <span className="tabular-nums">+{s.solBought.toLocaleString("en-AU")} bought</span>}
      </p>
      <details className="text-xs leading-relaxed text-muted">
        <summary className="cursor-pointer text-ink-2 hover:text-ink">Beyond the allowance</summary>
        <p className="mt-1">{beyondWords(m.key, { solStops: false, capCents: s.voice.capCents })}</p>
      </details>
    </div>
  );
}

function SolChart({ s }: { s: UsageState }) {
  const [by, setBy] = useState<"use" | "person">("use");
  const stack = useMemo(() => stackSol(s.solDays, s.month, by), [s.solDays, s.month, by]);
  const sol = s.meters.find((m) => m.key === "sol");
  return (
    <section className={clsx(ui.card, "space-y-5 p-5 sm:p-6")} aria-labelledby="sol-use">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="sol-use" className="text-base font-semibold text-ink">
            Sol&rsquo;s use this month
          </h2>
          <p className="text-sm text-ink-2">
            {stack.total.toLocaleString("en-AU")} credits
            {sol ? ` · ${percentWords({ used: stack.total, included: sol.included })} of the month's` : ""}
          </p>
        </div>
        <div className="inline-flex rounded-full bg-ink/[0.06] p-1 text-sm" role="tablist" aria-label="Show Sol's use">
          {(
            [
              ["use", "By use"],
              ["person", "By person"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={by === k}
              onClick={() => setBy(k)}
              className={clsx(
                "rounded-full px-3 py-1 font-medium",
                by === k ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {stack.total === 0 ? (
        <p className="text-sm text-ink-2">Sol hasn&rsquo;t used any credits yet this month.</p>
      ) : (
        <>
          <ShareBar stack={stack} />
          <Legend stack={stack} />
          <DayBars stack={stack} today={s.today} unit="credits" />
        </>
      )}
    </section>
  );
}

const colourOf = (stack: Stack, key: string) =>
  key === "__other" ? OTHER : (SERIES[stack.series.findIndex((x) => x.key === key)] ?? OTHER);

/** The month's total split by series, one thin bar with a 2px gap between parts. */
function ShareBar({ stack }: { stack: Stack }) {
  return (
    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
      {stack.series.map((x) => (
        <div
          key={x.key}
          style={{ flexGrow: x.total, background: colourOf(stack, x.key) }}
          className="first:rounded-l-full last:rounded-r-full"
        />
      ))}
    </div>
  );
}

function Legend({ stack }: { stack: Stack }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
      {stack.series.map((x) => (
        <li key={x.key} className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: colourOf(stack, x.key) }} aria-hidden />
            <span className="truncate">{x.label}</span>
          </p>
          <p className="pl-[18px] text-sm font-medium tabular-nums text-ink">
            {Math.round((x.total / Math.max(1, stack.total)) * 1000) / 10}% · {x.total.toLocaleString("en-AU")}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** A column a day, stacked by series, with what each day came to on hover or focus. Days still to come are faint. */
function DayBars({ stack, today, unit }: { stack: Stack; today: string; unit: string }) {
  const [at, setAt] = useState<number | null>(null);
  const most = Math.max(1, ...stack.days.map((d) => d.total));
  const shown = at === null ? null : stack.days[at];
  return (
    <div className="space-y-2">
      <div className="relative flex h-40 items-end gap-[3px] border-b border-line" onMouseLeave={() => setAt(null)}>
        <span className="absolute left-0 top-0 text-[10px] tabular-nums text-muted">{most.toLocaleString("en-AU")}</span>
        {stack.days.map((d, i) => (
          <button
            key={d.day}
            type="button"
            className="group flex h-full flex-1 flex-col justify-end outline-none"
            onMouseEnter={() => setAt(i)}
            onFocus={() => setAt(i)}
            aria-label={`${fullDay(d.day)}: ${d.total} ${unit}`}
          >
            {d.day > today ? (
              <span className="block h-px w-full bg-line" />
            ) : (
              <span
                className={clsx("flex w-full flex-col-reverse gap-px", at === i && "opacity-80")}
                style={{ height: `${(d.total / most) * 100}%` }}
              >
                {stack.series.map((x) =>
                  d.values[x.key] ? (
                    <span
                      key={x.key}
                      className="block w-full first:rounded-b-[2px] last:rounded-t-[3px]"
                      style={{ flexGrow: d.values[x.key], background: colourOf(stack, x.key) }}
                    />
                  ) : null,
                )}
              </span>
            )}
          </button>
        ))}
        {shown && (
          <div className="pointer-events-none absolute right-0 top-0 z-10 min-w-40 rounded-lg bg-surface p-3 text-xs shadow-lg ring-1 ring-line">
            <p className="font-medium text-ink">{fullDay(shown.day)}</p>
            <p className="mb-1 tabular-nums text-ink-2">
              {shown.total.toLocaleString("en-AU")} {unit}
            </p>
            {stack.series
              .filter((x) => shown.values[x.key])
              .map((x) => (
                <p key={x.key} className="flex items-center gap-2 text-ink-2">
                  <span className="size-2 rounded-sm" style={{ background: colourOf(stack, x.key) }} aria-hidden />
                  <span className="flex-1 truncate">{x.label}</span>
                  <span className="tabular-nums text-ink">{shown.values[x.key]}</span>
                </p>
              ))}
          </div>
        )}
      </div>
      {/* Dates under their own day, a week apart, so they line up with the bars above. */}
      <div className="relative h-3 text-[10px] tabular-nums text-muted" aria-hidden>
        {stack.days.map((d, i) =>
          i % 7 === 0 ? (
            <span key={d.day} className="absolute top-0" style={{ left: `${(i / stack.days.length) * 100}%` }}>
              {shortDay(d.day)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Calls & Texts by day: minutes and texts, each its own chart (two units never share an axis). */
function VoiceCharts({ s }: { s: UsageState }) {
  const one = (key: "minutes" | "texts"): Stack => {
    const by = new Map(s.voice.days.map((d) => [d.day, d[key]]));
    const days = daysOf(s.month).map((day) => {
      const n = by.get(day) ?? 0;
      return { day, values: n ? { [key]: n } : {}, total: n };
    });
    const total = days.reduce((t, d) => t + d.total, 0);
    return { series: [{ key, label: METER_WORDS[key].label, total }], days, total };
  };
  return (
    <section className={clsx(ui.card, "space-y-5 p-5 sm:p-6")} aria-labelledby="voice-use">
      <div>
        <h2 id="voice-use" className="text-base font-semibold text-ink">
          Calls &amp; Texts this month
        </h2>
        <p className="text-sm text-ink-2">
          {s.voice.charged
            ? s.voice.capCents > 0
              ? `Spending cap $${(s.voice.capCents / 100).toLocaleString("en-AU")} a month beyond the free allowance.`
              : "Spending cap $0: calls and texts stop at the free allowance."
            : "Included for your business: counted, never charged."}{" "}
          {s.owner && (
            <Link href={`${settingsPath("billing")}#add-ons`} className={ui.link}>
              Change the cap
            </Link>
          )}
        </p>
      </div>
      {!s.voice.days.length ? (
        <p className="text-sm text-ink-2">No voice agent minutes or texts yet this month.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {(["minutes", "texts"] as const).map((k) => {
            const st = one(k);
            return (
              <div key={k} className="space-y-2">
                <p className="text-sm text-ink-2">
                  {METER_WORDS[k].label} · <span className="font-medium tabular-nums text-ink">{st.total}</span>
                </p>
                <DayBars stack={st} today={s.today} unit={METER_WORDS[k].units} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
