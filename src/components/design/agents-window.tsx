"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { ArrowLeft, Check, ChevronRight, CircleAlert, MessagesSquare, Phone, Plus, X } from "lucide-react";
import {
  AGENT_COPY,
  AGENT_WORDS,
  NEED_SETTINGS,
  PURPOSE_WORDS,
  agentNeeds,
  agentStanding,
  kindsToAdd,
  needsNewNumber,
  numberPriceWords,
  type AgentKind,
  type AgentNeed,
} from "@/lib/domain/design/agents";
import { CALLER_VOICES, type CallerVoice } from "@/lib/domain/design/caller";
import { INSTRUCTIONS_MAX, instructionLines } from "@/lib/domain/design/coaching";
import type { CallerKey } from "@/lib/domain/install-call";
import {
  addAgent,
  askForNumber,
  closeAgents,
  loadAgents,
  openAgents,
  useAgentsOpen,
  type AgentLine,
  type AgentsState,
} from "@/lib/services/agents";
import { callerFor, useCallerInfo, type CallerInfo } from "@/lib/services/caller";
import { openCoach } from "@/lib/services/coaching";
import { openColleague } from "@/lib/services/colleague";
import { CallerAvatar } from "./settings-caller";

/**
 * A quiet plus under the assistants on the rail (13 Nov 2026, Martin: "we're going to need a function for the user to
 * add a new agent"): opens Your agents, where one is added. For a member who may change settings.
 */
export function AgentsButton() {
  const { mayChange, ready } = useCallerInfo();
  if (!ready || !mayChange) return null;
  return (
    <button
      type="button"
      onClick={openAgents}
      title={`${AGENT_COPY.title}: add one`}
      aria-label={`${AGENT_COPY.title}: add one`}
      className="grid size-8 place-items-center rounded-full border border-dashed border-muted text-muted transition-colors hover:border-sun-line hover:text-sun-line"
    >
      <Plus className="size-4" aria-hidden />
    </button>
  );
}

/**
 * Your agents (14 Nov 2026, Martin: "this should be better designed and should allow someone to add more sales agents";
 * and adding one should be its name, what it is for, sales or post sale, and a set of instructions, "then ready to use.
 * rather than being sent back to the settings page"). The business's agents as cards, the voice agents that ring
 * customers apart from the one that only answers the team, each opening its own chat; and **Add an agent**, one form:
 * what it is for, its name, its instructions (straight into its script, as written), its voice. Made, it opens.
 * Drawn on the page body, so it carries the studio's own look.
 */
export function AgentsWindow() {
  const isOpen = useAgentsOpen();
  const info = useCallerInfo();
  const [state, setState] = useState<AgentsState | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const reload = useCallback(() => {
    void loadAgents().then((r) => (r.ok ? (setState(r), setProblem(null)) : setProblem(r.message)));
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    reload();
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeAgents();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [isOpen, reload]);

  if (!isOpen || typeof document === "undefined") return null;
  const close = () => {
    setAdding(false);
    closeAgents();
  };
  const toAdd = state ? kindsToAdd(state.status) : [];
  const made = state?.agents.filter((a) => a.made) ?? [];
  const voices = made.filter((a) => a.kind !== "colleague");
  const team = made.filter((a) => a.kind === "colleague");

  /** Every agent opens its own chat: a voice agent's by its key, the chief of staff's own window. */
  const openAgent = (kind: AgentKind, key?: CallerKey) => {
    close();
    if (kind === "colleague") openColleague();
    else openCoach(null, key ?? (kind === "admin" ? "admin" : "sales"));
  };

  return createPortal(
    <div className="theme-studio contents">
      <section
        role="dialog"
        aria-label={AGENT_COPY.title}
        className="fixed bottom-20 right-4 z-[88] flex max-h-[min(46rem,calc(100dvh-7rem))] w-[min(27rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl bg-canvas shadow-lift ring-1 ring-line lg:bottom-6 lg:right-24 print:hidden"
      >
        <header className="flex items-start gap-2 bg-surface px-5 pb-4 pt-5">
          {adding && (
            <button
              type="button"
              onClick={() => setAdding(false)}
              aria-label="Back to your agents"
              className="-ml-2 grid size-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[19px] font-semibold leading-tight tracking-tight text-ink">{adding ? AGENT_COPY.add : AGENT_COPY.title}</p>
            <p className="mt-0.5 text-[13px] text-muted">{AGENT_COPY.sub}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-1.5 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
          {!state ? (
            <p className="px-5 py-8 text-center text-sm text-muted">{problem ?? "Just a moment…"}</p>
          ) : adding ? (
            <AddForm kinds={toAdd} state={state} onMade={openAgent} />
          ) : (
            <div className="space-y-5 p-4">
              {made.length === 0 && <p className="px-1 pt-1 text-sm text-ink-2">{AGENT_COPY.none}</p>}
              {voices.length > 0 && (
                <Group head={AGENT_COPY.voiceHead} sub={AGENT_COPY.voiceSub}>
                  {voices.map((a) => (
                    <AgentCard key={a.key ?? a.kind} agent={a} state={state} info={info} onOpen={() => openAgent(a.kind, a.key)} />
                  ))}
                </Group>
              )}
              {team.length > 0 && (
                <Group head={AGENT_COPY.teamHead} sub={AGENT_COPY.teamSub}>
                  {team.map((a) => (
                    <AgentCard key={a.kind} agent={a} state={state} info={info} onOpen={() => openAgent(a.kind)} />
                  ))}
                </Group>
              )}
              {state.mayChange ? (
                toAdd.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-dashed border-muted/60 p-3 text-left transition-colors hover:border-sun-line hover:bg-surface"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-ink-2 ring-1 ring-line transition-colors group-hover:bg-sun-line group-hover:text-white group-hover:ring-sun-line">
                      <Plus className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold text-ink">{AGENT_COPY.add}</span>
                      <span className="block text-xs text-muted">Its name, what it&apos;s for and its instructions</span>
                    </span>
                  </button>
                ) : (
                  <p className="px-1 text-xs text-muted">{AGENT_COPY.allMade}</p>
                )
              ) : (
                <p className="px-1 text-xs text-muted">{AGENT_COPY.onlyAdmin}</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function Group({ head, sub, children }: { head: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-baseline gap-2 px-1 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-2">{head}</span>
        <span className="text-xs text-muted">{sub}</span>
      </p>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

/** One agent: its face, its name, what it is for and where it stands; the whole card opens its chat. */
function AgentCard({ agent, state, info, onOpen }: { agent: AgentLine; state: AgentsState; info: CallerInfo; onOpen: () => void }) {
  const w = AGENT_WORDS[agent.kind];
  const standing = agentStanding(agent.kind, state.status);
  const short = needsNewNumber(agent.kind, state.status);
  return (
    <li className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_2px_rgba(20,22,26,0.06)] ring-1 ring-line">
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-2"
      >
        {agent.kind === "colleague" ? (
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--colleague,var(--primary))] text-white">
            <MessagesSquare className="size-5" aria-hidden />
          </span>
        ) : (
          <CallerAvatar caller={callerFor(info, agent.key)} size={44} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-ink">{agent.name || w.title}</span>
            <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2 ring-1 ring-line">
              {PURPOSE_WORDS[agent.kind].label}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <span className={clsx("size-1.5 shrink-0 rounded-full", standing.ready ? "bg-positive" : "bg-warning")} aria-hidden />
            <span className="truncate">{standing.words}</span>
          </span>
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
          aria-hidden
        />
      </button>
      {short && state.mayChange && (
        <div className="border-t border-line px-3 py-2">
          <NumberAsk kind={agent.kind} state={state} />
        </div>
      )}
    </li>
  );
}

/** What an agent needs, each ready or missing; for RENUABL's staff, the settings behind a missing one. */
function Needs({ needs, staff }: { needs: AgentNeed[]; staff: boolean }) {
  return (
    <ul className="space-y-1.5">
      {needs.map((n) => (
        <li key={n.key} className="flex items-start gap-2 text-xs">
          {n.state === "ready" ? (
            <Check className="mt-0.5 size-3.5 shrink-0 text-positive" aria-hidden />
          ) : (
            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
          )}
          <span className="min-w-0">
            <span className="font-semibold text-ink">{n.label}</span>
            <span className="block text-muted">{n.words}</span>
            {staff && n.state === "missing" && (
              <span className="mt-0.5 block font-mono text-[11px] text-ink-2">Staff: {NEED_SETTINGS[n.key]}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Asking RENUABL for the number an agent is short of. */
function NumberAsk({ kind, state }: { kind: AgentKind; state: AgentsState }) {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null);
  const send = async () => {
    setBusy(true);
    const r = await askForNumber(kind);
    setBusy(false);
    setSaid({ ok: r.ok, words: r.message });
  };
  if (said?.ok) return <p className="text-xs text-positive">{said.words}</p>;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={() => void send()}
        disabled={busy}
        className="text-xs font-semibold text-ink underline disabled:text-muted"
      >
        {busy ? "Asking…" : AGENT_COPY.ask}
      </button>
      {said && <span className="text-xs text-danger">{said.words}</span>}
      {state.staff && (
        <span className="font-mono text-[11px] text-ink-2">
          Staff:{" "}
          {agentNeeds(kind, state.status)
            .filter((n) => n.needsNumber)
            .map((n) => NEED_SETTINGS[n.key])
            .join("; ")}
        </span>
      )}
    </div>
  );
}

const EXAMPLES: Record<AgentKind, string> = {
  sales:
    "Say you're calling from our Rowville office.\nIf they ask about batteries, mention we install them ourselves.\nKeep calls under five minutes.",
  admin: "Ask if there's a dog or a locked gate on the day.\nRemind them the crew arrives between 7 and 9 in the morning.",
  colleague: "",
};

/**
 * Adding an agent, one form: what it is for (sales, post sale, or the team), its name, its instructions, its voice.
 * Made, it opens: nobody is sent to Settings.
 */
function AddForm({ kinds, state, onMade }: { kinds: AgentKind[]; state: AgentsState; onMade: (kind: AgentKind, key?: CallerKey) => void }) {
  const [kind, setKind] = useState<AgentKind>(kinds[0] ?? "sales");
  const w = AGENT_WORDS[kind];
  const number = needsNewNumber(kind, state.status);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [voice, setVoice] = useState("");
  const [askToo, setAskToo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const lines = instructionLines(instructions).length;
  const FIELD =
    "mt-1.5 block w-full rounded-xl bg-surface px-3 py-2.5 text-sm font-normal text-ink ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-sun-line";

  const make = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setFailed(null);
    const [provider, voiceId] = voice.split(":");
    const picked: CallerVoice | null = voice && w.usesNumber ? { provider: provider as CallerVoice["provider"], voiceId } : null;
    // A new sales agent takes the next key free; the first one, and the post-sale agent, their own.
    const key: CallerKey | undefined = kind === "sales" ? (state.nextSales ?? "sales") : kind === "admin" ? "admin" : undefined;
    const made = await addAgent(kind, name.trim(), picked, { key, instructions: w.usesNumber ? instructions : "" });
    if (!made.ok) {
      setBusy(false);
      return setFailed(made.message);
    }
    if (number && askToo) await askForNumber(kind);
    setBusy(false);
    onMade(kind, key);
  };

  return (
    <form
      className="space-y-5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void make();
      }}
    >
      <fieldset>
        <legend className="px-1 text-sm font-semibold text-ink">{AGENT_COPY.purpose}</legend>
        <div className="mt-1.5 space-y-1.5">
          {kinds.map((k) => (
            <label
              key={k}
              className={clsx(
                "flex cursor-pointer items-start gap-3 rounded-xl bg-surface p-3 ring-1 transition-colors",
                kind === k ? "ring-2 ring-sun-line" : "ring-line hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="purpose"
                checked={kind === k}
                onChange={() => setKind(k)}
                className="mt-0.5 size-4 accent-[var(--sun-line)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{PURPOSE_WORDS[k].label}</span>
                <span className="block text-xs text-muted">{PURPOSE_WORDS[k].line}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block px-1 text-sm font-semibold text-ink">
        {AGENT_COPY.nameIt}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus
          placeholder={kind === "colleague" ? "Tim" : kind === "admin" ? "Alex" : "Charlie"}
          className={FIELD}
        />
        <span className="mt-1 block text-xs font-normal text-muted">{AGENT_COPY.nameHint}</span>
      </label>

      {w.usesNumber && (
        <label className="block px-1 text-sm font-semibold text-ink">
          <span className="flex items-baseline justify-between gap-2">
            {AGENT_COPY.instructions}
            {lines > 0 && <span className="text-xs font-normal text-muted">{lines === 1 ? "1 instruction" : `${lines} instructions`}</span>}
          </span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={INSTRUCTIONS_MAX}
            rows={5}
            placeholder={EXAMPLES[kind]}
            className={clsx(FIELD, "resize-y leading-relaxed")}
          />
          <span className="mt-1 block text-xs font-normal text-muted">{AGENT_COPY.instructionsHint}</span>
          <span className="mt-1 block text-xs font-normal text-muted">{AGENT_COPY.instructionsNote}</span>
        </label>
      )}

      {w.usesNumber && (
        <label className="block px-1 text-sm font-semibold text-ink">
          Its voice
          <select value={voice} onChange={(e) => setVoice(e.target.value)} className={FIELD}>
            <option value="">Choose later</option>
            {CALLER_VOICES.map((v) => (
              <option key={`${v.provider}:${v.voiceId}`} value={`${v.provider}:${v.voiceId}`}>
                {v.label} · {v.words}
              </option>
            ))}
          </select>
        </label>
      )}

      {number ? (
        <div className="rounded-xl bg-sun p-3 ring-1 ring-sun-line/30">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Phone className="size-4 text-sun-line" aria-hidden />
            {AGENT_COPY.numberHead}
          </p>
          <p className="mt-1 text-xs text-ink-2">{AGENT_COPY.numberWhy}</p>
          <p className="mt-1 text-xs font-medium text-ink">{numberPriceWords()}</p>
          <label className="mt-2 flex items-center gap-2 text-xs font-medium text-ink">
            <input
              type="checkbox"
              checked={askToo}
              onChange={(e) => setAskToo(e.target.checked)}
              className="size-4 accent-[var(--sun-line)]"
            />
            {AGENT_COPY.ask} when I add it
          </label>
        </div>
      ) : (
        <div className="px-1">
          <Needs needs={agentNeeds(kind, state.status)} staff={state.staff} />
        </div>
      )}

      {failed && <p className="px-1 text-xs text-danger">{failed}</p>}
      <button
        type="submit"
        disabled={!name.trim() || busy}
        className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white disabled:bg-line disabled:text-muted"
      >
        {busy ? "Adding…" : name.trim() ? `Add ${name.trim()}` : AGENT_COPY.create(w.title)}
      </button>
    </form>
  );
}
