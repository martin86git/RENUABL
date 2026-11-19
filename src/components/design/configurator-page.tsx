"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Check, House, Plus, Receipt } from "lucide-react";
import { announcementShows, themeVars } from "@/lib/domain/design/brand";
import { todayInMarket } from "@/lib/domain/market";
import {
  backupPick,
  batteriesFor,
  batteryOfVariant,
  invertersFor,
  isConfigKey,
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

const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const cents = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const percent = (share: number) => `${Math.round(share * 100)}%`;
const eyebrow = "text-[11px] font-medium uppercase tracking-[0.16em] text-muted";

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
  const set = (patch: Partial<ConfigPick>) => setPick({ ...now, ...patch });
  const [week, setWeek] = useState<Week | null>(
    props.weeks.find((w) => w.monday === props.week) ?? props.weeks.find((w) => w.monday === props.held?.monday) ?? props.weeks[0] ?? null,
  );

  const invertersHere = invertersFor(cfg, mix.size);
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
        q.ev === want.ev &&
        q.backup === want.backup
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
  const addOns = mix.batteryId !== null || Boolean(cfg.charger);

  const headline = `${shown.system.kw} kW solar${shown.system.batteryKwh ? ` with a ${shown.system.batteryKwh} kWh battery` : ""}`;
  const orderHref = `/p/${encodeURIComponent(token)}/order?mix=${encodeURIComponent(mix.goal)}${week ? `&week=${week.monday}` : ""}`;

  return (
    <div
      style={themeVars(view.theme) as React.CSSProperties}
      className="min-h-dvh bg-surface pb-32 text-ink [color-scheme:light] [font-family:var(--proposal-body)] lg:pb-28"
    >
      {/* The business's special, across the top until its last day (19 Nov 2026, Martin: "an announcement bar at the top
          so we can announce any specials"). In its own words, as it stood when the proposal was published. */}
      {announcementShows(view.announcement, todayInMarket()) && (
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
      <header className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
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
          <p className={eyebrow}>
            {view.indicative ? INDICATIVE_LABEL : "Your proposal"} · {view.customer.name}
          </p>
          <h1 className="mt-2 text-[28px] leading-[1.1] tracking-tight [font-family:var(--proposal-heading)] sm:text-[40px]">{headline}</h1>
          <p className="mt-2 text-[14px] text-muted">{view.customer.address}</p>
          <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="relative [&>div]:rounded-none [&>div]:border-0">
              <Roof view={shown} src={urls.roof} frame={cfg.sizes[0]?.roofPanels} />
              {/* What isn't on the roof, drawn on the home's wall in the picture's corner as it is chosen. */}
              {(battery || mix.ev) && (
                <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-end gap-3 rounded-2xl bg-[#141416] p-3 max-sm:origin-bottom-right max-sm:scale-[0.72] shadow-[0_12px_32px_rgba(0,0,0,0.35)] ring-1 ring-white/10 sm:bottom-4 sm:right-4">
                  {mix.ev && <ChargerArt />}
                  {battery && (
                    <BatteryArt
                      key={`${battery.id}-${Boolean(mix.backup)}`}
                      kwh={shown.system.batteryKwh}
                      qty={Math.min(8, battery.qty + (mix.backup ? 1 : 0))}
                      maker={battery.maker}
                      backup={Boolean(mix.backup)}
                    />
                  )}
                </div>
              )}
            </div>
            <Performance cfg={cfg} mix={mix} />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            The layout is a design, checked on site before anything is installed. A different panel goes in the same places. Output, offset
            and savings are estimates from your bill.
          </p>
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
                onPick={() => set({ battery: null, backup: false })}
                title="No battery"
                note="Solar only. A battery can be added later."
                side={mix.batteryId === null ? "" : delta({ battery: null, backup: false })}
              />
              {batteriesHere.map((b) => (
                <Choice
                  key={b.id}
                  on={mix.batteryId === b.id}
                  disabled={locked || !exists({ battery: b.id, backup: false })}
                  onPick={() => set({ battery: b.id })}
                  title={`${b.maker} · ${b.kwh} kWh`}
                  note={b.name}
                  side={mix.batteryId === b.id ? "" : delta({ battery: b.id })}
                />
              ))}
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
                {/* Backup is a battery's add-on, so it shows only once a battery is picked (19 Nov 2026, Martin). */}
                {mix.batteryId !== null && (
                  <Toggle
                    on={Boolean(mix.backup)}
                    disabled={locked || (mix.backup ? !exists({ backup: false }) : !withBackup)}
                    onChange={(on) => (on ? withBackup && setPick(withBackup) : set({ backup: false }))}
                    title="Blackout backup"
                    note="One battery module more, held for blackouts, with chosen circuits kept on when the grid goes down."
                    side={mix.backup ? "Added" : withBackup ? deltaTo(withBackup) : ""}
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
 * What the system does, joined to the picture: what it makes in a year, how much of the home's power it offsets (the
 * panels' share, and the battery's on top of it in the business's accent, counted on its own), and the yearly saving.
 * Estimates; the offset is never said to be more than 90%.
 */
function Performance({ cfg, mix }: { cfg: ConfiguratorView; mix: ConfigVariant }) {
  const solar = mix.batteryId === null ? mix : (solarOnly(cfg, mix) ?? mix);
  const total = mix.bill ? Math.min(OFFSET_CAP, mix.bill.selfReliance) : null;
  const fromPanels = solar.bill ? Math.min(OFFSET_CAP, solar.bill.selfReliance) : null;
  const fromBattery = total !== null && fromPanels !== null && mix.batteryId !== null ? Math.max(0, total - fromPanels) : 0;
  return (
    <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
      <Cell title="Makes a year" big={mix.production ? `${mix.production.yearKwh.toLocaleString("en-AU")} kWh` : "—"} />
      <div className="px-3 py-3.5 sm:px-4">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Grid offset</p>
        <p className="mt-1 text-[18px] leading-none tracking-tight [font-variant-numeric:tabular-nums] sm:text-[20px]">
          {total !== null && mix.bill ? offsetWords(mix.bill.selfReliance) : "—"}
        </p>
        {total !== null && fromPanels !== null && (
          <>
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <span className="h-full bg-ink/45 transition-[width] duration-500" style={{ width: percent(fromPanels) }} />
              <span className="h-full bg-[color:var(--accent)] transition-[width] duration-500" style={{ width: percent(fromBattery) }} />
            </div>
            <p className="mt-1.5 text-[11px] leading-tight text-muted">
              {fromBattery > 0.005 ? (
                <>
                  Solar {percent(fromPanels)} ·{" "}
                  <span className="font-medium text-[color:var(--accent)]">battery +{percent(fromBattery)}</span>
                </>
              ) : (
                "From the panels"
              )}
            </p>
          </>
        )}
      </div>
      <Cell title="Saves a year" big={mix.bill && mix.bill.saving > 0 ? dollars(mix.bill.saving) : "—"} />
    </div>
  );
}

function Cell({ title, big }: { title: string; big: string }) {
  return (
    <div className="px-3 py-3.5 sm:px-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{title}</p>
      <p className="mt-1 text-[18px] leading-none tracking-tight [font-variant-numeric:tabular-nums] sm:text-[20px]">{big}</p>
    </div>
  );
}

/**
 * The battery as it would hang on the home's wall, on a dark glass plate over the picture: a tall white unit, softly
 * lit from the left, with a light bar in the business's accent that fills as the battery charges, its modules as
 * fine seams (the one held for blackouts marked), and beside it its size and maker. Drawn, not a picture of any
 * maker's product, and nothing of RENUABL's on it (the proposal is the business's).
 */
function BatteryArt({ kwh, qty, maker, backup }: { kwh: number; qty: number; maker: string; backup: boolean }) {
  const height = 128 + Math.min(4, Math.max(0, qty - 2)) * 10;
  const inner = height - 28;
  const seam = inner / qty;
  return (
    <figure className="cfg-in m-0 flex items-end gap-3">
      <svg width={58} height={height} viewBox={`0 0 58 ${height}`} role="img" aria-label={`A ${kwh} kWh battery`}>
        <defs>
          <linearGradient id="cfg-shell" x1="0" x2="1">
            <stop offset="0" stopColor="#e9e9e6" />
            <stop offset="0.35" stopColor="#ffffff" />
            <stop offset="1" stopColor="#d4d4cf" />
          </linearGradient>
          <linearGradient id="cfg-charge" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <ellipse cx="29" cy={height - 2} rx="24" ry="2.5" fill="rgb(0 0 0 / 0.45)" />
        <rect x="3" y="1" width="52" height={height - 6} rx="12" fill="url(#cfg-shell)" />
        <rect x="3.5" y="1.5" width="51" height={height - 7} rx="11.5" fill="none" stroke="rgb(255 255 255 / 0.9)" />
        {/* The modules as fine seams; the one held for blackouts tinted. */}
        {Array.from({ length: qty - 1 }, (_, i) => (
          <line key={i} x1="10" x2="48" y1={14 + seam * (i + 1)} y2={14 + seam * (i + 1)} stroke="rgb(0 0 0 / 0.07)" />
        ))}
        {backup && <rect x="9" y={14 + seam * (qty - 1) + 2} width="40" height={seam - 4} rx="4" fill="var(--accent)" fillOpacity="0.14" />}
        {/* The light bar: a track, and the charge rising in it. */}
        <rect x="26" y="14" width="6" height={inner - 4} rx="3" fill="rgb(0 0 0 / 0.06)" />
        <rect
          className="cfg-charge"
          x="26"
          y="14"
          width="6"
          height={inner - 4}
          rx="3"
          fill="url(#cfg-charge)"
          style={{ transformOrigin: `29px ${10 + inner}px` }}
        />
      </svg>
      <figcaption className="pb-1 text-white">
        <span className="block text-[22px] font-semibold leading-none tracking-tight [font-variant-numeric:tabular-nums]">{kwh}</span>
        <span className="block text-[11px] text-white/75">kWh</span>
        <span className="mt-2 block text-[12px] font-medium">{maker}</span>
        {backup && <span className="mt-1 inline-block rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">Blackout backup</span>}
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

function Choice(props: { on: boolean; disabled?: boolean; onPick: () => void; title: string; note: string; side?: string }) {
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
      </span>
      {props.side && <span className="shrink-0 text-[13px] text-ink [font-variant-numeric:tabular-nums]">{props.side}</span>}
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
@keyframes cfg-fade { from { opacity: .35 } to { opacity: 1 } }
.cfg-fade { animation: cfg-fade .45s ease-out }
@keyframes cfg-in { from { opacity: 0; transform: translateY(14px) scale(.94) } to { opacity: 1; transform: none } }
.cfg-in { animation: cfg-in .5s cubic-bezier(.2,.8,.2,1) both }
@keyframes cfg-glow { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes cfg-charge { from { transform: scaleY(.15) } to { transform: scaleY(1) } }
.cfg-charge { animation: cfg-charge 1.6s cubic-bezier(.2,.8,.2,1) both }
.cfg-glow { animation: cfg-glow 2.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .cfg-fade, .cfg-in, .cfg-glow, .cfg-charge { animation: none } }
`;
