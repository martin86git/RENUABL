"use client";

import clsx from "clsx";
import { BatteryFull, MapPin, PenTool, Plus, Search, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AddressEntry } from "@/components/consumer/address-entry";
import {
  DEFAULT_WAITING,
  WAITING_WINDOWS,
  attachable,
  designsDone,
  siteState,
  sitesOf,
  toDesign,
  waitedWords,
  windowLabel,
  type SiteLine,
  type WaitingWindow,
} from "@/lib/domain/design/design-home";
import { ROOF_IMAGE } from "@/lib/domain/design/roof-design";
import type { Address } from "@/lib/domain/types";
import { attachSite, listJobs, loadDesignHome, shortDate, type JobLine } from "@/lib/services/crm";
import type { DesignRoof } from "@/lib/services/design-store";
import type { DesignHomeData } from "@/lib/server/design-home-repo";
import { ui } from "./design-shell";

const WINDOW_KEY = "renuabl.design.waiting-window";
const head = "text-[11px] font-medium uppercase tracking-[0.16em] text-muted";

const roofPicture = (s: { lat: number; lng: number }) =>
  `/api/design/roof?lat=${s.lat.toFixed(6)}&lng=${s.lng.toFixed(6)}&size=${ROOF_IMAGE.width}x${ROOF_IMAGE.height}`;
const designHref = (jobId: string) => `/design/roof?job=${encodeURIComponent(jobId)}`;

/**
 * The design tool's home (1 Nov 2026, Martin: Primero's copied across, wave 6): one search for a deal or a new site,
 * what has been designed today and this week, the deals waiting for a design (so designers are always fed new work),
 * the roofs designed lately, and the sites drawn that aren't on a deal yet, each with the way to put it on one.
 */
export function DesignToolHome({ onPick, onOpen }: { onPick: (address: Address) => void; onOpen: (roof: DesignRoof) => void }) {
  const [data, setData] = useState<DesignHomeData | null>(null);
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [asks, setAsks] = useState(0);
  useEffect(() => {
    let gone = false;
    void Promise.all([loadDesignHome(), listJobs()]).then(([home, list]) => {
      if (gone) return;
      if (home.ok) setData(home);
      else setProblem(home.message);
      setJobs(list.ok ? list.jobs : []);
    });
    return () => {
      gone = true;
    };
  }, [asks]);

  const [window_, setWindow] = useState<WaitingWindow>(DEFAULT_WAITING);
  useEffect(() => {
    try {
      const kept = localStorage.getItem(WINDOW_KEY);
      const w = kept === "all" ? null : Number(kept);
      // Read once the page is in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (kept && (w === null || WAITING_WINDOWS.includes(w as WaitingWindow))) setWindow(w as WaitingWindow);
    } catch {
      // Storage is off: 30 days.
    }
  }, []);
  const pickWindow = (w: WaitingWindow) => {
    setWindow(w);
    try {
      localStorage.setItem(WINDOW_KEY, w === null ? "all" : String(w));
    } catch {
      // It still changes for this visit.
    }
  };

  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const waiting = data ? toDesign(data.waiting, now, window_) : null;
  const done = data ? designsDone(data.firstSent, now) : null;
  const sites = data ? sitesOf(data.sites) : null;
  const allWaiting = data ? toDesign(data.waiting, now, null).list : [];
  // + New site: to the canvas's address box on the right.
  const siteBox = useRef<HTMLDivElement>(null);
  const newSite = () => {
    const box = siteBox.current;
    box?.scrollIntoView({ behavior: "smooth", block: "center" });
    requestAnimationFrame(() => box?.querySelector("input")?.focus({ preventScroll: true }));
  };

  return (
    // Split in two (1 Nov 2026, Martin, as Primero's: too much unused space): the designer's front door and its lists on
    // the left; on the right, the designer's canvas waiting for an address.
    <div className={clsx(ui.page, "grid items-start gap-5 xl:grid-cols-2")}>
      <div className="min-w-0 space-y-5">
        <FrontDoor jobs={jobs} onNewSite={newSite} />
        {problem && (
          <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
            {problem}
          </p>
        )}

        <div className="flex flex-col-reverse gap-5">
          <section className={clsx(ui.card, "p-5")} aria-labelledby="waiting">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 id="waiting" className="text-[15px] font-semibold text-ink">
                  Waiting for a design
                </h2>
                <p className="mt-0.5 text-xs text-muted">Deals still being sold with no design yet, the longest waiting first.</p>
              </div>
              <div role="radiogroup" aria-label="How far back" className="flex rounded-md border border-line bg-surface-2 p-0.5 text-xs">
                {WAITING_WINDOWS.map((w) => (
                  <button
                    key={String(w)}
                    role="radio"
                    aria-checked={window_ === w}
                    onClick={() => pickWindow(w)}
                    className={clsx(
                      "rounded-[5px] px-2.5 py-1",
                      window_ === w ? "bg-surface text-ink shadow-[0_1px_3px_rgba(11,11,12,0.12)]" : "text-ink-2",
                    )}
                  >
                    {windowLabel(w)}
                  </button>
                ))}
              </div>
            </div>
            {!waiting ? (
              <p className="mt-4 text-sm text-muted">Loading…</p>
            ) : !waiting.list.length ? (
              <p className="mt-4 text-sm text-ink-2">
                Nothing waiting{window_ ? ` from the last ${window_} days` : ""}. Every deal being sold has a design.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {waiting.list.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/design/deals/${encodeURIComponent(j.id)}`}
                        className="block truncate text-sm font-medium text-ink hover:underline"
                      >
                        {j.customerName} · {j.title}
                      </Link>
                      <p className="truncate text-xs text-muted">{j.address || "No address yet"}</p>
                    </div>
                    <span className={clsx("shrink-0 text-xs tabular-nums", j.late ? "font-medium text-danger" : "text-muted")}>
                      {waitedWords(j.days)}
                    </span>
                    {j.placed ? (
                      <Link href={designHref(j.id)} className={clsx(ui.primary, "h-9 shrink-0 px-3")}>
                        <PenTool className="size-4" aria-hidden /> Design it
                      </Link>
                    ) : (
                      <Link
                        href={`/design/deals/${encodeURIComponent(j.id)}`}
                        className={clsx(ui.quiet, "h-9 shrink-0 px-3")}
                        title="The deal needs an address on the map first"
                      >
                        Add an address
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {waiting && waiting.older > 0 && (
              <p className="mt-3 text-xs text-muted">
                {waiting.older} older {waiting.older === 1 ? "deal" : "deals"} left out.{" "}
                <button className="font-medium text-ink-2 underline underline-offset-4" onClick={() => pickWindow(null)}>
                  Show all
                </button>
              </p>
            )}
          </section>

          <section className="rounded-lg bg-primary p-5 text-white" aria-labelledby="done">
            <h2 id="done" className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">
              Designs completed today
            </h2>
            <p className="mt-2 text-[44px] font-light leading-none tabular-nums text-sun-line">{done?.today.length ?? "–"}</p>
            {done && done.today.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {done.today.map((d) => (
                  <li key={d.jobId}>
                    <Link
                      href={`/design/deals/${encodeURIComponent(d.jobId)}`}
                      className="rounded-full bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20"
                    >
                      {d.customerName}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {done && (
              <>
                <div className="mt-5 flex h-20 items-end gap-2" aria-label={`${done.weekTotal} this week`}>
                  {done.week.map((d) => {
                    const top = Math.max(1, ...done.week.map((x) => x.count));
                    return (
                      <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.count}`}>
                        <span className="text-[10px] tabular-nums text-white/60">{d.count || ""}</span>
                        <span
                          className={clsx("w-full rounded-sm", d.today ? "bg-sun-line" : "bg-white/25")}
                          style={{ height: `${Math.max(3, (d.count / top) * 48)}px` }}
                        />
                        <span className={clsx("text-[10px]", d.today ? "text-white" : "text-white/50")}>{d.label}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-white/70">
                  {done.weekTotal} this week ·{" "}
                  {allWaiting.length
                    ? `${allWaiting.length} waiting, the oldest ${allWaiting[0].days} ${allWaiting[0].days === 1 ? "day" : "days"}`
                    : "nothing waiting"}
                </p>
              </>
            )}
          </section>
        </div>

        {sites && sites.recent.length > 0 && (
          <section aria-labelledby="recent">
            <h2 id="recent" className={head}>
              Recent designs
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {sites.recent.map((s) => (
                <li key={s.id}>
                  <SiteCard site={s} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {sites && sites.loose.length > 0 && (
          <section className={clsx(ui.card, "p-5")} aria-labelledby="loose">
            <h2 id="loose" className="text-[15px] font-semibold text-ink">
              Sites not on a deal yet
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Drawn from an address with no deal. Put one on a deal that has no address yet, and the deal finds its roof.
            </p>
            <ul className="mt-3 divide-y divide-line">
              {sites.loose.map((s) => (
                <LooseSite key={s.id} site={s} jobs={jobs ?? []} onOpen={onOpen} onAttached={() => setAsks((n) => n + 1)} />
              ))}
            </ul>
          </section>
        )}
      </div>
      <SiteCanvas onPick={onPick} box={siteBox} />
    </div>
  );
}

/**
 * The designer's canvas, waiting for an address (1 Nov 2026, Martin, as Primero's): the right half of the design home,
 * drawn as the designer at rest (its graphite ground, a roof in fine orange lines, the tools faint at its corners), with
 * one box in the middle. Picking an address opens that roof in the designer as a new site. It stays in view as the
 * left side scrolls.
 */
function SiteCanvas({ onPick, box }: { onPick: (address: Address) => void; box: React.RefObject<HTMLDivElement | null> }) {
  const faint = "flex size-8 items-center justify-center rounded-full bg-white/[0.06] text-white/25";
  return (
    <section
      aria-label="Start a design from an address"
      className="relative flex min-h-[32rem] flex-col overflow-hidden rounded-[28px] bg-primary text-white xl:sticky xl:top-28 xl:h-[calc(100dvh-9rem)]"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(90% 70% at 50% 45%, rgba(255,90,31,0.16), transparent 70%), linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 32px 32px, 32px 32px",
        }}
      />
      <svg
        aria-hidden
        viewBox="0 0 400 300"
        className="pointer-events-none absolute inset-x-0 top-[8%] mx-auto w-[70%] max-w-lg opacity-60"
      >
        <path d="M60 210 L140 90 L300 90 L350 210 Z" fill="none" className="stroke-sun-line" strokeWidth="1.2" strokeDasharray="4 5" />
        <path
          d="M140 90 L210 150 L300 90 M210 150 L210 210"
          fill="none"
          className="stroke-sun-line"
          strokeWidth="0.8"
          strokeOpacity="0.5"
        />
        {Array.from({ length: 2 }, (_, row) =>
          Array.from({ length: 5 }, (_, i) => (
            <rect
              key={`${row}-${i}`}
              x={222 + i * 22 - row * 6}
              y={158 + row * 24}
              width="19"
              height="21"
              rx="1.5"
              fill="rgba(255,90,31,0.08)"
              className="stroke-sun-line"
              strokeWidth="0.9"
            />
          )),
        )}
      </svg>
      <div aria-hidden className="absolute left-4 top-4 flex gap-1.5 rounded-full bg-white/[0.04] p-1">
        <span className={faint}>
          <PenTool className="size-4" />
        </span>
        <span className={faint}>
          <Plus className="size-4" />
        </span>
      </div>
      <div aria-hidden className="absolute bottom-4 left-4 flex gap-1.5 rounded-full bg-white/[0.04] p-1">
        <span className={faint}>
          <Search className="size-4" />
        </span>
      </div>
      <div aria-hidden className="absolute right-4 top-4 flex gap-1.5 rounded-full bg-white/[0.04] p-1">
        <span className={faint}>
          <Sun className="size-4" />
        </span>
        <span className={faint}>
          <BatteryFull className="size-4" />
        </span>
      </div>
      <div ref={box} className="relative z-10 m-auto w-full max-w-md px-6 pt-24 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-sun-line text-white shadow-[0_6px_24px_rgba(255,90,31,0.45)]">
          <PenTool className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">Start a design</h2>
        <p className="mt-1 text-sm text-white/60">Type an address. Its roof opens, ready to design.</p>
        <div className="mt-5 text-left text-ink">
          <AddressEntry compact placeholder="Street address of the site" onPick={onPick} />
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/50">
          <MapPin className="size-3.5" aria-hidden /> Draw it now and put it on a deal later.
        </p>
      </div>
    </section>
  );
}

/**
 * The designer's own front door (1 Nov 2026, Martin, as Primero's: it should feel like a special feature): a warm pad
 * with the orange pen, a short search for a customer's deal, and + New site for a roof with no deal.
 */
function FrontDoor({ jobs, onNewSite }: { jobs: JobLine[] | null; onNewSite: () => void }) {
  const [typed, setTyped] = useState("");
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
  const found =
    words.length && jobs
      ? jobs.filter((j) => words.every((w) => `${j.customerName} ${j.title} ${j.address}`.toLowerCase().includes(w))).slice(0, 6)
      : [];
  return (
    <section
      className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_140%_at_100%_0%,rgba(255,90,31,0.16)_0%,rgba(255,90,31,0.05)_38%,var(--color-surface)_72%)] p-6 ring-1 ring-sun-line/30"
      aria-label="Find a deal or start a new site"
    >
      <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sun-line text-white shadow-[0_6px_20px_rgba(255,90,31,0.35)]">
          <PenTool className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink">Design</h1>
          <p className="text-sm text-ink-2">Draw the roof, quote it and send the proposal, in one place.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            id="find-deal"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && found.length === 1)
                window.location.href = found[0].lat !== null ? designHref(found[0].id) : `/design/deals/${found[0].id}`;
            }}
            placeholder="Find a deal: customer, deal or address"
            aria-label="Find a customer's deal"
            className="block h-11 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-ink"
          />
        </div>
        <button
          type="button"
          onClick={onNewSite}
          title="Design a roof that isn't on a deal yet"
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-sun-line px-4 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(255,90,31,0.35)] hover:brightness-105"
        >
          <Plus className="size-4" aria-hidden /> New site
        </button>
      </div>
      {words.length > 0 && (
        <ul className="mt-2 space-y-1">
          {found.length ? (
            found.map((j) => (
              <li key={j.id}>
                <Link
                  href={j.lat !== null ? designHref(j.id) : `/design/deals/${encodeURIComponent(j.id)}`}
                  className="flex items-baseline justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm hover:bg-surface-2"
                >
                  <span className="truncate text-ink">
                    {j.customerName} · {j.title}
                  </span>
                  <span className="shrink-0 truncate text-xs text-muted">{j.lat !== null ? j.address : "No address yet"}</span>
                </Link>
              </li>
            ))
          ) : (
            <li className="px-2.5 py-1.5 text-sm text-muted">
              No deal found.{" "}
              <button type="button" onClick={onNewSite} className="font-medium text-ink underline underline-offset-4">
                Design a new site
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function SiteCard({ site, onOpen }: { site: SiteLine; onOpen: (roof: DesignRoof) => void }) {
  const body = (
    <>
      {/* The same picture the designer opens on, so it comes from the browser's own copy. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={roofPicture(site)} alt="" className="aspect-[8/5] w-full rounded-t-lg bg-surface-2 object-cover" loading="lazy" />
      <span className="block px-2.5 py-2">
        <span className="block truncate text-[13px] font-medium text-ink">{site.customerName ?? site.address.split(",")[0]}</span>
        <span className="mt-0.5 flex items-center justify-between gap-1 text-[11px] text-muted">
          <span className="tabular-nums">{site.kw ? `${site.kw.toFixed(2)} kW` : "No panels"}</span>
          <span>{shortDate(site.updatedAt)}</span>
        </span>
        <span
          className={clsx(
            "mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
            site.published ? "bg-positive-soft text-positive" : site.jobId ? "bg-surface-2 text-ink-2" : "bg-sun text-sun-ink",
          )}
        >
          {siteState(site)}
        </span>
      </span>
    </>
  );
  const box = "block overflow-hidden rounded-lg bg-surface text-left ring-1 ring-line hover:ring-forest";
  return site.jobId ? (
    <Link href={designHref(site.jobId)} className={box}>
      {body}
    </Link>
  ) : (
    <button type="button" className={clsx(box, "w-full")} onClick={() => onOpen({ address: site.address, lat: site.lat, lng: site.lng })}>
      {body}
    </button>
  );
}

function LooseSite({
  site,
  jobs,
  onOpen,
  onAttached,
}: {
  site: SiteLine;
  jobs: JobLine[];
  onOpen: (roof: DesignRoof) => void;
  onAttached: () => void;
}) {
  const choices = attachable(jobs);
  const [to, setTo] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const attach = async () => {
    if (!to) return;
    const res = await attachSite(site.id, to);
    if (!res.ok) return setNote(res.message);
    setNote(null);
    onAttached();
  };
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <button
        type="button"
        onClick={() => onOpen({ address: site.address, lat: site.lat, lng: site.lng })}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate text-sm font-medium text-ink hover:underline">{site.address}</span>
        <span className="text-xs tabular-nums text-muted">
          {site.panels} panels · {site.kw.toFixed(2)} kW · {shortDate(site.updatedAt)}
        </span>
      </button>
      {choices.length ? (
        <div className="flex items-center gap-2">
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label={`A deal for ${site.address}`}
            className={clsx(ui.input, "h-9 min-h-9 w-56")}
          >
            <option value="">Put it on a deal…</option>
            {choices.map((j) => (
              <option key={j.id} value={j.id}>
                {j.customerName} · {j.title}
              </option>
            ))}
          </select>
          <button type="button" className={clsx(ui.quiet, "h-9 px-3")} disabled={!to} onClick={() => void attach()}>
            Attach
          </button>
        </div>
      ) : (
        <span className="text-xs text-muted">No deal without an address to put it on.</span>
      )}
      {note && (
        <p className="w-full text-xs text-danger" role="alert">
          {note}
        </p>
      )}
    </li>
  );
}
