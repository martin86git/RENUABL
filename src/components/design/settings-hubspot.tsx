"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight, Check, ChevronDown, CircleAlert, KeyRound } from "lucide-react";
import { JOB_STAGES, STAGE_LABELS } from "@/lib/domain/design/crm";
import {
  HUBSPOT_BATCH,
  HUBSPOT_KEY_HELP,
  HUBSPOT_SCOPES,
  HUBSPOT_WORDS,
  hubspotProgress,
  type EngagementType,
  type HsOutcome,
  type HubSpotMap,
  type StageChoice,
} from "@/lib/domain/design/hubspot-import";
import { bringFromHubSpot, lookAtHubSpot, type HubSpotLookView } from "@/lib/services/hubspot-import";
import { PATHS, ui } from "./design-shell";

type Run = {
  done: number;
  total: number;
  already: number;
  failed: number;
  skipped: number;
  lines: number;
  joined: number;
  running: boolean;
  stopped: boolean;
};

const ENGAGEMENT_WORDS: Record<EngagementType, string> = { notes: "notes", emails: "emails", calls: "calls", meetings: "meetings" };

/**
 * Settings → CRM → Bring in from HubSpot (23 Nov 2026, Martin). The token is held in this page only while it runs; the
 * business matches HubSpot's stages and fields to its own, and each deal becomes a customer and a deal with its record.
 */
export function HubSpotImportSettings() {
  const [key, setKey] = useState("");
  const [look, setLook] = useState<HubSpotLookView | null>(null);
  const [map, setMap] = useState<HubSpotMap>({ stages: {}, fields: {} });
  const [pipelinesOn, setPipelinesOn] = useState<string[]>([]);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [failures, setFailures] = useState<{ name: string; why: string }[]>([]);
  const [unread, setUnread] = useState<EngagementType[]>([]);
  const [broughtIn, setBroughtIn] = useState<string[]>([]);
  const stop = useRef(false);

  const check = async () => {
    setBusy(true);
    setProblem(null);
    setLook(null);
    setRun(null);
    setFailures([]);
    setUnread([]);
    const res = await lookAtHubSpot(key);
    setBusy(false);
    if (!res.ok) return setProblem(res.message);
    setLook(res);
    setMap(res.guess);
    setPipelinesOn(res.pipelines.map((p) => p.id));
    setUnread(res.unread);
    setBroughtIn(res.already);
  };

  const counts = useMemo(() => {
    const byStage = new Map<string, number>();
    const byPipeline = new Map<string, number>();
    for (const d of look?.deals ?? []) {
      byStage.set(d.stage, (byStage.get(d.stage) ?? 0) + 1);
      byPipeline.set(d.pipeline, (byPipeline.get(d.pipeline) ?? 0) + 1);
    }
    return { byStage, byPipeline };
  }, [look]);

  const toBring = useMemo(() => {
    if (!look) return [];
    const have = new Set(broughtIn);
    return look.deals.filter((d) => {
      const s = map.stages[d.stage];
      return pipelinesOn.includes(d.pipeline) && !have.has(d.id) && s && s !== "skip";
    });
  }, [look, map, pipelinesOn, broughtIn]);

  const matched = look ? look.targets.filter((t) => map.fields[t.key]).length : 0;

  const bring = async () => {
    if (!look) return;
    stop.current = false;
    const names = new Map(look.deals.map((d) => [d.id, d.name || `Deal ${d.id}`]));
    const list = toBring;
    let state: Run = { done: 0, total: list.length, already: 0, failed: 0, skipped: 0, lines: 0, joined: 0, running: true, stopped: false };
    setRun(state);
    setProblem(null);
    const failed: { name: string; why: string }[] = [];
    const missing = new Set<EngagementType>();
    const kept: string[] = [];
    for (let i = 0; i < list.length; i += HUBSPOT_BATCH) {
      if (stop.current) {
        state = { ...state, running: false, stopped: true };
        break;
      }
      const res = await bringFromHubSpot(
        key,
        list.slice(i, i + HUBSPOT_BATCH).map((d) => d.id),
        map,
      );
      if (!res.ok) {
        setProblem(res.message);
        state = { ...state, running: false, stopped: true };
        break;
      }
      for (const u of res.unread) missing.add(u);
      for (const r of res.results as HsOutcome[]) {
        if (r.result === "in") {
          kept.push(r.id);
          state = { ...state, done: state.done + 1, lines: state.lines + r.lines, joined: state.joined + (r.joined ? 1 : 0) };
        } else if (r.result === "already") {
          kept.push(r.id);
          state = { ...state, done: state.done + 1, already: state.already + 1 };
        } else if (r.result === "skipped") state = { ...state, skipped: state.skipped + 1 };
        else {
          state = { ...state, failed: state.failed + 1 };
          failed.push({ name: names.get(r.id) ?? r.id, why: r.why });
        }
      }
      setRun({ ...state });
      setFailures([...failed]);
      setUnread([...missing]);
    }
    state = { ...state, running: false };
    setRun(state);
    setBroughtIn((b) => [...b, ...kept]);
    // Done with the token: it isn't kept on the page once a whole run ends.
    if (!state.stopped) setKey("");
  };

  const share = run && run.total ? (run.done + run.failed + run.skipped) / run.total : 0;
  const stageChoice = (id: string): StageChoice => map.stages[id] ?? "skip";

  return (
    <div className={clsx(ui.page, "max-w-3xl")}>
      <p className={ui.eyebrow}>Settings · CRM</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">{HUBSPOT_WORDS.title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{HUBSPOT_WORDS.intro}</p>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
          <KeyRound className="size-4 text-muted" aria-hidden /> Your HubSpot service key or private app token
        </p>
        <p className="mt-1 text-sm text-ink-2">{HUBSPOT_WORDS.keyHow}</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {HUBSPOT_SCOPES.map((s) => (
            <li key={s} className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-xs text-ink-2">
              {s}
            </li>
          ))}
        </ul>
        <a
          href={HUBSPOT_KEY_HELP}
          target="_blank"
          rel="noreferrer noopener"
          className={clsx(ui.link, "mt-2 inline-flex items-center gap-0.5 text-sm")}
        >
          HubSpot&rsquo;s help on private apps <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
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
            placeholder="Paste the key"
            aria-label="HubSpot service key or private app token"
            className={clsx(ui.input, "min-w-0 flex-1 font-mono")}
            disabled={run?.running}
          />
          <button type="submit" className={ui.primary} disabled={!key.trim() || busy || run?.running}>
            {busy ? "Looking in HubSpot…" : look ? "Look again" : "Find my deals"}
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">{HUBSPOT_WORDS.keyKept}</p>
      </div>

      {problem && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-ink" role="alert">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {problem}
        </p>
      )}

      {look && (
        <>
          <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
            <p className="text-[15px] font-medium text-ink">
              {look.deals.length ? `${look.deals.length.toLocaleString("en-AU")} deals in HubSpot` : "No deals found in HubSpot"}
              {broughtIn.length > 0 && (
                <span className="font-normal text-muted"> · {broughtIn.length.toLocaleString("en-AU")} already brought in</span>
              )}
            </p>
            {unread.length > 0 && !run && (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-ink">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                The token can&rsquo;t read {unread.map((u) => ENGAGEMENT_WORDS[u]).join(", ")}. Add the read scope for{" "}
                {unread.length === 1 ? "it" : "them"} to the private app in HubSpot and press Look again, or bring the deals in without{" "}
                {unread.length === 1 ? "it" : "them"}.
              </p>
            )}
            {look.more && (
              <p className="mt-1 text-sm text-ink-2">That&rsquo;s as many as one import reads. Run it again once these are in.</p>
            )}

            <p className="mt-4 text-sm font-medium text-ink">1. Match each HubSpot stage to one of yours</p>
            <p className="mt-0.5 text-xs text-muted">
              We&rsquo;ve guessed from each stage&rsquo;s name. Leave a stage in HubSpot to bring none of its deals.
            </p>
            <div className="mt-3 space-y-4">
              {look.pipelines.map((p) => {
                const on = pipelinesOn.includes(p.id);
                return (
                  <fieldset key={p.id} className="rounded-xl border border-line p-3" disabled={run?.running}>
                    <legend className="px-1">
                      <label className="flex items-center gap-2 text-sm font-medium text-ink">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => setPipelinesOn((list) => (e.target.checked ? [...list, p.id] : list.filter((x) => x !== p.id)))}
                        />
                        {p.label}
                        <span className="font-normal text-muted">· {(counts.byPipeline.get(p.id) ?? 0).toLocaleString("en-AU")} deals</span>
                      </label>
                    </legend>
                    {on && (
                      <ul className="divide-y divide-line text-sm">
                        {p.stages.map((s) => (
                          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <span className="min-w-0 text-ink">
                              {s.label}
                              <span className="text-muted"> · {counts.byStage.get(s.id) ?? 0}</span>
                            </span>
                            <div className="w-full sm:w-56">
                              <select
                                aria-label={`Where ${s.label} goes`}
                                value={stageChoice(s.id)}
                                onChange={(e) => setMap((m) => ({ ...m, stages: { ...m.stages, [s.id]: e.target.value as StageChoice } }))}
                                className={ui.input}
                              >
                                {JOB_STAGES.map((j) => (
                                  <option key={j} value={j}>
                                    {STAGE_LABELS[j]}
                                  </option>
                                ))}
                                <option value="skip">Leave in HubSpot</option>
                              </select>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </fieldset>
                );
              })}
            </div>

            <button
              type="button"
              className="mt-5 flex w-full items-center justify-between text-left text-sm font-medium text-ink"
              aria-expanded={fieldsOpen}
              data-hs-fields
              onClick={() => setFieldsOpen((o) => !o)}
            >
              <span>
                2. Match your deal fields{" "}
                <span className="font-normal text-muted">
                  · {matched} of {look.targets.length} matched
                </span>
              </span>
              <ChevronDown className={clsx("size-4 text-muted transition-transform", fieldsOpen && "rotate-180")} aria-hidden />
            </button>
            <p className="mt-0.5 text-xs text-muted">
              Anything you don&rsquo;t match still comes across, written in the deal&rsquo;s note. A choice field takes a value only when
              it&rsquo;s one of its own choices.
            </p>
            {fieldsOpen && (
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line text-sm">
                {look.targets.map((t) => (
                  <li key={t.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="text-ink">{t.label}</span>
                    <div className="w-full sm:w-64">
                      <select
                        aria-label={`HubSpot property for ${t.label}`}
                        value={map.fields[t.key] ?? ""}
                        disabled={run?.running}
                        onChange={(e) =>
                          setMap((m) => {
                            const fields = { ...m.fields };
                            if (e.target.value) fields[t.key] = e.target.value;
                            else delete fields[t.key];
                            return { ...m, fields };
                          })
                        }
                        className={ui.input}
                      >
                        <option value="">Not from HubSpot</option>
                        {look.properties.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.label}
                            {p.custom ? "" : " (HubSpot's)"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-5 text-xs leading-relaxed text-muted">{HUBSPOT_WORDS.notCarried}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{HUBSPOT_WORDS.again}</p>

            {!run?.running && (
              <button
                type="button"
                className={clsx(ui.primary, "mt-4")}
                onClick={() => void bring()}
                disabled={!key.trim() || !toBring.length}
              >
                {toBring.length
                  ? `${run?.stopped ? "Carry on: bring in" : "Bring in"} ${toBring.length.toLocaleString("en-AU")} deal${toBring.length === 1 ? "" : "s"}`
                  : "Nothing new to bring in"}
              </button>
            )}
            {!key.trim() && look && toBring.length > 0 && !run?.running && (
              <p className="mt-2 text-xs text-muted">Paste the token again to carry on.</p>
            )}
          </div>
        </>
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
          <p className="mt-2 text-sm text-ink-2">{hubspotProgress(run)}</p>
          {run.lines > 0 && (
            <p className="mt-1 text-sm text-ink-2">
              {run.lines.toLocaleString("en-AU")} notes, emails, calls and meetings put on their deals
            </p>
          )}
          {unread.length > 0 && (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-ink">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              The token can&rsquo;t read {unread.map((u) => ENGAGEMENT_WORDS[u]).join(", ")}, so those weren&rsquo;t brought across.
            </p>
          )}
          {!run.running && !run.stopped && (
            <p className="mt-3 flex items-center gap-2 text-sm text-ink">
              <Check className="size-4 text-positive" aria-hidden />
              <span>
                Your HubSpot deals are in.{" "}
                <Link href={PATHS.sales} className={ui.link}>
                  Open Deals
                </Link>
              </span>
            </p>
          )}
          {failures.length > 0 && (
            <div className="mt-4">
              <p className={ui.label}>Couldn&rsquo;t come across</p>
              <ul className="mt-1.5 max-h-60 divide-y divide-line overflow-y-auto rounded-xl border border-line text-sm">
                {failures.map((f, i) => (
                  <li key={i} className="px-3 py-2">
                    <span className="text-ink">{f.name}</span> <span className="text-muted">· {f.why}</span>
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
