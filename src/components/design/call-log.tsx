"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronDown, Phone, PhoneCall, RefreshCw } from "lucide-react";
import {
  CALL_FILTERS,
  callDay,
  callerName,
  callsOf,
  comingWords,
  outcomeTone,
  outcomeWords,
  type CallComing,
  type CallFilter,
  type CallLogEntry,
} from "@/lib/domain/design/call-log";
import { loadCallLog } from "@/lib/services/call-log";
import { SolBadge } from "./sol-icon";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Melbourne" });

const dealHref = (jobId: string) => `/design/deals/${encodeURIComponent(jobId)}`;

/**
 * Calls on Today (8 Nov 2026, Martin): Sol's phone calls through Vapi and the calls the team logged on a deal, newest
 * first and grouped by day, with what Sol still has lined up above them.
 */
export function CallLogPage() {
  const [data, setData] = useState<{ calls: CallLogEntry[]; coming: CallComing[]; solOn: boolean } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [filter, setFilter] = useState<CallFilter>("all");
  const [busy, setBusy] = useState(false);

  const apply = (r: Awaited<ReturnType<typeof loadCallLog>>) => {
    setBusy(false);
    if (r.ok) {
      setData({ calls: r.calls, coming: r.coming, solOn: r.solOn });
      setProblem(null);
    } else setProblem(r.message);
  };
  const load = () => void loadCallLog().then(apply);
  useEffect(() => {
    let gone = false;
    const go = () => void loadCallLog().then((r) => !gone && apply(r));
    go();
    const t = window.setInterval(go, 60_000);
    return () => {
      gone = true;
      window.clearInterval(t);
    };
  }, []);

  const shown = data ? callsOf(data.calls, filter) : [];
  const days: { day: string; calls: CallLogEntry[] }[] = [];
  for (const c of shown) {
    const day = callDay(c.at);
    const last = days[days.length - 1];
    if (last?.day === day) last.calls.push(c);
    else days.push({ day, calls: [c] });
  }

  return (
    <div className="mx-auto w-full max-w-3xl pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-surface p-1 ring-1 ring-line">
          {CALL_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={clsx(
                "rounded-full px-3 py-1.5 text-[13px] transition",
                filter === f.id ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setBusy(true);
            load();
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] text-ink-2 ring-1 ring-line hover:text-ink"
        >
          <RefreshCw className={clsx("size-3.5", busy && "animate-spin")} aria-hidden /> Refresh
        </button>
      </div>

      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      {data && !data.solOn && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-surface px-4 py-3 text-[13px] text-ink-2 ring-1 ring-line">
          <SolBadge className="mt-0.5 size-4 shrink-0" />
          Sol&apos;s phone calls aren&apos;t switched on for your business yet. Calls your team logs on a deal show here.
        </p>
      )}

      {data && data.coming.length > 0 && (
        <section className="mt-6">
          <h3 className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Sol has lined up</h3>
          <ul className="mt-2 grid gap-2">
            {data.coming.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sun">
                  <PhoneCall className={clsx("size-4 text-sun-ink", c.status === "calling" && "animate-pulse")} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-ink">
                    <span className="font-medium">{c.customer}</span>
                    <span className="text-muted"> · {c.deal}</span>
                  </p>
                  <p className="text-[12px] text-muted">{comingWords(c)}</p>
                </div>
                <Link href={dealHref(c.jobId)} className="tap-area text-[13px] text-ink-2 hover:text-ink">
                  Open deal
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && shown.length === 0 && (
        <div className="mt-16 text-center">
          <Phone className="mx-auto size-6 text-muted" aria-hidden />
          <p className="mt-3 text-[15px] text-ink">No calls yet.</p>
          <p className="mt-1 text-[13px] text-muted">
            {filter === "sol" ? "Sol's calls show here as they end." : "Calls show here as they end or are logged on a deal."}
          </p>
        </div>
      )}

      {days.map((d) => (
        <section key={d.day} className="mt-6">
          <h3 className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">{d.day}</h3>
          <ul className="mt-2 grid gap-2">
            {d.calls.map((c) => (
              <CallRow key={c.id} call={c} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CallRow({ call }: { call: CallLogEntry }) {
  const [open, setOpen] = useState(false);
  const tone = outcomeTone(call.outcome);
  const sol = call.who === "sol";
  return (
    <li className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            "grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold uppercase",
            sol ? "bg-primary" : "bg-canvas text-ink ring-1 ring-line",
          )}
          aria-hidden
        >
          {sol ? <SolBadge className="size-5" /> : callerName(call).slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="min-w-0 truncate text-[14px] text-ink">
              <span className="font-medium">{call.customer}</span>
              <span className="text-muted"> · {call.deal}</span>
            </p>
            <span className="text-[12px] tabular-nums text-muted">{time(call.at)}</span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
            <span>{callerName(call)}</span>
            <span
              className={clsx(
                "rounded-full px-2 py-0.5",
                tone === "good" && "bg-positive-soft text-positive",
                tone === "needs" && "bg-warning-soft text-warning",
                tone === "plain" && "bg-canvas text-ink-2 ring-1 ring-line",
              )}
            >
              {outcomeWords(call)}
            </span>
          </p>
          {call.words && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{call.words}</p>}
          <div className="mt-2 flex items-center gap-4 text-[13px]">
            {call.transcript && (
              <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                className="tap-area inline-flex items-center gap-1 text-ink-2 hover:text-ink"
              >
                Transcript <ChevronDown className={clsx("size-3.5 transition", open && "rotate-180")} aria-hidden />
              </button>
            )}
            <Link href={dealHref(call.jobId)} className="tap-area text-ink-2 hover:text-ink">
              Open deal
            </Link>
          </div>
          {open && call.transcript && (
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-canvas p-3 font-sans text-[12px] leading-relaxed text-ink-2">
              {call.transcript}
            </pre>
          )}
        </div>
      </div>
    </li>
  );
}
