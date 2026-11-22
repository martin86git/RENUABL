"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight, Check, CircleAlert, FileText, KeyRound } from "lucide-react";
import {
  PYLON_BATCH,
  PYLON_KEY_PAGE,
  PYLON_WORDS,
  progressWords,
  type PylonListed,
  type PylonOutcome,
  type PylonStage,
} from "@/lib/domain/design/pylon-import";
import { bringFromPylon, checkPylon } from "@/lib/services/pylon-import";
import { PylonCsvImport } from "./settings-pylon-csv";
import { PylonFill } from "./settings-pylon-fill";
import { PATHS, ui } from "./design-shell";

type Found = { projects: PylonListed[]; already: string[]; more: boolean };
type Run = { done: number; total: number; already: number; failed: number; pdfs: number; running: boolean; stopped: boolean };

/**
 * Settings → CRM → Bring in from Pylon (16 Nov 2026, Martin: a retailer moving off Pylon keeps every sold proposal).
 * The key is held in this page only while it runs; each sold job becomes a customer and a deal with its signed PDF.
 */
export function PylonImportSettings() {
  const [key, setKey] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [stage, setStage] = useState<PylonStage>("won");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [failures, setFailures] = useState<{ customer: string; why: string }[]>([]);
  const stop = useRef(false);

  const check = async () => {
    setBusy(true);
    setProblem(null);
    setFound(null);
    setRun(null);
    setFailures([]);
    const res = await checkPylon(key);
    setBusy(false);
    if (!res.ok) return setProblem(res.message);
    setFound({ projects: res.projects, already: res.already, more: res.more });
  };

  const toBring = found ? found.projects.filter((p) => !found.already.includes(p.id)) : [];

  const bring = async () => {
    if (!found) return;
    stop.current = false;
    const names = new Map(found.projects.map((p) => [p.id, p.customer || p.reference || p.id]));
    let state: Run = { done: 0, total: toBring.length, already: 0, failed: 0, pdfs: 0, running: true, stopped: false };
    setRun(state);
    setProblem(null);
    const failed: { customer: string; why: string }[] = [];
    for (let i = 0; i < toBring.length; i += PYLON_BATCH) {
      if (stop.current) {
        state = { ...state, running: false, stopped: true };
        break;
      }
      const ids = toBring.slice(i, i + PYLON_BATCH).map((p) => p.id);
      const res = await bringFromPylon(key, ids, stage);
      if (!res.ok) {
        setProblem(res.message);
        state = { ...state, running: false, stopped: true };
        break;
      }
      for (const r of res.results as PylonOutcome[]) {
        if (r.result === "in") state = { ...state, done: state.done + 1, pdfs: state.pdfs + (r.pdf ? 1 : 0) };
        else if (r.result === "already") state = { ...state, done: state.done + 1, already: state.already + 1 };
        else {
          state = { ...state, failed: state.failed + 1 };
          failed.push({ customer: names.get(r.id) ?? r.id, why: r.why });
        }
      }
      setRun({ ...state });
      setFailures([...failed]);
    }
    state = { ...state, running: false };
    setRun(state);
    // Done with the key: it isn't kept on the page once the run ends.
    if (!state.stopped) {
      setKey("");
      setFound((f) => (f ? { ...f, already: [...f.already, ...toBring.map((p) => p.id)] } : f));
    }
  };

  const share = run && run.total ? (run.done + run.failed) / run.total : 0;

  return (
    <div className={clsx(ui.page, "max-w-3xl")}>
      <p className={ui.eyebrow}>Settings · CRM</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">{PYLON_WORDS.title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{PYLON_WORDS.intro}</p>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
          <KeyRound className="size-4 text-muted" aria-hidden /> Your Pylon key
        </p>
        <p className="mt-1 text-sm text-ink-2">
          {PYLON_WORDS.keyHow}{" "}
          <a href={PYLON_KEY_PAGE} target="_blank" rel="noreferrer noopener" className={clsx(ui.link, "inline-flex items-center gap-0.5")}>
            Open Pylon&rsquo;s API settings <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim() && !busy && !run?.running) void check();
          }}
        >
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your Pylon API key"
            aria-label="Pylon API key"
            className={clsx(ui.input, "min-w-0 flex-1 font-mono")}
            disabled={run?.running}
          />
          <button type="submit" className={ui.primary} disabled={!key.trim() || busy || run?.running}>
            {busy ? "Looking in Pylon…" : "Find my sold jobs"}
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">{PYLON_WORDS.keyKept}</p>
      </div>

      <PylonFill pylonKey={key} />

      <PylonCsvImport />

      {problem && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-ink" role="alert">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {problem}
        </p>
      )}

      {found && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
          <p className="text-[15px] font-medium text-ink">
            {found.projects.length
              ? `${found.projects.length} sold job${found.projects.length === 1 ? "" : "s"} in Pylon`
              : "No sold jobs found in Pylon"}
            {found.already.length > 0 && <span className="font-normal text-muted"> · {found.already.length} already brought in</span>}
          </p>
          {found.more && (
            <p className="mt-1 text-sm text-ink-2">That&rsquo;s as many as one import reads. Run it again once these are in.</p>
          )}

          {toBring.length > 0 && (
            <>
              <ul className="mt-3 max-h-48 divide-y divide-line overflow-y-auto rounded-xl border border-line text-sm">
                {toBring.slice(0, 50).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate text-ink">{p.customer || "No name in Pylon"}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">{p.reference}</span>
                  </li>
                ))}
                {toBring.length > 50 && <li className="px-3 py-2 text-muted">and {toBring.length - 50} more</li>}
              </ul>

              <fieldset className="mt-4" disabled={run?.running}>
                <legend className={ui.label}>Bring them in as</legend>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(
                    [
                      ["won", "Won", "Sold, not installed yet"],
                      ["installed", "Installed", "Already installed"],
                    ] as const
                  ).map(([id, name, hint]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={stage === id}
                      onClick={() => setStage(id)}
                      className={clsx(
                        "rounded-lg border px-3 py-2 text-left text-sm",
                        stage === id ? "border-ink bg-surface ring-1 ring-ink" : "border-line hover:border-line-strong",
                      )}
                    >
                      <span className="block font-medium text-ink">{name}</span>
                      <span className="block text-xs text-muted">{hint}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">You can move any deal to another stage afterwards.</p>
              </fieldset>
            </>
          )}

          <p className="mt-4 text-xs leading-relaxed text-muted">{PYLON_WORDS.notCarried}</p>

          {toBring.length > 0 && !run?.running && (
            <button type="button" className={clsx(ui.primary, "mt-4")} onClick={() => void bring()} disabled={!key.trim()}>
              {run?.stopped ? "Carry on" : `Bring in ${toBring.length} sold job${toBring.length === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      )}

      {run && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-5" aria-live="polite">
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
          {run.pdfs > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
              <FileText className="size-4 text-muted" aria-hidden /> {run.pdfs} proposal PDF{run.pdfs === 1 ? "" : "s"} kept on their deals
            </p>
          )}
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
              <ul className="mt-1.5 divide-y divide-line rounded-xl border border-line text-sm">
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
