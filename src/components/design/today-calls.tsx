"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Phone } from "lucide-react";
import {
  callTime,
  callerName,
  comingWords,
  liveCallWords,
  outcomeTone,
  outcomeWords,
  todayCallsWords,
  todaysCalls,
  type CallComing,
  type CallLogEntry,
} from "@/lib/domain/design/call-log";
import { clockWords } from "@/lib/domain/live-call";
import { watchAssistantCall } from "@/lib/services/assistant-call";
import { loadCallLog } from "@/lib/services/call-log";
import { useCaller } from "@/lib/services/caller";
import { PATHS } from "./design-shell";
import { CallerAvatar } from "./settings-caller";

/** How often Today asks again: quickly while a call is ringing or on, else every half minute. */
const LIVE_MS = 4_000;
const QUIET_MS = 30_000;
/** Today's calls shown before "All calls". */
const DONE_SHOWN = 4;
/** One width for every pad on Today (as New in's), so a row of them centres whatever its count. */
const PAD = "w-full sm:w-[14.25rem]";
const CARD = "flex flex-col gap-2 rounded-2xl bg-surface p-3.5 text-left ring-1 ring-line transition hover:ring-ink-2";

/** What Calls holds, for Today's strip: whether calls are on, and how many are live, lined up and done today. */
export interface CallsSummary {
  on: boolean;
  live: number;
  lined: number;
  done: number;
}

const firstOf = (name: string) => name.trim().split(/\s+/)[0] || "them";

/**
 * Calls on Today (12 Nov 2026, Martin: the phone assistant calls on its own, so the team must see the calls happening
 * and the ones made): who it is on the call with now and for how long, what it has lined up, and today's calls with
 * what each came to. Each call is a pad like New in's, centred (14 Nov 2026, Martin: not a long bar). A call of the
 * assistant's opens its window with what was said; one the team logged opens the deal.
 */
export function TodayCalls(props: { id?: string; className?: string; onSummary?: (s: CallsSummary) => void } = {}) {
  const caller = useCaller();
  const [log, setLog] = useState<{ calls: CallLogEntry[]; coming: CallComing[]; solOn: boolean } | null>(null);
  const [now, setNow] = useState(() => new Date());

  const t = log ? todaysCalls(log, now) : null;
  const live = (t?.live.length ?? 0) > 0;

  useEffect(() => {
    let gone = false;
    let timer: number | undefined;
    const go = async () => {
      const r = await loadCallLog();
      if (gone) return;
      if (r.ok) setLog({ calls: r.calls, coming: r.coming, solOn: r.solOn });
      const busy = r.ok && r.coming.some((c) => c.phase === "ringing" || c.phase === "on-call" || c.status === "calling");
      timer = window.setTimeout(() => void go(), busy ? LIVE_MS : QUIET_MS);
    };
    void go();
    return () => {
      gone = true;
      window.clearTimeout(timer);
    };
  }, []);

  // Told to Today's strip each time the log is read.
  const onSummary = props.onSummary;
  useEffect(() => {
    if (!log || !onSummary) return;
    const day = todaysCalls(log);
    onSummary({ on: log.solOn, live: day.live.length, lined: day.lined.length, done: day.done.length });
  }, [log, onSummary]);

  // The clock on a call that is on, a second at a time.
  useEffect(() => {
    if (!live) return;
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, [live]);

  if (!log || !t) return null;
  const words = todayCallsWords(t);
  if (!words && !log.solOn) return null;

  const watch = (jobId: string, customer: string) => watchAssistantCall({ jobId, name: firstOf(customer), message: "" });
  const rest = t.done.length - DONE_SHOWN;

  return (
    <section id={props.id} className={props.className ?? "mt-8"} aria-label="Calls today">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink">
          Calls<span className="ml-1.5 font-normal normal-case tracking-normal text-muted">{words ?? "none yet today"}</span>
        </h2>
        <Link
          href="/design/calls"
          className="tap-area text-[12.5px] font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          All calls
        </Link>
      </div>
      <div className="flex flex-wrap gap-3">
        {t.live.map((c) => {
          const ran = c.phase === "on-call" && c.startedAt ? clockWords(now.getTime() - Date.parse(c.startedAt)) : null;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => watch(c.jobId, c.customer)}
              className={clsx(PAD, CARD, "bg-positive-soft/40 ring-positive/40")}
            >
              <span className="flex items-center gap-3">
                <span className="relative shrink-0">
                  <span className="absolute -inset-1 animate-ping rounded-full bg-positive/30 motion-reduce:hidden" aria-hidden />
                  <CallerAvatar caller={caller} size={36} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{c.customer}</span>
                  <span className="block truncate text-[12px] text-muted">{c.deal}</span>
                </span>
              </span>
              <span className="text-[13px] leading-snug text-ink">{liveCallWords({ ...c, by: c.by || caller.name })}</span>
              <span className="mt-auto flex items-center justify-between gap-2">
                {ran ? <span className="font-mono text-[14px] tabular-nums text-positive">{ran}</span> : <span />}
                <span className="rounded-full bg-primary px-3 py-1 text-[12.5px] font-semibold text-primary-ink">Listen in</span>
              </span>
            </button>
          );
        })}
        {t.lined.map((c) => (
          <button key={c.id} type="button" onClick={() => watch(c.jobId, c.customer)} className={clsx(PAD, CARD)}>
            <span className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-muted ring-1 ring-line">
                <Phone className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{c.customer}</span>
                <span className="block truncate text-[12px] text-muted">{c.deal}</span>
              </span>
            </span>
            <span className="text-[13px] leading-snug text-ink">{liveCallWords({ ...c, by: c.by || caller.name })}</span>
            <span className="mt-auto text-[12px] text-muted">{comingWords(c)}</span>
          </button>
        ))}
        {t.done.slice(0, DONE_SHOWN).map((e) => {
          const tone = outcomeTone(e.outcome);
          const inner = (
            <>
              <span className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[14px] font-semibold text-ink">{e.customer}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-muted">{callTime(e.at)}</span>
              </span>
              <span className="-mt-1.5 truncate text-[12px] text-muted">
                {callerName({ who: e.who, by: e.who === "sol" ? e.by || caller.name : e.by })} called · {e.deal}
              </span>
              {e.words && <span className="line-clamp-2 text-[12.5px] leading-snug text-ink-2">{e.words}</span>}
              <span
                className={clsx(
                  "mt-auto self-start rounded-full px-2.5 py-0.5 text-[12px] font-medium",
                  tone === "good" ? "bg-positive-soft text-positive" : tone === "needs" ? "bg-sun text-sun-ink" : "bg-canvas text-ink-2",
                )}
              >
                {outcomeWords(e)}
              </span>
            </>
          );
          return e.who === "sol" ? (
            <button key={e.id} type="button" onClick={() => watch(e.jobId, e.customer)} className={clsx(PAD, CARD)}>
              {inner}
            </button>
          ) : (
            <Link key={e.id} href={`${PATHS.deals}/${e.jobId}`} className={clsx(PAD, CARD)}>
              {inner}
            </Link>
          );
        })}
        {rest > 0 && (
          <Link
            href="/design/calls"
            className={clsx(
              PAD,
              "grid place-items-center rounded-2xl bg-surface p-3.5 text-[13px] font-medium text-ink-2 ring-1 ring-line hover:text-ink",
            )}
          >
            {rest} more today
          </Link>
        )}
        {!words && (
          <p className="max-w-[31.5rem] rounded-2xl bg-surface px-5 py-4 text-[13px] leading-snug text-ink-2 ring-1 ring-line">
            No calls yet today. {caller.name} rings new leads and customers who ask, in calling hours, and each call shows here.
          </p>
        )}
      </div>
    </section>
  );
}
