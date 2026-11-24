"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, CircleAlert, FileText } from "lucide-react";
import {
  PYLON_CSV_BATCH,
  PYLON_CSV_WORDS,
  PYLON_WON_WEEKS,
  csvStage,
  progressWords,
  readPylonExport,
  type PylonCsvRow,
  type PylonOutcome,
} from "@/lib/domain/design/pylon-import";
import { todayInMarket } from "@/lib/domain/market";
import { bringCsvRows, checkPylonCsv, givePylonOwners } from "@/lib/services/pylon-import";
import { PATHS, ui } from "./design-shell";

type Loaded = { name: string; sold: PylonCsvRow[]; all: number; already: Set<string> };
type Run = { done: number; total: number; already: number; failed: number; running: boolean; stopped: boolean };

/**
 * Pylon's CSV export (20 Nov 2026, Martin: Pylon exported every Primero project). Read here in the browser, the sold
 * rows sent a batch at a time; each dated the day it sold, Won if sold in the last few weeks, else Installed.
 */
export function PylonCsvImport() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [weeks, setWeeks] = useState(PYLON_WON_WEEKS);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [failures, setFailures] = useState<{ customer: string; why: string }[]>([]);
  const stop = useRef(false);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setLoaded(null);
    setRun(null);
    setFailures([]);
    setBusy(true);
    const read = readPylonExport(await file.text());
    if ("problem" in read) {
      setBusy(false);
      return setProblem(read.problem);
    }
    const check = await checkPylonCsv(read.sold.map((r) => r.id));
    setBusy(false);
    if (!check.ok) return setProblem(check.message);
    setLoaded({ name: file.name, sold: read.sold, all: read.all, already: new Set(check.already) });
  };

  const today = todayInMarket();
  const toBring = loaded ? loaded.sold.filter((r) => !loaded.already.has(r.id)) : [];
  const won = toBring.filter((r) => csvStage(r.soldOn, today, weeks) === "won").length;
  const n = (v: number) => v.toLocaleString("en-AU");

  const bring = async () => {
    if (!loaded) return;
    stop.current = false;
    let state: Run = { done: 0, total: toBring.length, already: 0, failed: 0, running: true, stopped: false };
    setRun(state);
    setProblem(null);
    const failed: { customer: string; why: string }[] = [];
    const names = new Map(toBring.map((r) => [r.id, r.name || r.reference || r.id]));
    const brought: string[] = [];
    for (let i = 0; i < toBring.length; i += PYLON_CSV_BATCH) {
      if (stop.current) {
        state = { ...state, stopped: true };
        break;
      }
      const res = await bringCsvRows(toBring.slice(i, i + PYLON_CSV_BATCH), weeks);
      if (!res.ok) {
        setProblem(res.message);
        state = { ...state, stopped: true };
        break;
      }
      for (const r of res.results as PylonOutcome[]) {
        if (r.result === "failed") {
          state = { ...state, failed: state.failed + 1 };
          failed.push({ customer: names.get(r.id) ?? r.id, why: r.why });
        } else {
          brought.push(r.id);
          state = { ...state, done: state.done + 1, already: state.already + (r.result === "already" ? 1 : 0) };
        }
      }
      setRun({ ...state });
      setFailures([...failed]);
    }
    setRun({ ...state, running: false });
    setLoaded((l) => (l ? { ...l, already: new Set([...l.already, ...brought]) } : l));
  };

  const share = run && run.total ? (run.done + run.failed) / run.total : 0;

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
      <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
        <FileText className="size-4 text-muted" aria-hidden /> {PYLON_CSV_WORDS.title}
      </p>
      <p className="mt-1 text-sm text-ink-2">{PYLON_CSV_WORDS.how}</p>
      <label className={clsx(ui.quiet, "mt-3 inline-flex cursor-pointer", (busy || run?.running) && "pointer-events-none opacity-60")}>
        {busy ? "Reading…" : loaded ? "Choose another file" : "Choose the CSV"}
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={busy || run?.running}
          onChange={(e) => {
            void choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      {problem && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-ink" role="alert">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {problem}
        </p>
      )}

      {loaded && (
        <div className="mt-4">
          <p className="text-[15px] font-medium text-ink">
            {n(loaded.sold.length)} sold job{loaded.sold.length === 1 ? "" : "s"} in the file
            {loaded.already.size > 0 && <span className="font-normal text-muted"> · {n(loaded.already.size)} already brought in</span>}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            Of {n(loaded.all)} projects. The {n(loaded.all - loaded.sold.length)} that weren&rsquo;t sold aren&rsquo;t brought in.
          </p>

          {loaded.already.size > 0 && <GiveToSellers rows={loaded.sold.filter((r) => loaded.already.has(r.id))} />}

          {toBring.length > 0 && (
            <fieldset className="mt-4" disabled={run?.running}>
              <legend className={ui.label}>Which are still to install?</legend>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                Sold in the last
                <input
                  type="number"
                  min={0}
                  max={520}
                  value={weeks}
                  onChange={(e) => setWeeks(Math.max(0, Math.min(520, Math.round(Number(e.target.value) || 0))))}
                  className={clsx(ui.input, "w-20 text-center")}
                  aria-label="Weeks"
                />
                weeks come in as Won ({n(won)}), earlier ones as Installed ({n(toBring.length - won)}).
              </p>
              <p className="mt-1 text-xs text-muted">Each is dated the day it sold. You can move any deal to another stage afterwards.</p>
            </fieldset>
          )}

          <p className="mt-4 text-xs leading-relaxed text-muted">{PYLON_CSV_WORDS.notCarried}</p>

          {toBring.length > 0 && !run?.running && (
            <button type="button" className={clsx(ui.primary, "mt-4")} onClick={() => void bring()}>
              {run?.stopped ? "Carry on" : `Bring in ${n(toBring.length)} sold job${toBring.length === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      )}

      {run && (
        <div className="mt-4 border-t border-line pt-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-medium text-ink">{run.running ? "Bringing them in…" : run.stopped ? "Stopped" : "Done"}</p>
            {run.running && (
              <button type="button" className={ui.link} onClick={() => (stop.current = true)}>
                Stop
              </button>
            )}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-sun-line transition-[width] duration-300"
              style={{ width: `${Math.round(share * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-ink-2">{progressWords(run)}</p>
          {!run.running && !run.stopped && (
            <p className="mt-3 flex items-center gap-2 text-sm text-ink">
              <Check className="size-4 text-positive" aria-hidden />
              <span>
                Your Pylon jobs are in.{" "}
                <Link href={PATHS.sales} className={ui.link}>
                  Open Deals
                </Link>
              </span>
            </p>
          )}
          {failures.length > 0 && (
            <div className="mt-4">
              <p className={ui.label}>Couldn&rsquo;t come across</p>
              <ul className="mt-1.5 max-h-48 divide-y divide-line overflow-y-auto rounded-xl border border-line text-sm">
                {failures.map((f, i) => (
                  <li key={i} className="px-3 py-2">
                    <span className="text-ink">{f.customer}</span> <span className="text-muted">· {f.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Deals already brought in, given to whoever sold them in Pylon (24 Nov 2026, Martin: a salesperson added after the
 * import, as a member or a deal owner not invited yet). Only to someone in Your account; only deals with no owner yet
 * or still owned by whoever brought them in.
 */
function GiveToSellers({ rows }: { rows: PylonCsvRow[] }) {
  const [state, setState] = useState<{ busy: boolean; said: string | null }>({ busy: false, said: null });
  const sellers = new Map<string, { name: string; count: number }>();
  for (const r of rows) {
    if (!r.ownerEmail) continue;
    const s = sellers.get(r.ownerEmail) ?? { name: r.owner || r.ownerEmail, count: 0 };
    sellers.set(r.ownerEmail, { ...s, count: s.count + 1 });
  }
  if (!sellers.size) return null;
  const give = async () => {
    setState({ busy: true, said: null });
    const pairs = rows.filter((r) => r.ownerEmail).map((r) => ({ id: r.id, ownerEmail: r.ownerEmail }));
    let given = 0;
    for (let i = 0; i < pairs.length; i += 500) {
      const res = await givePylonOwners(pairs.slice(i, i + 500));
      if (!res.ok) return setState({ busy: false, said: res.message });
      given += res.given;
    }
    setState({
      busy: false,
      said: given
        ? `${given.toLocaleString("en-AU")} deal${given === 1 ? "" : "s"} given to the people who sold them.`
        : "No deals changed hands. Add the seller in Your account first (Deal owners not invited yet), with the email Pylon has for them.",
    });
  };
  return (
    <div className="mt-4 rounded-xl border border-line px-4 py-3">
      <p className="text-sm font-medium text-ink">Give the deals already brought in to who sold them</p>
      <p className="mt-1 text-sm text-ink-2">
        Sold by{" "}
        {[...sellers.values()]
          .slice(0, 6)
          .map((s) => `${s.name} (${s.count})`)
          .join(", ")}
        {sellers.size > 6 ? ` and ${sellers.size - 6} more` : ""}. Only to people in Your account, as members or deal owners not invited
        yet, matched by their Pylon email. A deal someone has already been given is left alone.
      </p>
      <button type="button" className={clsx(ui.quiet, "mt-2")} disabled={state.busy} onClick={() => void give()}>
        {state.busy ? "Giving them out…" : "Give them to their sellers"}
      </button>
      {state.said && (
        <p className="mt-2 text-sm text-ink-2" role="status">
          {state.said}
        </p>
      )}
    </div>
  );
}
