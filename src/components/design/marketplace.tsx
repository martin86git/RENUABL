"use client";

import clsx from "clsx";
import { ArrowLeft, Battery, Car, Check, Circle, MapPin, Store, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_OPEN_FOR,
  DISTANCES,
  OPEN_FOR,
  bidOrder,
  bidRefusal,
  browse,
  closesWords,
  listingBreakdown,
  systemLine,
  windowWords,
  type Distance,
  type Listing,
} from "@/lib/domain/design/marketplace";
import type { Address } from "@/lib/domain/types";
import type { Place } from "@/lib/domain/design/job-map";
import { todayInMarket } from "@/lib/domain/market";
import { AddressEntry } from "@/components/consumer/address-entry";
import { jobMapImage } from "@/lib/services/crm";
import {
  createListing,
  listingAction,
  listingPicturePath,
  loadListing,
  loadListings,
  marketplacePath,
  saveBase,
  type ListingDetail,
} from "@/lib/services/marketplace";
import { PATHS, PageHead, ui } from "./design-shell";

const money = (n: number) => `$${n.toLocaleString("en-AU")}`;
/** Suburb zoom: an area a few kilometres across, so the map shows where the work is without showing the home. */
const AREA_ZOOM = 12;
const DISTANCE_KEY = "renuabl.design.market-distance";
const STATE_WORDS: Record<string, string> = { open: "Taking bids", awarded: "Awarded", closed: "Closed", withdrawn: "Taken down" };

/**
 * The Marketplace (1 Nov 2026, Martin: "job listings just like Airbnb listings, and then bid to take on the
 * installation"): installers browse the jobs other businesses have listed near them, as cards, and bid; a business
 * lists its sold jobs from the deal and chooses a bid. Only the suburb, system and dates are ever shown to others.
 */
export function MarketplacePage({ view }: { view: "browse" | "mine" | "bids" }) {
  const [data, setData] = useState<{ listings: Listing[]; base: { lat: number; lng: number } | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [within, setWithin] = useState<Distance>(100);
  useEffect(() => {
    try {
      const kept = localStorage.getItem(DISTANCE_KEY);
      // Read once the page is in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (kept) setWithin(kept === "any" ? null : (Number(kept) as Distance));
    } catch {
      // Storage is off: 100 km.
    }
    void loadListings().then((res) => (res.ok ? setData(res) : setProblem(res.message)));
  }, []);
  const pick = (d: Distance) => {
    setWithin(d);
    try {
      localStorage.setItem(DISTANCE_KEY, d === null ? "any" : String(d));
    } catch {
      // It still changes for this visit.
    }
  };
  const today = todayInMarket();
  const shown = useMemo(() => {
    if (!data) return null;
    if (view === "browse") return browse(data.listings, data.base, within, today);
    if (view === "mine") return data.listings.filter((l) => l.mine).map((l) => ({ ...l, km: null }));
    return data.listings.filter((l) => l.myBid).map((l) => ({ ...l, km: null }));
  }, [data, view, within, today]);
  const title = view === "browse" ? "Job listings" : view === "mine" ? "My listings" : "My bids";
  return (
    <div className={clsx(ui.page, "space-y-5")}>
      <PageHead title={title}>
        {view === "browse" && data && (
          <div role="radiogroup" aria-label="How far" className="flex rounded-md border border-line bg-surface-2 p-0.5 text-sm">
            {DISTANCES.map((d) => (
              <button
                key={String(d)}
                role="radio"
                aria-checked={within === d}
                onClick={() => pick(d)}
                className={clsx(
                  "rounded-[5px] px-3 py-1",
                  within === d ? "bg-surface text-ink shadow-[0_1px_3px_rgba(11,11,12,0.12)]" : "text-ink-2",
                )}
              >
                {d === null ? "Anywhere" : `${d} km`}
              </button>
            ))}
          </div>
        )}
      </PageHead>
      <p className="-mt-2 text-sm text-ink-2">
        {view === "browse"
          ? "Installations other businesses need done, near you. Each shows the suburb, the system and the dates; the address and contact come once your bid is chosen."
          : view === "mine"
            ? "Jobs you've listed for installers to bid on. List a sold job from its deal page."
            : "Listings you've bid on, and where each stands."}
      </p>
      {view === "browse" && data && !data.base && <BaseNote what="job" onSaved={(base) => setData((d) => d && { ...d, base })} />}
      {problem && (
        <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {!shown ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !shown.length ? (
        <p className={clsx(ui.card, "p-6 text-sm text-ink-2")}>
          {view === "browse"
            ? "No jobs listed near you right now. Check back soon."
            : view === "mine"
              ? "You haven't listed a job yet."
              : "You haven't bid on a job yet."}
        </p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((l) => (
            <li key={l.id}>
              <ListingCard listing={l} km={l.km} today={today} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A listing as a card, the way a stay is shown: the place and the headline figure large, the rest in a few lines. */
const placeOf = (a: Address): Place | null =>
  typeof a.lat === "number" && typeof a.lng === "number"
    ? { address: [a.line, a.suburb, a.state, a.postcode].filter(Boolean).join(", "), lat: a.lat, lng: a.lng }
    : null;

/**
 * Where the business works from, asked for in place when it isn't marked (the Job map's base; an installer or an
 * inspector has no Job map), so distances show and the list keeps to what is near.
 */
export function BaseNote({ what, onSaved }: { what: "job" | "item"; onSaved: (base: { lat: number; lng: number }) => void }) {
  const [problem, setProblem] = useState<string | null>(null);
  const pick = async (a: Address) => {
    const place = placeOf(a);
    if (!place) return setProblem("That address couldn't be found on the map. Try another.");
    const res = await saveBase(place);
    if (!res.ok) return setProblem(res.message);
    if (res.base) onSaved(res.base);
  };
  return (
    <div className="rounded-md bg-sun px-4 py-3 text-sm text-sun-ink">
      <p>
        Where do you work from? Mark your base to see how far each {what} is and keep to those near you. Only the distance is shown, never
        your address.
      </p>
      <div className="mt-2 max-w-md">
        <AddressEntry compact placeholder="Your base address" onPick={(a) => void pick(a)} />
      </div>
      {problem && (
        <p className="mt-2 text-warning" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}

function ListingCard({ listing: l, km, today }: { listing: Listing; km: number | null; today: string }) {
  const closing = closesWords(l, today);
  return (
    <Link href={marketplacePath(l.id)} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-sun via-surface to-surface-2 ring-1 ring-line transition group-hover:ring-forest">
        {/* The roof design, everything round the roof blurred (listing-picture.ts); else the area, never the home: the
            point is rounded to about a kilometre and the map is at suburb zoom. */}
        {l.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listingPicturePath(l.id)}
            alt={`The roof design for the job in ${l.suburb}`}
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          l.near && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={jobMapImage({ ...l.near, zoom: AREA_ZOOM })}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
            />
          )
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" aria-hidden />
        <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm">
          {closing}
        </span>
        {l.myBid && (
          <span className="absolute right-3 top-3 rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-white">
            Your bid {money(l.myBid.amount)}
          </span>
        )}
        {l.mine && (
          <span className="absolute right-3 top-3 rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-white">
            {STATE_WORDS[l.status]}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-[44px] font-light leading-none tabular-nums text-ink">
            {l.system.kw ? l.system.kw.toFixed(1) : "–"}
            <span className="ml-1 text-lg text-ink-2">kW</span>
          </p>
          <div className="mt-2 flex gap-2 text-ink-2">
            {l.system.batteryKwh ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface/80 px-2 py-0.5 text-xs">
                <Battery className="size-3.5" aria-hidden /> {l.system.batteryKwh} kWh
              </span>
            ) : null}
            {l.system.ev && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface/80 px-2 py-0.5 text-xs">
                <Car className="size-3.5" aria-hidden /> EV
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2.5 px-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[15px] font-semibold text-ink">
            {l.suburb}
            {l.state ? `, ${l.state}` : ""}
          </p>
          {km !== null && <span className="shrink-0 text-xs tabular-nums text-muted">{km} km</span>}
        </div>
        <p className="truncate text-sm text-ink-2">{systemLine(l.system)}</p>
        <p className="text-sm text-ink-2">{windowWords(l.from, l.to)}</p>
        <p className="mt-1 text-sm">
          <span className="font-semibold text-ink">{l.guide ? `${money(l.guide)} guide` : "Open to offers"}</span>
          <span className="text-muted">
            {" "}
            · {l.bids} {l.bids === 1 ? "bid" : "bids"} · {l.business}
          </span>
        </p>
      </div>
    </Link>
  );
}

/** One listing: what is to be done, and for an installer the bid; for the poster the bids, and the handover once chosen. */
export function ListingPage({ id }: { id: string }) {
  const [d, setD] = useState<ListingDetail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void loadListing(id).then((res) => (res.ok ? setD(res) : setProblem(res.message)));
  }, [id]);
  const act = async (body: Record<string, unknown>) => {
    const res = await listingAction(id, body);
    if (!res.ok) {
      setProblem(res.message);
      return false;
    }
    setProblem(null);
    setD(res);
    return true;
  };
  const today = todayInMarket();
  if (!d)
    return (
      <div className={ui.page}>
        <p className="text-sm text-muted">{problem ?? "Loading…"}</p>
      </div>
    );
  const l = d.listing;
  const facts = [
    ["When", windowWords(l.from, l.to)],
    ["Guide price", l.guide ? `${money(l.guide)} ex GST` : "Open to offers"],
  ];
  return (
    <div className={clsx(ui.page, "space-y-5")}>
      <Link
        href={l.mine ? `${PATHS.marketplace}/mine` : PATHS.marketplace}
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> {l.mine ? "My listings" : "Job listings"}
      </Link>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className={clsx(ui.card, "overflow-hidden")}>
          {l.picture && (
            <figure className="relative bg-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listingPicturePath(l.id)}
                alt={`The roof design for the job in ${l.suburb}`}
                className="aspect-[4/3] w-full object-cover"
              />
              <figcaption className="absolute bottom-3 left-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] text-ink-2">
                The roof design · everything round the roof blurred
              </figcaption>
            </figure>
          )}
          {l.near && !l.picture && (
            <div className="relative h-56 bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={jobMapImage({ ...l.near, zoom: AREA_ZOOM })}
                alt={`The area around ${l.suburb}`}
                className="size-full object-cover"
              />
              <span
                className="absolute left-1/2 top-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sun-line bg-sun-line/15"
                aria-hidden
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] text-ink-2">
                Approximate area
              </span>
            </div>
          )}
          <div className="p-6">
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <MapPin className="size-4" aria-hidden /> {l.suburb}
              {l.state ? `, ${l.state}` : ""} {l.postcode}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{l.title}</h1>
            <p className="mt-1 text-sm text-ink-2">
              Listed by {l.business} · {closesWords(l, today)} · {l.bids} {l.bids === 1 ? "bid" : "bids"}
            </p>
            <Breakdown listing={l} />
            <dl className="mt-5 grid gap-x-6 gap-y-2 border-t border-line pt-4 text-sm sm:grid-cols-[auto_1fr]">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {l.notes && (
              <div className="mt-5 border-t border-line pt-4">
                <p className={ui.eyebrow}>About the job</p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink">{l.notes}</p>
              </div>
            )}
            {d.handover && (
              <div className="mt-5 rounded-lg bg-positive-soft p-4 text-sm">
                <p className="font-medium text-positive">Awarded to {d.handover.installer.business}</p>
                <p className="mt-2 text-ink">
                  <span className="text-muted">Address:</span> {d.handover.address}
                </p>
                <p className="text-ink">
                  <span className="text-muted">Listed by:</span> {d.handover.poster.business} · {d.handover.poster.email}
                </p>
                <p className="text-ink">
                  <span className="text-muted">Installer:</span> {d.handover.installer.business} · {d.handover.installer.email}
                </p>
                {d.handover.jobCard ? (
                  <>
                    <p className="mt-2 text-xs text-muted">
                      It&apos;s in your Jobs: the day, the customer&apos;s name and phone, the drawings, notes and photos.
                    </p>
                    <Link href={`/design/jobs/${encodeURIComponent(d.handover.jobCard)}`} className={clsx(ui.primary, "mt-3 h-9 px-3")}>
                      Open the job card
                    </Link>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-muted">The customer&apos;s own details are passed on by {d.handover.poster.business}.</p>
                )}
              </div>
            )}
          </div>
        </section>
        <aside className="space-y-4">
          {l.mine ? (
            <PosterSide d={d} act={act} />
          ) : (
            <BidBox key={`${l.myBid?.at ?? "new"}-${l.myBid?.status ?? ""}`} listing={l} today={today} act={act} />
          )}
          {problem && (
            <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
              {problem}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/** What an installer wants to know before pricing the job, row by row, each piece of work a clear yes or no. */
export function Breakdown({ listing: l, narrow }: { listing: Pick<Listing, "system">; narrow?: boolean }) {
  return (
    <div className="mt-5">
      <p className={ui.eyebrow}>What&apos;s to install</p>
      <dl className={clsx("mt-2 grid gap-px overflow-hidden rounded-lg bg-line ring-1 ring-line", !narrow && "sm:grid-cols-2")}>
        {listingBreakdown(l.system).map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 bg-surface px-3.5 py-2.5 text-sm">
            <dt className="text-muted">{r.label}</dt>
            <dd className={clsx("flex items-center gap-1.5 text-right", r.has === false ? "text-muted" : "text-ink")}>
              {r.has === true && <Check className="size-4 text-sun-line" aria-hidden />}
              {r.has === false && <X className="size-3.5" aria-hidden />}
              {r.has === null && r.label === "Switchboard upgrade" && <Circle className="size-3 text-muted" aria-hidden />}
              <span className="font-medium">{r.value}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function BidBox({ listing: l, today, act }: { listing: Listing; today: string; act: (b: Record<string, unknown>) => Promise<boolean> }) {
  const mine = l.myBid && l.myBid.status !== "withdrawn" ? l.myBid : null;
  const [amount, setAmount] = useState(mine ? String(mine.amount) : "");
  const [start, setStart] = useState(mine?.start ?? "");
  const [note, setNote] = useState(mine?.note ?? "");
  const refused = bidRefusal(l, today);
  if (mine && mine.status !== "open")
    return (
      <section className={clsx(ui.card, "p-5")}>
        <p className={ui.eyebrow}>Your bid</p>
        <p className="mt-1 text-2xl font-light tabular-nums text-ink">{money(mine.amount)}</p>
        <p className={clsx("mt-1 text-sm font-medium", mine.status === "accepted" ? "text-positive" : "text-muted")}>
          {mine.status === "accepted" ? "Accepted: the job is yours" : "Not chosen this time"}
        </p>
      </section>
    );
  return (
    <section className={clsx(ui.card, "p-5")}>
      <p className={ui.eyebrow}>{mine ? "Your bid" : "Bid for this job"}</p>
      {refused ? (
        <p className="mt-2 text-sm text-ink-2">{refused}</p>
      ) : (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ do: "bid", amount, start: start || null, note });
          }}
        >
          <label className={ui.label}>
            Your price for the installation, ex GST
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 2400"
              className={clsx(ui.input, "mt-1 tabular-nums")}
            />
          </label>
          <label className={ui.label}>
            The first day you could start
            <input type="date" min={today} value={start} onChange={(e) => setStart(e.target.value)} className={clsx(ui.input, "mt-1")} />
          </label>
          <label className={ui.label}>
            A note (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={600}
              placeholder="What's included, your crew, anything to check"
              className={clsx(ui.input, "mt-1 min-h-20 py-2")}
            />
          </label>
          <button type="submit" className={clsx(ui.primary, "w-full")} disabled={!amount}>
            {mine ? "Update my bid" : "Place my bid"}
          </button>
          {mine && (
            <button
              type="button"
              onClick={() => void act({ do: "withdraw-bid" })}
              className="w-full text-center text-xs text-muted underline underline-offset-4 hover:text-ink"
            >
              Take my bid back
            </button>
          )}
          <p className="text-xs text-muted">
            Contact details and links are taken out of notes: you&apos;re put in touch once your bid is chosen.
          </p>
        </form>
      )}
    </section>
  );
}

function PosterSide({ d, act }: { d: ListingDetail; act: (b: Record<string, unknown>) => Promise<boolean> }) {
  const l = d.listing;
  const bids = bidOrder(d.bids ?? []);
  return (
    <section className={clsx(ui.card, "p-5")}>
      <p className={ui.eyebrow}>Bids</p>
      {!bids.length ? (
        <p className="mt-2 text-sm text-ink-2">No bids yet. Installers near {l.suburb} can see it now.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {bids.map((b) => (
            <li
              key={b.id}
              className={clsx(
                "rounded-lg border p-3",
                b.status === "accepted" ? "border-positive bg-positive-soft" : "border-line",
                (b.status === "declined" || b.status === "withdrawn") && "opacity-60",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium text-ink">{b.business}</p>
                <p className="text-lg font-light tabular-nums text-ink">{money(b.amount)}</p>
              </div>
              <p className="text-xs text-muted">
                {b.start ? `Could start ${windowWords(b.start, null).replace("From ", "")}` : "Start to agree"} ·{" "}
                {b.status === "open" ? "Open" : b.status === "accepted" ? "Accepted" : b.status === "withdrawn" ? "Taken back" : "Declined"}
              </p>
              {b.note && <p className="mt-1.5 whitespace-pre-line text-sm text-ink-2">{b.note}</p>}
              {l.status === "open" && b.status === "open" && (
                <button
                  type="button"
                  onClick={() =>
                    window.confirm(
                      `Give this job to ${b.business} for ${money(b.amount)} ex GST? The other bids are declined, and you'll both see each other's contact and the address.`,
                    ) && void act({ do: "award", bidId: b.id })
                  }
                  className={clsx(ui.primary, "mt-2 h-9 w-full")}
                >
                  Accept this bid
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {d.jobId && (
        <Link
          href={`${PATHS.deals}/${encodeURIComponent(d.jobId)}`}
          className="mt-4 block text-center text-sm text-ink-2 underline underline-offset-4 hover:text-ink"
        >
          Open the deal
        </Link>
      )}
      {l.status === "open" && (
        <button
          type="button"
          onClick={() => window.confirm("Take this listing down? Open bids are declined.") && void act({ do: "withdraw" })}
          className="mt-2 w-full text-center text-xs text-muted underline underline-offset-4 hover:text-danger"
        >
          Take the listing down
        </button>
      )}
    </section>
  );
}

/** On a sold deal: list it on the marketplace for installers to bid on. Shows what others will and won't see first. */
export function ListOnMarketplace({ jobId, suburb }: { jobId: string; suburb: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [guide, setGuide] = useState("");
  const [openFor, setOpenFor] = useState<number>(DEFAULT_OPEN_FOR);
  const [problem, setProblem] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const today = todayInMarket();
  const send = async () => {
    const res = await createListing({ jobId, notes, from, to, guide, openFor });
    if (!res.ok) return setProblem(res.message);
    setMade(res.id);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={clsx(ui.quiet, "mt-2 w-full")}>
        <Store className="size-4" aria-hidden /> List on the marketplace
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="theme-studio fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/40 p-3 sm:p-10"
            onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="List on the marketplace"
              className="w-full max-w-lg rounded-2xl bg-canvas p-6 shadow-lift"
            >
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold tracking-tight text-ink">List this job for installers</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              {made ? (
                <div className="mt-4 space-y-3 text-sm">
                  <p className="text-positive">Listed. Installers near {suburb || "the job"} can bid now.</p>
                  <Link href={marketplacePath(made)} className={ui.primary}>
                    See the listing
                  </Link>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="rounded-md bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">
                    Other businesses see the roof design (everything round the roof blurred), the suburb (
                    {suburb || "from the deal's address"}), the system and the dates, your business name and your guide price. Never the
                    customer&apos;s name, phone, email or street, and never your costs. The address goes only to the installer whose bid you
                    accept; an installer on RENUABL gets the job card too, as if you had sent it the job.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={ui.label}>
                      Earliest day
                      <input
                        type="date"
                        min={today}
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className={clsx(ui.input, "mt-1")}
                      />
                    </label>
                    <label className={ui.label}>
                      Latest day
                      <input
                        type="date"
                        min={from || today}
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className={clsx(ui.input, "mt-1")}
                      />
                    </label>
                  </div>
                  <label className={ui.label}>
                    Guide price for the installation, ex GST (optional)
                    <input
                      inputMode="numeric"
                      value={guide}
                      onChange={(e) => setGuide(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="Leave blank: open to offers"
                      className={clsx(ui.input, "mt-1 tabular-nums")}
                    />
                  </label>
                  <label className={ui.label}>
                    About the job (optional)
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={1200}
                      placeholder="Access, the roof, what's supplied, what you need from the installer"
                      className={clsx(ui.input, "mt-1 min-h-24 py-2")}
                    />
                  </label>
                  <label className={ui.label}>
                    Takes bids for
                    <select value={openFor} onChange={(e) => setOpenFor(Number(e.target.value))} className={clsx(ui.input, "mt-1")}>
                      {OPEN_FOR.map((n) => (
                        <option key={n} value={n}>
                          {n} days
                        </option>
                      ))}
                    </select>
                  </label>
                  {problem && (
                    <p className="text-sm text-danger" role="alert">
                      {problem}
                    </p>
                  )}
                  <button type="button" onClick={() => void send()} className={clsx(ui.primary, "w-full")}>
                    List it
                  </button>
                  <p className="text-xs text-muted">Phone numbers, emails, links and street addresses are taken out of what you write.</p>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
