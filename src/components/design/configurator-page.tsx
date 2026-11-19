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
  const addOns = mix.batteryId !== null || Boolean(cfg.charger) || Boolean(mix.extras?.length);

  const special = announcementShows(view.announcement, todayInMarket());
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
      <header className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10 lg:py-8">
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
            <p className={eyebrow}>
              {view.indicative ? INDICATIVE_LABEL : "Your proposal"} · {view.customer.name}
            </p>
            <h1 className="mt-2 text-[28px] leading-[1.1] tracking-tight [font-family:var(--proposal-heading)] sm:text-[40px]">
              {headline}
            </h1>
            <p className="mt-2 text-[14px] text-muted">{view.customer.address}</p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="@container relative [&>div]:rounded-none [&>div]:border-0">
                <Roof view={shown} src={urls.roof} frame={cfg.sizes[0]?.roofPanels} />
                {/* What isn't on the roof, drawn on the home's wall in the picture's corner as it is chosen. */}
                {(battery || mix.ev) && (
                  <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-end gap-3 rounded-3xl bg-gradient-to-br from-[#202226] to-[#0d0e10] px-5 py-4 origin-bottom-right scale-[0.66] @3xl:scale-[0.82] @5xl:scale-100 shadow-[0_12px_32px_rgba(0,0,0,0.35)] ring-1 ring-white/10 sm:bottom-4 sm:right-4">
                    {mix.ev && <ChargerArt />}
                    {battery && (
                      <BatteryArt
                        key={`${battery.id}-${mix.extra ?? 0}-${Boolean(mix.backup)}`}
                        kwh={shown.system.batteryKwh}
                        qty={Math.min(8, battery.qty + (mix.extra ?? 0) + (mix.backup ? 1 : 0))}
                        backup={Boolean(mix.backup)}
                      />
                    )}
                  </div>
                )}
              </div>
              <Performance cfg={cfg} mix={mix} />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              The layout is a design, checked on site before anything is installed. A different panel goes in the same places. Output,
              offset and savings are estimates from your bill.
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
 * What the system does for the home, as rings (19 Nov 2026, Martin: "add some apple watch inspired analytics to show
 * the expected energy impacts of the system"): on black under the picture, three rings closing as the mix changes, each
 * an estimate from the mix's own figures. Outer, sun orange: the share of the home's power the system supplies (never
 * said to be more than 90%, `OFFSET_CAP`). Middle, green: the share of the bill it saves. Inner, sky: of the power the
 * panels alone can't supply (mostly evenings), the share the battery does. What it makes a year under them.
 */
function Performance({ cfg, mix }: { cfg: ConfiguratorView; mix: ConfigVariant }) {
  const solar = mix.batteryId === null ? mix : (solarOnly(cfg, mix) ?? mix);
  const total = mix.bill ? Math.min(OFFSET_CAP, mix.bill.selfReliance) : 0;
  const fromPanels = solar.bill ? Math.min(OFFSET_CAP, solar.bill.selfReliance) : 0;
  const saved = mix.bill && mix.bill.now > 0 ? Math.min(1, Math.max(0, mix.bill.saving / mix.bill.now)) : 0;
  const evenings = mix.batteryId !== null && fromPanels < 1 ? Math.min(1, Math.max(0, (total - fromPanels) / (1 - fromPanels))) : 0;
  const rings = [
    {
      tone: RING.sun,
      share: total,
      label: "Home powered",
      value: mix.bill ? offsetWords(mix.bill.selfReliance) : "—",
      note: "of its power",
    },
    {
      tone: RING.leaf,
      share: saved,
      label: "Bill saved",
      value: mix.bill && mix.bill.saving > 0 ? dollars(mix.bill.saving) : "—",
      note: "a year",
    },
    {
      tone: RING.sky,
      share: evenings,
      label: "Evenings",
      value: mix.batteryId === null ? "—" : percent(evenings),
      note: mix.batteryId === null ? "add a battery" : "from the battery",
    },
  ];
  return (
    <div className="flex items-center gap-5 bg-[#0b0b0d] px-4 py-4 text-white sm:gap-7 sm:px-6">
      <Rings rings={rings} />
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-6">
        {rings.map((r) => (
          <div key={r.label} className="flex min-w-0 items-baseline justify-between gap-2 sm:block">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: r.tone }}>
              {r.label}
            </p>
            <p className="truncate text-[18px] font-semibold leading-none tracking-tight [font-variant-numeric:tabular-nums] sm:mt-1 sm:text-[24px]">
              {r.value}
            </p>
            <p className="mt-1 hidden text-[11.5px] text-white/55 sm:block">{r.note}</p>
          </div>
        ))}
        <p className="text-[11.5px] text-white/45 sm:col-span-3 sm:-mt-1">
          {mix.production ? `Makes about ${mix.production.yearKwh.toLocaleString("en-AU")} kWh a year. ` : ""}Estimates from your bill.
        </p>
      </div>
    </div>
  );
}

/** The rings' colours: vivid on black, as a watch's are; our own, not any maker's. */
const RING = { sun: "#ff8a3d", leaf: "#3ddc84", sky: "#4cc2ff" } as const;

/** Three rings, one inside the next, each closing to its share with a round end; the track the same hue, dim. */
function Rings({ rings }: { rings: { tone: string; share: number; label: string }[] }) {
  const size = 92;
  const stroke = 10;
  const gap = 2.5;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + gap);
        const length = 2 * Math.PI * radius;
        const shown = Math.max(0.001, Math.min(1, r.share));
        return (
          <g key={r.label}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.tone} strokeOpacity={0.2} strokeWidth={stroke} />
            <circle
              className="cfg-ring"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={r.tone}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={length}
              strokeDashoffset={length * (1 - shown)}
              style={{ ["--ring-len" as string]: `${length}` }}
            />
          </g>
        );
      })}
    </svg>
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
function BatteryArt({ kwh, qty, backup }: { kwh: number; qty: number; backup: boolean }) {
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
    return { y, held: backup && m === 0 };
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
          {backup ? " · one held for blackouts" : ""}
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
   figures under it and the Order bar with a margin (about 30rem with the rings; 2.5rem more with the special's bar), times 1.6. */
@media (min-width: 1024px) {
  .cfg-home { max-width: max(26rem, calc((100dvh - 30rem) * 1.6)); margin-inline: auto; }
  .cfg-home-special { max-width: max(26rem, calc((100dvh - 32.5rem) * 1.6)); }
}
@keyframes cfg-ring { from { stroke-dashoffset: var(--ring-len) } }
.cfg-ring { transition: stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1); animation: cfg-ring 1.2s cubic-bezier(.2,.8,.2,1) both }
@keyframes cfg-fade { from { opacity: .35 } to { opacity: 1 } }
.cfg-fade { animation: cfg-fade .45s ease-out }
@keyframes cfg-in { from { opacity: 0; transform: translateY(14px) scale(.94) } to { opacity: 1; transform: none } }
.cfg-in { animation: cfg-in .5s cubic-bezier(.2,.8,.2,1) both }
@keyframes cfg-glow { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes cfg-charge { from { transform: scaleY(.15) } to { transform: scaleY(1) } }
.cfg-charge { animation: cfg-charge 1.6s cubic-bezier(.2,.8,.2,1) both }
.cfg-glow { animation: cfg-glow 2.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .cfg-fade, .cfg-in, .cfg-glow, .cfg-charge, .cfg-fill, .cfg-ring { animation: none; transition: none } .cfg-sheen { display: none } }
`;
