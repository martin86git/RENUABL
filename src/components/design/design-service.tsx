"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  serviceBriefing,
  serviceFocusWords,
  waitingDays,
  type PlannerFilter,
  type ServiceCase,
  type ServiceState,
} from "@/lib/domain/design/service";
import { listService, raiseService, shortDate, updateService } from "@/lib/services/crm";
import type { ServiceLine } from "@/lib/server/design-service-repo";
import type { SolDesignShown } from "@/lib/domain/design/sol-designs";
import { SOL_CHANGED, SOL_TOGGLE, askSol } from "@/lib/services/sol";
import { PATHS, ui } from "./design-shell";
import { SolMark, SolStars } from "./sol-icon";
import { SolDesignView } from "./sol-design-view";
import { SolThinking } from "./sol-thinking";
import { SolBox, SolSays, Typed } from "./today-pad";

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

/** One turn of the Service conversation: Sol turned to a case, or a question and his answer. */
type Turn =
  | { id: number; kind: "focus"; customer: string; title: string }
  | { id: number; kind: "ask"; q: string; a: { text: string; more: boolean; designs?: SolDesignShown[] } | null };

/** The cases waiting, in a line each: what Sol is told on the Service screen while no case is picked. */
function pipelineWords(cases: readonly ServiceLine[]): string {
  const waiting = plannerOrder(cases, "to-resolve");
  return [
    `The service pipeline: ${waiting.length} case${waiting.length === 1 ? "" : "s"} to resolve, ${cases.length - waiting.length} resolved.`,
    ...waiting.map(
      (c) =>
        `- ${c.customer} · deal "${c.title}" (deal id ${c.jobId}) · ${SERVICE_STATE_LABEL[c.state]} since ${c.raisedAt.slice(0, 10)}: ${c.issue.replace(/\s+/g, " ")}`,
    ),
  ].join("\n");
}

/**
 * /design/service (3 Nov 2026, Martin): Sol's chat, as on Today, with the service cases down the right. Picking a case
 * turns the conversation to that deal: a line in the chat says so, Sol is asked to bring the member up to speed the
 * first time it is picked in the visit, and every question after goes with the case, its history, its earlier cases and
 * the deal's id (his deal_details adds the record, the system and the as-built). The picked card opens to its history
 * and what can be done to it. Each change is written on the deal; nothing is sent to the customer.
 */
export function ServicePlanner() {
  const [cases, setCases] = useState<ServiceLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlannerFilter>("to-resolve");
  const [find, setFind] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [asking, setAsking] = useState(false);
  const briefed = useRef(new Set<string>());
  /** Each turn its own number. */
  const turnNo = useRef(0);
  const end = useRef<HTMLDivElement>(null);
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
  const focus = cases?.find((c) => c.id === picked) ?? null;
  const talking = turns.length > 0;

  const follow = useCallback(() => {
    const el = end.current;
    if (!el) return;
    const below = el.getBoundingClientRect().bottom - window.innerHeight;
    if (below > -40 && below < 480) el.scrollIntoView({ block: "end", behavior: "smooth" });
  }, []);

  const ask = async (q: string, on: ServiceLine | null = focus) => {
    if (asking || !cases) return;
    const id = ++turnNo.current;
    setAsking(true);
    setTurns((t) => [...t, { id, kind: "ask", q, a: null }]);
    window.setTimeout(() => end.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 60);
    const page = { path: PATHS.service, title: "Service", about: on ? serviceFocusWords(on, cases) : pipelineWords(cases), screen: "" };
    const r = await askSol(q, [], page);
    setAsking(false);
    let a: { text: string; more: boolean; designs?: SolDesignShown[] };
    if (!r.ok) a = { text: r.message, more: false };
    else {
      window.dispatchEvent(new CustomEvent(SOL_CHANGED, { detail: r.state }));
      const last = [...r.state.turns].reverse().find((t) => t.role === "sol");
      a = {
        text: last?.text ?? "Done.",
        more: Boolean(last?.charts?.length || last?.diagrams?.length || last?.drafts?.length || last?.reminder),
        ...(last?.designs?.length ? { designs: last.designs } : {}),
      };
    }
    setTurns((all) => all.map((t) => (t.id === id && t.kind === "ask" ? { ...t, a } : t)));
  };

  /** Turns the conversation to a case: said in the chat, and Sol brings them up to speed the first time. */
  const pick = (c: ServiceLine) => {
    if (picked === c.id) return setPicked(null);
    setPicked(c.id);
    setTurns((t) => [...t, { id: ++turnNo.current, kind: "focus", customer: c.customer, title: c.title }]);
    if (!briefed.current.has(c.id) && !asking) {
      briefed.current.add(c.id);
      void ask(serviceBriefing(c.customer), c);
    } else window.setTimeout(() => end.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 60);
  };

  const box = (
    <SolBox
      id="service-ask"
      onAsk={(q) => void ask(q)}
      asking={asking || !cases}
      placeholder={focus ? `Ask Sol about ${focus.customer.split(/\s+/)[0]}'s case` : "Ask Sol about your service cases"}
    />
  );

  return (
    <div className={clsx(ui.page, "grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]")}>
      {/* Sol's conversation. */}
      <section className="order-2 flex min-w-0 flex-col lg:order-1 lg:min-h-[calc(100dvh-13rem)]" aria-label="Sol">
        {problem && (
          <p className="mb-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
            {problem}
          </p>
        )}
        {!talking ? (
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-1 py-6 text-center lg:py-10">
            <span className="relative">
              <span className="sol-orb sol-breathe inline-flex size-16 items-center justify-center rounded-full">
                <SolMark className="size-12" />
              </span>
              <SolStars className="absolute -right-3 -top-3 size-6" />
            </span>
            <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Service</p>
            <h1 className="mt-2 text-[clamp(28px,3.6vw,42px)] font-light leading-[1.05] tracking-[-0.025em] text-ink">
              {cases === null
                ? "Looking at your service cases…"
                : count("open") + count("in-hand") === 0
                  ? "Nothing to put right."
                  : `${count("open") + count("in-hand")} to put right.`}
            </h1>
            <p className="mt-3 max-w-md text-[15px] text-ink-2">
              Pick a case and I&apos;ll bring you up to speed on it, or ask me about any of them.
            </p>
            <div className="mt-8 w-full">{box}</div>
          </div>
        ) : (
          <>
            <div className="mx-auto w-full max-w-2xl flex-1 space-y-7 pb-4 pt-2" aria-live="polite">
              {turns.map((t) =>
                t.kind === "focus" ? (
                  <div key={t.id} className="flex items-center gap-3 text-xs text-muted">
                    <span className="h-px flex-1 bg-line" />
                    <span className="inline-flex items-center gap-1.5">
                      <Wrench className="size-3.5 text-sun-line" aria-hidden /> Now on {t.customer} · {t.title}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                ) : (
                  <div key={t.id} className="space-y-4">
                    <div className="flex justify-end">
                      <p className="max-w-[80%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-ink">
                        {t.q}
                      </p>
                    </div>
                    <SolSays>
                      {!t.a ? (
                        <SolThinking />
                      ) : (
                        <div className="text-[15px] leading-relaxed text-ink">
                          <Typed text={t.a.text} onDone={follow} />
                          {t.a.designs?.length ? (
                            <div className="mt-3 max-w-2xl space-y-3">
                              {t.a.designs.map((d) => (
                                <SolDesignView key={d.jobId} shown={d} />
                              ))}
                            </div>
                          ) : null}
                          {t.a.more && (
                            <button
                              type="button"
                              onClick={() => window.dispatchEvent(new Event(SOL_TOGGLE))}
                              className="mt-2 block text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink"
                            >
                              There is more with it in your conversation with Sol. Open it
                            </button>
                          )}
                        </div>
                      )}
                    </SolSays>
                  </div>
                ),
              )}
              <div ref={end} className="scroll-mb-40" />
            </div>
            <div className="sticky bottom-0 z-10 bg-gradient-to-t from-canvas from-60% to-transparent pb-5 pt-10">
              <div className="mx-auto max-w-2xl">
                {focus && (
                  <p className="mb-2 flex items-center gap-2 text-xs text-muted">
                    Sol is looking at {focus.customer}&apos;s case
                    <button type="button" className="underline underline-offset-4 hover:text-ink" onClick={() => setPicked(null)}>
                      Look at them all
                    </button>
                  </p>
                )}
                {box}
              </div>
            </div>
          </>
        )}
      </section>

      {/* The cases. */}
      <aside className="order-1 min-w-0 lg:order-2" aria-label="Service cases">
        <div className="lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100dvh-9rem)] lg:flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <h2 className="text-[15px] font-semibold text-ink">Service cases</h2>
            <p className="text-xs tabular-nums text-muted">
              {cases ? `${count("open")} open · ${count("in-hand")} in hand · ${count("resolved")} resolved` : "–"}
            </p>
          </div>
          <div className="mt-3 flex gap-1 rounded-md bg-surface-2 p-1" role="group" aria-label="Show">
            {PLANNER_FILTERS.map((f) => (
              <button
                key={f.id}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={clsx(
                  "h-7 flex-1 rounded px-2 text-xs font-medium",
                  filter === f.id ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-ink-2 hover:text-ink",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="relative mt-2 block">
            <span className="sr-only">Search cases</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input className={clsx(ui.input, "pl-9")} value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search cases" />
          </label>
          {cases && shown.length === 0 && (
            <p className={clsx(ui.card, "mt-3 p-4 text-[13px] text-ink-2")}>
              {cases.length === 0
                ? "No deal has been flagged for service yet. Open a deal and use its Service card to flag it."
                : find.trim()
                  ? "Nothing matches that."
                  : filter === "to-resolve"
                    ? "Nothing waiting: every service case is resolved."
                    : "None here."}
            </p>
          )}
          <ul className="mt-3 space-y-2 lg:-mr-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-2 lg:pr-2">
            {shown.map((c) => {
              const on = picked === c.id;
              const latest = [...c.updates].reverse().find((u) => u.text);
              const days = waitingDays(c, now);
              return (
                <li key={c.id} className={clsx(ui.card, "p-0 transition", on && "ring-2 ring-sun-line")}>
                  <button type="button" onClick={() => pick(c)} aria-pressed={on} className="block w-full p-3.5 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{c.customer}</p>
                      <StatePill state={c.state} />
                    </div>
                    <p className="truncate text-xs text-muted">
                      {c.title} ·{" "}
                      {c.state === "resolved" && c.resolvedAt
                        ? `resolved ${shortDate(c.resolvedAt)}`
                        : `waiting ${days} day${days === 1 ? "" : "s"}`}
                    </p>
                    <p className={clsx("mt-1.5 text-[13px] text-ink", !on && "line-clamp-2")}>{c.issue}</p>
                    {latest && !on && <p className="mt-1 truncate text-xs text-ink-2">Latest: {latest.text}</p>}
                  </button>
                  {on && (
                    <div className="border-t border-line px-3.5 pb-3.5 pt-3 text-[13px]">
                      <div className="space-y-1 text-ink-2">
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
                          {c.installer && ` · ${c.installer}`} · raised by {who(c.raisedBy)}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {c.state !== "resolved" && <ResolveButton c={c} onChange={replace} />}
                        <Link href={`${PATHS.deals}/${c.jobId}`} className={clsx(ui.quiet, "h-8 px-3 text-xs")}>
                          Open deal
                        </Link>
                      </div>
                      <History c={c} />
                      <CaseActions c={c} onChange={replace} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
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
