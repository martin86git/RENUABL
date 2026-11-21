"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, CircleAlert, FileSpreadsheet } from "lucide-react";
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_WORDS,
  IMPORT_LIMITS,
  IMPORT_WORDS,
  cleanImportMap,
  guessImportColumns,
  importMapProblem,
  importSummary,
  looksLikeDeals,
  rowFromCells,
  rowRef,
  type ImportField,
  type ImportMap,
  type ImportMode,
  type ImportRow,
} from "@/lib/domain/design/crm-import";
import { readCsv } from "@/lib/domain/design/pylon-import";
import { bringSheetRows, readImportSheet } from "@/lib/services/crm-import";
import { PATHS, ui } from "./design-shell";

type Sheet = { name: string; header: string[]; body: string[][]; over: boolean };
type Run = { in: number; already: number; failed: number; total: number; running: boolean; stopped: boolean };

const n = (v: number) => v.toLocaleString("en-AU");

/**
 * Settings → CRM → Bring in contacts and deals (21 Nov 2026, Martin: "build the generic crm export import for contacts
 * and deals"): an export sheet from any CRM, its columns guessed and put right here, then brought in a batch at a time.
 */
export function CrmImportSettings() {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [map, setMap] = useState<ImportMap | null>(null);
  const [mode, setMode] = useState<ImportMode>("contacts");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [failures, setFailures] = useState<{ who: string; why: string }[]>([]);
  const stop = useRef(false);
  const done = useRef(new Set<string>());

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setSheet(null);
    setMap(null);
    setRun(null);
    setFailures([]);
    done.current = new Set();
    setBusy(true);
    let rows: string[][];
    if (/\.(xlsx|xlsm)$/i.test(file.name)) {
      if (file.size > IMPORT_LIMITS.fileBytes) {
        setBusy(false);
        return setProblem("That Excel file is over 4 MB. Save it as CSV and upload that: a CSV can be any size.");
      }
      const res = await readImportSheet(file);
      if (!res.ok) {
        setBusy(false);
        return setProblem(res.message);
      }
      rows = res.rows;
    } else {
      rows = readCsv(await file.text())
        .map((r) => r.slice(0, IMPORT_LIMITS.columns).map((c) => c.trim()))
        .filter((r) => r.some(Boolean));
    }
    setBusy(false);
    if (rows.length < 2)
      return setProblem("We couldn't find any rows in that file. It needs a row of column names, then a row for each person or deal.");
    const [header, ...body] = rows;
    const guessed = guessImportColumns(header!);
    setSheet({ name: file.name, header: header!, body: body.slice(0, IMPORT_LIMITS.rows), over: body.length > IMPORT_LIMITS.rows });
    setMap(guessed);
    setMode(looksLikeDeals(guessed) ? "deals" : "contacts");
  };

  const read = useMemo(() => {
    if (!sheet || !map) return { rows: [] as ImportRow[], skipped: 0 };
    const rows: ImportRow[] = [];
    const seen = new Set<string>();
    let skipped = 0;
    for (const cells of sheet.body) {
      const row = rowFromCells(cells, map);
      const ref = row && rowRef(row, mode);
      if (!row || !ref || seen.has(ref)) skipped++;
      else {
        seen.add(ref);
        rows.push(row);
      }
    }
    return { rows, skipped };
  }, [sheet, map, mode]);

  const mapProblem = map ? importMapProblem(map) : null;
  const stages = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of read.rows) count.set(r.stage, (count.get(r.stage) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [read.rows]);

  const setColumn = (field: ImportField, column: number) => {
    if (!sheet || !map) return;
    // A column holds one thing: taking it for this field frees it from any other.
    const next = { ...map };
    if (column >= 0) for (const f of IMPORT_FIELDS) if (next[f] === column) next[f] = -1;
    next[field] = column;
    setMap(cleanImportMap(next, sheet.header.length));
    setRun(null);
  };

  const bring = async () => {
    if (!sheet) return;
    stop.current = false;
    const todo = read.rows.filter((r) => !done.current.has(rowRef(r, mode)));
    let state: Run = { in: 0, already: 0, failed: 0, total: todo.length, running: true, stopped: false };
    setRun(state);
    setProblem(null);
    const failed: { who: string; why: string }[] = [];
    for (let i = 0; i < todo.length; i += IMPORT_LIMITS.batch) {
      if (stop.current) {
        state = { ...state, stopped: true };
        break;
      }
      const batch = todo.slice(i, i + IMPORT_LIMITS.batch);
      const res = await bringSheetRows(batch, mode, sheet.name);
      if (!res.ok) {
        setProblem(res.message);
        state = { ...state, stopped: true };
        break;
      }
      res.results.forEach((r, k) => {
        const row = batch[k];
        if (!row) return;
        if (r.result === "failed") {
          state = { ...state, failed: state.failed + 1 };
          failed.push({ who: `${row.firstName} ${row.lastName}`.trim(), why: r.why });
        } else {
          done.current.add(rowRef(row, mode));
          state = r.result === "in" ? { ...state, in: state.in + 1 } : { ...state, already: state.already + 1 };
        }
      });
      setRun({ ...state });
      setFailures([...failed]);
    }
    setRun({ ...state, running: false });
  };

  const gone = run ? run.in + run.already + run.failed : 0;
  const share = run && run.total ? gone / run.total : 0;
  const what = mode === "deals" ? "deal" : "contact";
  const locked = busy || Boolean(run?.running);

  return (
    <div className={clsx(ui.page, "max-w-3xl")}>
      <p className={ui.eyebrow}>Settings · CRM</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">{IMPORT_WORDS.title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{IMPORT_WORDS.intro}</p>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
          <FileSpreadsheet className="size-4 text-muted" aria-hidden /> Your export sheet
        </p>
        <p className="mt-1 text-sm text-ink-2">
          In your old CRM, export your contacts or your deals as CSV or Excel. The first row should be the column names. One sheet at a
          time: contacts first, then deals, works well.
        </p>
        <label
          className={clsx(sheet ? ui.quiet : ui.primary, "mt-3 inline-flex cursor-pointer", locked && "pointer-events-none opacity-60")}
        >
          {busy ? "Reading…" : sheet ? "Choose another sheet" : "Choose a sheet"}
          <input
            type="file"
            accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={locked}
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {sheet && (
          <p className="mt-2 text-sm text-ink-2">
            <span className="text-ink">{sheet.name}</span> · {n(sheet.body.length)} row{sheet.body.length === 1 ? "" : "s"}
            {sheet.over && ` (the first ${n(IMPORT_LIMITS.rows)}: split a larger sheet in two)`}
          </p>
        )}
        <p className="mt-3 text-xs text-muted">
          Coming from Pylon?{" "}
          <Link href={`${PATHS.settings}/pylon`} className={ui.link}>
            Bring in from Pylon
          </Link>{" "}
          carries the signed proposals too.
        </p>
      </div>

      {problem && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-ink" role="alert">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {problem}
        </p>
      )}

      {sheet && map && (
        <>
          <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
            <p className="text-[15px] font-medium text-ink">What is each row?</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="What is each row?">
              {(["contacts", "deals"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  disabled={locked}
                  onClick={() => {
                    setMode(m);
                    setRun(null);
                  }}
                  className={clsx(
                    "rounded-xl border px-4 py-3 text-left transition-colors",
                    mode === m ? "border-ink bg-canvas" : "border-line hover:border-ink/40",
                  )}
                >
                  <span className="block text-sm font-medium text-ink">{IMPORT_WORDS[m]}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {m === "contacts"
                      ? "Each person comes in as a contact. No deals are made."
                      : "Each row comes in as a deal on its customer, at the stage the sheet gives."}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <fieldset className="mt-4 rounded-2xl border border-line bg-surface p-5" disabled={locked}>
            <legend className="sr-only">Columns</legend>
            <p className="text-[15px] font-medium text-ink">Which column is which?</p>
            <p className="mt-1 text-sm text-ink-2">
              We&rsquo;ve matched what we could from the column names. Check them, and change any that are wrong.
            </p>
            <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {IMPORT_FIELDS.filter((f) => mode === "deals" || !["title", "stage", "value", "kw", "date", "owner"].includes(f)).map((f) => {
                const sample = map[f] >= 0 ? (sheet.body.find((r) => (r[map[f]] ?? "").trim())?.[map[f]] ?? "") : "";
                return (
                  <label key={f} className="block min-w-0">
                    <span className={ui.label}>{IMPORT_FIELD_WORDS[f]}</span>
                    <select className={clsx(ui.input, "mt-1 w-full")} value={map[f]} onChange={(e) => setColumn(f, Number(e.target.value))}>
                      <option value={-1}>Not in this sheet</option>
                      {sheet.header.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block truncate text-xs text-muted">{sample ? `e.g. ${sample}` : " "}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
            {mapProblem ? (
              <p className="flex items-start gap-2 text-sm text-ink" role="alert">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {mapProblem}
              </p>
            ) : (
              <>
                <p className="text-[15px] font-medium text-ink">
                  {n(read.rows.length)} {what}
                  {read.rows.length === 1 ? "" : "s"} to bring in
                  {read.skipped > 0 && (
                    <span className="font-normal text-muted">
                      {" "}
                      · {n(read.skipped)} row{read.skipped === 1 ? "" : "s"} left out (no name or email, or a repeat)
                    </span>
                  )}
                </p>
                {mode === "deals" && stages.length > 0 && (
                  <p className="mt-1 text-sm text-ink-2">
                    {stages.map(([s, c]) => `${STAGE_LABELS[s as keyof typeof STAGE_LABELS] ?? s} ${n(c)}`).join(" · ")}
                    {map.stage < 0 && ". With no stage column, every deal comes in as a new lead."}
                  </p>
                )}
                {read.rows.length > 0 && (
                  <div className="mt-3 overflow-x-auto rounded-xl border border-line">
                    <table className="w-full min-w-[32rem] text-left text-sm">
                      <thead className="bg-canvas text-xs text-muted">
                        <tr>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Email</th>
                          <th className="px-3 py-2 font-medium">Phone</th>
                          {mode === "deals" && <th className="px-3 py-2 font-medium">Deal</th>}
                          {mode === "deals" && <th className="px-3 py-2 font-medium">Stage</th>}
                          {mode === "deals" && <th className="px-3 py-2 text-right font-medium">Value</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {read.rows.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-ink">{`${r.firstName} ${r.lastName}`.trim()}</td>
                            <td className="px-3 py-2 text-ink-2">{r.email || "--"}</td>
                            <td className="px-3 py-2 text-ink-2">{r.phone || "--"}</td>
                            {mode === "deals" && <td className="px-3 py-2 text-ink-2">{r.title || "Solar"}</td>}
                            {mode === "deals" && <td className="px-3 py-2 text-ink-2">{STAGE_LABELS[r.stage]}</td>}
                            {mode === "deals" && (
                              <td className="px-3 py-2 text-right tabular-nums text-ink-2">
                                {r.value === null ? "--" : `$${n(Math.round(r.value))}`}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-3 text-xs leading-relaxed text-muted">{IMPORT_WORDS.notCarried}</p>
                {read.rows.length > 0 && !run?.running && !(run && !run.stopped) && (
                  <button type="button" className={clsx(ui.primary, "mt-4")} onClick={() => void bring()}>
                    {run?.stopped ? "Carry on" : `Bring in ${n(read.rows.length)} ${what}${read.rows.length === 1 ? "" : "s"}`}
                  </button>
                )}
              </>
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
                <p className="mt-2 text-sm text-ink-2">
                  {run.running
                    ? `${n(gone)} of ${n(run.total)}`
                    : importSummary({ in: run.in, already: run.already, failed: run.failed, mode })}
                </p>
                {!run.running && !run.stopped && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-ink">
                    <Check className="size-4 text-positive" aria-hidden />
                    <Link href={mode === "deals" ? PATHS.sales : PATHS.customers} className={ui.link}>
                      {mode === "deals" ? "Open Deals" : "Open Customers"}
                    </Link>
                  </p>
                )}
                {failures.length > 0 && (
                  <div className="mt-4">
                    <p className={ui.label}>Couldn&rsquo;t come across</p>
                    <ul className="mt-1.5 max-h-48 divide-y divide-line overflow-y-auto rounded-xl border border-line text-sm">
                      {failures.map((f, i) => (
                        <li key={i} className="px-3 py-2">
                          <span className="text-ink">{f.who}</span> <span className="text-muted">· {f.why}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
