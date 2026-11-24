"use client";

import { clsx } from "clsx";
import {
  ChevronDown,
  CornerDownRight,
  Flag,
  GitBranch,
  Hourglass,
  Lock,
  Pencil,
  Play,
  Plus,
  Repeat,
  UserRound,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { CallSetup } from "@/lib/domain/design/call-setup";
import {
  runningCount,
  type Routine,
  type RoutineNode,
  type RoutineSetting,
  type RoutineStep,
  type StepKind,
  type StepLive,
} from "@/lib/domain/design/routines";
import { ROUTINE_CHOICES, SEND_HOURS, type AgentSettings, type SendHours } from "@/lib/domain/design/sol-agents";
import type { CallerKey } from "@/lib/domain/install-call";
import { callerFor, useCallerInfo } from "@/lib/services/caller";
import { loadRoutines, saveRoutineSettings, saveVoiceSetup, chooseVoiceScript, type RoutinesView } from "@/lib/services/routines";
import { PageHead, ui } from "./design-shell";
import { RoutineBuilder } from "./routines-builder";
import { CallerAvatar } from "./settings-caller";
import { SolBadge } from "./sol-sun";

/**
 * Routines (20 Nov 2026, Martin: "the routines page itself, shows all agents Voice and Text (sol) and what they have
 * programmed into them… a really basic zapier / shopify flow type view… adjusting here should adjust actions").
 * Down the left, every agent's routine; beside it the one picked as a flow on a dotted canvas: what starts it, what it
 * checks, waits and does, what repeats, and where it hands over. A step that can be changed has a pencil and changes
 * the routine itself; one that can't says why.
 */
export function RoutinesPage() {
  const [view, setView] = useState<RoutinesView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const read = useCallback(async () => {
    const res = await loadRoutines();
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    setView(res);
  }, []);
  useEffect(() => {
    let gone = false;
    void loadRoutines().then((res) => {
      if (gone) return;
      if (res.ok) setView(res);
      else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, []);

  if (problem && !view)
    return (
      <div className={ui.page}>
        <PageHead title="Routines" />
        <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      </div>
    );
  if (!view)
    return (
      <div className={ui.page}>
        <PageHead title="Routines" />
        <p className="mt-6 text-sm text-muted">Reading your agents&apos; routines…</p>
      </div>
    );

  const routines = view.routines;
  const chosen = routines.find((r) => r.id === picked) ?? routines[0];
  const own = chosen.custom ? (view.own.find((r) => r.id === chosen.custom) ?? null) : null;
  const mayBuild = view.may.settings && !view.readOnly;
  const running = runningCount(routines);

  return (
    <div className="mx-auto w-full max-w-[90rem]">
      <PageHead title="Routines">
        <p className="text-sm text-muted">
          {running === 1 ? "1 routine running" : `${running} routines running`} · what each agent does by itself, step by step
        </p>
      </PageHead>
      {problem && (
        <p className="mt-3 rounded-md bg-warning-soft px-4 py-2 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      <div className="routines-cols mt-5 grid gap-5">
        <RoutineList
          routines={routines}
          chosen={picked === NEW ? NEW : chosen.id}
          onPick={setPicked}
          onNew={mayBuild ? () => setPicked(NEW) : undefined}
        />
        {picked === NEW ? (
          <RoutineBuilder
            key={NEW}
            routine={null}
            view={view}
            onSaved={async (id) => {
              await read();
              setPicked(`custom-${id}`);
            }}
            onGone={read}
            onCancelNew={() => setPicked(null)}
          />
        ) : own ? (
          <RoutineBuilder
            key={own.id + own.updatedAt}
            routine={own}
            view={view}
            onSaved={read}
            onGone={async () => {
              setPicked(null);
              await read();
            }}
            onCancelNew={() => setPicked(null)}
          />
        ) : (
          <FlowCanvas key={chosen.id} routine={chosen} view={view} onProblem={setProblem} onChanged={read} />
        )}
      </div>
    </div>
  );
}

/** The list's id for a routine being built and not yet kept. */
const NEW = "new";

/** The agent's face: its own picture or sound wave for a voice agent, Sol's sun for Sol's. */
function Face({ routine, size = 36 }: { routine: Routine; size?: number }) {
  const info = useCallerInfo();
  if (routine.medium === "voice" && routine.agentKey)
    return <CallerAvatar caller={callerFor(info, routine.agentKey as CallerKey)} size={size} />;
  return (
    <span className="grid place-items-center rounded-full bg-[#2f3237]" style={{ width: size, height: size }}>
      <SolBadge className="size-[60%]" />
    </span>
  );
}

function Standing({ routine }: { routine: Routine }) {
  if (routine.soon) return <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">Coming soon</span>;
  if (routine.on === true)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-positive-soft px-2 py-0.5 text-[11px] font-medium text-positive">
        <span className="size-1.5 rounded-full bg-positive" aria-hidden /> Running
      </span>
    );
  if (routine.on === false)
    return (
      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
        {routine.custom ? "Off" : "Drafts only"}
      </span>
    );
  return <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">Not running</span>;
}

function RoutineList({
  routines,
  chosen,
  onPick,
  onNew,
}: {
  routines: Routine[];
  chosen: string;
  onPick: (id: string) => void;
  onNew?: () => void;
}) {
  const groups: { title: string; list: Routine[] }[] = [
    { title: "Your routines", list: routines.filter((r) => r.custom) },
    { title: "Sol · writes", list: routines.filter((r) => r.medium === "text" && !r.soon && !r.custom) },
    { title: "Voice agents · ring", list: routines.filter((r) => r.medium === "voice" && !r.custom) },
    { title: "Coming soon", list: routines.filter((r) => r.soon) },
  ];
  return (
    <nav aria-label="Your agents' routines" className="space-y-4">
      {onNew && (
        <button
          type="button"
          onClick={onNew}
          aria-current={chosen === NEW ? "true" : undefined}
          className={clsx(
            "flex w-full items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 text-left text-sm font-semibold transition",
            chosen === NEW ? "border-ink bg-surface text-ink" : "border-line text-ink-2 hover:border-ink/40 hover:text-ink",
          )}
        >
          <span className="grid size-9 place-items-center rounded-full bg-sun-line text-white" aria-hidden>
            <Plus className="size-4" />
          </span>
          New routine
        </button>
      )}
      {groups
        .filter((g) => g.list.length)
        .map((g) => (
          <div key={g.title}>
            <p className={clsx(ui.eyebrow, "mb-2 px-1")}>{g.title}</p>
            <ul className="space-y-1.5">
              {g.list.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onPick(r.id)}
                    aria-current={r.id === chosen ? "true" : undefined}
                    className={clsx(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                      r.id === chosen ? "bg-surface shadow-[var(--shadow-soft)] ring-1 ring-ink" : "hover:bg-surface/70",
                      r.soon && "opacity-60",
                    )}
                  >
                    <Face routine={r} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{r.agent}</span>
                      <span className="block truncate text-[12px] text-ink-2">{r.title}</span>
                    </span>
                    <Standing routine={r} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      {!routines.some((r) => r.medium === "voice") && (
        <p className="px-1 text-[12px] leading-snug text-muted">
          No voice agents yet. Add one from the plus on the bar, and its calls show here.
        </p>
      )}
    </nav>
  );
}

export const KIND: Record<StepKind, { label: string; Icon: typeof Zap; tone: string }> = {
  trigger: { label: "When", Icon: Zap, tone: "bg-sun-line text-white" },
  check: { label: "Checks", Icon: GitBranch, tone: "bg-[#5b5bd6] text-white" },
  wait: { label: "Waits", Icon: Hourglass, tone: "bg-[#8e8e93] text-white" },
  action: { label: "Does", Icon: Play, tone: "bg-ink text-canvas" },
  handoff: { label: "Hands over", Icon: UserRound, tone: "bg-positive text-white" },
  end: { label: "Ends", Icon: Flag, tone: "bg-[#3a3d43] text-white" },
};

/** The routine as a flow: one column of steps joined by a line, on a dotted canvas. */
function FlowCanvas({
  routine,
  view,
  onProblem,
  onChanged,
}: {
  routine: Routine;
  view: RoutinesView;
  onProblem: (m: string | null) => void;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = view.readOnly;

  const saveSettings = async (next: AgentSettings) => {
    setBusy(true);
    const res = await saveRoutineSettings(next);
    setBusy(false);
    if (!res.ok) return onProblem(res.message);
    onProblem(null);
    await onChanged();
  };
  const run = async (p: Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    const res = await p;
    setBusy(false);
    if (!res.ok) return onProblem(res.message ?? "That couldn't be changed. Try again.");
    onProblem(null);
    await onChanged();
  };
  const editor = (setting: RoutineSetting) => (
    <SettingEditor setting={setting} view={view} busy={busy} onSettings={saveSettings} onRun={run} />
  );
  const mayEdit = (s?: RoutineSetting) => {
    if (!s || locked) return false;
    if (s.key === "on") return view.may.onOff;
    if (s.key === "audience" || s.key === "script") return view.may.voice;
    return view.may.settings;
  };

  return (
    <section aria-label={`${routine.agent}'s routine`} className="relative overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      {/* Its header: who, what it does, and its switch. */}
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <Face routine={routine} size={44} />
        <div className="min-w-[12rem] flex-1">
          <p className="text-[15px] font-semibold text-ink">
            {routine.agent} <span className="font-normal text-muted">· {routine.title}</span>
          </p>
          <p className="text-[13px] leading-snug text-ink-2">{routine.what}</p>
        </div>
        {routine.onSetting && routine.onSetting.key === "on" && (
          <OnSwitch
            on={routine.on === true}
            disabled={!mayEdit(routine.onSetting) || busy}
            why={view.may.onOff ? undefined : "Only the business's owner can switch Sol on or off."}
            onFlip={() => {
              const stage = (routine.onSetting as { stage: AgentSettings["on"][number] }).stage;
              const on = view.settings.on.includes(stage) ? view.settings.on.filter((s) => s !== stage) : [...view.settings.on, stage];
              void saveSettings({ ...view.settings, on });
            }}
          />
        )}
        {routine.medium === "voice" && <Standing routine={routine} />}
      </header>
      {routine.standing && <p className="border-b border-line bg-warning-soft px-5 py-2 text-[13px] text-warning">{routine.standing}</p>}

      <div
        className="min-h-[28rem] px-4 py-8 sm:px-8"
        style={{ backgroundImage: "radial-gradient(var(--line) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      >
        {routine.soon ? (
          <div className="mx-auto max-w-md rounded-xl bg-surface p-5 text-center shadow-[var(--shadow-soft)] ring-1 ring-line">
            <Workflow className="mx-auto size-6 text-muted" aria-hidden />
            <p className="mt-2 text-sm font-semibold text-ink">Not built yet</p>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">{routine.soon}</p>
          </div>
        ) : (
          <LiveSteps.Provider value={view.live ?? {}}>
            <ol className="mx-auto flex max-w-[34rem] flex-col items-center" aria-label="Its steps, in order">
              {routine.nodes.map((n, i) => (
                <li key={n.id} className="flex w-full flex-col items-center">
                  {i > 0 && <Joint />}
                  {n.kind === "loop" ? (
                    <LoopBox node={n} open={open} onOpen={setOpen} mayEdit={mayEdit} editor={editor} />
                  ) : (
                    <StepCard
                      step={n}
                      open={open === n.id}
                      onOpen={(o) => setOpen(o ? n.id : null)}
                      mayEdit={mayEdit(n.setting)}
                      editor={editor}
                    />
                  )}
                </li>
              ))}
            </ol>
          </LiveSteps.Provider>
        )}
      </div>
      <footer className="border-t border-line px-5 py-3 text-[12px] leading-snug text-muted">
        A change here is the routine itself: the agent works this way from its next step.{" "}
        {routine.medium === "voice" && routine.agentKey && (
          <>
            What it says on a call is its script:{" "}
            <Link className={ui.link} href="/design">
              open its chat from the bar
            </Link>{" "}
            to change the words.
          </>
        )}
      </footer>
    </section>
  );
}

/** What each step is doing now (routineLive), by its id. */
export const LiveSteps = createContext<Record<string, StepLive>>({});

const LIVE_TONE: Record<StepLive["tone"], { pill: string; dot: string }> = {
  now: { pill: "bg-sun-line/12 text-ink ring-sun-line/40", dot: "bg-sun-line animate-pulse motion-reduce:animate-none" },
  press: { pill: "bg-warning-soft text-warning ring-warning/30", dot: "bg-warning" },
  done: { pill: "bg-surface-2 text-ink-2 ring-line", dot: "bg-positive" },
};

/**
 * A step's live line (20 Nov 2026, Martin: "build the live counts on each step"): what it is doing now, waiting on a
 * person, or has done lately; pressed, the deals behind the count, each opening its deal.
 */
export function LiveLine({ id }: { id: string }) {
  const live = useContext(LiveSteps)[id];
  const [open, setOpen] = useState(false);
  if (!live) return null;
  const t = LIVE_TONE[live.tone];
  return (
    <div className="px-4 pb-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={clsx("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1", t.pill)}
      >
        <span className={clsx("size-1.5 rounded-full", t.dot)} aria-hidden />
        {live.words}
        <ChevronDown className={clsx("size-3 opacity-60 transition", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg ring-1 ring-line">
          {live.deals.map((d) => (
            <li key={d.jobId}>
              <Link
                href={`/design/deals/${d.jobId}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px] hover:bg-canvas"
              >
                <span className="truncate font-medium text-ink">{d.customer}</span>
                <span className="shrink-0 text-muted">{d.note ?? "Open deal"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The line between two steps, with a small arrow. */
export function Joint() {
  return (
    <span className="flex h-8 flex-col items-center" aria-hidden>
      <span className="w-px flex-1 bg-ink/25" />
      <span className="-mt-px size-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-ink/35" />
    </span>
  );
}

function StepCard({
  step,
  open,
  onOpen,
  mayEdit,
  editor,
  inLoop,
}: {
  step: RoutineStep;
  open: boolean;
  onOpen: (open: boolean) => void;
  mayEdit: boolean;
  editor: (s: RoutineSetting) => React.ReactNode;
  inLoop?: boolean;
}) {
  const k = KIND[step.kind];
  const editable = Boolean(step.setting) && mayEdit;
  return (
    <div className={clsx("relative w-full", step.otherwise && "sm:pr-0")}>
      <div
        className={clsx(
          "relative w-full rounded-xl bg-surface shadow-[0_1px_2px_rgba(20,22,26,0.06),0_6px_18px_rgba(20,22,26,0.06)] ring-1 transition",
          open ? "ring-ink" : "ring-line",
          inLoop && "bg-surface",
        )}
      >
        <button
          type="button"
          disabled={!editable && !step.fixed}
          onClick={() => onOpen(!open)}
          aria-expanded={editable || step.fixed ? open : undefined}
          className="flex w-full items-start gap-3 px-4 py-3 text-left disabled:cursor-default"
        >
          <span className={clsx("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg", k.tone)} aria-hidden>
            <k.Icon className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{k.label}</span>
            <span className="block text-[14px] font-semibold leading-snug text-ink">{step.title}</span>
            {step.detail && <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{step.detail}</span>}
            {/* A check's other way: what happens when it doesn't hold, as a branch off the card. */}
            {step.otherwise && (
              <span className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted">
                <CornerDownRight className="size-3 shrink-0 text-[#5b5bd6]" aria-hidden />
                <span>
                  <span className="font-medium text-ink-2">If not:</span> {step.otherwise}
                </span>
              </span>
            )}
          </span>
          {editable ? (
            <Pencil className="mt-1 size-3.5 shrink-0 text-muted" aria-label="Change this step" />
          ) : step.fixed ? (
            <Lock className="mt-1 size-3.5 shrink-0 text-muted" aria-label="Can't be changed here" />
          ) : null}
        </button>
        <LiveLine id={step.id} />
        {open && (
          <div className="border-t border-line px-4 py-3">
            {step.fixed ? <p className="text-[12.5px] leading-snug text-ink-2">{step.fixed}</p> : step.setting && editor(step.setting)}
          </div>
        )}
      </div>
    </div>
  );
}

/** Steps that repeat, in a dashed box with what decides how often, and what follows once they're done. */
function LoopBox({
  node,
  open,
  onOpen,
  mayEdit,
  editor,
}: {
  node: Extract<RoutineNode, { kind: "loop" }>;
  open: string | null;
  onOpen: (id: string | null) => void;
  mayEdit: (s?: RoutineSetting) => boolean;
  editor: (s: RoutineSetting) => React.ReactNode;
}) {
  const editable = mayEdit(node.setting);
  const here = open === node.id;
  return (
    <div className="w-full rounded-2xl border-2 border-dashed border-sun-line/50 bg-sun/20 px-3 pb-3 pt-2 sm:px-5">
      <button
        type="button"
        disabled={!editable}
        onClick={() => onOpen(here ? null : node.id)}
        aria-expanded={editable ? here : undefined}
        className="mx-auto -mt-5 flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-[var(--shadow-soft)] ring-1 ring-sun-line/60 disabled:cursor-default"
      >
        <Repeat className="size-3.5 text-sun-line" aria-hidden />
        {node.title}
        {editable ? (
          <Pencil className="size-3 text-muted" aria-label="Change how often" />
        ) : node.fixed ? (
          <Lock className="size-3 text-muted" aria-label={node.fixed} />
        ) : null}
      </button>
      {node.detail && <p className="mt-1 text-center text-[12px] text-ink-2">{node.detail}</p>}
      <div className="flex justify-center [&>div]:px-0 [&>div]:pb-0 [&>div]:pt-2">
        <LiveLine id={node.id} />
      </div>
      {here && node.setting && (
        <div className="mx-auto mt-2 max-w-sm rounded-xl bg-surface p-3 ring-1 ring-line">{editor(node.setting)}</div>
      )}
      <ol className="mt-3 flex flex-col items-center">
        {node.steps.map((s, i) => (
          <li key={s.id} className="flex w-full flex-col items-center">
            {i > 0 && <Joint />}
            <StepCard
              step={s}
              open={open === s.id}
              onOpen={(o) => onOpen(o ? s.id : null)}
              mayEdit={mayEdit(s.setting)}
              editor={editor}
              inLoop
            />
          </li>
        ))}
      </ol>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] font-medium text-ink-2">
        <Repeat className="size-3 -scale-x-100 text-sun-line" aria-hidden /> Round again from the top · {node.after}
      </p>
    </div>
  );
}

export function OnSwitch({
  on,
  disabled,
  why,
  onFlip,
  words = ["Sends by itself", "Drafts for you"],
  hints,
}: {
  on: boolean;
  disabled: boolean;
  why?: string;
  onFlip: () => void;
  words?: [string, string];
  hints?: [string, string];
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onFlip}
      title={
        disabled ? why : (hints ?? ["Sends by itself. Switch off to approve each one", "Drafts only. Switch on to let it send"])[on ? 0 : 1]
      }
      className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2 disabled:opacity-60"
    >
      {on ? words[0] : words[1]}
      <span className={clsx("relative h-6 w-10 rounded-full transition", on ? "bg-positive" : "bg-line")}>
        <span
          className={clsx("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[1.125rem]" : "left-0.5")}
        />
      </span>
    </button>
  );
}

const CHIP = "rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1 transition disabled:opacity-50";
const chip = (on: boolean) => clsx(CHIP, on ? "bg-ink text-canvas ring-ink" : "bg-surface text-ink ring-line hover:ring-ink/40");
const minuteWords = (m: number) => (m < 60 ? `${m} min` : `${m / 60} h`);

/** The control for one setting, saving as it is chosen. */
function SettingEditor({
  setting,
  view,
  busy,
  onSettings,
  onRun,
}: {
  setting: RoutineSetting;
  view: RoutinesView;
  busy: boolean;
  onSettings: (s: AgentSettings) => Promise<void>;
  onRun: (p: Promise<{ ok: boolean; message?: string }>) => Promise<void>;
}) {
  const s = view.settings;
  const [day, setDay] = useState("");
  switch (setting.key) {
    case "hours":
      return (
        <div className="flex flex-wrap gap-2" role="group" aria-label="When it may send">
          {(Object.keys(SEND_HOURS) as SendHours[]).map((h) => (
            <button
              key={h}
              type="button"
              disabled={busy}
              className={chip(s.hours === h)}
              onClick={() => void onSettings({ ...s, hours: h })}
            >
              {SEND_HOURS[h].label} · {SEND_HOURS[h].words}
            </button>
          ))}
        </div>
      );
    case "reviewMinutes":
    case "helloMinutes": {
      const key = setting.key;
      return (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="How long it waits">
          <span className="text-[12.5px] text-ink-2">Wait</span>
          {ROUTINE_CHOICES[key].map((m) => (
            <button
              key={m}
              type="button"
              disabled={busy}
              className={chip(s[key] === m)}
              onClick={() => void onSettings({ ...s, [key]: m })}
            >
              {minuteWords(m)}
            </button>
          ))}
        </div>
      );
    }
    case "callAttempts":
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="How many calls">
            <span className="text-[12.5px] text-ink-2">Ring a new lead</span>
            {ROUTINE_CHOICES.callAttempts.map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy}
                className={chip(s.callAttempts === n)}
                onClick={() => void onSettings({ ...s, callAttempts: n })}
              >
                {n === 1 ? "Once" : `${n} times`}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-muted">Each try is in calling hours. After the last, the deal is over to your team.</p>
        </div>
      );
    case "followUpDays": {
      const { min, max, most } = ROUTINE_CHOICES.followUpDay;
      const add = () => {
        const n = Number(day);
        if (!Number.isInteger(n) || n < min || n > max) return;
        setDay("");
        void onSettings({ ...s, followUpDays: [...s.followUpDays, n] });
      };
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2" aria-label="Follow-up days">
            {s.followUpDays.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 rounded-full bg-ink py-1 pl-3 pr-1 text-[12.5px] font-medium text-canvas"
              >
                Day {d}
                {s.followUpDays.length > 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Take away day ${d}`}
                    onClick={() => void onSettings({ ...s, followUpDays: s.followUpDays.filter((x) => x !== d) })}
                    className="grid size-5 place-items-center rounded-full hover:bg-white/15"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                )}
              </span>
            ))}
            {s.followUpDays.length < most && (
              <form
                className="inline-flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  add();
                }}
              >
                <input
                  value={day}
                  onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  inputMode="numeric"
                  placeholder="Day"
                  aria-label={`Add a follow-up day, ${min} to ${max}`}
                  className="h-7 w-14 rounded-full border border-line bg-surface px-2.5 text-[12.5px] outline-none focus:border-ink"
                />
                <button
                  type="submit"
                  disabled={busy || !day}
                  className="grid size-7 place-items-center rounded-full ring-1 ring-line hover:ring-ink disabled:opacity-40"
                  aria-label="Add this day"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </form>
            )}
          </div>
          <p className="text-[12px] text-muted">
            Days after the proposal goes out, up to {most}. Proposals Sent and Sol&apos;s drafts both follow these.
          </p>
        </div>
      );
    }
    case "on":
      return <p className="text-[12.5px] text-ink-2">Use the switch at the top of this routine.</p>;
    case "audience":
    case "script": {
      const agent = view.voice.find((v) => v.key === setting.agent);
      if (!agent) return null;
      if (setting.key === "audience")
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Who it rings">
              {(
                [
                  ["enquired", "People who enquired"],
                  ["cold", "Cold calls"],
                ] as const
              ).map(([a, label]) => (
                <button
                  key={a}
                  type="button"
                  disabled={busy}
                  className={chip(agent.setup.audience === a)}
                  onClick={() => void onRun(saveVoiceSetup(agent.key, { ...agent.setup, audience: a } satisfies CallSetup))}
                >
                  {label}
                </button>
              ))}
            </div>
            {agent.setup.audience === "cold" && (
              <p className="text-[12px] leading-snug text-warning">
                Cold calls must respect the Do Not Call Register and calling hours, and say who is calling. Get advice before you start.
              </p>
            )}
          </div>
        );
      return (
        <div className="space-y-2">
          <label className={ui.label} htmlFor={`script-${agent.key}`}>
            Script it calls with
          </label>
          <select
            id={`script-${agent.key}`}
            disabled={busy}
            value=""
            onChange={(e) => e.target.value && void onRun(chooseVoiceScript(agent.key, e.target.value))}
            className={ui.input}
          >
            <option value="">{agent.scripts.find((x) => x.id === null)?.name ?? "Main script"} (in use)</option>
            {agent.scripts
              .filter((x) => x.id)
              .map((x) => (
                <option key={x.id} value={x.id!}>
                  {x.name}
                </option>
              ))}
          </select>
          <p className="text-[12px] text-muted">
            Its words are written in its chat (the cog beside it). Here you choose which one it uses.
          </p>
        </div>
      );
    }
  }
}
