"use client";

import clsx from "clsx";
import { Bell, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ALERT_DISTANCES, alertWords, watchWords, type JobAlert, type WatchKind } from "@/lib/domain/design/market-alerts";
import { browse, type Listing } from "@/lib/domain/design/marketplace";
import { browseItems, type TradeItem } from "@/lib/domain/design/trade";
import { todayInMarket } from "@/lib/domain/market";
import { loadJobAlert, loadListings, saveJobAlert, setWatched } from "@/lib/services/marketplace";
import { loadItems } from "@/lib/services/trade";
import { PageHead, ui } from "./design-shell";

/**
 * Watching on the Marketplace and job alerts (2 Nov 2026, Martin: as eBay and Facebook Marketplace do). The Watch
 * button on a card or a page, the Watching page with both kinds, and the card that sets this person's job alerts.
 */

/** Watch or stop watching. On a card it is a round over the picture (it doesn't follow the card's link). */
export function WatchButton({
  kind,
  id,
  watched,
  watching,
  round,
  onChange,
}: {
  kind: WatchKind;
  id: string;
  watched: boolean;
  watching: number;
  round?: boolean;
  onChange?: (watched: boolean) => void;
}) {
  const [on, setOn] = useState(watched);
  const [count, setCount] = useState(watching);
  const [busy, setBusy] = useState(false);
  const flip = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const next = !on;
    setBusy(true);
    setOn(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    const res = await setWatched(kind, id, next);
    setBusy(false);
    if (!res.ok) {
      setOn(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      return;
    }
    onChange?.(next);
  };
  if (round)
    return (
      <button
        type="button"
        onClick={flip}
        aria-pressed={on}
        aria-label={on ? "Stop watching" : "Watch"}
        title={on ? "Watching" : "Watch"}
        className={clsx(
          "flex size-9 items-center justify-center rounded-full shadow-sm transition",
          on ? "bg-sun-line text-white" : "bg-surface/90 text-ink hover:bg-surface",
        )}
      >
        <Eye className="size-4" aria-hidden />
      </button>
    );
  return (
    <button type="button" onClick={flip} aria-pressed={on} className={clsx(ui.quiet, "h-9 px-3", on && "text-sun-line")}>
      <Eye className="size-4" aria-hidden /> {on ? "Watching" : "Watch"}
      {count > 0 && <span className="text-xs tabular-nums text-muted">· {count}</span>}
    </button>
  );
}

/** "3 watching" for a card's quiet line; nothing when no one is. */
export const watchingLine = (n: number | undefined) => watchWords(n ?? 0);

/** This person's job alerts: on or off, how far from the base, battery jobs only. Saved as it changes. */
export function JobAlertsCard({ hasBase }: { hasBase: boolean }) {
  const [alert, setAlert] = useState<JobAlert | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void loadJobAlert().then((res) => (res.ok ? setAlert(res.alert) : setProblem(res.message)));
  }, []);
  const save = async (next: JobAlert) => {
    setAlert(next);
    const res = await saveJobAlert(next);
    if (!res.ok) setProblem(res.message);
    else {
      setProblem(null);
      setAlert(res.alert);
    }
  };
  if (!alert) return null;
  return (
    <section className={clsx(ui.card, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center")}>
      <span
        className={clsx(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          alert.on ? "bg-sun-line text-white" : "bg-surface-2 text-ink-2",
        )}
      >
        <Bell className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Job alerts</p>
        <p className="text-sm text-ink-2">{alertWords(alert)}</p>
        {alert.on && alert.withinKm !== null && !hasBase && (
          <p className="mt-1 text-xs text-warning">Mark your base above: without it, only alerts for anywhere can be sent.</p>
        )}
        {problem && (
          <p className="mt-1 text-xs text-warning" role="alert">
            {problem}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {alert.on && (
          <>
            <select
              aria-label="How far from your base"
              value={alert.withinKm === null ? "any" : String(alert.withinKm)}
              onChange={(e) =>
                void save({ ...alert, withinKm: e.target.value === "any" ? null : (Number(e.target.value) as JobAlert["withinKm"]) })
              }
              className={clsx(ui.input, "h-9 w-auto")}
            >
              {ALERT_DISTANCES.map((d) => (
                <option key={String(d)} value={d === null ? "any" : String(d)}>
                  {d === null ? "Anywhere" : `Within ${d} km`}
                </option>
              ))}
            </select>
            <label className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-ink-2">
              <input type="checkbox" checked={alert.battery} onChange={(e) => void save({ ...alert, battery: e.target.checked })} />
              Battery jobs only
            </label>
          </>
        )}
        <button
          type="button"
          onClick={() => void save({ ...alert, on: !alert.on })}
          className={alert.on ? clsx(ui.quiet, "h-9 px-3") : clsx(ui.primary, "h-9 px-3")}
        >
          {alert.on ? "Turn off" : "Turn on"}
        </button>
      </div>
    </section>
  );
}

/**
 * Watching: the jobs and the equipment this person is watching, in two parts. A job closed or awarded, or an item
 * sold, drops out (an item's watch ends when it goes; its watchers are emailed).
 */
export function WatchingPage({ renderJob, renderItem }: WatchingProps) {
  const today = todayInMarket();
  // An inspector's business trades equipment only: its job listings answer no, and the Jobs part isn't shown.
  const [data, setData] = useState<{ listings: Listing[] | null; items: TradeItem[]; problem: string | null } | null>(null);
  useEffect(() => {
    void Promise.all([loadListings(), loadItems()]).then(([l, i]) =>
      setData({ listings: l.ok ? l.listings : null, items: i.ok ? i.items : [], problem: i.ok ? null : i.message }),
    );
  }, []);
  const shown = useMemo(() => {
    if (!data) return null;
    return {
      jobs: data.listings ? browse(data.listings, null, null, today).filter((l) => l.watched) : null,
      items: browseItems(data.items, { base: null, within: null, category: "All", search: "" }).filter((i) => i.watched),
    };
  }, [data, today]);
  return (
    <div className={clsx(ui.page, "space-y-6")}>
      <PageHead title="Watching" />
      <p className="-mt-3 text-sm text-ink-2">
        What you&apos;re keeping an eye on. A job you watch and haven&apos;t bid on is emailed to you the day before it closes; an item you
        watch, when it&apos;s sold.
      </p>
      {data?.problem && (
        <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          {data.problem}
        </p>
      )}
      {!shown ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          {shown.jobs && (
            <section>
              <p className={ui.eyebrow}>Jobs</p>
              {shown.jobs.length ? (
                <ul className="mt-3 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {shown.jobs.map((l) => (
                    <li key={l.id}>{renderJob(l)}</li>
                  ))}
                </ul>
              ) : (
                <p className={clsx(ui.card, "mt-3 p-5 text-sm text-ink-2")}>No jobs watched. Press the eye on a job to keep it here.</p>
              )}
            </section>
          )}
          <section>
            <p className={ui.eyebrow}>Equipment</p>
            {shown.items.length ? (
              <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {shown.items.map((i) => (
                  <li key={i.id}>{renderItem(i)}</li>
                ))}
              </ul>
            ) : (
              <p className={clsx(ui.card, "mt-3 p-5 text-sm text-ink-2")}>
                No equipment watched. Press the eye on an item to keep it here.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

interface WatchingProps {
  renderJob: (l: Listing & { km: number | null }) => React.ReactNode;
  renderItem: (i: TradeItem & { km: number | null }) => React.ReactNode;
}
