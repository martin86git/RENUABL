"use client";

import clsx from "clsx";
import {
  Battery,
  Bell,
  BellRing,
  Check,
  Clock,
  Eye,
  Gavel,
  LayoutGrid,
  Lock,
  MapPin,
  MessageCircle,
  Package,
  Search,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LAUNCH, closesIn, servedFeed } from "@/lib/domain/design/marketplace-launch";
import type { ListingSystem } from "@/lib/domain/design/marketplace";
import { ListingRoofExample } from "./designer-showcase";
import { Breakdown } from "./marketplace";

/**
 * The Marketplace as an installer will use it, drawn on the launch page (2 Nov 2026, Martin: "it would be more
 * convincing if they could see what the marketplace looks like as an interface", influenced by eBay, social media and
 * Facebook Marketplace, a feed showing how job opportunities are served and how installers engage). Made-up
 * businesses and jobs; everything it does is what the Marketplace does: jobs within the distance chosen, closing
 * soonest at the top, sealed bids, the address once a bid is chosen.
 */

type Roof = "hip" | "gable" | "ell" | "flat";

interface FeedJob {
  id: string;
  poster: string;
  initials: string;
  posted: string;
  suburb: string;
  km: number;
  minutesLeft: number;
  from: string;
  bids: number;
  /** How many people are watching it (never who). */
  watching: number;
  guide: number | null;
  roof: Roof | "example";
  system: ListingSystem;
}

const sys = (s: Partial<ListingSystem> & Pick<ListingSystem, "kw" | "panels">): ListingSystem => ({
  panel: "475 W panels",
  inverter: "",
  batteryKwh: 0,
  battery: "",
  ev: false,
  storeys: "Single",
  roof: "Tile",
  phases: "Single",
  arrays: 2,
  strings: 2,
  tiltFrames: false,
  switchboard: "excluded",
  ...s,
});

/** Made-up jobs near a made-up base in Clayton. */
const JOBS: FeedJob[] = [
  {
    id: "glen",
    poster: "Sunrise Solar (example)",
    initials: "SS",
    posted: "2h",
    suburb: "Glen Waverley, VIC",
    km: 6,
    minutesLeft: 5 * 1440 + 4 * 60,
    from: "18 Nov",
    bids: 3,
    watching: 4,
    guide: null,
    roof: "example",
    system: sys({
      kw: 8.55,
      panels: 18,
      inverter: "8 kW three-phase hybrid",
      batteryKwh: 16,
      ev: true,
      roof: "Tile, and a flat garage",
      phases: "Three",
      arrays: 3,
      strings: 3,
      tiltFrames: true,
      switchboard: "included",
    }),
  },
  {
    id: "box",
    poster: "Harbour Energy (example)",
    initials: "HE",
    posted: "35m",
    suburb: "Box Hill, VIC",
    km: 14,
    minutesLeft: 18 * 60 + 5,
    from: "11 Nov",
    bids: 1,
    watching: 2,
    guide: 3200,
    roof: "gable",
    system: sys({ kw: 6.65, panels: 14, inverter: "5 kW string inverter", arrays: 1, strings: 1 }),
  },
  {
    id: "frank",
    poster: "Bayside Power (example)",
    initials: "BP",
    posted: "5h",
    suburb: "Frankston, VIC",
    km: 31,
    minutesLeft: 2 * 1440 + 9 * 60,
    from: "20 Nov",
    bids: 5,
    watching: 7,
    guide: null,
    roof: "hip",
    system: sys({
      kw: 10.45,
      panels: 22,
      inverter: "10 kW hybrid",
      batteryKwh: 16,
      storeys: "Double",
      roof: "Tin",
      arrays: 3,
      strings: 3,
      switchboard: "to-confirm",
    }),
  },
  {
    id: "pak",
    poster: "Greenline Electrical (example)",
    initials: "GE",
    posted: "1d",
    suburb: "Pakenham, VIC",
    km: 42,
    minutesLeft: 3 * 1440 + 2 * 60,
    from: "25 Nov",
    bids: 0,
    watching: 1,
    guide: 2400,
    roof: "ell",
    system: sys({ kw: 0, panels: 0, panel: "", inverter: "Battery inverter", batteryKwh: 24, arrays: 0, strings: 0 }),
  },
  {
    id: "dandy",
    poster: "Southside Solar (example)",
    initials: "SO",
    posted: "3h",
    suburb: "Dandenong South, VIC",
    km: 9,
    minutesLeft: 6 * 1440 + 20 * 60,
    from: "1 Dec",
    bids: 2,
    watching: 3,
    guide: null,
    roof: "flat",
    system: sys({
      kw: 30.4,
      panels: 64,
      inverter: "30 kW three-phase",
      roof: "Flat, Kliplok",
      phases: "Three",
      arrays: 4,
      strings: 6,
      tiltFrames: true,
    }),
  },
];

/** Made-up stock, as the equipment feed shows it. */
const STOCK = [
  { title: "12 × 475 W panels", line: "Unused, in the box", price: "$95 each", km: 8, seller: "Sunrise Solar (example)" },
  { title: "5 kW hybrid inverter", line: "Swapped out, 1 year old", price: "Make an offer", km: 21, seller: "Bayside Power (example)" },
  { title: "8 kWh battery module", line: "New, spare from a job", price: "$2,400", km: 34, seller: "Harbour Energy (example)" },
  { title: "Rail, 4.8 m × 40", line: "Pick up only", price: "$18 each", km: 5, seller: "Southside Solar (example)" },
];

const DISTANCES = [
  { km: 25, label: "25 km" },
  { km: 50, label: "50 km" },
  { km: null, label: "Anywhere" },
] as const;

const money = (n: number) => `$${n.toLocaleString("en-AU")}`;
const headline = (s: ListingSystem) =>
  [s.kw ? `${s.kw.toFixed(2)} kW solar` : null, s.batteryKwh ? `${s.batteryKwh} kWh battery` : null, s.ev ? "EV charger" : null]
    .filter(Boolean)
    .join(" + ");

interface MyBid {
  job: string;
  amount: number;
  start: string;
}

export function MarketplaceFeed() {
  const [tab, setTab] = useState<"jobs" | "stock">("jobs");
  const [within, setWithin] = useState<number | null>(50);
  const [battery, setBattery] = useState(false);
  const [ev, setEv] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [bidding, setBidding] = useState<string | null>(null);
  const [bids, setBids] = useState<MyBid[]>([]);
  const [won, setWon] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [watched, setWatched] = useState<string[]>([]);
  const [alerts, setAlerts] = useState(false);
  const watch = (id: string) => setWatched((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));

  const feed = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return servedFeed(JOBS, within).filter(
      (j) =>
        (!battery || (j.system.batteryKwh ?? 0) > 0) &&
        (!ev || j.system.ev) &&
        words.every((w) => `${j.suburb} ${j.poster} ${headline(j.system)}`.toLowerCase().includes(w)),
    );
  }, [within, battery, ev, query]);

  // The first bid placed is chosen a little later, as the seller would choose one some days on.
  useEffect(() => {
    if (!bids.length || won) return;
    const first = bids[0].job;
    const t = setTimeout(() => {
      setWon(first);
      setToast(first);
    }, 2600);
    return () => clearTimeout(t);
  }, [bids, won]);

  const place = (job: string, amount: number, start: string) => {
    setBids((b) => [...b.filter((x) => x.job !== job), { job, amount, start }]);
    setBidding(null);
  };
  const withdraw = (job: string) => setBids((b) => b.filter((x) => x.job !== job));
  const jobOf = (id: string) => JOBS.find((j) => j.id === id)!;

  return (
    <section>
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-sun-line">{LAUNCH.feedEyebrow}</p>
        <h2 className="mt-3 text-[clamp(32px,5vw,60px)] font-light leading-[1.02] tracking-[-0.03em] text-ink">{LAUNCH.feedHeadline}</h2>
        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">{LAUNCH.feedSub}</p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-sun/60 px-3.5 py-1.5 text-[13px] font-medium text-ink">
          <Gavel className="size-3.5 text-sun-line" aria-hidden /> {LAUNCH.feedTry}
        </p>
      </div>

      {/* The app, framed. */}
      <div className="relative mt-12 overflow-hidden rounded-[22px] bg-canvas shadow-[0_30px_80px_-30px_rgba(11,11,12,0.35)] ring-1 ring-line">
        <div className="flex h-9 items-center gap-1.5 border-b border-line bg-surface px-4" aria-hidden>
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="ml-3 text-[12px] text-muted">Marketplace · {tab === "jobs" ? "Job listings" : "Equipment"}</span>
        </div>

        <div className="grid lg:grid-cols-[13.5rem_minmax(0,1fr)_17rem]">
          {/* Filters, as a rail on wide screens and chips above the feed on a phone. */}
          <aside className="hidden border-r border-line bg-surface p-4 lg:block">
            <Tabs tab={tab} setTab={setTab} jobs={feed.length} />
            {tab === "jobs" && (
              <>
                <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Within</p>
                <div className="mt-2 space-y-1">
                  {DISTANCES.map((d) => (
                    <RailButton key={d.label} on={within === d.km} onClick={() => setWithin(d.km)}>
                      {d.label}
                    </RailButton>
                  ))}
                </div>
                <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Only show</p>
                <div className="mt-2 space-y-1">
                  <RailButton on={battery} onClick={() => setBattery((b) => !b)}>
                    <Battery className="size-4" aria-hidden /> With a battery
                  </RailButton>
                  <RailButton on={ev} onClick={() => setEv((v) => !v)}>
                    <Zap className="size-4" aria-hidden /> With an EV charger
                  </RailButton>
                </div>
              </>
            )}
            <p className="mt-6 flex items-center gap-1.5 text-[12px] text-muted">
              <MapPin className="size-3.5" aria-hidden /> Your base: Clayton
            </p>
            {/* Job alerts: new jobs near the base emailed as they are listed. */}
            <div className={clsx("mt-4 rounded-xl p-3 ring-1", alerts ? "bg-sun/50 ring-sun-line/40" : "bg-canvas ring-line")}>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                {alerts ? <BellRing className="size-4 text-sun-line" aria-hidden /> : <Bell className="size-4" aria-hidden />} Job alerts
              </p>
              <p className="mt-1 text-[12px] leading-snug text-ink-2">
                {alerts ? "New jobs within 50 km are emailed to you as they're listed." : "Hear about new jobs near you as they're listed."}
              </p>
              <button
                type="button"
                aria-pressed={alerts}
                onClick={() => setAlerts((a) => !a)}
                className={clsx(
                  "mt-2 h-8 w-full rounded-lg text-[12.5px] font-medium transition",
                  alerts ? "bg-surface text-ink-2 ring-1 ring-line" : "bg-ink text-canvas",
                )}
              >
                {alerts ? "Turn off" : "Turn on"}
              </button>
            </div>
          </aside>

          <div className="min-w-0 border-line lg:border-r">
            <div className="z-10 space-y-3 lg:sticky lg:top-0 border-b border-line bg-canvas/95 p-3 backdrop-blur sm:p-4">
              <label className="flex h-10 items-center gap-2 rounded-full bg-surface px-4 ring-1 ring-line">
                <Search className="size-4 text-muted" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tab === "jobs" ? "Search jobs by suburb or system" : "Search equipment"}
                  aria-label="Search the example feed"
                  className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
                />
              </label>
              <div className="flex gap-2 overflow-x-auto lg:hidden">
                <Chip on={tab === "jobs"} onClick={() => setTab("jobs")}>
                  Jobs
                </Chip>
                <Chip on={tab === "stock"} onClick={() => setTab("stock")}>
                  Equipment
                </Chip>
                {tab === "jobs" &&
                  DISTANCES.map((d) => (
                    <Chip key={d.label} on={within === d.km} onClick={() => setWithin(d.km)}>
                      {d.label}
                    </Chip>
                  ))}
                {tab === "jobs" && (
                  <Chip on={battery} onClick={() => setBattery((b) => !b)}>
                    Battery
                  </Chip>
                )}
              </div>
            </div>

            <div className="space-y-4 p-3 sm:p-4 lg:h-[46rem] lg:overflow-y-auto lg:overscroll-contain">
              {tab === "jobs" ? (
                feed.length ? (
                  feed.map((j) => (
                    <JobPost
                      key={j.id}
                      job={j}
                      open={open === j.id}
                      toggle={() => setOpen((o) => (o === j.id ? null : j.id))}
                      bidding={bidding === j.id}
                      startBid={() => setBidding(j.id)}
                      cancelBid={() => setBidding(null)}
                      mine={bids.find((b) => b.job === j.id) ?? null}
                      won={won === j.id}
                      place={(a, s) => place(j.id, a, s)}
                      withdraw={() => withdraw(j.id)}
                      watched={watched.includes(j.id)}
                      watch={() => watch(j.id)}
                    />
                  ))
                ) : (
                  <p className="py-16 text-center text-sm text-muted">No jobs match. Try a wider distance.</p>
                )
              ) : (
                <Stock query={query} />
              )}
            </div>
          </div>

          <aside className="hidden bg-surface p-4 lg:block">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">My bids</p>
            {bids.length ? (
              <ul className="mt-3 space-y-2">
                {bids.map((b) => {
                  const j = jobOf(b.job);
                  return (
                    <li key={b.job} className="rounded-xl bg-canvas p-3 ring-1 ring-line">
                      <p className="text-[13px] font-medium text-ink">{j.suburb.replace(", VIC", "")}</p>
                      <p className="text-[12px] text-muted">{headline(j.system)}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[15px] font-semibold tabular-nums text-ink">{money(b.amount)}</span>
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            won === b.job ? "bg-positive/15 text-positive" : "bg-surface-2 text-ink-2",
                          )}
                        >
                          {won === b.job ? "Chosen" : "Sealed · waiting"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] leading-relaxed text-muted">Bids you place show here, until the seller chooses one.</p>
            )}
            <p className="mt-8 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">How the feed works</p>
            <ul className="mt-3 space-y-3">
              {LAUNCH.feedRules.map((r, i) => {
                const Icon = [Clock, Lock, MapPin][i];
                return (
                  <li key={r} className="flex gap-2.5 text-[13px] leading-snug text-ink-2">
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-sun-line" aria-hidden /> {r}
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>

        {toast && (
          <div className="absolute inset-x-3 bottom-3 z-20 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink p-3.5 pr-2 text-canvas shadow-lift sm:bottom-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sun-line text-white">
              <Bell className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-canvas/60">Some days later</p>
              <p className="text-[14px] leading-snug">
                {jobOf(toast).poster} chose your bid for {jobOf(toast).suburb.replace(", VIC", "")}. The address and job card are yours.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Close"
              className="tap-area flex size-8 shrink-0 items-center justify-center rounded-full text-canvas/70 hover:text-canvas"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-muted">{LAUNCH.feedNote}</p>
    </section>
  );
}

function Tabs({ tab, setTab, jobs }: { tab: "jobs" | "stock"; setTab: (t: "jobs" | "stock") => void; jobs: number }) {
  return (
    <div className="space-y-1">
      <RailButton on={tab === "jobs"} onClick={() => setTab("jobs")}>
        <LayoutGrid className="size-4" aria-hidden /> Job listings
        <span className="ml-auto text-[12px] tabular-nums text-muted">{jobs}</span>
      </RailButton>
      <RailButton on={tab === "stock"} onClick={() => setTab("stock")}>
        <Package className="size-4" aria-hidden /> Equipment
      </RailButton>
    </div>
  );
}

function RailButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={clsx(
        "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13.5px] transition",
        on ? "bg-ink text-canvas" : "text-ink-2 hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={clsx(
        "h-8 shrink-0 rounded-full px-3.5 text-[13px] transition",
        on ? "bg-ink text-canvas" : "bg-surface text-ink-2 ring-1 ring-line",
      )}
    >
      {children}
    </button>
  );
}

function JobPost(props: {
  job: FeedJob;
  open: boolean;
  toggle: () => void;
  bidding: boolean;
  startBid: () => void;
  cancelBid: () => void;
  mine: MyBid | null;
  won: boolean;
  place: (amount: number, start: string) => void;
  withdraw: () => void;
  watched: boolean;
  watch: () => void;
}) {
  const { job: j, mine } = props;
  const watching = j.watching + (props.watched ? 1 : 0);
  const left = closesIn(j.minutesLeft);
  return (
    <article className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      {/* Who posted it, as a post in a feed. */}
      <header className="flex items-center gap-3 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-ink">
          {j.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">{j.poster}</p>
          <p className="text-[12px] text-muted">listed a job · {j.posted} ago</p>
        </div>
        <span className="flex items-center gap-1 text-[12px] tabular-nums text-muted">
          <MapPin className="size-3.5" aria-hidden /> {j.km} km
        </span>
      </header>

      <div className="relative bg-ink">
        {j.roof === "example" ? <ListingRoofExample className="block aspect-[16/9] w-full object-cover" /> : <FeedRoof shape={j.roof} />}
        <button
          type="button"
          onClick={props.watch}
          aria-pressed={props.watched}
          aria-label={props.watched ? "Stop watching" : "Watch"}
          title={props.watched ? "Watching" : "Watch"}
          className={clsx(
            "absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full shadow-sm transition",
            props.watched ? "bg-sun-line text-white" : "bg-surface/90 text-ink hover:bg-surface",
          )}
        >
          <Eye className="size-4" aria-hidden />
        </button>
        <span
          className={clsx(
            "absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums",
            left.soon ? "bg-sun-line text-white" : "bg-ink/80 text-white",
          )}
        >
          <Clock className="size-3" aria-hidden /> {left.words}
        </span>
        {(j.system.batteryKwh ?? 0) > 0 && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-1 text-[11.5px] font-medium text-ink">
            <Battery className="size-3" aria-hidden /> Battery
          </span>
        )}
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-semibold text-ink">{j.suburb}</p>
          <p className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">
            {j.guide ? `Guide ${money(j.guide)}` : "Open to offers"}
          </p>
        </div>
        <p className="mt-0.5 text-[14px] text-ink-2">{headline(j.system)}</p>
        <p className="mt-1 text-[12.5px] text-muted">
          {j.system.storeys} storey · {j.system.roof} · {j.system.phases.toLowerCase()} phase · from {j.from}
          {j.guide ? " · ex GST" : ""}
        </p>

        {/* Engagement, as an auction shows it: how many have bid (never what), and your own bid. */}
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-[13px] text-ink-2">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Gavel className="size-4" aria-hidden />
            <span className="tabular-nums">{j.bids + (mine ? 1 : 0)}</span> {j.bids + (mine ? 1 : 0) === 1 ? "bid" : "bids"}
            <span className="hidden sm:inline"> · sealed</span>
          </span>
          <span className="hidden items-center gap-1.5 whitespace-nowrap md:inline-flex">
            <Eye className="size-4" aria-hidden /> <span className="tabular-nums">{watching}</span> watching
          </span>
          <button type="button" onClick={props.toggle} className="tap-area whitespace-nowrap font-medium text-ink hover:underline">
            {props.open ? (
              "Hide details"
            ) : (
              <>
                <span className="sm:hidden">Details</span>
                <span className="hidden sm:inline">What&apos;s to install</span>
              </>
            )}
          </button>
          {!mine && !props.bidding && (
            <button
              type="button"
              onClick={props.startBid}
              className="ml-auto inline-flex h-9 shrink-0 items-center whitespace-nowrap gap-1.5 rounded-full bg-sun-line px-4 text-[13.5px] font-medium text-white transition hover:brightness-105"
            >
              Place a bid
            </button>
          )}
        </div>

        {props.open && <Breakdown listing={{ system: j.system }} narrow />}
        {props.bidding && <BidComposer guide={j.guide} place={props.place} cancel={props.cancelBid} />}
        {mine && (
          <div
            className={clsx(
              "mt-3 flex items-center gap-3 rounded-xl p-3",
              props.won ? "bg-positive/10 ring-1 ring-positive/30" : "bg-surface-2",
            )}
          >
            <Check className={clsx("size-4 shrink-0", props.won ? "text-positive" : "text-ink-2")} aria-hidden />
            <p className="flex-1 text-[13.5px] text-ink">
              {props.won ? (
                <>
                  <span className="font-semibold">Your bid was chosen.</span> The address, the seller&apos;s contact and the job card are
                  yours.
                </>
              ) : (
                <>
                  Your bid <span className="font-semibold tabular-nums">{money(mine.amount)}</span>, start {mine.start}. Only the seller
                  sees it.
                </>
              )}
            </p>
            {!props.won && (
              <button type="button" onClick={props.withdraw} className="tap-area text-[13px] font-medium text-ink-2 hover:text-ink">
                Take back
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

const STARTS = ["Mon 17 Nov", "Tue 18 Nov", "Thu 20 Nov"];

function BidComposer({
  guide,
  place,
  cancel,
}: {
  guide: number | null;
  place: (amount: number, start: string) => void;
  cancel: () => void;
}) {
  const [amount, setAmount] = useState(String(guide ?? 2950));
  const [start, setStart] = useState(STARTS[1]);
  const value = Number(amount.replace(/[^\d]/g, ""));
  return (
    <form
      className="mt-3 rounded-xl bg-surface-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (value > 0) place(value, start);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 items-center gap-1 rounded-lg bg-surface px-3 ring-1 ring-line">
          <span className="text-sm text-muted">$</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            aria-label="Your price for the installation, ex GST"
            className="w-20 bg-transparent text-[15px] tabular-nums text-ink outline-none"
          />
          <span className="text-[12px] text-muted">ex GST</span>
        </label>
        <div className="flex gap-1.5" role="group" aria-label="The first day you could start">
          {STARTS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={start === s}
              onClick={() => setStart(s)}
              className={clsx(
                "h-10 rounded-lg px-2.5 text-[12.5px] transition",
                start === s ? "bg-ink text-canvas" : "bg-surface text-ink-2 ring-1 ring-line",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          <Lock className="size-3.5" aria-hidden /> Only the seller sees your price
        </span>
        <button type="button" onClick={cancel} className="tap-area ml-auto text-[13px] text-ink-2 hover:text-ink">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!(value > 0)}
          className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-[13.5px] font-medium text-primary-ink disabled:bg-surface disabled:text-muted"
        >
          Place my bid
        </button>
      </div>
    </form>
  );
}

function Stock({ query }: { query: string }) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const items = STOCK.filter((s) => words.every((w) => `${s.title} ${s.line}`.toLowerCase().includes(w)));
  return (
    <ul className="grid grid-cols-2 gap-3">
      {items.map((s) => (
        <li key={s.title} className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-surface-2 to-surface">
            <Package className="size-10 text-ink-2" strokeWidth={1.2} aria-hidden />
          </div>
          <div className="p-3">
            <p className="text-[15px] font-semibold text-ink">{s.price}</p>
            <p className="truncate text-[13px] text-ink">{s.title}</p>
            <p className="truncate text-[12px] text-muted">
              {s.line} · {s.km} km
            </p>
            <p className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-ink-2">
              <MessageCircle className="size-3.5" aria-hidden /> Message {s.seller.replace(" (example)", "")}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * A made-up roof from above for the feed: blurred ground, the roof sharp with its panels. Drawn, never a real home.
 */
function FeedRoof({ shape }: { shape: Roof }) {
  const id = `feed-${shape}`;
  const roof: Record<Roof, { path: string; fill: string; panels: [number, number, number, number][] }> = {
    gable: {
      path: "M150 70 H450 V230 H150 Z",
      fill: "#8a6a5a",
      panels: rows(175, 82, 7, 2, 34, 52),
    },
    hip: {
      path: "M130 60 H470 V240 H130 Z",
      fill: "#7d8288",
      panels: [...rows(165, 76, 8, 2, 34, 52), ...rows(200, 190, 6, 1, 34, 40)],
    },
    ell: {
      path: "M140 60 H380 V150 H460 V250 H140 Z",
      fill: "#6f6a66",
      panels: [],
    },
    flat: {
      path: "M110 50 H490 V250 H110 Z",
      fill: "#b9bcc0",
      panels: [...rows(130, 70, 10, 2, 34, 52), ...rows(130, 175, 10, 1, 34, 52)],
    },
  };
  const r = roof[shape];
  return (
    <svg
      viewBox="0 0 600 300"
      className="block aspect-[16/9] w-full"
      role="img"
      aria-label="A roof design from above, everything round it blurred"
    >
      <defs>
        <filter id={`${id}-blur`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <clipPath id={`${id}-clip`}>
          <path d={r.path} />
        </clipPath>
      </defs>
      <g filter={`url(#${id}-blur)`}>
        <rect width="600" height="300" fill="#56664d" />
        <circle cx="70" cy="60" r="55" fill="#3e4d38" />
        <circle cx="540" cy="250" r="70" fill="#3b4935" />
        <rect x="0" y="262" width="600" height="38" fill="#8d8f8c" />
        <rect x="500" y="40" width="80" height="120" rx="8" fill="#7e9aa9" />
        <path d={r.path} fill={r.fill} />
      </g>
      <rect width="600" height="300" fill="#0b0b0c" fillOpacity="0.4" />
      <g clipPath={`url(#${id}-clip)`}>
        <path d={r.path} fill={r.fill} />
        {shape !== "flat" && <path d={ridgeOf(shape)} stroke="#000" strokeOpacity="0.25" strokeWidth="2" fill="none" />}
      </g>
      <path d={r.path} fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
      {r.panels.map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} fill="#16191d" stroke="#9aa3ad" strokeWidth="0.8" />
          <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke="#2b3138" strokeWidth="0.6" />
        </g>
      ))}
      {shape === "ell" && (
        <g>
          <rect x="300" y="200" width="44" height="30" rx="3" fill="#e8e6e1" stroke="#fff" />
          <text x="322" y="219" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1a1a1a">
            BAT
          </text>
        </g>
      )}
    </svg>
  );
}

/** Rows of portrait panels: n across, k rows, each w by h with a small gap. */
function rows(x: number, y: number, n: number, k: number, w: number, h: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let r = 0; r < k; r++) for (let c = 0; c < n; c++) out.push([x + c * (w + 2), y + r * (h + 2), w, h]);
  return out;
}

function ridgeOf(shape: Roof): string {
  if (shape === "gable") return "M150 150 H450";
  if (shape === "hip") return "M130 60 L220 150 H380 L470 60 M130 240 L220 150 M380 150 L470 240";
  return "M140 60 L260 150 V250 M260 150 L380 60";
}
