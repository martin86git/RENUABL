"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { BatteryCharging, Check, CircleAlert } from "lucide-react";
import { PYLON_FILL_WORDS } from "@/lib/domain/design/pylon-import";
import { fillFromPylon, pylonFillLeft } from "@/lib/services/pylon-import";
import { PATHS, ui } from "./design-shell";

type Run = {
  done: number;
  total: number;
  batteries: number;
  pdfs: number;
  failed: number;
  gone: number;
  noDesign: number;
  running: boolean;
  stopped: boolean;
};

/**
 * Filling in deals brought in from Pylon's export (22 Nov 2026, Martin: they all read as solar only). Uses the key typed
 * above on this page; each deal is read again from Pylon and given its equipment, site details and place on the map.
 */
export function PylonFill({ pylonKey }: { pylonKey: string }) {
  const [pdfs, setPdfs] = useState(true);
  const [left, setLeft] = useState<{ left: number; any: number } | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [whys, setWhys] = useState<string[]>([]);
  const stop = useRef(false);

  const count = useCallback(async (withPdfs: boolean) => {
    const res = await pylonFillLeft(withPdfs);
    if (res.ok) setLeft({ left: res.left, any: res.any });
  }, []);
  useEffect(() => {
    // Read from the server as the page opens and when the PDF tick changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void count(pdfs);
  }, [count, pdfs]);

  if (!left || (left.any === 0 && !run)) return null;

  const go = async () => {
    stop.current = false;
    setProblem(null);
    setWhys([]);
    let state: Run = { done: 0, total: left.left, batteries: 0, pdfs: 0, failed: 0, gone: 0, noDesign: 0, running: true, stopped: false };
    setRun(state);
    for (;;) {
      if (stop.current) {
        state = { ...state, running: false, stopped: true };
        break;
      }
      const res = await fillFromPylon(pylonKey, pdfs);
      if (!res.ok) {
        setProblem(res.message);
        state = { ...state, running: false, stopped: true };
        break;
      }
      for (const r of res.results) {
        if (r.result === "failed") {
          state = { ...state, failed: state.failed + 1 };
          const why = r.why;
          setWhys((w) => (w.includes(why) ? w : [...w, why].slice(-4)));
        } else state = { ...state, done: state.done + 1 };
        if (r.result === "gone") state = { ...state, gone: state.gone + 1 };
        if (r.result === "filled" && !r.design) state = { ...state, noDesign: state.noDesign + 1 };
        if (r.result === "filled")
          state = { ...state, batteries: state.batteries + (r.battery ? 1 : 0), pdfs: state.pdfs + (r.pdf ? 1 : 0) };
      }
      setRun({ ...state });
      setLeft((l) => (l ? { ...l, left: res.left } : l));
      if (!res.left || !res.results.length) break;
    }
    state = { ...state, running: false };
    setRun(state);
    void count(pdfs);
  };

  const share = run && run.total ? Math.min(1, (run.done + run.failed) / run.total) : 0;
  const n = (v: number) => v.toLocaleString("en-AU");

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
      <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
        <BatteryCharging className="size-4 text-muted" aria-hidden /> {PYLON_FILL_WORDS.title}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">{PYLON_FILL_WORDS.how}</p>

      <label className="mt-3 flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" className="mt-0.5" checked={pdfs} disabled={run?.running} onChange={(e) => setPdfs(e.target.checked)} />
        <span>
          Keep each deal&rsquo;s signed proposal PDF too
          <span className="block text-xs text-muted">
            Slower, and each PDF takes room in your account. Leave it off to fill in the equipment only.
          </span>
        </span>
      </label>

      {left.left === 0 && !run?.running ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink">
          <Check className="size-4 text-positive" aria-hidden /> {PYLON_FILL_WORDS.none}
        </p>
      ) : (
        !run?.running && (
          <button type="button" className={clsx(ui.primary, "mt-4")} disabled={!pylonKey.trim()} onClick={() => void go()}>
            {run?.stopped ? "Carry on" : PYLON_FILL_WORDS.button(left.left)}
          </button>
        )
      )}
      {!pylonKey.trim() && left.left > 0 && !run?.running && <p className="mt-2 text-xs text-muted">Paste your Pylon key above first.</p>}

      {problem && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-ink" role="alert">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {problem}
        </p>
      )}

      {run && (
        <div className="mt-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink">{run.running ? "Filling them in…" : run.stopped ? "Stopped" : "Done"}</p>
            {run.running && (
              <button type="button" className={ui.link} onClick={() => (stop.current = true)}>
                Stop
              </button>
            )}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-sun-line transition-[width] duration-300"
              style={{ width: `${Math.round(share * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-ink-2">
            {n(run.done)} of {n(run.total)} deals filled in · {n(run.batteries)} with a battery
            {run.pdfs > 0 && ` · ${n(run.pdfs)} PDFs kept`}
            {run.noDesign > 0 && ` · ${n(run.noDesign)} with no design in Pylon`}
            {run.gone > 0 && ` · ${n(run.gone)} no longer in Pylon`}
            {run.failed > 0 && ` · ${n(run.failed)} couldn't be read`}
          </p>
          {whys.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted">
              {whys.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {!run.running && !run.stopped && (
            <p className="mt-2 text-sm">
              <Link href={PATHS.customers} className={ui.link}>
                Open Customers
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
