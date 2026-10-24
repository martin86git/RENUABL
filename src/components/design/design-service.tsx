"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Mail, Phone, Search, Wrench } from "lucide-react";
import clsx from "clsx";
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import {
  MAX_ISSUE,
  MAX_NOTE,
  PLANNER_FILTERS,
  SERVICE_STATE_LABEL,
  matchesSearch,
  nextStates,
  plannerOrder,
  waitingDays,
  type PlannerFilter,
  type ServiceCase,
  type ServiceState,
} from "@/lib/domain/design/service";
import { listService, raiseService, shortDate, updateService } from "@/lib/services/crm";
import type { ServiceLine } from "@/lib/server/design-service-repo";
import { PATHS, PageHead, ui } from "./design-shell";
import { PanelTally } from "./solar-gauges";

const PILL: Record<ServiceState, string> = {
  open: "bg-danger/10 text-danger",
  "in-hand": "bg-sun text-sun-ink",
  resolved: "bg-positive-soft text-positive",
};
const ACTION_WORDS: Record<ServiceState, string> = { open: "Open it again", "in-hand": "Mark in hand", resolved: "Mark resolved" };
const who = (email: string) => email.split("@")[0];

/** Tells the nav's count that cases have changed. */
const changed = () => window.dispatchEvent(new Event("renuabl:service"));

function StatePill({ state }: { state: ServiceState }) {
  return <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", PILL[state])}>{SERVICE_STATE_LABEL[state]}</span>;
}

/**
 * What can be done to a case: a note, and the steps it can take from where it is (each "with the note" when one is
 * written), or the note alone.
 */
function CaseActions({ c, onChange }: { c: ServiceCase; onChange: (c: ServiceCase) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async (state?: ServiceState) => {
    setBusy(true);
    const res = await updateService(c.id, { ...(state ? { state } : {}), ...(text.trim() ? { text } : {}) });
    setBusy(false);
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    setText("");
    onChange(res.case);
    changed();
  };
  const withNote = text.trim() ? " with the note" : "";
  return (
    <div className="mt-3">
      <textarea
        aria-label="Add a note"
        className={clsx(ui.input, "min-h-16 py-2 text-[13px]")}
        value={text}
        maxLength={MAX_NOTE}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note: what was done, who is going out, what the customer said"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {nextStates(c.state).map((s) => (
          <button
            key={s}
            className={clsx(s === "resolved" ? ui.primary : ui.quiet, "h-8 px-3 text-xs")}
            disabled={busy}
            onClick={() => void send(s)}
          >
            {ACTION_WORDS[s]}
            {withNote}
          </button>
        ))}
        {text.trim() && (
          <button className={clsx(ui.quiet, "h-8 px-3 text-xs")} disabled={busy} onClick={() => void send()}>
            Add the note
          </button>
        )}
      </div>
      {problem && <p className="mt-1.5 text-xs text-danger">{problem}</p>}
    </div>
  );
}

/** A case's history, newest last. */
function History({ c }: { c: ServiceCase }) {
  if (!c.updates.length) return null;
  return (
    <ol className="mt-3 space-y-2 border-l border-line pl-3">
      {c.updates.map((u, i) => (
        <li key={i} className="text-[13px]">
          <p className="text-xs text-muted">
            {shortDate(u.at)} · {who(u.by)}
            {u.state && <> · {u.state === "open" ? "opened again" : SERVICE_STATE_LABEL[u.state].toLowerCase()}</>}
          </p>
          {u.text && <p className="mt-0.5 whitespace-pre-wrap text-ink">{u.text}</p>}
        </li>
      ))}
    </ol>
  );
}

/**
 * /design/service: the service pipeline (as Primero's). Every case the business has, those to resolve first (open, then
 * in hand, each longest waiting first), with the customer and deal beside the issue, its history, and what to do next.
 * Each change is written on the deal; nothing is sent to the customer.
 */
export function ServicePlanner() {
  const [cases, setCases] = useState<ServiceLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlannerFilter>("to-resolve");
  const [find, setFind] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  useEffect(() => {
    void listService().then((res) => (res.ok ? setCases(res.cases) : setProblem(res.message)));
  }, []);
  const shown = useMemo(
    () =>
      plannerOrder(cases ?? [], filter).filter((c) =>
        matchesSearch([c.customer, c.phone, c.email, c.address, c.title, c.issue, ...c.updates.map((u) => u.text)], find),
      ),
    [cases, filter, find],
  );
  const count = (s: ServiceState) => (cases ?? []).filter((c) => c.state === s).length;
  const replace = (next: ServiceCase) => setCases((all) => (all ?? []).map((c) => (c.id === next.id ? { ...c, ...next } : c)));

  return (
    <div className={ui.page}>
      <PageHead eyebrow="Service" title="Service pipeline" />
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        Jobs flagged with something to put right after the sale. Flag one from its deal. Each change is written on the deal, and nothing is
        sent to the customer.
      </p>
      <div className="mt-6 flex flex-wrap items-stretch gap-3">
        <div className="grid flex-1 grid-cols-3 gap-3 sm:max-w-xl">
          {(["open", "in-hand", "resolved"] as const).map((s) => (
            <div key={s} className={clsx(ui.card, "px-4 py-3")}>
              <p className={ui.eyebrow}>{SERVICE_STATE_LABEL[s]}</p>
              <p className="mt-1 text-[22px] tabular-nums tracking-tight text-ink">{cases ? count(s) : "–"}</p>
            </div>
          ))}
        </div>
        {/* One panel a case: lit when resolved, half-lit in hand, dark while open. */}
        <div className={clsx(ui.card, "flex flex-col justify-center gap-1.5 px-4 py-3")}>
          <p className={ui.eyebrow}>Every case</p>
          <PanelTally
            states={cases ? cases.map((c) => (c.state === "resolved" ? "done" : c.state === "in-hand" ? "part" : "todo")) : null}
            label="Every case: lit when resolved, half-lit when in hand"
          />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md bg-surface-2 p-1" role="group" aria-label="Show">
          {PLANNER_FILTERS.map((f) => (
            <button
              key={f.id}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={clsx(
                "h-8 rounded px-3 text-[13px] font-medium",
                filter === f.id ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-ink-2 hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">Search cases</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            className={clsx(ui.input, "pl-9")}
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Search customer, phone, email, address, deal or issue"
          />
        </label>
      </div>
      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {cases && shown.length === 0 && (
        <p className={clsx(ui.card, "mt-4 p-5 text-sm text-ink-2")}>
          {cases.length === 0
            ? "No deal has been flagged for service yet. Open a deal and use its Service card to flag it."
            : find.trim()
              ? "Nothing matches that."
              : filter === "to-resolve"
                ? "Nothing waiting: every service case is resolved."
                : "None here."}
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {shown.map((c) => {
          const latest = [...c.updates].reverse().find((u) => u.text);
          const days = waitingDays(c, now);
          return (
            <li key={c.id} className={clsx(ui.card, "grid gap-4 p-4 md:grid-cols-[16rem_minmax(0,1fr)]")}>
              {/* The customer and the deal, as they are now. */}
              <div className="min-w-0 border-line text-[13px] md:border-r md:pr-4">
                <p className="truncate text-sm font-semibold text-ink">{c.customer}</p>
                <p className="text-xs text-muted">{c.title}</p>
                <div className="mt-2 space-y-1 text-ink-2">
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:text-ink">
                      <Phone className="size-3.5" aria-hidden /> {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 truncate hover:text-ink">
                      <Mail className="size-3.5" aria-hidden /> {c.email}
                    </a>
                  )}
                  {c.address && <p className="truncate">{c.address}</p>}
                  <p className="text-xs text-muted">
                    {STAGE_LABELS[c.stage]}
                    {c.installDate && ` · installed ${shortDate(c.installDate)}`}
                    {c.installer && ` · ${c.installer}`}
                  </p>
                </div>
                <Link href={`${PATHS.deals}/${c.jobId}`} className={clsx(ui.quiet, "mt-3 h-8 px-3 text-xs")}>
                  Open deal
                </Link>
              </div>
              {/* The issue, where it stands, and what to do. */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatePill state={c.state} />
                  <p className="text-xs text-muted">
                    Raised {shortDate(c.raisedAt)} by {who(c.raisedBy)} ·{" "}
                    {c.state === "resolved" && c.resolvedAt
                      ? `resolved ${shortDate(c.resolvedAt)}`
                      : `waiting ${days} day${days === 1 ? "" : "s"}`}
                  </p>
                </div>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">The issue</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{c.issue}</p>
                {latest && open !== c.id && <p className="mt-1.5 truncate text-[13px] text-ink-2">Latest: {latest.text}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.state !== "resolved" && open !== c.id && <ResolveButton c={c} onChange={replace} />}
                  <button className={clsx(ui.quiet, "h-8 px-3 text-xs")} onClick={() => setOpen(open === c.id ? null : c.id)}>
                    {open === c.id ? "Close" : c.updates.length ? `Update · ${c.updates.length}` : "Update"}
                  </button>
                </div>
                {open === c.id && (
                  <>
                    <History c={c} />
                    <CaseActions c={c} onChange={replace} />
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ResolveButton({ c, onChange }: { c: ServiceCase; onChange: (c: ServiceCase) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={clsx(ui.primary, "h-8 bg-positive px-3 text-xs hover:bg-positive")}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await updateService(c.id, { state: "resolved" });
        setBusy(false);
        if (res.ok) {
          onChange(res.case);
          changed();
        }
      }}
    >
      <Check className="size-3.5" aria-hidden /> {busy ? "Resolving…" : "Resolved"}
    </button>
  );
}

/**
 * The deal's Service card: its open case, with its history and what to do next, or "Flag for service" when there is
 * none; and how many earlier cases there have been.
 */
export function DealService({ jobId }: { jobId: string }) {
  const [cases, setCases] = useState<ServiceCase[] | null>(null);
  const [raising, setRaising] = useState(false);
  const [issue, setIssue] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void listService().then((res) => res.ok && setCases(res.cases.filter((c) => c.jobId === jobId)));
  }, [jobId]);
  if (!cases) return null;
  const current = cases.find((c) => c.state !== "resolved") ?? null;
  const earlier = cases.filter((c) => c.state === "resolved").length;
  const raise = async () => {
    const res = await raiseService(jobId, issue);
    if (!res.ok) return setProblem(res.message);
    setCases([...cases, res.case]);
    setRaising(false);
    setIssue("");
    setProblem(null);
    changed();
  };
  return (
    <div className="space-y-3">
      {current ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatePill state={current.state} />
            <span className="text-xs text-muted">
              Raised {shortDate(current.raisedAt)} by {who(current.raisedBy)}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{current.issue}</p>
          <History c={current} />
          <CaseActions c={current} onChange={(next) => setCases(cases.map((c) => (c.id === next.id ? next : c)))} />
        </div>
      ) : raising ? (
        <div>
          <textarea
            aria-label="What needs resolving"
            className={clsx(ui.input, "min-h-20 py-2 text-[13px]")}
            value={issue}
            maxLength={MAX_ISSUE}
            autoFocus
            onChange={(e) => setIssue(e.target.value)}
            placeholder="What needs resolving? e.g. Inverter showing an earth fault since Monday"
          />
          {problem && <p className="mt-1 text-xs text-danger">{problem}</p>}
          <div className="mt-2 flex gap-2">
            <button className={clsx(ui.primary, "h-8 px-3 text-xs")} disabled={!issue.trim()} onClick={() => void raise()}>
              <Wrench className="size-3.5" aria-hidden /> Flag for service
            </button>
            <button className={clsx(ui.quiet, "h-8 px-3 text-xs")} onClick={() => setRaising(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-2">No service case open.</p>
          <button className={clsx(ui.quiet, "h-8 px-3 text-xs")} onClick={() => setRaising(true)}>
            <Wrench className="size-3.5" aria-hidden /> Flag for service
          </button>
        </div>
      )}
      {earlier > 0 && (
        <p className="text-xs text-muted">
          {earlier} earlier case{earlier === 1 ? "" : "s"}, resolved.
        </p>
      )}
      <Link href={PATHS.service} className="block text-xs text-muted underline underline-offset-4 hover:text-ink">
        The service pipeline
      </Link>
    </div>
  );
}
