"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Check, CircleAlert, Headset, Phone, Plus, X } from "lucide-react";
import {
  AGENT_COPY,
  AGENT_WORDS,
  NEED_SETTINGS,
  agentNeeds,
  agentStanding,
  kindsToAdd,
  needsNewNumber,
  type AgentKind,
  type AgentNeed,
} from "@/lib/domain/design/agents";
import { CALLER_VOICES, type CallerVoice } from "@/lib/domain/design/caller";
import { addAgent, askForNumber, closeAgents, loadAgents, openAgents, useAgentsOpen, type AgentsState } from "@/lib/services/agents";
import { useCallerInfo } from "@/lib/services/caller";
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

type Step = { at: "list" } | { at: "pick" } | { at: "form"; kind: AgentKind };

/**
 * Your agents (13 Nov 2026, Martin: creating an agent should say when it needs a new number): the agents the business
 * has, each with where it stands, and **Add an agent**: what it should do, its name and voice, and before it is made,
 * what it needs to work, a phone number of its own first. A number is RENUABL's to set up for now, so it is asked for.
 */
export function AgentsWindow() {
  const isOpen = useAgentsOpen();
  const { caller, admin } = useCallerInfo();
  const [state, setState] = useState<AgentsState | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ at: "list" });
  const [note, setNote] = useState<string | null>(null);

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
    setStep({ at: "list" });
    setNote(null);
    closeAgents();
  };
  const toAdd = state ? kindsToAdd(state.status) : [];
  const made = state?.agents.filter((a) => a.made) ?? [];

  const openAgent = (kind: AgentKind) => {
    close();
    if (kind === "sales") openCoach(null);
    else if (kind === "colleague") openColleague();
  };

  return createPortal(
    <section
      role="dialog"
      aria-label={AGENT_COPY.title}
      className="fixed bottom-20 right-4 z-[88] flex max-h-[min(42rem,calc(100dvh-7rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-surface shadow-lift ring-1 ring-line lg:bottom-6 lg:right-20 print:hidden"
    >
      <header className="flex items-center gap-2 bg-primary px-4 py-3 text-white">
        {step.at !== "list" && (
          <button
            type="button"
            onClick={() => setStep(step.at === "form" && toAdd.length > 1 ? { at: "pick" } : { at: "list" })}
            aria-label="Back"
            className="-ml-1 grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
        )}
        <p className="min-w-0 flex-1 truncate font-semibold">
          {step.at === "list"
            ? AGENT_COPY.title
            : step.at === "pick"
              ? AGENT_COPY.add
              : `New ${AGENT_WORDS[step.kind].title.toLowerCase()}`}
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!state ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{problem ?? "Just a moment…"}</p>
        ) : step.at === "list" ? (
          <div className="p-3">
            {note && <p className="mb-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink">{note}</p>}
            {made.length === 0 && <p className="px-1 py-3 text-sm text-muted">{AGENT_COPY.none}</p>}
            <ul className="space-y-1.5">
              {made.map((a) => {
                const w = AGENT_WORDS[a.kind];
                const standing = agentStanding(a.kind, state.status);
                const short = needsNewNumber(a.kind, state.status);
                return (
                  <li key={a.kind} className="rounded-xl ring-1 ring-line">
                    <div className="flex items-center gap-3 p-3">
                      <AgentFace kind={a.kind} sales={caller} admin={admin} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{a.name || w.title}</p>
                        <p className="truncate text-xs text-muted">
                          {w.title} · {w.talksTo.toLowerCase()}
                        </p>
                        <p className={clsx("mt-0.5 text-xs", standing.ready ? "text-positive" : "text-warning")}>{standing.words}</p>
                      </div>
                      {a.kind === "admin" ? (
                        <Link
                          href="/design/settings/calls?assistant=admin"
                          onClick={close}
                          className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-line hover:bg-line/40"
                        >
                          Settings
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openAgent(a.kind)}
                          className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-line hover:bg-line/40"
                        >
                          Open
                        </button>
                      )}
                    </div>
                    {short && state.mayChange && (
                      <div className="border-t border-line px-3 py-2">
                        <NumberAsk kind={a.kind} state={state} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {state.mayChange ? (
              toAdd.length > 0 ? (
                <button
                  type="button"
                  onClick={() => (setNote(null), setStep(toAdd.length === 1 ? { at: "form", kind: toAdd[0] } : { at: "pick" }))}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-white"
                >
                  <Plus className="size-4" aria-hidden />
                  {AGENT_COPY.add}
                </button>
              ) : (
                <p className="mt-3 px-1 text-xs text-muted">{AGENT_COPY.allMade}</p>
              )
            ) : (
              <p className="mt-3 px-1 text-xs text-muted">{AGENT_COPY.onlyAdmin}</p>
            )}
          </div>
        ) : step.at === "pick" ? (
          <div className="p-3">
            <p className="px-1 pb-2 text-sm font-semibold text-ink">{AGENT_COPY.pickKind}</p>
            <ul className="space-y-1.5">
              {toAdd.map((k) => {
                const w = AGENT_WORDS[k];
                const number = needsNewNumber(k, state.status);
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => setStep({ at: "form", kind: k })}
                      className="w-full rounded-xl p-3 text-left ring-1 ring-line transition-colors hover:bg-surface-2"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-ink">{w.title}</span>
                        <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-muted">{w.talksTo}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-2">{w.does}</span>
                      <span className={clsx("mt-1.5 flex items-start gap-1.5 text-xs", number ? "text-warning" : "text-muted")}>
                        <Phone className="mt-0.5 size-3 shrink-0" aria-hidden />
                        {number ? "Needs a new phone number. " : ""}
                        {w.number}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <AddForm
            kind={step.kind}
            state={state}
            onMade={(message) => {
              setNote(message);
              setStep({ at: "list" });
              reload();
            }}
          />
        )}
      </div>
    </section>,
    document.body,
  );
}

function AgentFace({
  kind,
  sales,
  admin,
}: {
  kind: AgentKind;
  sales: Parameters<typeof CallerAvatar>[0]["caller"];
  admin: Parameters<typeof CallerAvatar>[0]["caller"];
}) {
  if (kind === "colleague")
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white">
        <Headset className="size-[18px]" aria-hidden />
      </span>
    );
  return <CallerAvatar caller={kind === "admin" ? admin : sales} size={40} />;
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

function AddForm({ kind, state, onMade }: { kind: AgentKind; state: AgentsState; onMade: (message: string) => void }) {
  const w = AGENT_WORDS[kind];
  const needs = agentNeeds(kind, state.status);
  const number = needsNewNumber(kind, state.status);
  const [name, setName] = useState("");
  const [voice, setVoice] = useState("");
  const [askToo, setAskToo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const make = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setFailed(null);
    const [provider, voiceId] = voice.split(":");
    const picked: CallerVoice | null = voice ? { provider: provider as CallerVoice["provider"], voiceId } : null;
    const made = await addAgent(kind, name.trim(), picked);
    if (!made.ok) {
      setBusy(false);
      return setFailed(made.message);
    }
    let message = `${name.trim()} is added.`;
    if (number && askToo) {
      const asked = await askForNumber(kind);
      message += ` ${asked.ok ? AGENT_COPY.asked : `The number wasn't asked for: ${asked.message}`}`;
    } else if (number) message += " It still needs its phone number: ask for one here when you're ready.";
    setBusy(false);
    onMade(message);
  };

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void make();
      }}
    >
      <p className="text-sm text-ink-2">{w.does}</p>

      {number && (
        <div className="rounded-xl bg-sun p-3 ring-1 ring-sun-line/30">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Phone className="size-4 text-sun-line" aria-hidden />
            {AGENT_COPY.numberHead}
          </p>
          <p className="mt-1 text-xs text-ink-2">{w.number}</p>
          <p className="mt-1 text-xs text-ink-2">{AGENT_COPY.numberWhy}</p>
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
      )}

      <label className="block text-sm font-semibold text-ink">
        {AGENT_COPY.nameIt}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus
          placeholder={kind === "colleague" ? "Tim" : kind === "admin" ? "Alex" : "Charlie"}
          className="mt-1 block w-full rounded-lg bg-surface-2 px-3 py-2 text-sm font-normal text-ink ring-1 ring-line outline-none placeholder:text-muted focus:ring-sun-line"
        />
        <span className="mt-1 block text-xs font-normal text-muted">{AGENT_COPY.nameHint}</span>
      </label>

      <label className="block text-sm font-semibold text-ink">
        Its voice
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          className="mt-1 block w-full rounded-lg bg-surface-2 px-3 py-2 text-sm font-normal text-ink ring-1 ring-line"
        >
          <option value="">Choose later</option>
          {CALLER_VOICES.map((v) => (
            <option key={`${v.provider}:${v.voiceId}`} value={`${v.provider}:${v.voiceId}`}>
              {v.label} · {v.words}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink">{AGENT_COPY.needsHead}</p>
        <Needs needs={needs} staff={state.staff} />
      </div>

      {failed && <p className="text-xs text-danger">{failed}</p>}
      <button
        type="submit"
        disabled={!name.trim() || busy}
        className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-white disabled:bg-line disabled:text-muted"
      >
        {busy ? "Adding…" : AGENT_COPY.create(w.title)}
      </button>
    </form>
  );
}
