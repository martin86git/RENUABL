"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Check, House, Plus, Receipt, ShieldCheck, Sun, UtilityPole } from "lucide-react";
import { announcementShows, themeVars } from "@/lib/domain/design/brand";
import { todayInMarket } from "@/lib/domain/market";
import { homeDay } from "@/lib/domain/design/home-day";
import { TILT } from "@/lib/domain/design/tilt";
import { ASSUMPTIONS } from "@/lib/domain/recommendation";
import {
  backupPick,
  batteriesFor,
  batteryOfVariant,
  invertersFor,
  isConfigKey,
  mixMarks,
  mixMarksWords,
  type MixMarks,
  nearestVariant,
  pickOf,
  readConfigurator,
  solarOnly,
  switchInverter,
  switchSize,
  type ConfigPick,
  type ConfigVariant,
  type ConfiguratorView,
} from "@/lib/domain/design/configurator";
import {
  INDICATIVE_LABEL,
  INDICATIVE_PRICE_NOTE,
  SAVING_NOTE,
  STC_NOTE,
  viewForChoice,
  type OptionKey,
  type ProposalState,
  type ProposalView,
} from "@/lib/domain/design/proposal";
import { proposalUrls, tellOpened } from "@/lib/services/proposals";
import { BatteryIcon, ChargerIcon, InverterIcon, PanelIcon } from "./deal-banner";
import { Roof } from "./proposal-view";
import { ShadeSummary } from "./shade-summary";

const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const cents = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const percent = (share: number) => `${Math.round(share * 100)}%`;

type Week = { monday: string; label: string };

/**
 * The proposal as a configurator (19 Nov 2026, Martin: "what would our proposal look like if the Tesla team took it
 * over"), at `/p/<token>/configure`, beside the proposal page, never in place of it. The home from above stays on the
 * left and changes as they choose, with a bar joined to it for what the system makes, how much of the home's power it
 * offsets (the battery's share lit on top of the panels') and the yearly saving, and the battery and charger drawn on
 * it when chosen. The choices on the right: the size, the panel, the battery and its maker, blackout backup, an EV
 * charger and the install week (four to choose from). One price in a bar along the foot, and Order, which opens the
 * plain order page (`/p/<token>/order`). Every figure is one the server priced when the proposal was published
 * (`ProposalView.configurator`): nothing is worked out here.
 */
export function ConfiguratorPage(props: {
  token: string;
  view: ProposalView;
  state: ProposalState;
  accepted: { name: string; at: string; option?: OptionKey | null } | null;
  weeks: Week[];
  held: Week | null;
  /** The mix and week to open on (coming back from the order page). */
  mix?: string | null;
  week?: string | null;
}) {
  const { token, view } = props;
  const cfg = useMemo(() => readConfigurator(view.configurator!), [view.configurator]);
  const urls = useMemo(() => proposalUrls(token), [token]);
  const router = useRouter();
  useEffect(() => tellOpened(token), [token]);

  const locked = props.state !== "live";
  // Where they start: what they ordered, else where they were, else the business's recommendation as designed.
  const opening =
    cfg.variants.find((v) => isConfigKey(props.accepted?.option) && v.goal === props.accepted?.option) ??
    cfg.variants.find((v) => v.goal === props.mix) ??
    cfg.variants.find((v) => v.goal === cfg.start) ??
    cfg.variants[0];
  const [pick, setPick] = useState<ConfigPick>(() => pickOf(opening));
  const mix = nearestVariant(cfg, pick) ?? opening;
  const shown = viewForChoice(view, mix.goal);
  const now = pickOf(mix);
  // Backup off takes the module kept for it away too: it is only ever offered with backup.
  const set = (patch: Partial<ConfigPick>) => setPick({ ...now, ...patch, ...(patch.backup === false ? { reserve: false } : {}) });
  const [week, setWeek] = useState<Week | null>(
    props.weeks.find((w) => w.monday === props.week) ?? props.weeks.find((w) => w.monday === props.held?.monday) ?? props.weeks[0] ?? null,
  );

  const invertersHere = invertersFor(cfg, mix.size);
  // On a proposal published before inverters could be chosen, the one on its system lines.
  const designedInverter = shown.system.details.find((d) => /inverter/i.test(d.label));
  const batteriesHere = batteriesFor(cfg, mix.size, now.inverter);
  const battery = batteryOfVariant(cfg, mix);
  const exists = (p: Partial<ConfigPick>) => {
    const want = { ...now, ...p };
    return cfg.variants.some((v) => {
      const q = pickOf(v);
      return (
        q.size === want.size &&
        q.panel === want.panel &&
        q.inverter === want.inverter &&
        q.battery === want.battery &&
        q.extra === want.extra &&
        q.ev === want.ev &&
        q.backup === want.backup &&
        q.reserve === want.reserve
      );
    });
  };
  /** What a change would add to or take off the price ("+ $1,200"), from the mix it would be. */
  const deltaTo = (p: ConfigPick) => {
    const there = nearestVariant(cfg, p);
    if (!there) return "";
    const d = there.price.youPay - mix.price.youPay;
    return d === 0 ? "" : `${d > 0 ? "+" : "−"} ${dollars(Math.abs(d))}`;
  };
  const delta = (p: Partial<ConfigPick>) => deltaTo({ ...now, ...p });
  // What switching blackout backup on moves to: this mix with backup, else the nearest priced one (with a battery).
  const withBackup = backupPick(cfg, now);
  // Add-ons: blackout backup once a battery is picked, and the EV charger when one is listed.
  const addOns = mix.batteryId !== null || Boolean(cfg.charger) || Boolean(mix.extras?.length);

  const special = announcementShows(view.announcement, todayInMarket());
  const [sunView, setSunView] = useState(false);
  // Where the battery's plate stands on the picture, so the line from the panels ends at its edge.
  const picture = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const [lineTo, setLineTo] = useState<{ x: number; y: number } | null>(null);
  const plateKey = `${battery?.id ?? "none"}-${mix.extra ?? 0}-${Boolean(mix.backup)}-${Boolean(mix.reserve)}-${Boolean(mix.ev)}`;
  useLayoutEffect(() => {
    const box = picture.current;
    if (!box) return;
    const measure = () => {
      const p = plate.current?.getBoundingClientRect();
      // The roof's own box: on a phone the plate sits under it, not on it, and then no line is drawn.
      const b = (box.firstElementChild ?? box).getBoundingClientRect();
      if (!p || !b.width || !b.height || p.top >= b.bottom - 1) return setLineTo(null);
      setLineTo({ x: Math.max(0, (p.left - b.left - 4) / b.width), y: Math.min(1, (p.top - b.top + p.height * 0.55) / b.height) });
    };
    measure();
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    watch?.observe(box);
    return () => watch?.disconnect();
  }, [plateKey]);
  const headline = `${shown.system.kw} kW solar${shown.system.batteryKwh ? ` with a ${shown.system.batteryKwh} kWh battery` : ""}`;
  const orderHref = `/p/${encodeURIComponent(token)}/order?mix=${encodeURIComponent(mix.goal)}${week ? `&week=${week.monday}` : ""}`;

  return (
    <div
      style={themeVars(view.theme) as React.CSSProperties}
      className="min-h-dvh bg-surface pb-32 text-ink [color-scheme:light] [font-family:var(--proposal-body)] lg:pb-28"
    >
      {/* The business's special, across the top until its last day (19 Nov 2026, Martin: "an announcement bar at the top
          so we can announce any specials"). In its own words, as it stood when the proposal was published. */}
      {special && view.announcement && (
        <div className="bg-primary px-5 py-2.5 text-center text-[13.5px] text-[color:var(--primary-ink)] sm:px-8">
          <span className="font-medium">{view.announcement.text}</span>
          {view.announcement.until && (
            <span className="opacity-80">
              {" "}
              · Until{" "}
              {new Date(`${view.announcement.until}T00:00:00Z`).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>
          )}
        </div>
      )}
      <header className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10 lg:py-4">
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

      <main className="mx-auto grid w-full max-w-[1680px] gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-10 lg:px-10 xl:grid-cols-[minmax(0,1fr)_28rem]">
        {/* The home: it stays in view on a wide screen and changes as they choose. */}
        <section aria-label="Your home" className="lg:sticky lg:top-6 lg:self-start">
          {/* The home, its figures and the battery in one fold, with room round them (19 Nov 2026, Martin: "the map needs
              to fit along with the performance bar and battery all in one fold… space around it… for the RENUABL logo to
              stand out"): on a wide screen everything here shares one width worked from the window's height. */}
          <div className={clsx("cfg-home", special && "cfg-home-special")}>
            <h1 className="text-[28px] leading-[1.1] tracking-tight [font-family:var(--proposal-heading)] sm:text-[34px]">{headline}</h1>
            {/* The label, who it is for and where, in one quiet line, so the picture has the height. */}
            <p className="mt-1.5 text-[13px] text-muted">
              <span className="font-medium uppercase tracking-[0.14em] text-[11px]">
                {view.indicative ? INDICATIVE_LABEL : "Your proposal"}
              </span>
              {" · "}
              {view.customer.name} · {view.customer.address}
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
              <div ref={picture} className="@container relative [&>div]:rounded-none [&>div]:border-0">
                <Roof
                  view={shown}
                  src={urls.roof}
                  frame={cfg.sizes[0]?.roofPanels}
                  line={battery && !sunView ? lineTo : null}
                  shadeView={sunView}
                />
                {/* The sun on the panels (19 Nov 2026, Martin): from the design's shade reading, when it has one. */}
                {shown.roof.shade && (
                  <button
                    type="button"
                    aria-pressed={sunView}
                    onClick={() => setSunView((v) => !v)}
                    className={clsx(
                      "absolute left-3 top-3 z-20 inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-medium shadow-[0_6px_18px_rgba(0,0,0,0.3)] backdrop-blur transition-colors",
                      sunView ? "bg-white text-ink" : "bg-black/60 text-white hover:bg-black/75",
                    )}
                  >
                    <Sun className="size-4" aria-hidden /> Sun on panels
                  </button>
                )}
                {sunView && shown.roof.shade && (
                  <div className="relative z-20 bg-[#0b0b0d] p-4 sm:absolute sm:left-3 sm:top-14 sm:w-[min(20rem,calc(100%-1.5rem))] sm:rounded-2xl sm:bg-[#0b0b0d]/90 sm:shadow-[0_12px_32px_rgba(0,0,0,0.4)] sm:ring-1 sm:ring-white/10 sm:backdrop-blur">
                    <ShadeSummary shade={shown.roof.shade} dark />
                  </div>
                )}
                {/* What isn't on the roof, drawn on the home's wall in the picture's corner as it is chosen. On a phone it is a
                    strip under the picture instead (24 Nov 2026, Martin: on his iPhone it covered the panels). */}
                {(battery || mix.ev) && !sunView && (
                  <div
                    ref={plate}
                    className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-end gap-3 rounded-3xl bg-gradient-to-br from-[#202226] to-[#0d0e10] px-5 py-4 origin-bottom-right scale-[0.66] @3xl:scale-[0.82] @5xl:scale-100 shadow-[0_12px_32px_rgba(0,0,0,0.35)] ring-1 ring-white/10 sm:bottom-4 sm:right-4 @max-2xl:static @max-2xl:scale-100 @max-2xl:justify-center @max-2xl:rounded-none @max-2xl:px-5 @max-2xl:py-5 @max-2xl:shadow-none @max-2xl:ring-0"
                  >
                    {mix.ev && <ChargerArt />}
                    {battery && (
                      <BatteryArt
                        key={`${battery.id}-${mix.extra ?? 0}-${Boolean(mix.backup)}-${Boolean(mix.reserve)}`}
                        kwh={shown.system.batteryKwh}
                        qty={Math.min(8, battery.qty + (mix.extra ?? 0) + (mix.reserve ? 1 : 0))}
                        backup={Boolean(mix.backup)}
                        kept={Boolean(mix.backup && mix.reserve)}
                      />
                    )}
                  </div>
                )}
              </div>
              <Performance cfg={cfg} mix={mix} view={view} />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              {shown.production ? `Makes about ${shown.production.yearKwh.toLocaleString("en-AU")} kWh a year. ` : ""}The layout is a
              design, checked on site before anything is installed. A different panel goes in the same places. Output, offset and savings
              are estimates from your bill.
            </p>
          </div>
        </section>

        {/* The choices. */}
        <section aria-label="Choose your system" className="space-y-4">
          {/* Why nothing below can be changed (19 Nov 2026, Martin: the switches looked broken once it was ordered). */}
          {locked && (
            <div className="rounded-[28px] bg-canvas p-5 text-[14px] leading-relaxed sm:p-6">
              {props.state === "accepted" ? (
                <>
                  <p className="flex items-center gap-1.5 font-medium">
                    <Check className="size-4 text-positive" aria-hidden />
                    You ordered this system
                    {props.accepted?.at
                      ? ` on ${new Date(props.accepted.at).toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "Australia/Melbourne" })}`
                      : ""}
                    .
                  </p>
                  <p className="mt-1 text-muted">
                    It&apos;s shown as you ordered it, so the choices are fixed. To change anything, ask {view.business.name} in the chat on
                    your proposal.
                  </p>
                </>
              ) : (
                <p className="text-muted">
                  {props.state === "lapsed"
                    ? `This price has lapsed, so the choices are fixed. Ask ${view.business.name} for an up-to-date proposal.`
                    : "This proposal isn't available any more, so the choices are fixed."}
                </p>
              )}
            </div>
          )}
          <Step icon={<House className="size-[18px]" strokeWidth={1.8} aria-hidden />} title="Size">
            <div className="space-y-2.5">
              {cfg.sizes.map((s) => {
                const v = nearestVariant(cfg, switchSize(cfg, now, s.id));
                return (
                  <Choice
                    key={s.id}
                    on={mix.size === s.id}
                    disabled={locked}
                    onPick={() => setPick(switchSize(cfg, now, s.id))}
                    title={s.name}
                    note={`${v ? `${v.system.kw} kW · ` : ""}${s.panels} panels`}
                    side={v ? dollars(v.price.youPay) : ""}
                    marks={v ? <Marks marks={mixMarks(cfg, v)} /> : null}
                  />
                );
              })}
            </div>
          </Step>

          <Step icon={<PanelIcon className="size-[18px]" />} title="Panels">
            <div className="space-y-2.5">
              {cfg.panels.map((p) => (
                <Choice
                  key={p.id}
                  on={mix.panel === p.id}
                  disabled={locked || !exists({ panel: p.id })}
                  onPick={() => set({ panel: p.id })}
                  title={p.maker}
                  note={`${p.watts} W · ${p.name}`}
                  side={mix.panel === p.id ? (p.id === 0 ? "As designed" : "") : delta({ panel: p.id })}
                />
              ))}
            </div>
          </Step>

          <Step icon={<InverterIcon className="size-[18px]" />} title="Inverter">
            <div className="space-y-2.5">
              {invertersHere.map((i) => (
                <Choice
                  key={i.id}
                  on={now.inverter === i.id}
                  disabled={locked || !cfg.variants.some((v) => v.size === mix.size && (v.inverter ?? 0) === i.id)}
                  onPick={() => setPick(switchInverter(cfg, now, i.id))}
                  title={`${i.maker} · ${i.kw} kW`}
                  note={i.name}
                  side={now.inverter === i.id ? (i.id === 0 ? "As designed" : "") : deltaTo(switchInverter(cfg, now, i.id))}
                />
              ))}
              {!invertersHere.length && designedInverter && (
                <Choice on onPick={() => {}} title={designedInverter.value} note="Sized for your panels" side="As designed" />
              )}
              {invertersHere.length <= 1 && (
                <p className="px-1 text-[12.5px] leading-relaxed text-muted">Sized for your panels. Others are checked on site.</p>
              )}
            </div>
          </Step>

          <Step icon={<BatteryIcon className="size-[18px]" />} title="Battery">
            <div className="space-y-2.5">
              <Choice
                on={mix.batteryId === null}
                disabled={locked || !exists({ battery: null, backup: false })}
                onPick={() => set({ battery: null, backup: false, extra: 0 })}
                title="No battery"
                note="Solar only. A battery can be added later."
                side={mix.batteryId === null ? "" : delta({ battery: null, backup: false })}
              />
              {batteriesHere.map((b) => (
                <Choice
                  key={b.id}
                  on={mix.batteryId === b.id}
                  disabled={locked || !exists({ battery: b.id, backup: false })}
                  onPick={() => set({ battery: b.id, extra: 0 })}
                  title={`${b.maker} · ${b.kwh} kWh`}
                  note={b.name}
                  side={mix.batteryId === b.id ? "" : delta({ battery: b.id, extra: 0 })}
                />
              ))}
              {/* Storage a module down or up (19 Nov 2026, Martin), each priced on publishing. */}
              {mix.batteryId !== null && (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                  <span>
                    <span className="block text-[15px] font-medium text-ink">Storage</span>
                    <span className="block text-[12.5px] text-muted">A module more or fewer</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StepButton
                      label="One module fewer"
                      sign="−"
                      disabled={locked || !exists({ extra: (now.extra ?? 0) - 1, backup: false })}
                      onPress={() => set({ extra: (now.extra ?? 0) - 1, backup: false })}
                      side={
                        exists({ extra: (now.extra ?? 0) - 1, backup: false })
                          ? deltaTo({ ...now, extra: (now.extra ?? 0) - 1, backup: false })
                          : ""
                      }
                    />
                    <span className="min-w-[4.5rem] text-center text-[17px] font-semibold tracking-tight [font-variant-numeric:tabular-nums]">
                      {shown.system.batteryKwh} kWh
                    </span>
                    <StepButton
                      label="One module more"
                      sign="+"
                      disabled={locked || !exists({ extra: (now.extra ?? 0) + 1, backup: false })}
                      onPress={() => set({ extra: (now.extra ?? 0) + 1, backup: false })}
                      side={
                        exists({ extra: (now.extra ?? 0) + 1, backup: false })
                          ? deltaTo({ ...now, extra: (now.extra ?? 0) + 1, backup: false })
                          : ""
                      }
                    />
                  </span>
                </div>
              )}
              {!batteriesHere.length && (
                <p className="text-[13px] text-muted">
                  No battery on our lists works with this system&apos;s inverter. Ask us in the chat.
                </p>
              )}
            </div>
          </Step>

          {addOns && (
            <Step icon={<Plus className="size-[18px]" strokeWidth={1.8} aria-hidden />} title="Add-ons">
              <div className="space-y-2.5">
                {/* Decided on the job in the designer (19 Nov 2026, Martin: "these aren't components a customer would self
                    select"): in the price, ticked, not switches. */}
                {mix.extras?.map((x) => (
                  <div key={x} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                    <span
                      aria-hidden
                      className="grid size-5 shrink-0 place-items-center rounded-full bg-[color:var(--primary)] text-[color:var(--primary-ink)]"
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] font-medium text-ink">{x}</span>
                    <span className="shrink-0 text-[13px] text-muted">Included</span>
                  </div>
                ))}
                {/* Backup is a battery's add-on, so it shows only once a battery is picked (19 Nov 2026, Martin). */}
                {mix.batteryId !== null && (
                  <Toggle
                    on={Boolean(mix.backup)}
                    disabled={locked || (mix.backup ? !exists({ backup: false }) : !withBackup)}
                    onChange={(on) => (on ? withBackup && setPick(withBackup) : set({ backup: false }))}
                    title="Blackout backup"
                    note="Chosen circuits kept on when the grid goes down. Your battery still runs your evenings as usual."
                    side={mix.backup ? "Added" : withBackup ? deltaTo(withBackup) : ""}
                  />
                )}
                {/* A module kept for blackouts is offered only with backup (19 Nov 2026, Martin). */}
                {mix.batteryId !== null && mix.backup && (mix.reserve || exists({ reserve: true })) && (
                  <Toggle
                    on={Boolean(mix.reserve)}
                    disabled={locked || !exists({ reserve: !mix.reserve })}
                    onChange={(reserve) => set({ reserve })}
                    title="Extra module for blackouts"
                    note="One battery module more, kept full for a blackout, on top of what runs your evenings."
                    side={mix.reserve ? "Added" : delta({ reserve: true })}
                  />
                )}
                {cfg.charger && (
                  <Toggle
                    on={Boolean(mix.ev)}
                    disabled={locked || !exists({ ev: !mix.ev })}
                    onChange={(ev) => set({ ev })}
                    title="EV charger"
                    icon={<ChargerIcon className="size-4" />}
                    note={`${cfg.charger.kw} kW · ${cfg.charger.name}, installed`}
                    side={mix.ev ? "Added" : delta({ ev: true })}
                  />
                )}
              </div>
            </Step>
          )}

          <Step icon={<CalendarDays className="size-[18px]" strokeWidth={1.8} aria-hidden />} title="Installation">
            {props.weeks.length ? (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  {props.weeks.map((w) => (
                    <button
                      key={w.monday}
                      type="button"
                      aria-pressed={week?.monday === w.monday}
                      disabled={locked}
                      onClick={() => setWeek(w)}
                      className={clsx(
                        "rounded-2xl border bg-surface px-4 py-3 text-left transition-[border-color,box-shadow]",
                        week?.monday === w.monday
                          ? "border-transparent shadow-[0_0_0_2px_var(--primary)]"
                          : "border-line hover:border-line-strong",
                      )}
                    >
                      <span className="block text-[11px] uppercase tracking-[0.14em] text-muted">Week of</span>
                      <span className="mt-0.5 block text-[15px] font-medium text-ink">{w.label.replace("the week of ", "")}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
                  {view.indicative
                    ? "Your week is confirmed with you after we visit your home."
                    : "Your day in that week is confirmed with you, subject to approvals."}
                </p>
              </>
            ) : (
              <p className="text-[14px] text-muted">We&apos;ll find your installation week with you.</p>
            )}
          </Step>

          <Step icon={<Receipt className="size-[18px]" strokeWidth={1.8} aria-hidden />} title="Price">
            <div className="rounded-2xl border border-line bg-surface p-4 text-[14px]">
              <Row label="System, installed (GST included)" value={dollars(shown.price.incGst)} />
              <Row label="Federal rebate (STCs)" value={`− ${dollars(shown.price.stc)}`} />
              <Row label="You pay" value={dollars(shown.price.youPay)} strong />
              {shown.paybackYears && (
                <p className="mt-3 text-[13px] text-muted">Pays for itself in about {shown.paybackYears} years (estimate).</p>
              )}
              {shown.price.solarVic && <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{shown.price.solarVic.note}</p>}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              {view.indicative ? `${INDICATIVE_PRICE_NOTE} ` : ""}
              {STC_NOTE} {shown.bill?.saving ? SAVING_NOTE : ""}
            </p>
          </Step>
        </section>
      </main>

      {/* The price along the foot, and Order. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3.5 sm:px-8 lg:px-10">
          <p>
            <span className="text-[24px] font-semibold tracking-tight [font-variant-numeric:tabular-nums]">
              {dollars(shown.price.youPay)}
            </span>{" "}
            <span className="text-[12.5px] text-muted">after the federal rebate</span>
          </p>
          {/* Due today (19 Nov 2026, Martin, as Tesla's order fee): the deposit the business asks when they order, from
              the share set on the proposal screen; nothing on an indicative proposal, which is confirmed after the visit. */}
          {props.state === "live" && (
            <p className="ml-auto text-right max-sm:ml-0 max-sm:text-left">
              <span className="block text-[11px] uppercase tracking-[0.12em] text-muted">Due today</span>
              <span className="text-[20px] font-semibold tracking-tight [font-variant-numeric:tabular-nums]">
                {view.indicative || !shown.terms?.deposit ? "$0" : cents(shown.terms.deposit)}
              </span>{" "}
              <span className="text-[12px] text-muted">
                {view.indicative
                  ? shown.terms?.deposit
                    ? `deposit of ${cents(shown.terms.deposit)} once your final proposal is confirmed`
                    : "nothing until your final proposal"
                  : shown.terms?.deposit
                    ? "deposit"
                    : "nothing to pay to order"}
              </span>
            </p>
          )}
          {props.state === "accepted" ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[14px] font-medium">
                <Check className="size-4 text-positive" aria-hidden /> Ordered{props.accepted ? `, ${props.accepted.name}` : ""}
              </span>
              <Link href={`/p/${encodeURIComponent(token)}#pay`} className={button}>
                Next steps
              </Link>
            </div>
          ) : props.state === "live" ? (
            <button type="button" className={button} onClick={() => router.push(orderHref)}>
              Order
            </button>
          ) : (
            <p className="text-[13.5px] text-muted">
              {props.state === "lapsed"
                ? `This price has lapsed. Ask ${view.business.name} for an up-to-date proposal.`
                : "This proposal isn't available any more."}
            </p>
          )}
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const button =
  "inline-flex min-h-12 min-w-36 items-center justify-center gap-2 rounded-full bg-primary px-8 text-[15px] font-medium text-[color:var(--primary-ink)] transition-opacity hover:opacity-90 disabled:bg-line-strong disabled:text-muted";

/** The most of a home's power an estimate ever claims the system offsets (as the homeowner site: never all of it). */
const OFFSET_CAP = 0.9;
const offsetWords = (share: number) => (share >= OFFSET_CAP ? `${percent(OFFSET_CAP)}+` : percent(share));

/**
 * What the system does for the home (19 Nov 2026, Martin: Apple Watch analytics as Apple and SpaceX might draw them;
 * then "grow… so the dials can grow… reducing the size of the values… I like the Primero Solar style icons… a bell
 * curve chart"): on a warm dark ground under the picture, a day's curve (`DayCurve`) and three instruments, each with a
 * gold line icon in a fine circle. Every figure an estimate from the mix's own. HOME POWERED: the share of the home's
 * power the system supplies (never said to be more than 90%, `OFFSET_CAP`). BILL SAVED: the share of the bill it saves,
 * read in dollars a year. EVENINGS: of the power the panels alone can't supply (mostly evenings), the battery's share.
 */
function Performance({ cfg, mix, view }: { cfg: ConfiguratorView; mix: ConfigVariant; view: ProposalView }) {
  const solar = mix.batteryId === null ? mix : (solarOnly(cfg, mix) ?? mix);
  const total = mix.bill ? Math.min(OFFSET_CAP, mix.bill.selfReliance) : 0;
  const fromPanels = solar.bill ? Math.min(OFFSET_CAP, solar.bill.selfReliance) : 0;
  const saved = mix.bill && mix.bill.now > 0 ? Math.min(1, Math.max(0, mix.bill.saving / mix.bill.now)) : 0;
  const evenings = mix.batteryId !== null && fromPanels < 1 ? Math.min(1, Math.max(0, (total - fromPanels) / (1 - fromPanels))) : 0;
  const dials = [
    {
      label: "Home powered",
      icon: <House className="size-3" strokeWidth={1.6} />,
      share: total,
      value: mix.bill ? offsetWords(mix.bill.selfReliance) : "—",
      unit: "of its power",
    },
    {
      label: "Bill saved",
      icon: <UtilityPole className="size-3" strokeWidth={1.6} />,
      share: saved,
      value: mix.bill && mix.bill.saving > 0 ? dollars(mix.bill.saving) : "—",
      unit: "a year",
    },
    {
      label: "Evenings",
      icon: <BatteryIcon className="size-3" />,
      share: evenings,
      value: mix.batteryId === null ? "—" : percent(evenings),
      unit: mix.batteryId === null ? "no battery" : "from battery",
    },
  ];
  return (
    <div
      className="@container text-white"
      style={{ background: "radial-gradient(120% 160% at 20% 130%, rgba(214,170,90,0.22), transparent 60%), #0a0a0b" }}
    >
      <div className="grid gap-x-4 gap-y-3 px-4 pb-3.5 pt-4 @2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)] sm:px-6">
        <DayCurve view={view} mix={mix} />
        <div className="grid grid-cols-3 gap-1 sm:gap-3">
          {dials.map((d) => (
            <Dial key={d.label} {...d} />
          ))}
        </div>
      </div>
    </div>
  );
}

const GOLD = "#e0b35a";

/**
 * An average day, as a bell (19 Nov 2026, Martin, from Primero Solar's day chart): every half hour a fine bar, what the
 * roof makes rising above the line in gold, what the home uses hanging below it, its share from the panels and the
 * battery in gold and from the grid in grey. Played through `homeDay` on the mix's own panels, the home's use from the
 * bill on a typical day's shape, and the battery; the day's output is the year's divided by its days. An estimate.
 */
function DayCurve({ view, mix }: { view: ProposalView; mix: ConfigVariant }) {
  const shown = viewForChoice(view, mix.goal);
  const day = useMemo(() => {
    const each = shown.system.panels > 0 ? shown.system.kw / shown.system.panels : 0;
    const panels = shown.roof.panels.map((flat, n) => {
      const corners = [0, 1, 2, 3].map((i) => [flat[i * 2], flat[i * 2 + 1]] as const);
      const aspect = shown.roof.aspects?.[n];
      return {
        corners,
        x: corners.reduce((sum, c) => sum + c[0], 0) / 4,
        y: corners.reduce((sum, c) => sum + c[1], 0) / 4,
        kw: each,
        tilt: aspect?.[0] ?? TILT.roof,
        facing: aspect?.[1] ?? 0,
      };
    });
    const yearKwh = shown.production?.yearKwh ?? 0;
    if (!panels.length || !yearKwh) return null;
    return homeDay({
      latitude: shown.roof.lat,
      // March, near the equinox: a middle day of the year's sun.
      month: 2,
      panels,
      dayKwh: yearKwh / 365,
      homeDayKwh: shown.bill?.dailyKwh ?? null,
      batteryKwh: Math.max(0, shown.system.eveningKwh ?? shown.system.batteryKwh) * ASSUMPTIONS.batteryUsableShare,
    });
  }, [shown]);
  if (!day) return <div className="hidden @2xl:block" />;
  const W = 480;
  const H = 108;
  const mid = 58;
  const top = Math.max(0.1, ...day.steps.map((st) => st.solar));
  const bottom = Math.max(0.1, ...day.steps.map((st) => st.use));
  const up = (mid - 6) / top;
  // Below the line on its own scale: a home uses a fraction of what the roof makes at noon, and the shape is what reads.
  const down = (H - mid - 14) / bottom;
  const step = W / day.steps.length;
  const bar = step * 0.42;
  return (
    <figure className="m-0 min-w-0">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/75">An average day</span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-white/45">
          <span style={{ color: GOLD }}>■</span> Made <span className="ml-2 text-white/60">■</span> Used
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1.5 block h-auto w-full"
        role="img"
        aria-label={`About ${Math.round(day.solarKwh)} kWh made and ${Math.round(day.useKwh)} kWh used on an average day`}
      >
        <defs>
          <linearGradient id="cfg-made" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={GOLD} />
            <stop offset="1" stopColor={GOLD} stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {day.steps.map((st, i) => {
          const x = Math.round((i * step + (step - bar) / 2) * 100) / 100;
          // To the hundredth, so the page drawn on the server and in the browser agree.
          const r2 = (n: number) => Math.round(n * 100) / 100;
          const made = r2(st.solar * up);
          const own = r2((st.direct + st.discharge) * down);
          const grid = r2(st.imported * down);
          return (
            <g key={i}>
              {made > 0.3 && (
                <rect className="cfg-bar-up" x={x} y={mid - made} width={bar} height={made} rx={bar / 2} fill="url(#cfg-made)" />
              )}
              {own > 0.3 && (
                <rect className="cfg-bar-down" x={x} y={mid + 2} width={bar} height={own} rx={bar / 2} fill={GOLD} fillOpacity={0.55} />
              )}
              {grid > 0.3 && (
                <rect
                  className="cfg-bar-down"
                  x={x}
                  y={mid + 2 + own}
                  width={bar}
                  height={grid}
                  rx={bar / 2}
                  fill="#ffffff"
                  fillOpacity={0.22}
                />
              )}
            </g>
          );
        })}
        <line x1="0" x2={W} y1={mid + 1} y2={mid + 1} stroke="#ffffff" strokeOpacity={0.25} strokeWidth={0.8} />
        {[6, 12, 18].map((h) => (
          <text key={h} x={(h / 24) * W} y={H - 1} textAnchor="middle" className="fill-white/40 font-mono" fontSize={9} letterSpacing={1}>
            {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
          </text>
        ))}
      </svg>
    </figure>
  );
}

/** One instrument: graduations round three quarters of a circle, the reading as a thin arc, the figure small in its middle. */
function Dial({ label, icon, share, value, unit }: { label: string; icon: React.ReactNode; share: number; value: string; unit: string }) {
  const size = 96;
  const c = size / 2;
  const r = 36;
  const sweep = 270;
  const from = 135; // degrees, clockwise from the right: the open end at the bottom
  const point = (deg: number, radius: number) => {
    const a = ((from + deg) * Math.PI) / 180;
    // To the hundredth, so the page drawn on the server and in the browser agree.
    return [Math.round((c + radius * Math.cos(a)) * 100) / 100, Math.round((c + radius * Math.sin(a)) * 100) / 100];
  };
  const shown = Math.max(0, Math.min(1, share));
  const length = (2 * Math.PI * r * sweep) / 360;
  const [x0, y0] = point(0, r);
  const [x1, y1] = point(sweep, r);
  const arc = `M${x0} ${y0} A${r} ${r} 0 1 1 ${x1} ${y1}`;
  const [ex, ey] = point(sweep * shown, r);
  const ticks = 54;
  return (
    <figure className="m-0 flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size - 10 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-x-0 top-0" aria-hidden>
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const deg = (sweep * i) / ticks;
            const major = i % 9 === 0;
            const [a0, b0] = point(deg, r + 5);
            const [a1, b1] = point(deg, r + (major ? 10 : 7.5));
            const lit = shown > 0 && deg <= sweep * shown + 0.01;
            return (
              <line
                key={i}
                x1={a0}
                y1={b0}
                x2={a1}
                y2={b1}
                stroke="#ffffff"
                strokeOpacity={major ? (lit ? 0.85 : 0.35) : lit ? 0.5 : 0.14}
                strokeWidth={major ? 1.2 : 0.8}
              />
            );
          })}
          <path d={arc} fill="none" stroke="#ffffff" strokeOpacity={0.1} strokeWidth={2} />
          <path
            className="cfg-ring"
            d={arc}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={length}
            strokeDashoffset={length * (1 - shown)}
            style={{ ["--ring-len" as string]: `${length}` }}
          />
          {shown > 0 && (
            <>
              <circle cx={ex} cy={ey} r={6} fill={GOLD} opacity={0.3} className="cfg-glow" />
              <circle cx={ex} cy={ey} r={2.6} fill={GOLD} />
            </>
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pt-1.5">
          <span className="font-mono text-[14px] font-medium leading-none tracking-tight [font-variant-numeric:tabular-nums]">{value}</span>
        </div>
      </div>
      <figcaption className="-mt-1 flex flex-col items-center text-center">
        <span className="flex items-center gap-1.5">
          <span
            className="grid size-5 place-items-center rounded-full ring-1"
            style={{ color: GOLD, ["--tw-ring-color" as string]: "rgba(224,179,90,0.55)" }}
          >
            {icon}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/80">{label}</span>
        </span>
        <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">{unit}</span>
      </figcaption>
    </figure>
  );
}

/**
 * The battery on the home's wall (19 Nov 2026, Martin: "make it a unique to renuabl gif type image where the bars light
 * up to the top of the battery… adjacent to it the amount of battery storage… modern, not gimmicky… imagine if Apple
 * were making home batteries… you don't need to mention the brand"): a soft white unit, front on, with one column of
 * light set into it, a short group of segments for each module; the segments light from the bottom to the top, hold,
 * and dim together, again and again. The storage beside it, large. Our own drawing, no maker. The unit is taller for
 * more modules. Lit and still with reduced motion.
 */
function BatteryArt({ kwh, qty, backup, kept }: { kwh: number; qty: number; backup: boolean; kept: boolean }) {
  const modules = Math.max(1, Math.min(8, qty));
  const per = modules <= 2 ? 4 : modules <= 4 ? 3 : 2;
  const W = 76;
  const H = 128 + Math.max(0, modules - 2) * 12;
  const top = 22;
  const bottom = H - 20;
  const moduleGap = 6;
  const segGap = 2.5;
  const moduleH = (bottom - top - moduleGap * (modules - 1)) / modules;
  const segH = (moduleH - segGap * (per - 1)) / per;
  // From the bottom up: the order the segments light in.
  const segs = Array.from({ length: modules * per }, (_, k) => {
    const m = Math.floor(k / per);
    const y = top + m * (moduleH + moduleGap) + (k % per) * (segH + segGap);
    return { y, held: kept && modules > 1 && m === 0 };
  }).reverse();
  const n = segs.length;
  const name = `cfg-seg-${n}`;
  // One keyframe a segment: each comes on in turn over the first 60% of the loop, all hold, then dim together.
  const keyframes = segs
    .map((_, i) => {
      const on = 4 + (i * 58) / Math.max(1, n - 1);
      return `@keyframes ${name}-${i} { 0%, ${on.toFixed(1)}% { opacity: .16 } ${(on + 3).toFixed(1)}%, 84% { opacity: 1 } 94%, 100% { opacity: .16 } }`;
    })
    .join("\n");
  return (
    <figure className="cfg-in m-0 flex items-center gap-4">
      <style>{`${keyframes}
.${name} { animation-duration: 4.8s; animation-iteration-count: infinite; animation-timing-function: ease-out; animation-fill-mode: both }
@media (prefers-reduced-motion: reduce) { .${name} { animation: none !important; opacity: 1 } }`}</style>
      <svg width={W} height={H + 10} viewBox={`0 0 ${W} ${H + 10}`} role="img" aria-label={`A ${kwh} kWh battery`} className="shrink-0">
        <defs>
          <linearGradient id="cfg-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#f2f2f0" />
            <stop offset="1" stopColor="#dcdcd8" />
          </linearGradient>
          <linearGradient id="cfg-well" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e4e4e1" />
            <stop offset="1" stopColor="#d6d6d2" />
          </linearGradient>
          <filter id="cfg-light" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="cfg-drop" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <ellipse cx={W / 2} cy={H + 3} rx={W / 2 - 6} ry="4" fill="#000" opacity="0.6" filter="url(#cfg-drop)" />
        <rect x="2" y="1" width={W - 4} height={H} rx="18" fill="url(#cfg-body)" />
        <rect x="2.5" y="1.5" width={W - 5} height={H - 1} rx="17.5" fill="none" stroke="#fff" strokeOpacity="0.9" />
        {/* The column of light, set into the face. */}
        <rect x={W / 2 - 15} y={top - 7} width="30" height={bottom - top + 14} rx="9" fill="url(#cfg-well)" />
        <g filter="url(#cfg-light)">
          {segs.map((sg, i) => (
            <rect
              key={i}
              className={`${name}`}
              style={{ animationName: `${name}-${i}` }}
              x={W / 2 - 10}
              y={sg.y}
              width="20"
              height={segH}
              rx="2.5"
              fill={sg.held ? "#5fb8ff" : "var(--accent)"}
            />
          ))}
        </g>
      </svg>
      <figcaption className="text-white">
        <span className="block text-[40px] font-semibold leading-none tracking-tight [font-variant-numeric:tabular-nums]">{kwh}</span>
        <span className="mt-1 block text-[12.5px] text-white/65">kWh of storage</span>
        <span className="mt-2.5 block text-[12px] text-white/50">
          {qty} module{qty === 1 ? "" : "s"}
          {kept && qty > 1 ? " · one kept for blackouts" : backup ? " · blackout backup" : ""}
        </span>
      </figcaption>
    </figure>
  );
}

/** The EV charger on the wall: a small rounded box with its ring of light and cable. */
function ChargerArt() {
  return (
    <figure className="cfg-in m-0 flex flex-col items-center gap-1 text-white">
      <svg width={46} height={84} viewBox="0 0 46 84" role="img" aria-label="An EV charger">
        <defs>
          <linearGradient id="cfg-ev" x1="0" x2="1">
            <stop offset="0" stopColor="#e9e9e6" />
            <stop offset="0.4" stopColor="#ffffff" />
            <stop offset="1" stopColor="#d4d4cf" />
          </linearGradient>
        </defs>
        <rect x="3" y="2" width="40" height="50" rx="11" fill="url(#cfg-ev)" />
        <circle className="cfg-glow" cx="23" cy="24" r="9" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        <path
          d="M24.5 18l-4.5 6.5h5l-4 6"
          stroke="var(--accent)"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M23 52c0 12 -14 10 -14 28" stroke="#f2f2ef" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </svg>
      <figcaption className="text-[11px] font-medium">EV charger</figcaption>
    </figure>
  );
}

/**
 * One choice on a pad of its own (19 Nov 2026, Martin, from Tesla's: "on pads… their titles are also more
 * distinguishable from their content"): an icon in a round, the title large and heavy, the options in white under it.
 */
function Step({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] bg-canvas p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-[22px] font-semibold leading-none tracking-tight text-ink [font-family:var(--proposal-heading)]">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-line"
        >
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * What sets an option apart, on its card (19 Nov 2026, Martin: three options of the same kW and panels read alike until
 * you scrolled): a panel; a battery with what it holds and its maker; a shield for blackout backup; a charger; and a
 * plus with how many costs are included on the job. Each a small pill, in words for a screen reader and on hover.
 */
function Marks({ marks }: { marks: MixMarks }) {
  const pill = "inline-flex h-6 items-center gap-1 rounded-full bg-canvas px-2 text-[11.5px] font-medium text-ink";
  return (
    <span role="img" aria-label={mixMarksWords(marks)} className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className={pill} title="Solar panels">
        <PanelIcon className="size-3.5" />
        Solar
      </span>
      {marks.battery && (
        <span className={pill} title={`${marks.battery.kwh} kWh ${marks.battery.maker} battery`}>
          <BatteryIcon className="size-3.5" />
          <span className="[font-variant-numeric:tabular-nums]">{marks.battery.kwh} kWh</span>
          {marks.battery.maker && <span className="font-normal text-muted">{marks.battery.maker}</span>}
        </span>
      )}
      {marks.backup && (
        <span className={pill} title={marks.reserve ? "Blackout backup, with a module kept for it" : "Blackout backup"}>
          <ShieldCheck className="size-3.5" strokeWidth={1.8} aria-hidden />
          {marks.reserve ? "Backup + module" : "Backup"}
        </span>
      )}
      {marks.ev && (
        <span className={pill} title="EV charger">
          <ChargerIcon className="size-3.5" />
          EV
        </span>
      )}
      {marks.extras.length > 0 && (
        <span className={pill} title={`Included: ${marks.extras.join(", ")}`}>
          <Plus className="size-3.5" strokeWidth={2} aria-hidden />
          {marks.extras.length} {marks.extras.length === 1 ? "add-on" : "add-ons"}
        </span>
      )}
    </span>
  );
}

function Choice(props: {
  on: boolean;
  disabled?: boolean;
  onPick: () => void;
  title: string;
  note: string;
  side?: string;
  marks?: React.ReactNode;
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
        <span className="block text-[15px] font-medium text-ink">{props.title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{props.note}</span>
        {props.marks}
      </span>
      {props.side && <span className="shrink-0 text-[13px] text-ink [font-variant-numeric:tabular-nums]">{props.side}</span>}
    </button>
  );
}

function StepButton(props: { label: string; sign: string; disabled: boolean; onPress: () => void; side: string }) {
  return (
    <button
      type="button"
      aria-label={`${props.label}${props.side ? ` (${props.side})` : ""}`}
      title={props.side || props.label}
      disabled={props.disabled}
      onClick={props.onPress}
      className="grid size-9 place-items-center rounded-full text-[20px] leading-none text-ink ring-1 ring-line-strong transition-colors hover:bg-canvas disabled:text-muted disabled:ring-line"
    >
      {props.sign}
    </button>
  );
}

function Toggle(props: {
  on: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  title: string;
  icon?: React.ReactNode;
  note: string;
  side?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.on)}
      className={clsx(
        "flex w-full items-start gap-3 rounded-2xl border bg-surface px-4 py-3.5 text-left",
        props.on ? "border-transparent shadow-[0_0_0_2px_var(--primary)]" : "border-line hover:border-line-strong",
        props.disabled && "opacity-50",
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
          props.on ? "bg-[color:var(--primary)]" : "bg-line-strong",
        )}
      >
        <span className={clsx("size-4 rounded-full bg-white shadow transition-transform", props.on && "translate-x-4")} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
          {props.icon && <span className="text-muted">{props.icon}</span>}
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

const CSS = `
/* The picture is 1.6 times as wide as it is tall: its width is the window's height less the header, the heading, the
   figures under it and the Order bar with a margin (about 24.5rem with the dials; 2.5rem more with the special's bar), times 1.6. */
@media (min-width: 1024px) {
  .cfg-home { max-width: max(26rem, calc((100dvh - 24.5rem) * 1.6)); margin-inline: auto; }
  .cfg-home-special { max-width: max(26rem, calc((100dvh - 27rem) * 1.6)); }
}
@keyframes cfg-ring { from { stroke-dashoffset: var(--ring-len) } }
.cfg-ring { transition: stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1); animation: cfg-ring 1.2s cubic-bezier(.2,.8,.2,1) both }
.cfg-bar-up, .cfg-bar-down { transform-box: fill-box; transition: transform .5s ease-out }
.cfg-bar-up { transform-origin: bottom } .cfg-bar-down { transform-origin: top }
@keyframes cfg-bars { from { transform: scaleY(0) } }
.cfg-bar-up, .cfg-bar-down { animation: cfg-bars .9s cubic-bezier(.2,.8,.2,1) both }
@keyframes cfg-fade { from { opacity: .35 } to { opacity: 1 } }
.cfg-fade { animation: cfg-fade .45s ease-out }
@keyframes cfg-in { from { opacity: 0; transform: translateY(14px) scale(.94) } to { opacity: 1; transform: none } }
.cfg-in { animation: cfg-in .5s cubic-bezier(.2,.8,.2,1) both }
@keyframes cfg-glow { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes cfg-charge { from { transform: scaleY(.15) } to { transform: scaleY(1) } }
.cfg-charge { animation: cfg-charge 1.6s cubic-bezier(.2,.8,.2,1) both }
.cfg-glow { animation: cfg-glow 2.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .cfg-fade, .cfg-in, .cfg-glow, .cfg-charge, .cfg-fill, .cfg-ring, .cfg-bar-up, .cfg-bar-down { animation: none; transition: none } .cfg-sheen { display: none } }
`;
