"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { ArrowRight, BatteryCharging, Check, CalendarDays, Sun } from "lucide-react";
import { themeVars } from "@/lib/domain/design/brand";
import { isConfigKey, nearestVariant, type ConfigKey } from "@/lib/domain/design/configurator";
import {
  INDICATIVE_LABEL,
  INDICATIVE_PRICE_NOTE,
  SAVING_NOTE,
  STC_NOTE,
  acceptLine,
  viewForChoice,
  type OptionKey,
  type ProposalState,
  type ProposalView,
} from "@/lib/domain/design/proposal";
import { acceptProposal, holdInstallWeek, proposalUrls, tellOpened } from "@/lib/services/proposals";
import { Roof } from "./proposal-view";

const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const eyebrow = "text-[11px] font-medium uppercase tracking-[0.16em] text-muted";

/**
 * The proposal as a configurator (19 Nov 2026, Martin: "what would our proposal look like if the Tesla team took it
 * over"), at `/p/<token>/configure`, beside the proposal page, never in place of it. The home from above stays on the
 * left and changes as they choose; a few choices on the right (the size, the panel, a battery, the install week); one
 * price in a bar along the foot that moves with them; and one small step. On an indicative proposal that step is
 * holding the first free install week, which charges nothing and agrees nothing; on a final one it is going ahead,
 * with the same name and tick as the proposal page. Every figure is one the server priced when the proposal was
 * published (`ProposalView.configurator`): nothing is worked out here.
 */
export function ConfiguratorPage(props: {
  token: string;
  view: ProposalView;
  state: ProposalState;
  accepted: { name: string; at: string; option?: OptionKey | null } | null;
  week: { monday: string; label: string } | null;
  held: { monday: string; label: string } | null;
}) {
  const { token, view } = props;
  const cfg = view.configurator!;
  const urls = useMemo(() => proposalUrls(token), [token]);
  useEffect(() => tellOpened(token), [token]);

  const [state, setState] = useState(props.state);
  const [accepted, setAccepted] = useState(props.accepted);
  const [held, setHeld] = useState(props.held);
  // Where they start: what they went ahead with, else the business's recommendation as designed.
  const opening = cfg.variants.find((v) => v.goal === (isConfigKey(accepted?.option) ? accepted?.option : cfg.start)) ?? cfg.variants[0];
  const [size, setSize] = useState(opening.size);
  const [panel, setPanel] = useState(opening.panel);
  const [battery, setBattery] = useState(opening.battery);
  const mix = nearestVariant(cfg, size, panel, battery) ?? opening;
  const shown = viewForChoice(view, mix.goal);
  const locked = state !== "live";
  const batteryFor = cfg.batteries.find((b) => b.size === mix.size) ?? null;
  const sizeOf = cfg.sizes.find((s) => s.id === mix.size)!;
  const panelOf = cfg.panels.find((p) => p.id === mix.panel)!;
  const pickable = (s: number, p: number) => cfg.variants.some((v) => v.size === s && v.panel === p);

  const headline = `${shown.system.kw} kW solar${shown.system.batteryKwh ? ` with a ${shown.system.batteryKwh} kWh battery` : ""}`;
  const saving = shown.bill && shown.bill.saving > 0 ? shown.bill.saving : null;

  return (
    <div
      style={themeVars(view.theme) as React.CSSProperties}
      className="min-h-dvh bg-canvas pb-40 text-ink [color-scheme:light] [font-family:var(--proposal-body)] lg:pb-28"
    >
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        {view.business.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- the business's own picture, served by our own route
          <img
            src={urls.image(view.business.logo.id)}
            alt={view.business.name}
            className="h-9 w-auto max-w-[180px] object-contain object-left"
          />
        ) : (
          <span className="text-[17px] font-semibold tracking-tight">{view.business.name}</span>
        )}
        <Link
          href={`/p/${encodeURIComponent(token)}`}
          className="tap-area inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline-offset-4 hover:underline"
        >
          The full proposal <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-12">
        {/* The home: it stays in view on a wide screen and changes as they choose. */}
        <section aria-label="Your home" className="lg:sticky lg:top-6 lg:self-start">
          <p className={eyebrow}>
            {view.indicative ? INDICATIVE_LABEL : "Your proposal"} · {view.customer.name}
          </p>
          <h1 className="mt-2 text-[28px] leading-[1.1] tracking-tight [font-family:var(--proposal-heading)] sm:text-[40px]">{headline}</h1>
          <p className="mt-2 text-[14px] text-muted">{view.customer.address}</p>
          <div key={mix.size} className="cfg-fade mt-6">
            <Roof view={shown} src={urls.roof} frame={cfg.sizes[0]?.roofPanels} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Figure big={`${sizeOf.panels}`} small="panels" />
            <Figure big={shown.production ? `${shown.production.yearKwh.toLocaleString("en-AU")}` : "—"} small="kWh a year, estimated" />
            <Figure
              big={shown.system.batteryKwh ? `${shown.system.batteryKwh} kWh` : "None"}
              small={shown.system.batteryKwh ? "battery for your evenings" : "battery"}
            />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            The layout is a design, checked on site before anything is installed. A different panel goes in the same places.
          </p>
        </section>

        {/* The choices. */}
        <section aria-label="Choose your system" className="space-y-9">
          <Step n={1} title="Size">
            <div className="space-y-2.5">
              {cfg.sizes.map((s) => {
                const v = nearestVariant(cfg, s.id, panel, battery);
                return (
                  <Choice
                    key={s.id}
                    on={mix.size === s.id}
                    disabled={locked}
                    onPick={() => setSize(s.id)}
                    title={s.name}
                    note={`${v ? `${v.system.kw} kW · ` : ""}${s.panels} panels${s.note ? ` · ${s.note}` : ""}`}
                    side={v ? dollars(v.price.youPay) : ""}
                  />
                );
              })}
            </div>
          </Step>

          <Step n={2} title="Panels">
            {cfg.panels.length > 1 ? (
              <div className="space-y-2.5">
                {cfg.panels.map((p) => (
                  <Choice
                    key={p.id}
                    on={mix.panel === p.id}
                    disabled={locked || !pickable(mix.size, p.id)}
                    onPick={() => setPanel(p.id)}
                    title={p.maker}
                    note={`${p.watts} W · ${p.name}`}
                    side={p.id === 0 ? "As designed" : ""}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-ink">
                {panelOf.name} · {panelOf.watts} W
              </p>
            )}
          </Step>

          <Step n={3} title="Battery">
            {batteryFor ? (
              <div className="grid grid-cols-2 gap-2.5">
                <Choice
                  on={mix.battery}
                  disabled={locked}
                  onPick={() => setBattery(true)}
                  title={`${batteryFor.kwh} kWh`}
                  note={
                    batteryFor.backup
                      ? "Runs your evenings, and keeps chosen circuits on in a blackout"
                      : "Stores the day's sun for your evenings"
                  }
                  icon={<BatteryCharging className="size-4" aria-hidden />}
                />
                <Choice
                  on={!mix.battery}
                  disabled={locked}
                  onPick={() => setBattery(false)}
                  title="No battery"
                  note="Solar only. A battery can be added later."
                />
              </div>
            ) : (
              <p className="text-[14px] text-muted">
                A battery isn&apos;t offered with this size. Ask us in the chat if you&apos;d like one.
              </p>
            )}
          </Step>

          <Step n={4} title="Installation">
            <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
              <CalendarDays className="mt-0.5 size-5 shrink-0 text-[color:var(--primary)]" aria-hidden />
              <div>
                <p className="text-[15px] font-medium text-ink">
                  {held
                    ? `Held for you: ${held.label}`
                    : props.week
                      ? `Installs from ${props.week.label}`
                      : "We'll find your installation week with you"}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                  {view.indicative
                    ? "Hold it now: nothing is charged and nothing is agreed. We confirm the design, the price and the day when we visit your home."
                    : "Confirmed with you once you go ahead, subject to approvals."}
                </p>
              </div>
            </div>
          </Step>

          <Step n={5} title="Price">
            <div className="rounded-2xl border border-line bg-surface p-4 text-[14px]">
              <Row label="System, installed (GST included)" value={dollars(shown.price.incGst)} />
              <Row label="Federal rebate (STCs)" value={`− ${dollars(shown.price.stc)}`} />
              <Row label="You pay" value={dollars(shown.price.youPay)} strong />
              {saving && shown.paybackYears && (
                <p className="mt-3 flex items-start gap-2 text-[13px] text-muted">
                  <Sun className="mt-0.5 size-4 shrink-0" aria-hidden />
                  About {dollars(saving)} off your power bills a year, paying for itself in about {shown.paybackYears} years. Estimates.
                </p>
              )}
              {shown.price.solarVic && <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{shown.price.solarVic.note}</p>}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              {view.indicative ? `${INDICATIVE_PRICE_NOTE} ` : ""}
              {STC_NOTE} {saving ? SAVING_NOTE : ""}
            </p>
          </Step>
        </section>
      </main>

      <PriceBar
        token={token}
        view={view}
        shown={shown}
        mix={mix.goal}
        saving={saving}
        state={state}
        accepted={accepted}
        held={held}
        week={props.week}
        onHeld={setHeld}
        onAccepted={(name) => {
          setAccepted({ name, at: new Date().toISOString(), option: mix.goal });
          setState("accepted");
        }}
      />
      <style>{`@keyframes cfg-fade { from { opacity: .35 } to { opacity: 1 } } .cfg-fade { animation: cfg-fade .45s ease-out } @media (prefers-reduced-motion: reduce) { .cfg-fade { animation: none } }`}</style>
    </div>
  );
}

function Figure({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3">
      <p className="text-[18px] leading-none tracking-tight text-ink [font-variant-numeric:tabular-nums]">{big}</p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{small}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 flex items-baseline gap-2 text-[17px] font-medium tracking-tight [font-family:var(--proposal-heading)]">
        <span className="text-[12px] font-medium text-muted [font-variant-numeric:tabular-nums]">{String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Choice(props: {
  on: boolean;
  disabled?: boolean;
  onPick: () => void;
  title: string;
  note: string;
  side?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.on}
      disabled={props.disabled && !props.on}
      onClick={props.onPick}
      className={clsx(
        "flex w-full items-start gap-3 rounded-2xl border bg-surface px-4 py-3.5 text-left transition-[border-color,box-shadow]",
        props.on ? "border-transparent shadow-[0_0_0_2px_var(--primary)]" : "border-line hover:border-line-strong",
        props.disabled && !props.on && "opacity-50",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
          {props.icon}
          {props.title}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{props.note}</span>
      </span>
      {props.side && <span className="shrink-0 text-[13px] text-ink [font-variant-numeric:tabular-nums]">{props.side}</span>}
    </button>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={clsx("flex items-baseline justify-between gap-4 py-1.5", strong && "mt-1 border-t border-line pt-2.5")}>
      <span className={strong ? "font-medium text-ink" : "text-muted"}>{label}</span>
      <span className={clsx("text-ink [font-variant-numeric:tabular-nums]", strong && "text-[16px] font-semibold")}>{value}</span>
    </div>
  );
}

/** The price along the foot, with the one step: hold the week (indicative) or go ahead (final). */
function PriceBar(props: {
  token: string;
  view: ProposalView;
  shown: ProposalView;
  mix: ConfigKey;
  saving: number | null;
  state: ProposalState;
  accepted: { name: string; at: string; option?: OptionKey | null } | null;
  held: { monday: string; label: string } | null;
  week: { monday: string; label: string } | null;
  onHeld: (week: { monday: string; label: string }) => void;
  onAccepted: (name: string) => void;
}) {
  const { view, shown, state } = props;
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [going, setGoing] = useState(false);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);

  const hold = async () => {
    setBusy(true);
    setProblem(null);
    const res = await holdInstallWeek(props.token, props.mix);
    setBusy(false);
    if (!res.ok) return setProblem(res.message);
    props.onHeld(res.week);
  };
  const goAhead = async () => {
    setBusy(true);
    setProblem(null);
    const res = await acceptProposal(props.token, name, agree, props.mix);
    setBusy(false);
    if (!res.ok) return setProblem(res.message);
    props.onAccepted(name.trim());
  };

  const button = clsx(
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-medium text-[color:var(--primary-ink)] transition-opacity hover:opacity-90 disabled:bg-line-strong disabled:text-muted",
  );

  let action: React.ReactNode;
  if (state === "accepted")
    action = (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink">
          <Check className="size-4 text-positive" aria-hidden /> You&apos;re going ahead{props.accepted ? `, ${props.accepted.name}` : ""}
        </span>
        <Link href={`/p/${encodeURIComponent(props.token)}#pay`} className={button}>
          Next steps and payment
        </Link>
      </div>
    );
  else if (state === "lapsed")
    action = <p className="text-[13.5px] text-muted">This price has lapsed. Ask {view.business.name} for an up-to-date proposal.</p>;
  else if (state === "withdrawn") action = <p className="text-[13.5px] text-muted">This proposal isn&apos;t available any more.</p>;
  else if (view.indicative)
    action = (
      <button type="button" className={button} disabled={busy || !props.week} onClick={() => void hold()}>
        {busy ? "Holding…" : props.held ? "Hold it for this system" : "Hold my install week"}
      </button>
    );
  else
    action = (
      <button type="button" className={button} onClick={() => setGoing(true)}>
        Go ahead
      </button>
    );

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
      {going && state === "live" && !view.indicative && (
        <form
          className="mx-auto w-full max-w-7xl border-b border-line px-5 py-4 sm:px-8"
          onSubmit={(e) => {
            e.preventDefault();
            void goAhead();
          }}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="block min-w-0 flex-1 text-[13px] font-medium text-ink">
              Your full name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="mt-1.5 block h-11 w-full rounded-xl border border-line bg-canvas px-3 text-[15px] text-ink"
              />
            </label>
            <label className="flex flex-[2] items-start gap-2 text-[13px] leading-snug text-ink">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4" />
              <span>
                {acceptLine(view)}{" "}
                <Link href={`/p/${encodeURIComponent(props.token)}`} className="underline underline-offset-2">
                  Read the proposal and its terms
                </Link>
              </span>
            </label>
            <button type="submit" className={button} disabled={busy || !name.trim() || !agree}>
              {busy ? "Going ahead…" : `Go ahead · ${dollars(shown.price.youPay)}`}
            </button>
          </div>
        </form>
      )}
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3.5 sm:px-8">
        <div className="flex items-baseline gap-x-5 gap-y-1 max-sm:flex-col">
          <p>
            <span className="text-[24px] font-semibold tracking-tight [font-variant-numeric:tabular-nums]">
              {dollars(shown.price.youPay)}
            </span>{" "}
            <span className="text-[12.5px] text-muted">after the federal rebate</span>
          </p>
          {props.saving && <p className="text-[12.5px] text-muted">About {dollars(props.saving)} a year off your bills (estimate)</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {action}
          {problem && <p className="text-[12.5px] text-danger">{problem}</p>}
          {state === "live" && view.indicative && props.held && !problem && (
            <p className="text-[12px] text-muted">Held: {props.held.label}. We&apos;ll be in touch to book the visit.</p>
          )}
        </div>
      </div>
    </div>
  );
}
