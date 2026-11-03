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
import { AerialRoof, type AerialRoofSpec } from "./aerial-roof";
import { ListingRoofExample } from "./designer-showcase";
import { Breakdown } from "./marketplace";

/**
 * The Marketplace as an installer will use it, drawn on the launch page (2 Nov 2026, Martin: "it would be more
 * convincing if they could see what the marketplace looks like as an interface", influenced by eBay, social media and
 * Facebook Marketplace, a feed showing how job opportunities are served and how installers engage). Made-up
 * businesses and jobs; everything it does is what the Marketplace does: jobs within the distance chosen, closing
 * soonest at the top, sealed bids, the address once a bid is chosen.
 */

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
  /** The roof as the listing shows it, drawn (aerial-roof.tsx); "example" is the front page's made-up home. */
  roof: AerialRoofSpec | "example";
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
    roof: { form: "gable", finish: "charcoal-tile", at: [160, 64, 320, 186], panels: { north: 14 }, seed: 3 },
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
    roof: { form: "hip", finish: "monument", at: [150, 56, 340, 196], panels: { north: 22 }, seed: 7 },
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
    roof: { form: "ell", finish: "terracotta", at: [130, 60, 300, 160], wing: [330, 100, 70], panels: {}, pool: true, seed: 11 },
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
    roof: { form: "flat", finish: "zinc", at: [150, 26, 340, 286], scale: 9, panels: { north: 64 }, seed: 17 },
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
  {
    id: "mtw",
    poster: "Eastside Energy (example)",
    initials: "EE",
    posted: "20m",
    suburb: "Mount Waverley, VIC",
    km: 5,
    minutesLeft: 4 * 1440 + 11 * 60,
    from: "19 Nov",
    bids: 2,
    watching: 5,
    guide: 2900,
    roof: { form: "hip", finish: "charcoal-tile", at: [150, 60, 330, 190], panels: { north: 14 }, seed: 21 },
    system: sys({ kw: 6.65, panels: 14, inverter: "5 kW hybrid", batteryKwh: 16, arrays: 1, strings: 1 }),
  },
  {
    id: "oak",
    poster: "Clayton Solar Co (example)",
    initials: "CS",
    posted: "50m",
    suburb: "Oakleigh, VIC",
    km: 4,
    minutesLeft: 9 * 60 + 40,
    from: "12 Nov",
    bids: 4,
    watching: 6,
    guide: 2100,
    roof: { form: "gable", finish: "surfmist", at: [170, 70, 300, 176], panels: { north: 11 }, seed: 23 },
    system: sys({ kw: 5.23, panels: 11, inverter: "5 kW string inverter", roof: "Tin", arrays: 1, strings: 1 }),
  },
  {
    id: "chel",
    poster: "Bayside Power (example)",
    initials: "BP",
    posted: "4h",
    suburb: "Cheltenham, VIC",
    km: 13,
    minutesLeft: 3 * 1440 + 5 * 60,
    from: "24 Nov",
    bids: 3,
    watching: 4,
    guide: null,
    roof: { form: "hip", finish: "terracotta", at: [140, 54, 350, 200], panels: { north: 14, west: 6 }, seed: 29 },
    system: sys({ kw: 9.5, panels: 20, inverter: "8 kW hybrid", batteryKwh: 24, arrays: 2, strings: 2, switchboard: "included" }),
  },
  {
    id: "ber",
    poster: "Southern Cross Solar (example)",
    initials: "SC",
    posted: "6h",
    suburb: "Berwick, VIC",
    km: 33,
    minutesLeft: 5 * 1440 + 15 * 60,
    from: "2 Dec",
    bids: 1,
    watching: 3,
    guide: 4600,
    roof: { form: "hip", finish: "monument", at: [120, 44, 390, 220], panels: { north: 22, east: 6 }, pool: true, seed: 31 },
    system: sys({
      kw: 13.3,
      panels: 28,
      inverter: "10 kW three-phase hybrid",
      batteryKwh: 24,
      ev: true,
      storeys: "Double",
      roof: "Tin",
      phases: "Three",
      arrays: 2,
      strings: 3,
      switchboard: "to-confirm",
    }),
  },
  {
    id: "ring",
    poster: "Harbour Energy (example)",
    initials: "HE",
    posted: "1h",
    suburb: "Ringwood, VIC",
    km: 24,
    minutesLeft: 1440 + 3 * 60,
    from: "17 Nov",
    bids: 2,
    watching: 2,
    guide: null,
    roof: {
      form: "ell",
      finish: "charcoal-tile",
      at: [120, 40, 320, 160],
      wing: [316, 124, 110],
      panels: { north: 10, wing: 6 },
      seed: 37,
    },
    system: sys({ kw: 6.18, panels: 13, inverter: "5 kW hybrid", batteryKwh: 16, arrays: 2, strings: 2 }),
  },
  {
    id: "ment",
    poster: "Peninsula Solar (example)",
    initials: "PS",
    posted: "3h",
    suburb: "Mentone, VIC",
    km: 16,
    minutesLeft: 2 * 1440 + 20 * 60,
    from: "21 Nov",
    bids: 0,
    watching: 1,
    guide: 2500,
    roof: { form: "skillion", finish: "woodland", at: [170, 60, 290, 180], panels: { north: 13 }, seed: 41 },
    system: sys({ kw: 6.18, panels: 13, inverter: "5 kW string inverter", roof: "Tin, skillion", arrays: 1, strings: 1 }),
  },
  {
    id: "narre",
    poster: "Southside Solar (example)",
    initials: "SO",
    posted: "8h",
    suburb: "Narre Warren, VIC",
    km: 27,
    minutesLeft: 4 * 1440 + 2 * 60,
    from: "26 Nov",
    bids: 3,
    watching: 5,
    guide: null,
    roof: { form: "hip", finish: "shale", at: [140, 56, 350, 200], panels: { north: 14, east: 8 }, seed: 43 },
    system: sys({ kw: 10.45, panels: 22, inverter: "10 kW hybrid", batteryKwh: 16, ev: true, roof: "Tin", arrays: 2, strings: 2 }),
  },
  {
    id: "bri",
    poster: "Bayside Power (example)",
    initials: "BP",
    posted: "2d",
    suburb: "Brighton, VIC",
    km: 15,
    minutesLeft: 22 * 60 + 30,
    from: "14 Nov",
    bids: 6,
    watching: 9,
    guide: 4200,
    roof: { form: "hip", finish: "terracotta", at: [130, 50, 370, 210], panels: { north: 18, west: 6 }, pool: true, seed: 47 },
    system: sys({
      kw: 11.4,
      panels: 24,
      inverter: "10 kW hybrid",
      batteryKwh: 32,
      storeys: "Double",
      arrays: 2,
      strings: 3,
      switchboard: "included",
    }),
  },
  {
    id: "wer",
    poster: "Western Suns (example)",
    initials: "WS",
    posted: "5h",
    suburb: "Werribee, VIC",
    km: 47,
    minutesLeft: 6 * 1440 + 4 * 60,
    from: "3 Dec",
    bids: 1,
    watching: 2,
    guide: 2800,
    roof: { form: "gable", finish: "charcoal-tile", at: [150, 66, 330, 184], panels: { north: 14 }, seed: 53 },
    system: sys({ kw: 6.65, panels: 14, inverter: "5 kW string inverter", arrays: 1, strings: 1 }),
  },
  {
    id: "moor",
    poster: "Metro Commercial Solar (example)",
    initials: "MC",
    posted: "1d",
    suburb: "Moorabbin, VIC",
    km: 10,
    minutesLeft: 5 * 1440 + 8 * 60,
    from: "8 Dec",
    bids: 2,
    watching: 4,
    guide: null,
    roof: { form: "flat", finish: "zinc", at: [120, 30, 400, 280], scale: 10, panels: { north: 42 }, seed: 59 },
    system: sys({
      kw: 19.95,
      panels: 42,
      inverter: "20 kW three-phase",
      roof: "Flat, Kliplok",
      phases: "Three",
      arrays: 3,
      strings: 4,
      tiltFrames: true,
      switchboard: "to-confirm",
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

/** `bare`: the job feed alone, inside the showroom (marketplace-showroom.tsx), which draws the frame and the menu. */
export function MarketplaceFeed({ bare = false }: { bare?: boolean } = {}) {
  const [chosenTab, setTab] = useState<"jobs" | "stock">("jobs");
  const tab = bare ? "jobs" : chosenTab;
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
      {!bare && (
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-sun-line">{LAUNCH.feedEyebrow}</p>
          <h2 className="mt-3 text-[clamp(32px,5vw,60px)] font-light leading-[1.02] tracking-[-0.03em] text-ink">{LAUNCH.feedHeadline}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2">{LAUNCH.feedSub}</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-sun/60 px-3.5 py-1.5 text-[13px] font-medium text-ink">
            <Gavel className="size-3.5 text-sun-line" aria-hidden /> {LAUNCH.feedTry}
          </p>
        </div>
      )}

      {/* The app, framed. */}
      <div
        className={clsx(
          "relative overflow-hidden bg-canvas",
          !bare && "mt-12 rounded-[22px] shadow-[0_30px_80px_-30px_rgba(11,11,12,0.35)] ring-1 ring-line",
        )}
      >
        {!bare && (
          <div className="flex h-9 items-center gap-1.5 border-b border-line bg-surface px-4" aria-hidden>
            <span className="size-2.5 rounded-full bg-line" />
            <span className="size-2.5 rounded-full bg-line" />
            <span className="size-2.5 rounded-full bg-line" />
            <span className="ml-3 text-[12px] text-muted">Marketplace · {tab === "jobs" ? "Job listings" : "Equipment"}</span>
          </div>
        )}

        <div className="grid lg:grid-cols-[13.5rem_minmax(0,1fr)_17rem]">
          {/* Filters, as a rail on wide screens and chips above the feed on a phone. */}
          <aside className="hidden border-r border-line bg-surface p-4 lg:block">
            {!bare && <Tabs tab={tab} setTab={setTab} jobs={feed.length} />}
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
                {!bare && (
                  <>
                    <Chip on={tab === "jobs"} onClick={() => setTab("jobs")}>
                      Jobs
                    </Chip>
                    <Chip on={tab === "stock"} onClick={() => setTab("stock")}>
                      Equipment
                    </Chip>
                  </>
                )}
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
      {!bare && <p className="mt-3 text-center text-xs text-muted">{LAUNCH.feedNote}</p>}
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
        {j.roof === "example" ? (
          <ListingRoofExample className="block aspect-[16/9] w-full object-cover" />
        ) : (
          <AerialRoof spec={j.roof} className="block aspect-[16/9] w-full" />
        )}
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
