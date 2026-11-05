"use client";

import clsx from "clsx";
import { ArrowRight, Check, Flame, MapPin, PenTool, Plus, Search, Sun, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { goUnderneath, inDrawer, openDesigner } from "./design-drawer";
import { useEffect, useMemo, useRef, useState } from "react";
import { AddressEntry } from "@/components/consumer/address-entry";
import { inLaunchMarket, outsideMarketMessage, type AddressSuggestion } from "@/lib/domain/address";
import type { DealPulse } from "@/lib/domain/design/deal-heat";
import {
  attachable,
  designsDone,
  siteState,
  sitesOf,
  toDesign,
  waitedWords,
  type SiteLine,
  type Waiting,
} from "@/lib/domain/design/design-home";
import { ROOF_IMAGE } from "@/lib/domain/design/roof-design";
import type { Address } from "@/lib/domain/types";
import { resolveAddress, suggestAddresses } from "@/lib/services/consumer";
import { attachSite, listJobs, loadDesignHome, saveJob, shortDate, type JobLine } from "@/lib/services/crm";
import { loadPulses } from "@/lib/services/deal-pulse";
import { cleanKind } from "@/lib/domain/design/business-kind";
import { useDesignAccount } from "./design-account";
import type { DesignRoof } from "@/lib/services/design-store";
import type { DesignHomeData } from "@/lib/server/design-home-repo";
import { ui } from "./design-shell";

const head = "text-[11px] font-medium uppercase tracking-[0.16em] text-muted";
const roofPicture = (s: { lat: number; lng: number }) =>
  `/api/design/roof?lat=${s.lat.toFixed(6)}&lng=${s.lng.toFixed(6)}&size=${ROOF_IMAGE.width}x${ROOF_IMAGE.height}`;
const designHref = (jobId: string) => `/design/roof?job=${encodeURIComponent(jobId)}`;
const lineOf = (a: Address) => [a.line, a.suburb, a.state, a.postcode].filter(Boolean).join(", ");
const newSession = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));

/** Waiting deals, the one most worth designing first: the hottest and nearest the end of its clock, then the longest waiting. */
function rankQueue(list: readonly Waiting[], pulses: Record<string, DealPulse>): Waiting[] {
  return [...list].sort((a, b) => {
    if (a.placed !== b.placed) return a.placed ? -1 : 1;
    const pa = pulses[a.id]?.priority ?? -Infinity;
    const pb = pulses[b.id]?.priority ?? -Infinity;
    return pb !== pa ? pb - pa : b.days - a.days;
  });
}

/**
 * The design tool's home (1 Nov 2026, Martin: "what do I design next, and how fast can I be drawing it?", and it should
 * feel like a product of its own). RENUABL Design's own masthead with the round orange + for a new design; one bar for a
 * deal or an address; Up next, the deal most worth designing now on its own roof, with the designer warmed up behind
 * it; the rest of the queue as roof cards; and Carry on, the designs started and not yet sent.
 */
export function DesignToolHome({ onPick, onOpen }: { onPick: (address: Address) => void; onOpen: (roof: DesignRoof) => void }) {
  const [data, setData] = useState<DesignHomeData | null>(null);
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  const [pulses, setPulses] = useState<Record<string, DealPulse>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [asks, setAsks] = useState(0);
  const bar = useRef<HTMLInputElement>(null);
  // An installer designs sites, not deals: it has no CRM to ask (business-kind.ts).
  const [account] = useDesignAccount();
  // Null until the account is known, so nothing is asked of the CRM before it is clear this business has one.
  const deals = account ? cleanKind(account.signedIn ? account.business?.kind : undefined) === "retailer" : null;
  useEffect(() => {
    if (deals === null) return;
    let gone = false;
    const none = { ok: false as const, message: "" };
    void Promise.all([loadDesignHome(), deals ? listJobs() : Promise.resolve(none), deals ? loadPulses() : Promise.resolve(none)]).then(
      ([home, list, pulse]) => {
        if (gone) return;
        if (home.ok) setData(home);
        else setProblem(home.message);
        setJobs(list.ok ? list.jobs : []);
        if (pulse.ok) setPulses(pulse.pulses);
      },
    );
    return () => {
      gone = true;
    };
  }, [asks, deals]);
  // "/" anywhere on the page goes to the bar, as in the tools people already know.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || t?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      bar.current?.focus();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const queue = data ? rankQueue(toDesign(data.waiting, now, null).list, pulses) : null;
  const done = data ? designsDone(data.firstSent, now) : null;
  const sites = data ? sitesOf(data.sites) : null;
  const next = queue?.[0]?.placed ? queue[0] : null;
  const rest = queue ? queue.filter((w) => w !== next) : [];
  // Started and not yet sent: the roofs saved but not published, newest first.
  const carryOn = sites
    ? [...sites.recent, ...sites.loose].filter((s, i, all) => !s.published && all.findIndex((x) => x.id === s.id) === i)
    : [];

  return (
    <div className={clsx(ui.page, "mx-auto max-w-6xl space-y-8 pb-10")}>
      <header className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-sun-line">
            <PenTool className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-[26px] font-semibold leading-none tracking-[-0.03em] text-ink">
              RENUABL <span className="font-light text-ink-2">Design</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              {deals === false ? "Draw the roof, string it, price it." : "Draw the roof, price it, send it."}
              {done && done.weekTotal > 0 ? ` · ${done.weekTotal} designed this week` : ""}
            </p>
          </div>
        </div>
      </header>

      <FindBar inputRef={bar} jobs={jobs} deals={deals !== false} onPick={onPick} />

      {problem && (
        <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      {queue === null ? (
        <div className="h-72 animate-pulse rounded-[28px] bg-surface-2" aria-label="Loading" />
      ) : next ? (
        <UpNext deal={next} pulse={pulses[next.id]} />
      ) : (
        !rest.length && <AllDesigned deals={deals !== false} />
      )}

      {rest.length > 0 && (
        <section aria-labelledby="queue">
          <div className="flex items-baseline justify-between">
            <h2 id="queue" className={head}>
              Waiting for a design · {rest.length}
            </h2>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((w) => (
              <li key={w.id}>
                <QueueCard deal={w} pulse={pulses[w.id]} onPlaced={() => setAsks((n) => n + 1)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {carryOn.length > 0 && (
        <section aria-labelledby="carry-on">
          <h2 id="carry-on" className={head}>
            Carry on
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {deals === false ? "Designs started, newest first." : "Designs started and not sent yet, newest first."}
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {carryOn.map((s) => (
              <li key={s.id}>
                <SiteCard site={s} jobs={jobs ?? []} deals={deals !== false} onOpen={onOpen} onAttached={() => setAsks((n) => n + 1)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * One bar for everything: a deal by customer, deal or address, or a street address for a new site, side by side as
 * they type. The round orange + beside it is the way to a new design: it puts the bar into "a new site".
 */
function FindBar({
  inputRef,
  jobs,
  deals: hasDeals,
  onPick,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  jobs: JobLine[] | null;
  /** False for an installer: no deals to find, only addresses. */
  deals: boolean;
  onPick: (a: Address) => void;
}) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [places, setPlaces] = useState<{ of: string; rows: AddressSuggestion[] } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [newSite, setNewSite] = useState(false);
  const session = useRef("");
  const asked = typed.trim();
  useEffect(() => {
    session.current = newSession();
  }, []);
  useEffect(() => {
    if (asked.length < 3) return;
    const stop = new AbortController();
    const t = setTimeout(async () => {
      const result = await suggestAddresses(asked, session.current, stop.signal);
      if (!stop.signal.aborted) setPlaces({ of: asked, rows: result.suggestions.slice(0, 5) });
    }, 220);
    return () => {
      clearTimeout(t);
      stop.abort();
    };
  }, [asked]);
  const words = asked.toLowerCase().split(/\s+/).filter(Boolean);
  const deals =
    !newSite && words.length && jobs
      ? jobs.filter((j) => words.every((w) => `${j.customerName} ${j.title} ${j.address}`.toLowerCase().includes(w))).slice(0, 5)
      : [];
  const found = places && places.of === asked ? places.rows : [];
  const openPlace = async (s: AddressSuggestion) => {
    const address = await resolveAddress(s.id, session.current);
    session.current = newSession();
    if (!address) return setNote("We couldn't find that exact address. Pick the street address from the list.");
    if (!inLaunchMarket(address)) {
      const m = outsideMarketMessage(address);
      return setNote(`${m.title} ${m.body}`);
    }
    onPick(address);
  };
  const openDeal = (j: JobLine) => {
    if (j.lat !== null) return openDesigner(designHref(j.id), router);
    const deal = `/design/deals/${encodeURIComponent(j.id)}`;
    if (inDrawer()) goUnderneath(deal);
    else router.push(deal);
  };
  const open = asked.length >= 2;
  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            "flex min-w-0 flex-1 items-center gap-3 rounded-full bg-surface px-5 shadow-[var(--shadow-soft)] ring-1 transition",
            newSite ? "ring-2 ring-sun-line" : "ring-line focus-within:ring-ink/40",
          )}
        >
          {newSite ? (
            <MapPin className="size-5 shrink-0 text-sun-line" aria-hidden />
          ) : (
            <Search className="size-5 shrink-0 text-muted" aria-hidden />
          )}
          <input
            ref={inputRef}
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              setNote(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setTyped("");
                setNewSite(false);
              }
              if (e.key !== "Enter") return;
              if (deals[0]) openDeal(deals[0]);
              else if (found[0]) void openPlace(found[0]);
            }}
            placeholder={
              newSite
                ? "The new site's street address"
                : hasDeals
                  ? "Find a deal, or type an address to design"
                  : "Type an address to design"
            }
            aria-label={newSite ? "The new site's street address" : hasDeals ? "Find a deal or an address" : "An address to design"}
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
          />
          {newSite ? (
            <button
              type="button"
              onClick={() => setNewSite(false)}
              aria-label="Back to finding a deal"
              className="text-muted hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : (
            <kbd className="hidden rounded border border-line px-1.5 text-[11px] text-muted sm:inline">/</kbd>
          )}
        </div>
        {/* A new design: the round orange +, as Primero's gold one (Martin). */}
        <button
          type="button"
          onClick={() => {
            setNewSite(true);
            inputRef.current?.focus();
          }}
          title="Start a new design from an address"
          aria-label="New design"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-sun-line text-white shadow-[0_8px_24px_rgba(255,90,31,0.35)] transition hover:scale-105 hover:brightness-105 motion-reduce:transition-none"
        >
          <Plus className="size-7" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      {(open || note) && (
        <div
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-surface shadow-lift ring-1 ring-line"
          role="listbox"
        >
          {note && <p className="px-5 py-3 text-sm text-warning">{note}</p>}
          {deals.length > 0 && (
            <div className="py-2">
              <p className={clsx(head, "px-5 py-1")}>Deals</p>
              {deals.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => openDeal(j)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-2 text-left hover:bg-surface-2"
                >
                  <span className="truncate text-sm text-ink">
                    {j.customerName} · {j.title}
                  </span>
                  <span className="shrink-0 truncate text-xs text-muted">{j.lat !== null ? j.address : "Not on the map yet"}</span>
                </button>
              ))}
            </div>
          )}
          {found.length > 0 && (
            <div className={clsx("py-2", deals.length > 0 && "border-t border-line")}>
              <p className={clsx(head, "px-5 py-1")}>A new site</p>
              {found.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => void openPlace(s)}
                  className="flex w-full items-center gap-3 px-5 py-2 text-left hover:bg-surface-2"
                >
                  <MapPin className="size-4 shrink-0 text-sun-line" aria-hidden />
                  <span className="truncate text-sm text-ink">{s.main}</span>
                  <span className="truncate text-xs text-muted">{s.secondary.replace(/, Australia$/, "")}</span>
                </button>
              ))}
            </div>
          )}
          {open && !deals.length && !found.length && !note && <p className="px-5 py-3 text-sm text-muted">Searching…</p>}
        </div>
      )}
    </div>
  );
}

/** Chips for a deal's temperature and clock, from the business's own record. */
function Pulse({ pulse, dark }: { pulse?: DealPulse; dark?: boolean }) {
  if (!pulse) return null;
  const hot = pulse.heat.heat === "hot";
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {hot && (
        <span className="inline-flex items-center gap-1 rounded-full bg-sun-line px-2 py-0.5 text-[11px] font-semibold text-white">
          <Flame className="size-3" aria-hidden /> Hot
        </span>
      )}
      <span
        className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium", dark ? "bg-white/15 text-white" : "bg-surface-2 text-ink-2")}
      >
        {pulse.clock.words}
      </span>
    </span>
  );
}

/**
 * Up next: the deal most worth designing now, large on its own roof, with what is ready and one button. The designer
 * is warmed up behind it (its page and the roof picture fetched as this shows), so Design it opens straight onto the roof.
 */
function UpNext({ deal, pulse }: { deal: Waiting; pulse?: DealPulse }) {
  const router = useRouter();
  const href = designHref(deal.id);
  useEffect(() => {
    router.prefetch(href);
  }, [router, href]);
  // The warmest sign from the customer, when there is one.
  const warm = pulse?.heat.reasons.find((r) => r.weight > 0);
  const ready: [string, boolean][] = [
    ["On the map", deal.placed],
    ["What they want", Boolean(deal.title)],
    [warm?.text ?? "No word from them yet", Boolean(warm)],
  ];
  return (
    <section aria-labelledby="up-next" className="group relative overflow-hidden rounded-[28px] bg-primary text-white shadow-lift">
      {deal.lat !== null && deal.lng !== null && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={roofPicture({ lat: deal.lat, lng: deal.lng })}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-80 transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
        />
      )}
      <div
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,20,22,0.92)_0%,rgba(20,20,22,0.7)_45%,rgba(20,20,22,0.1)_100%)]"
        aria-hidden
      />
      <div className="relative flex min-h-[19rem] flex-col justify-between gap-6 p-7 sm:p-9">
        <div>
          <p id="up-next" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sun-line">
            Up next
          </p>
          <h2 className="mt-2 text-[34px] font-semibold leading-tight tracking-[-0.03em]">{deal.customerName}</h2>
          <p className="mt-1 text-[15px] text-white/75">
            {deal.title} · {deal.address}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pulse pulse={pulse} dark />
            <span className="text-xs text-white/60">{waitedWords(deal.days)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <ul className="space-y-1.5 text-sm">
            {ready.map(([words, ok]) => (
              <li key={words} className={clsx("flex items-center gap-2", ok ? "text-white" : "text-white/55")}>
                <span
                  className={clsx("flex size-4 items-center justify-center rounded-full", ok ? "bg-sun-line" : "border border-white/40")}
                >
                  {ok && <Check className="size-3 text-white" strokeWidth={3} aria-hidden />}
                </span>
                {words}
              </li>
            ))}
          </ul>
          <Link
            href={href}
            className="inline-flex h-14 items-center gap-2.5 rounded-full bg-sun-line px-7 text-[16px] font-semibold text-white shadow-[0_10px_30px_rgba(255,90,31,0.45)] transition hover:gap-3.5 hover:brightness-105 motion-reduce:transition-none"
          >
            <PenTool className="size-5" aria-hidden /> Design it <ArrowRight className="size-5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Every deal has a design: a calm sun, and nothing to do. An installer, with no deals, is shown the way to start. */
function AllDesigned({ deals = true }: { deals?: boolean }) {
  return (
    <section className="flex flex-col items-center rounded-[28px] bg-surface px-6 py-14 text-center ring-1 ring-line">
      <Sun className="size-10 text-sun-line" strokeWidth={1.4} aria-hidden />
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">{deals ? "Every deal has a design." : "Design a site."}</h2>
      <p className="mt-1 text-sm text-muted">
        {deals
          ? "New deals waiting for a roof show up here. Or press + to design a new site."
          : "Press + and find the address. Each new site is one design job."}
      </p>
    </section>
  );
}

/** A waiting deal as a roof card; one not on the map yet takes its address right here. */
function QueueCard({ deal, pulse, onPlaced }: { deal: Waiting; pulse?: DealPulse; onPlaced: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const place = async (a: Address) => {
    if (typeof a.lat !== "number" || typeof a.lng !== "number") return setNote("Pick the street address from the list.");
    const res = await saveJob(deal.id, { address: lineOf(a), lat: a.lat, lng: a.lng });
    if (!res.ok) return setNote(res.message);
    onPlaced();
  };
  const words = (
    <span className="block px-4 py-3">
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-ink">{deal.customerName}</span>
          <span className="block truncate text-xs text-muted">
            {deal.title} · {deal.address || "No address yet"}
          </span>
        </span>
        <span className={clsx("shrink-0 text-[11px] tabular-nums", deal.late ? "font-medium text-danger" : "text-muted")}>
          {waitedWords(deal.days)}
        </span>
      </span>
      <span className="mt-2 block">
        <Pulse pulse={pulse} />
      </span>
    </span>
  );
  if (deal.placed && deal.lat !== null && deal.lng !== null)
    return (
      <Link
        href={designHref(deal.id)}
        className="group block overflow-hidden rounded-2xl bg-surface ring-1 ring-line transition hover:shadow-lift hover:ring-ink/30"
      >
        <span className="block overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={roofPicture({ lat: deal.lat, lng: deal.lng })}
            alt=""
            loading="lazy"
            className="aspect-[16/9] w-full bg-surface-2 object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] motion-reduce:transition-none"
          />
        </span>
        {words}
      </Link>
    );
  return (
    <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex aspect-[16/9] flex-col justify-center gap-2 bg-surface-2 px-4">
        <p className="text-xs font-medium text-ink-2">Place it on the map to design it</p>
        <AddressEntry compact placeholder={deal.address || "Street address"} onPick={(a) => void place(a)} />
        {note && <p className="text-xs text-danger">{note}</p>}
      </div>
      {words}
    </div>
  );
}

/** A design started and not sent: its roof, where it stands, and for a site with no deal, the way to put it on one. */
function SiteCard({
  site,
  jobs,
  deals,
  onOpen,
  onAttached,
}: {
  site: SiteLine;
  jobs: JobLine[];
  /** False for an installer, which has no deals to put a site on. */
  deals: boolean;
  onOpen: (roof: DesignRoof) => void;
  onAttached: () => void;
}) {
  const [attaching, setAttaching] = useState(false);
  const [to, setTo] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const choices = attachable(jobs);
  const attach = async () => {
    if (!to) return;
    const res = await attachSite(site.id, to);
    if (!res.ok) return setNote(res.message);
    onAttached();
  };
  const body = (
    <>
      <span className="block overflow-hidden">
        {/* The same picture the designer opens on, so it comes from the browser's own copy. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={roofPicture(site)}
          alt=""
          loading="lazy"
          className="aspect-[8/5] w-full bg-surface-2 object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] motion-reduce:transition-none"
        />
      </span>
      <span className="block px-3 py-2.5">
        <span className="block truncate text-[13px] font-medium text-ink">{site.customerName ?? site.address.split(",")[0]}</span>
        <span className="mt-0.5 flex items-center justify-between gap-1 text-[11px] text-muted">
          <span className="tabular-nums">{site.kw ? `${site.kw.toFixed(2)} kW` : "No panels yet"}</span>
          <span>{shortDate(site.updatedAt)}</span>
        </span>
        <span
          className={clsx(
            "mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
            site.jobId ? "bg-surface-2 text-ink-2" : "bg-sun text-sun-ink",
          )}
        >
          {siteState(site)}
        </span>
      </span>
    </>
  );
  const box =
    "group block w-full overflow-hidden rounded-2xl bg-surface text-left ring-1 ring-line transition hover:shadow-lift hover:ring-ink/30";
  return (
    <div>
      {site.jobId ? (
        <Link href={designHref(site.jobId)} className={box}>
          {body}
        </Link>
      ) : (
        <button type="button" className={box} onClick={() => onOpen({ address: site.address, lat: site.lat, lng: site.lng })}>
          {body}
        </button>
      )}
      {!site.jobId &&
        deals &&
        (attaching ? (
          <div className="mt-2 space-y-1.5">
            {choices.length ? (
              <>
                <select
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  aria-label={`A deal for ${site.address}`}
                  className={clsx(ui.input, "h-9 min-h-9 w-full text-xs")}
                >
                  <option value="">Choose a deal…</option>
                  {choices.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.customerName} · {j.title}
                    </option>
                  ))}
                </select>
                <button type="button" className={clsx(ui.quiet, "h-8 w-full text-xs")} disabled={!to} onClick={() => void attach()}>
                  Put it on this deal
                </button>
              </>
            ) : (
              <p className="text-[11px] text-muted">No deal without an address to put it on.</p>
            )}
            {note && <p className="text-[11px] text-danger">{note}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAttaching(true)}
            className="mt-1.5 text-[11px] font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
          >
            Put on a deal
          </button>
        ))}
    </div>
  );
}
