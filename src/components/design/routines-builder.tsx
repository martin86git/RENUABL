"use client";

import { useStageLabel } from "./stage-select";
import { clsx } from "clsx";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  CHECK_TESTS,
  CHECK_WORDS,
  CUSTOM_LIMITS,
  SOL_AGENT,
  STEP_WORDS,
  TRIGGER_STAGES,
  insertStep,
  moveStep,
  removeStep,
  routineProblem,
  stepsFor,
  viewStepId,
  type CustomRoutine,
  type CustomStep,
  type CustomStepKind,
  type CustomTrigger,
  type TriggerStage,
} from "@/lib/domain/design/custom-routines";
import type { StepKind } from "@/lib/domain/design/routines";
import { deleteOwnRoutine, saveOwnRoutine, type RoutinesView } from "@/lib/services/routines";
import { ui } from "./design-shell";
import { Joint, KIND, LiveLine, LiveSteps, OnSwitch } from "./routines";

type Draft = Omit<CustomRoutine, "id" | "onAt" | "updatedAt">;

/** A new routine to start from: Sol, a new lead, one email to write. */
export const blankRoutine = (): Draft => ({
  name: "",
  agent: SOL_AGENT,
  on: false,
  trigger: { kind: "new-lead" },
  steps: insertStep([], -1, "email"),
});

const viewKind: Record<CustomStepKind, StepKind> = { wait: "wait", check: "check", email: "action", text: "action", call: "action" };

/**
 * A routine the business builds itself (20 Nov 2026, Martin: "go ahead with 1 and 2, keep the live pills"): who runs
 * it, what starts it, then its steps as cards on the same canvas as the others, each changed in place, moved up or
 * down, or taken away, with a plus between any two to add one. Nothing changes until Save; switching it on is the
 * owner's, and only once it has something to do.
 */
export function RoutineBuilder({
  routine,
  view,
  onSaved,
  onGone,
  onCancelNew,
}: {
  /** The routine as kept, or null for a new one. */
  routine: CustomRoutine | null;
  view: RoutinesView;
  onSaved: (id: string) => Promise<void>;
  onGone: () => Promise<void>;
  onCancelNew: () => void;
}) {
  // Stages by the business's own names (pipeline-stages.ts).
  const stageWords = useStageLabel();
  const kept: Draft = routine
    ? { name: routine.name, agent: routine.agent, on: routine.on, trigger: routine.trigger, steps: routine.steps }
    : blankRoutine();
  const [draft, setDraft] = useState<Draft>(kept);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState<number | null>(null);
  const [sure, setSure] = useState(false);
  const locked = view.readOnly || !view.may.settings;
  const dirty = JSON.stringify(draft) !== JSON.stringify(kept) || !routine;
  const agent = view.agents.find((a) => a.key === draft.agent);
  const allowed = stepsFor(draft.agent);
  const problemNow = routineProblem(draft);

  const set = (patch: Partial<Draft>) => {
    setProblem(null);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const setStep = (id: string, patch: Partial<CustomStep>) =>
    set({ steps: draft.steps.map((s) => (s.id === id ? ({ ...s, ...patch } as CustomStep) : s)) });

  const save = async (next: Draft) => {
    setBusy(true);
    const res = await saveOwnRoutine(routine?.id ?? null, next);
    setBusy(false);
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    await onSaved(res.routine.id);
  };

  const pickAgent = (key: string) => {
    const can = stepsFor(key);
    // What the steps say carries across: an email or text becomes a call for a voice agent, a call an email for Sol.
    const swap = (s: CustomStep): CustomStep =>
      can.includes(s.kind) || !("about" in s) ? s : { id: s.id, kind: key === SOL_AGENT ? "email" : "call", about: s.about };
    set({ agent: key, steps: draft.steps.map(swap).filter((s) => can.includes(s.kind)) });
  };

  return (
    <section aria-label="Build a routine" className="relative overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="routine-name">
            Routine name
          </label>
          <input
            id="routine-name"
            value={draft.name}
            disabled={locked}
            maxLength={CUSTOM_LIMITS.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Name it: Battery check-in"
            className="w-full bg-transparent text-[16px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-muted"
          />
          <p className="text-[12.5px] text-ink-2">
            {agent ? `${agent.name} runs it` : "Choose who runs it"} · once a deal, from when it&apos;s switched on
          </p>
        </div>
        <OnSwitch
          on={draft.on}
          disabled={locked || busy || (!draft.on && (!view.may.onOff || Boolean(problemNow)))}
          why={!view.may.onOff ? "Only the business's owner can switch a routine on." : (problemNow ?? undefined)}
          words={["Running", "Off"]}
          hints={["Running: switch off and no new deal starts it", "Off: switch on and it starts on each new deal from now"]}
          onFlip={() => void save({ ...draft, on: !draft.on })}
        />
      </header>

      {problem && (
        <p className="border-b border-line bg-warning-soft px-5 py-2 text-[13px] text-warning" role="alert">
          {problem}
        </p>
      )}

      <div
        className="min-h-[28rem] px-4 py-8 sm:px-8"
        style={{ backgroundImage: "radial-gradient(var(--line) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      >
        <LiveSteps.Provider value={view.live ?? {}}>
          <ol className="mx-auto flex max-w-[34rem] flex-col items-center" aria-label="Its steps, in order">
            {/* Who runs it, and what starts it. */}
            <li className="w-full">
              <Card kind="trigger" title="When">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={ui.label}>Who runs it</span>
                    <select className={ui.input} disabled={locked} value={draft.agent} onChange={(e) => pickAgent(e.target.value)}>
                      {view.agents.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.name} · {a.medium === "text" ? "writes" : "rings"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={ui.label}>What starts it</span>
                    <select
                      className={ui.input}
                      disabled={locked}
                      value={draft.trigger.kind === "new-lead" ? "new-lead" : draft.trigger.stage}
                      onChange={(e) =>
                        set({
                          trigger: (e.target.value === "new-lead"
                            ? { kind: "new-lead" }
                            : { kind: "stage", stage: e.target.value as TriggerStage }) satisfies CustomTrigger,
                        })
                      }
                    >
                      <option value="new-lead">A new lead comes in</option>
                      {TRIGGER_STAGES.map((s) => (
                        <option key={s} value={s}>
                          A deal reaches {stageWords(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </Card>
            </li>

            <li className="w-full">
              <AddHere
                at={-1}
                open={asking === -1}
                onOpen={setAsking}
                allowed={allowed}
                locked={locked || draft.steps.length >= CUSTOM_LIMITS.steps}
                onAdd={(kind) => {
                  set({ steps: insertStep(draft.steps, -1, kind) });
                  setAsking(null);
                }}
              />
            </li>

            {draft.steps.map((s, i) => (
              <li key={s.id} className="flex w-full flex-col items-center">
                <Card
                  kind={viewKind[s.kind]}
                  title={STEP_WORDS[s.kind].label}
                  live={routine ? viewStepId(routine.id, s.id) : undefined}
                  tools={
                    locked ? null : (
                      <span className="flex items-center gap-0.5">
                        <Tool label="Move up" disabled={i === 0} onClick={() => set({ steps: moveStep(draft.steps, s.id, -1) })}>
                          <ArrowUp className="size-3.5" aria-hidden />
                        </Tool>
                        <Tool
                          label="Move down"
                          disabled={i === draft.steps.length - 1}
                          onClick={() => set({ steps: moveStep(draft.steps, s.id, 1) })}
                        >
                          <ArrowDown className="size-3.5" aria-hidden />
                        </Tool>
                        <Tool label="Take this step away" onClick={() => set({ steps: removeStep(draft.steps, s.id) })}>
                          <X className="size-3.5" aria-hidden />
                        </Tool>
                      </span>
                    )
                  }
                >
                  <StepFields step={s} locked={locked} agentName={agent?.name ?? "The agent"} onChange={(p) => setStep(s.id, p)} />
                </Card>
                <AddHere
                  at={i}
                  open={asking === i}
                  onOpen={setAsking}
                  allowed={allowed}
                  locked={locked || draft.steps.length >= CUSTOM_LIMITS.steps}
                  onAdd={(kind) => {
                    set({ steps: insertStep(draft.steps, i, kind) });
                    setAsking(null);
                  }}
                />
              </li>
            ))}

            <li className="w-full">
              <Card kind="end" title="Done">
                <p className="text-[12.5px] text-ink-2">Each step is written on the deal. A deal runs a routine once.</p>
              </Card>
            </li>
          </ol>
        </LiveSteps.Provider>
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
        <p className="min-w-0 flex-1 text-[12px] leading-snug text-muted">
          {problemNow ?? "Emails count down in Sol's outbox first; texts and calls keep their hours."}
        </p>
        {!locked && routine && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!sure) return setSure(true);
              setBusy(true);
              const res = await deleteOwnRoutine(routine.id);
              setBusy(false);
              if (!res.ok) return setProblem(res.message);
              await onGone();
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-warning ring-1 ring-warning/30 hover:bg-warning-soft"
          >
            <Trash2 className="size-3.5" aria-hidden /> {sure ? "Yes, delete it" : "Delete"}
          </button>
        )}
        {!locked && (
          <>
            {dirty && (
              <button
                type="button"
                disabled={busy}
                onClick={() => (routine ? setDraft(kept) : onCancelNew())}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink-2 ring-1 ring-line hover:ring-ink/40"
              >
                {routine ? "Undo changes" : "Cancel"}
              </button>
            )}
            <button
              type="button"
              disabled={busy || !dirty || !draft.name.trim()}
              onClick={() => void save(draft)}
              className="rounded-full bg-ink px-4 py-1.5 text-[12.5px] font-semibold text-canvas disabled:opacity-40"
            >
              {busy ? "Saving…" : routine ? "Save" : "Save routine"}
            </button>
          </>
        )}
      </footer>
    </section>
  );
}

function Tool({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** One card on the canvas, shaped as the built-in routines' steps are. */
function Card({
  kind,
  title,
  tools,
  live,
  children,
}: {
  kind: StepKind;
  title: string;
  tools?: React.ReactNode;
  live?: string;
  children: React.ReactNode;
}) {
  const k = KIND[kind];
  return (
    <div className="w-full rounded-xl bg-surface shadow-[0_1px_2px_rgba(20,22,26,0.06),0_6px_18px_rgba(20,22,26,0.06)] ring-1 ring-line">
      <div className="flex items-center gap-3 px-4 pt-3">
        <span className={clsx("grid size-7 shrink-0 place-items-center rounded-lg", k.tone)} aria-hidden>
          <k.Icon className="size-3.5" />
        </span>
        <span className="flex-1 text-[13px] font-semibold text-ink">{title}</span>
        {tools}
      </div>
      <div className="px-4 pb-3 pt-2">{children}</div>
      {live && <LiveLine id={live} />}
    </div>
  );
}

const CHIP = "rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1 transition disabled:opacity-50";
const chip = (on: boolean) => clsx(CHIP, on ? "bg-ink text-canvas ring-ink" : "bg-surface text-ink ring-line hover:ring-ink/40");

function StepFields({
  step,
  locked,
  agentName,
  onChange,
}: {
  step: CustomStep;
  locked: boolean;
  agentName: string;
  onChange: (p: Partial<CustomStep>) => void;
}) {
  if (step.kind === "wait")
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-2">Wait</span>
        <input
          type="number"
          min={1}
          max={step.unit === "hours" ? CUSTOM_LIMITS.hours : CUSTOM_LIMITS.days}
          disabled={locked}
          value={step.amount}
          onChange={(e) => onChange({ amount: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
          aria-label="How long"
          className="h-8 w-16 rounded-lg border border-line bg-surface px-2 text-[13px] outline-none focus:border-ink"
        />
        {(["hours", "days"] as const).map((u) => (
          <button key={u} type="button" disabled={locked} className={chip(step.unit === u)} onClick={() => onChange({ unit: u })}>
            {u}
          </button>
        ))}
      </div>
    );
  if (step.kind === "check")
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="What it checks">
          {CHECK_TESTS.map((t) => (
            <button key={t} type="button" disabled={locked} className={chip(step.test === t)} onClick={() => onChange({ test: t })}>
              {CHECK_WORDS[t].title}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-muted">If not: {CHECK_WORDS[step.test].otherwise}</p>
      </div>
    );
  const label =
    step.kind === "email"
      ? "What should Sol's email say?"
      : step.kind === "text"
        ? "What should Sol's text say?"
        : `What should ${agentName} ring them about?`;
  return (
    <label className="block">
      <span className={ui.label}>{label}</span>
      <textarea
        rows={2}
        disabled={locked}
        maxLength={CUSTOM_LIMITS.about}
        value={step.about}
        onChange={(e) => onChange({ about: e.target.value })}
        placeholder={
          step.kind === "call"
            ? "Check they got the proposal and ask if they have questions"
            : "Check in about the battery and offer a quick call"
        }
        className={clsx(ui.input, "min-h-[3.5rem] resize-y")}
      />
      <span className="mt-1 block text-[11.5px] text-muted">{STEP_WORDS[step.kind].what}. Never a price or a promise.</span>
    </label>
  );
}

/** The line to the next card, with a plus that opens the kinds of step this agent can take. */
function AddHere({
  at,
  open,
  onOpen,
  allowed,
  locked,
  onAdd,
}: {
  at: number;
  open: boolean;
  onOpen: (at: number | null) => void;
  allowed: readonly CustomStepKind[];
  locked: boolean;
  onAdd: (kind: CustomStepKind) => void;
}) {
  return (
    <div className="flex w-full flex-col items-center">
      <Joint />
      {!locked && (
        <>
          <button
            type="button"
            onClick={() => onOpen(open ? null : at)}
            aria-expanded={open}
            aria-label="Add a step here"
            className="-my-1 grid size-6 place-items-center rounded-full bg-surface text-muted ring-1 ring-line transition hover:text-ink hover:ring-ink"
          >
            <Plus className={clsx("size-3.5 transition", open && "rotate-45")} aria-hidden />
          </button>
          {open && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 rounded-xl bg-surface p-2 shadow-[var(--shadow-soft)] ring-1 ring-line">
              {allowed.map((k) => (
                <button key={k} type="button" onClick={() => onAdd(k)} title={STEP_WORDS[k].what} className={chip(false)}>
                  {STEP_WORDS[k].label}
                </button>
              ))}
            </div>
          )}
          <Joint />
        </>
      )}
    </div>
  );
}
