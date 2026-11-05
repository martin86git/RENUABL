"use client";

/**
 * Sol's sales agents on the pipeline (domain/design/sol-agents.ts): a Sol round in each column's header, opening that
 * stage's card (what he has lined up and when each goes, what waits on a person, what he sent this week, and the
 * switches), and a chip on each deal card saying when his email goes. One outbox behind them all.
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import { Hand, Send, X } from "lucide-react";
import {
  AGENTS,
  SEND_HOURS,
  agentOn,
  chipWords,
  countdownWords,
  type AgentSettings,
  type AgentStage,
  type SendHours,
} from "@/lib/domain/design/sol-agents";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { actOnOutbox, editOutbox, loadOutbox, saveAgentSettings, type Outbox, type OutboxEntry } from "@/lib/services/sol-agents";
import { PATHS } from "./design-shell";
import { SolBadge } from "./sol-icon";

const POLL_MS = 60_000;

/** The outbox, asked for each minute, with a clock that ticks each half minute so countdowns stay true. */
export function useOutbox() {
  const [box, setBox] = useState<Outbox | null>(null);
  const [now, setNow] = useState(() => new Date());
  const reload = useCallback(async () => {
    const r = await loadOutbox();
    if (r.ok) setBox(r);
  }, []);
  useEffect(() => {
    void loadOutbox().then((r) => r.ok && setBox(r));
    const poll = setInterval(() => document.visibilityState === "visible" && void reload(), POLL_MS);
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [reload]);
  return { box, reload, now, setBox };
}

/** The first thing lined up for a deal, for its card. */
export function entryFor(box: Outbox | null, jobId: string): OutboxEntry | undefined {
  return box?.entries.find((e) => e.jobId === jobId);
}

/** The round in a column's header: Sol at work on that stage, with how many emails he has lined up. */
export function AgentRound({ stage, box, onOpen }: { stage: AgentStage; box: Outbox | null; onOpen: () => void }) {
  const agent = AGENTS[stage];
  const lined = box?.entries.filter((e) => e.stage === stage).length ?? 0;
  const waiting = box?.needsYou.filter((n) => n.stage === stage).length ?? 0;
  const on = box ? agentOn(box.settings, stage) : false;
  const label = `${agent.name}: ${agent.working ? `${on ? "on" : "off"}, ${lined} lined up` : "coming soon"}${waiting ? `, ${waiting} need you` : ""}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={label}
      aria-label={label}
      className={clsx(
        "relative inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary ring-1 ring-line transition hover:scale-105",
        !agent.working && "opacity-60",
      )}
    >
      <SolBadge className="size-4" />
      {on && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-positive ring-2 ring-surface" aria-hidden />}
      {waiting > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white tabular-nums">
          {waiting}
        </span>
      ) : lined > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-sun-line px-1 text-[10px] font-semibold leading-4 text-white tabular-nums">
          {lined}
        </span>
      ) : null}
    </button>
  );
}

/** The chip on a deal card: when Sol's email goes, or that the customer is waiting on a person. */
export function OutboxChip({ entry, needsYou, now }: { entry?: OutboxEntry; needsYou?: boolean; now: Date }) {
  if (needsYou)
    return (
      <span className="mt-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
        <Hand className="size-3" aria-hidden /> Needs you · they wrote
      </span>
    );
  if (!entry) return null;
  const soon = entry.state === "counting" && Date.parse(entry.firesAt) - now.getTime() < 30 * 60_000;
  return (
    <span
      className={clsx(
        "mt-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        soon ? "bg-sun-line text-white" : entry.state === "counting" ? "bg-sun text-sun-ink" : "bg-canvas text-ink-2 ring-1 ring-line",
      )}
    >
      <SolBadge className="size-3" />
      {entry.status === "preparing" ? "Sol is writing…" : chipWords(entry.state, entry.firesAt, now)}
    </span>
  );
}

/** One email lined up: who, when, the words to read, and what can be done. */
function Lined({ entry, now, onDone }: { entry: OutboxEntry; now: Date; onDone: (message?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(entry.subject);
  const [body, setBody] = useState(entry.body);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = async (work: () => Promise<{ ok: boolean; message?: string }>, done?: string) => {
    setBusy(true);
    setProblem(null);
    const r = await work();
    setBusy(false);
    if (!r.ok) setProblem(r.message ?? "That couldn't be done.");
    else onDone(done ?? r.message);
  };
  const when =
    entry.state === "counting"
      ? `Goes ${countdownWords(entry.firesAt, now)}`
      : entry.state === "waiting"
        ? "Waiting for you to send"
        : entry.state === "held"
          ? "Held: Sol won't send it"
          : "No email on file";
  return (
    <li className="rounded-2xl bg-canvas p-3 ring-1 ring-line">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-ink">{entry.customer}</span>
          <span className="block truncate text-[12px] text-ink-2">
            {entry.why} · {entry.subject}
          </span>
        </span>
        <span
          className={clsx(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
            entry.state === "counting" ? "bg-sun text-sun-ink" : "bg-surface text-ink-2 ring-1 ring-line",
          )}
        >
          {entry.status === "preparing" ? "Writing…" : when}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {editing ? (
            <>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                aria-label="Subject"
                className="w-full rounded-xl bg-surface px-3 py-2 text-[13px] text-ink ring-1 ring-line focus:outline-none focus:ring-sun-line"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                aria-label="Email"
                className="w-full rounded-xl bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink ring-1 ring-line focus:outline-none focus:ring-sun-line"
              />
            </>
          ) : (
            <div className="whitespace-pre-wrap rounded-xl bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink ring-1 ring-line">
              <p className="mb-2 font-medium">{entry.subject}</p>
              {entry.body}
            </div>
          )}
          {entry.basis.length > 0 && !editing && <p className="text-[11px] text-muted">Why: {entry.basis.join(" · ")}</p>}
          {problem && <p className="text-[12px] text-danger">{problem}</p>}
          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                <Act
                  busy={busy}
                  primary
                  onClick={() => run(() => editOutbox(entry.id, { subject, body }), "Saved. Sol will send your words.")}
                >
                  Save
                </Act>
                <Act busy={busy} onClick={() => setEditing(false)}>
                  Cancel
                </Act>
              </>
            ) : (
              <>
                <Act busy={busy || entry.status === "preparing"} primary onClick={() => run(() => actOnOutbox(entry.id, "send"))}>
                  <Send className="size-3.5" aria-hidden /> Send now
                </Act>
                <Act busy={busy} onClick={() => setEditing(true)}>
                  Edit
                </Act>
                <Act busy={busy} onClick={() => run(() => actOnOutbox(entry.id, entry.held ? "release" : "hold"))}>
                  {entry.held ? "Let Sol send it" : "Hold"}
                </Act>
                <Act busy={busy} onClick={() => run(() => actOnOutbox(entry.id, "skip"), "Taken off.")}>
                  Skip
                </Act>
                <Link
                  href={`${PATHS.deals}/${entry.jobId}`}
                  className="ml-auto self-center text-[12px] font-medium text-ink-2 hover:text-ink"
                >
                  Open deal
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Act({ children, onClick, busy, primary }: { children: React.ReactNode; onClick: () => void; busy?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition disabled:bg-line disabled:text-muted",
        primary ? "bg-primary text-primary-ink hover:opacity-90" : "bg-surface text-ink ring-1 ring-line hover:ring-sun-line",
      )}
    >
      {children}
    </button>
  );
}

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: LAUNCH_MARKET.timeZone, weekday: "short", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );

/** A stage agent's card, over the page: what is next, what needs a person, what went, and the switches. */
export function AgentCard({
  stage,
  box,
  now,
  onClose,
  reload,
}: {
  stage: AgentStage;
  box: Outbox;
  now: Date;
  onClose: () => void;
  reload: () => Promise<void>;
}) {
  const agent = AGENTS[stage];
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const s = box.settings;
  const lined = box.entries.filter((e) => e.stage === stage);
  const needs = box.needsYou.filter((n) => n.stage === stage);
  const sent = box.sent.filter((x) => x.stage === stage);
  const on = agentOn(s, stage);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const save = async (next: AgentSettings) => {
    setSaving(true);
    const r = await saveAgentSettings(next);
    setSaving(false);
    if (!r.ok) setNote(r.message ?? "That couldn't be saved.");
    await reload();
  };
  const done = (message?: string) => {
    if (message) setNote(message);
    void reload();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-20" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={agent.name}
        onClick={(e) => e.stopPropagation()}
        className="theme-studio w-full max-w-lg rounded-3xl bg-surface p-5 shadow-xl ring-1 ring-line"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary">
            <SolBadge className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">{agent.name}</p>
            <p className="text-[13px] text-ink-2">{agent.what}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="tap-area rounded-full p-1 text-muted hover:text-ink">
            <X className="size-4" />
          </button>
        </div>

        {/* What it does, and whether Sol does it himself (5 Nov 2026, Martin: what it is, what it does, on or off). */}
        <section className="mt-4 rounded-2xl bg-canvas p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">What it does</h3>
              <p className="mt-1 text-[14px] text-ink">{agent.job}</p>
            </div>
            <Switch
              on={on}
              label={`${agent.name} ${on ? "on" : "off"}`}
              disabled={!agent.working || !box.owner || saving}
              onChange={(next) => save({ ...s, on: next ? [...s.on, stage] : s.on.filter((x) => x !== stage) })}
            />
          </div>
          <p className="mt-3 text-[12px] text-ink-2">
            {!agent.working
              ? agent.soon
              : on
                ? `On: Sol sends these himself in ${SEND_HOURS[s.hours].label.toLowerCase()}. Each shows its countdown, so you can stop or change it first.`
                : "Off: Sol writes them, and they wait for you to press send."}
          </p>
          {agent.working && !box.owner && <p className="mt-1 text-[11px] text-muted">Only the owner can switch Sol on or off.</p>}
          {agent.working && !box.canSend && (
            <p className="mt-1 text-[11px] text-muted">Email isn&apos;t set up on this site yet, so nothing can be sent.</p>
          )}
          {agent.working && (
            <label className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-[13px] text-ink">
              <span>When he sends</span>
              <select
                value={s.hours}
                disabled={saving}
                onChange={(e) => void save({ ...s, hours: e.target.value as SendHours })}
                className="rounded-full bg-surface px-3 py-1 text-[13px] text-ink ring-1 ring-line"
              >
                {(Object.keys(SEND_HOURS) as SendHours[]).map((h) => (
                  <option key={h} value={h}>
                    {SEND_HOURS[h].label} ({SEND_HOURS[h].words})
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
        {note && <p className="mt-2 text-[12px] text-ink-2">{note}</p>}

        {needs.length > 0 && (
          <section className="mt-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-danger">Needs you</h3>
            <p className="mt-1 text-[12px] text-muted">They wrote back, so Sol has stepped aside for a person to answer.</p>
            <ul className="mt-2 space-y-1.5">
              {needs.map((n) => (
                <li key={n.jobId}>
                  <Link
                    href={`${PATHS.deals}/${n.jobId}?tab=chat`}
                    className="block rounded-2xl bg-canvas px-3 py-2 ring-1 ring-line hover:ring-sun-line"
                  >
                    <span className="block text-[13px] font-medium text-ink">
                      {n.customer} <span className="font-normal text-muted">· {timeOf(n.at)}</span>
                    </span>
                    <span className="block truncate text-[12px] text-ink-2">“{n.last}”</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {agent.working && (
          <section className="mt-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Next up</h3>
            {lined.length ? (
              <ul className="mt-2 space-y-1.5">
                {lined.map((e) => (
                  <Lined key={e.id} entry={e} now={now} onDone={done} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-ink-2">
                Nothing lined up. He writes a follow-up when one falls due, 2, 7 and 14 days after a proposal.
              </p>
            )}
          </section>
        )}

        {sent.length > 0 && (
          <section className="mt-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Sent by Sol this week</h3>
            <ul className="mt-2 space-y-1">
              {sent.map((x) => (
                <li key={x.id} className="flex justify-between gap-3 text-[12px]">
                  <Link href={`${PATHS.deals}/${x.jobId}`} className="truncate text-ink hover:underline">
                    {x.customer} · {x.subject}
                  </Link>
                  <span className="shrink-0 tabular-nums text-muted">{timeOf(x.at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** An on and off switch. */
function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={clsx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        on ? "bg-positive" : "bg-line",
      )}
    >
      <span
        className={clsx("inline-block size-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-6" : "translate-x-1")}
      />
      <span className="sr-only">{on ? "On" : "Off"}</span>
    </button>
  );
}
