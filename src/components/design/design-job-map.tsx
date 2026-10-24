"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Home, Minus, Navigation, Package, Plus, X } from "lucide-react";
import clsx from "clsx";
import { AddressEntry } from "@/components/consumer/address-entry";
import { PRE_INSTALL_STAGES, STAGE_LABELS } from "@/lib/domain/design/crm";
import { weekOf } from "@/lib/domain/design/deal";
import {
  MAP_SIZE,
  directionsUrl,
  fitView,
  project,
  runFor,
  runKm,
  type JobPlaces,
  type MapView,
  type Place,
} from "@/lib/domain/design/job-map";
import { todayInMarket } from "@/lib/domain/market";
import type { Address, ISODate } from "@/lib/domain/types";
import { jobMapImage, loadJobMap, saveJobPlaces, shortDate, type MapJob } from "@/lib/services/crm";
import { useDesignAccount } from "./design-account";
import { PATHS, PageHead, ui } from "./design-shell";
import { EventCard } from "./event-card";

type Filter = "week" | "upcoming" | "all";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "upcoming", label: "Upcoming" },
  { id: "all", label: "All sold" },
];
const placeOf = (a: Address): Place | null =>
  typeof a.lat === "number" && typeof a.lng === "number"
    ? { address: [a.line, a.suburb, a.state, a.postcode].filter(Boolean).join(", "), lat: a.lat, lng: a.lng }
    : null;
const day = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", timeZone: "UTC" }) : "To book";

/**
 * /design/procurement/map: the job map, from the installer's side (24 Oct 2026, Martin: Apple Maps style; where the job
 * is, where the base is, where the stock is collected). The business's sold jobs on a soft map of its own style with
 * the base and each wholesaler's collection point; picking a job draws its run (base, the wholesalers on its order,
 * the job) with the distances as the crow flies, and a card with directions through every stop and its event card.
 */
export function JobMapPage() {
  const [data, setData] = useState<{ jobs: MapJob[]; places: JobPlaces; wholesalers: string[] } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [picked, setPicked] = useState<string | null>(null);
  const [zoomBy, setZoomBy] = useState(0);
  const [event, setEvent] = useState<string | null>(null);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [account] = useDesignAccount();
  const canEdit = Boolean(account?.signedIn && (!account.may || account.may.prices));
  const today = todayInMarket();
  useEffect(() => {
    void loadJobMap().then((res) => (res.ok ? setData(res) : setProblem(res.message)));
  }, []);

  const week = useMemo(() => new Set(weekOf(today)), [today]);
  const jobs = useMemo(
    () =>
      (data?.jobs ?? [])
        .filter((j) =>
          filter === "all"
            ? true
            : filter === "upcoming"
              ? PRE_INSTALL_STAGES.includes(j.stage)
              : Boolean(j.installDate && week.has(j.installDate as ISODate)),
        )
        .sort((a, b) => (a.installDate ?? "9999").localeCompare(b.installDate ?? "9999")),
    [data, filter, week],
  );
  const job = jobs.find((j) => j.id === picked) ?? null;
  const places = data?.places ?? { base: null, collection: {} };
  const run = job
    ? runFor(
        { label: job.address.split(",")[0], place: { address: job.address, lat: job.lat, lng: job.lng }, wholesalers: job.wholesalers },
        places,
      )
    : null;
  const km = run ? runKm(run.stops) : null;

  // The view: the picked job's run, else every job shown with the base and the collection points; then the zoom asked for.
  const fitted = fitView(
    run ? run.stops.map((s) => s.place) : [...jobs, ...(places.base ? [places.base] : []), ...Object.values(places.collection)],
  );
  const view: MapView = { ...fitted, zoom: Math.min(18, Math.max(3, fitted.zoom + zoomBy)) };
  const at = (p: { lat: number; lng: number }) => {
    const { x, y } = project(p.lat, p.lng, view);
    return {
      x,
      y,
      left: `${(x / MAP_SIZE.w) * 100}%`,
      top: `${(y / MAP_SIZE.h) * 100}%`,
      on: x > -20 && x < MAP_SIZE.w + 20 && y > -20 && y < MAP_SIZE.h + 20,
    };
  };
  const pick = (id: string | null) => {
    setPicked(id);
    setZoomBy(0);
  };
  const savePlaces = async (next: JobPlaces) => {
    const res = await saveJobPlaces(next);
    if (!res.ok) return setProblem(res.message);
    setData((d) => (d ? { ...d, places: res.places } : d));
  };
  const usedPoints = new Set(jobs.flatMap((j) => j.wholesalers));

  return (
    <div className={ui.page}>
      <PageHead eyebrow="Procurement" title="Job map">
        <button className={ui.quiet} onClick={() => setPlacesOpen(!placesOpen)}>
          <Home className="size-4" aria-hidden /> {placesOpen ? "Done" : "Base and collection points"}
        </button>
      </PageHead>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        Where each job is, where you start from, and where its stock is collected. Pick a job to see its run and get directions.
      </p>
      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {placesOpen && data && (
        <PlacesPanel places={places} wholesalers={data.wholesalers} canEdit={canEdit} onSave={(next) => void savePlaces(next)} />
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* The map: the picture in its own soft style, and our own pins and the run drawn over it. */}
        <div className={clsx(ui.card, "relative overflow-hidden")}>
          <div className="relative w-full" style={{ aspectRatio: `${MAP_SIZE.w} / ${MAP_SIZE.h}` }}>
            {data && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={jobMapImage(view)} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
            )}
            {run && (
              <svg viewBox={`0 0 ${MAP_SIZE.w} ${MAP_SIZE.h}`} className="pointer-events-none absolute inset-0 size-full" aria-hidden>
                <polyline
                  points={run.stops.map((s) => `${at(s.place).x},${at(s.place).y}`).join(" ")}
                  fill="none"
                  stroke="rgb(58 61 67 / 0.25)"
                  strokeWidth={6}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <polyline
                  points={run.stops.map((s) => `${at(s.place).x},${at(s.place).y}`).join(" ")}
                  fill="none"
                  stroke="#ff5a1f"
                  strokeWidth={2.5}
                  strokeDasharray="6 5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {places.base && at(places.base).on && (
              <Pin left={at(places.base).left} top={at(places.base).top} kind="base" title={`Base · ${places.base.address}`} />
            )}
            {Object.entries(places.collection)
              .filter(([name]) => !run || run.stops.some((s) => s.label === name) || usedPoints.has(name))
              .map(([name, p]) =>
                at(p).on ? (
                  <Pin key={name} left={at(p).left} top={at(p).top} kind="collect" title={`${name} · collection point`} label={name} />
                ) : null,
              )}
            {jobs.map((j) =>
              at(j).on && (!run || j.id === job?.id) ? (
                <Pin
                  key={j.id}
                  left={at(j).left}
                  top={at(j).top}
                  kind="job"
                  picked={j.id === job?.id}
                  title={`${j.customer} · ${j.address}`}
                  label={day(j.installDate)}
                  onClick={() => pick(j.id === picked ? null : j.id)}
                />
              ) : null,
            )}
            <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg bg-surface/90 shadow-[var(--shadow-lift)] backdrop-blur">
              <button
                className="flex size-9 items-center justify-center hover:bg-surface-2"
                aria-label="Zoom in"
                onClick={() => setZoomBy((z) => z + 1)}
              >
                <Plus className="size-4" aria-hidden />
              </button>
              <button
                className="flex size-9 items-center justify-center border-t border-line hover:bg-surface-2"
                aria-label="Zoom out"
                onClick={() => setZoomBy((z) => z - 1)}
              >
                <Minus className="size-4" aria-hidden />
              </button>
            </div>
            {data && !places.base && (
              <button
                className="absolute bottom-3 left-3 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-medium text-ink shadow-[var(--shadow-lift)]"
                onClick={() => setPlacesOpen(true)}
              >
                Mark your base and collection points
              </button>
            )}
          </div>
        </div>

        {/* Beside it: the picked job's run, or the jobs to pick from. */}
        <aside className="space-y-3">
          <div className="flex gap-1 rounded-md bg-surface-2 p-1" role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                aria-pressed={filter === f.id}
                onClick={() => {
                  setFilter(f.id);
                  pick(null);
                }}
                className={clsx(
                  "h-8 flex-1 rounded px-2 text-[12.5px] font-medium",
                  filter === f.id ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-ink-2 hover:text-ink",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {job && run && km ? (
            <section className={clsx(ui.card, "p-4")} aria-label="The run">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{job.customer}</p>
                  <p className="text-xs text-ink-2">{job.address}</p>
                  <p className="mt-1 text-xs text-muted">
                    {job.installDate ? shortDate(job.installDate) : "No install date yet"} · {STAGE_LABELS[job.stage]}
                    {job.kw ? ` · ${job.kw} kW` : ""}
                    {job.installer ? ` · ${job.installer}` : ""}
                  </p>
                </div>
                <button
                  className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
                  aria-label="Back to every job"
                  onClick={() => pick(null)}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <ol className="mt-4 space-y-0">
                {run.stops.map((s, i) => (
                  <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                    {i < run.stops.length - 1 && (
                      <span
                        className="absolute left-[11px] top-6 h-[calc(100%-1rem)] border-l border-dashed border-line-strong"
                        aria-hidden
                      />
                    )}
                    <StopMark kind={s.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{s.kind === "job" ? "The job" : s.label}</p>
                      <p className="truncate text-[11.5px] text-muted">{s.place.address}</p>
                      {i > 0 && <p className="text-[11px] tabular-nums text-ink-2">{km.legs[i - 1]} km</p>}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 border-t border-line pt-2 text-[12px] text-ink-2">
                About <span className="font-medium tabular-nums text-ink">{km.total} km</span> as the crow flies
                {!places.base && ". Mark your base to start the run there"}
              </p>
              {run.unplaced.length > 0 && (
                <p className="mt-1.5 text-[11.5px] text-sun-ink">
                  No collection point marked for {run.unplaced.join(", ")}.{" "}
                  <button className="underline underline-offset-2" onClick={() => setPlacesOpen(true)}>
                    Mark it
                  </button>
                </p>
              )}
              {job.wholesalers.length === 0 && <p className="mt-1.5 text-[11.5px] text-muted">No order with a wholesaler on it yet.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {directionsUrl(run.stops) && (
                  <a href={directionsUrl(run.stops)!} target="_blank" rel="noreferrer" className={clsx(ui.primary, "h-8 px-3 text-xs")}>
                    <Navigation className="size-3.5" aria-hidden /> Directions
                  </a>
                )}
                {job.installDate && (
                  <button className={clsx(ui.quiet, "h-8 px-3 text-xs")} onClick={() => setEvent(job.id)}>
                    <CalendarDays className="size-3.5" aria-hidden /> Event card
                  </button>
                )}
                <Link href={`${PATHS.deals}/${job.id}`} className={clsx(ui.quiet, "h-8 px-3 text-xs")}>
                  Open deal
                </Link>
              </div>
            </section>
          ) : (
            <ul className={clsx(ui.card, "max-h-[28rem] divide-y divide-line overflow-y-auto")}>
              {data && jobs.length === 0 && <li className="p-4 text-sm text-ink-2">No jobs here with a place on the map.</li>}
              {!data && !problem && <li className="p-4 text-sm text-muted">Loading…</li>}
              {jobs.map((j) => (
                <li key={j.id}>
                  <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2" onClick={() => pick(j.id)}>
                    <span className="w-14 shrink-0 text-[11.5px] font-medium tabular-nums text-ink">{day(j.installDate)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{j.address.split(",")[0]}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {j.customer}
                        {j.wholesalers.length ? ` · ${j.wholesalers.join(", ")}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
      {event && <EventCard jobId={event} onClose={() => setEvent(null)} />}
    </div>
  );
}

/** A pin, as Apple's maps draw them: a round mark with a white ring and a soft shadow, a label under it. */
function Pin(props: {
  left: string;
  top: string;
  kind: "base" | "collect" | "job";
  title: string;
  label?: string;
  picked?: boolean;
  onClick?: () => void;
}) {
  const Mark = props.onClick ? "button" : "div";
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: props.left, top: props.top }}>
      <Mark
        type={props.onClick ? "button" : undefined}
        onClick={props.onClick}
        title={props.title}
        aria-label={props.title}
        className={clsx(
          "relative flex items-center justify-center rounded-full ring-2 ring-white shadow-[0_2px_8px_rgba(0,0,0,0.28)] transition-transform",
          props.kind === "base"
            ? "size-8 bg-primary text-white"
            : props.kind === "collect"
              ? "size-7 bg-white text-[#ff5a1f]"
              : "bg-[#ff5a1f] text-white",
          props.kind === "job" && (props.picked ? "size-6 scale-125" : "size-[18px] hover:scale-125"),
          props.kind === "collect" && "ring-[#ff5a1f]",
        )}
      >
        {props.kind === "base" && <Home className="size-4" aria-hidden />}
        {props.kind === "collect" && <Package className="size-3.5" aria-hidden />}
        {props.picked && <span className="absolute inset-0 animate-ping rounded-full bg-[#ff5a1f]/40 motion-reduce:hidden" aria-hidden />}
      </Mark>
      {props.label && (
        <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-1.5 py-px text-[10px] font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.15)]">
          {props.label}
        </span>
      )}
    </div>
  );
}

function StopMark({ kind }: { kind: "base" | "collect" | "job" }) {
  return (
    <span
      className={clsx(
        "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full",
        kind === "base"
          ? "bg-primary text-white"
          : kind === "collect"
            ? "bg-white text-[#ff5a1f] ring-1 ring-[#ff5a1f]"
            : "bg-[#ff5a1f] text-white",
      )}
      aria-hidden
    >
      {kind === "base" ? (
        <Home className="size-3" />
      ) : kind === "collect" ? (
        <Package className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-white" />
      )}
    </span>
  );
}

/** Where the business starts from, and where each wholesaler's stock is collected, each found with the address search. */
function PlacesPanel(props: { places: JobPlaces; wholesalers: string[]; canEdit: boolean; onSave: (next: JobPlaces) => void }) {
  const { places, wholesalers, canEdit, onSave } = props;
  const row = (label: string, icon: React.ReactNode, place: Place | null, set: (p: Place | null) => void) => (
    <li className="grid gap-2 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
      <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
        {icon}
        {label}
      </span>
      {place ? (
        <span className="flex items-center gap-3 text-[13px] text-ink-2">
          <span className="min-w-0 flex-1 truncate">{place.address}</span>
          {canEdit && (
            <button className="text-xs font-medium text-ink-2 underline underline-offset-4" onClick={() => set(null)}>
              Change
            </button>
          )}
        </span>
      ) : canEdit ? (
        <AddressEntry compact placeholder="Find the address" onPick={(a) => set(placeOf(a))} />
      ) : (
        <span className="text-[13px] text-muted">Not marked</span>
      )}
    </li>
  );
  return (
    <section className={clsx(ui.card, "mt-4 px-5 py-2")} aria-label="Base and collection points">
      <ul className="divide-y divide-line">
        {row("Your base", <Home className="size-4 text-muted" aria-hidden />, places.base, (p) => onSave({ ...places, base: p }))}
        {wholesalers.map((w) =>
          row(w, <Package className="size-4 text-muted" aria-hidden />, places.collection[w] ?? null, (p) => {
            const collection = { ...places.collection };
            if (p) collection[w] = p;
            else delete collection[w];
            onSave({ ...places, collection });
          }),
        )}
        {wholesalers.length === 0 && <li className="py-3 text-sm text-ink-2">Upload a price list and its wholesaler appears here.</li>}
      </ul>
    </section>
  );
}
