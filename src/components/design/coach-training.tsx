"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronDown, GraduationCap, Loader2, Lock, PhoneCall, RotateCcw, X } from "lucide-react";
import type { CoachNote } from "@/lib/domain/design/coaching";
import { DEFAULT_DELIVERY, DELIVERY_COPY, NATURAL_DELIVERY, sameDelivery, type Delivery } from "@/lib/domain/design/delivery";
import { TRAINING_COPY, openProposals, type TrainingProposal, type TrainingView } from "@/lib/domain/design/training-call";
import { TRAINING_PLACED, ringMeToHear, ringMeToTrain, type CallerState } from "@/lib/services/caller";
import { answerProposal, loadTraining, retryTraining, saveDelivery } from "@/lib/services/coaching";

const SEEN_KEY = "renuabl.design.training-seen";
const seenId = (): string | null => {
  try {
    return sessionStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};

/**
 * Ring me (16 Nov 2026, Martin: "allow requesting a call from an agent to be training mode and test mode (calling a
 * lead)"): one round in the agent's window that opens the two calls it can make to the member's own mobile. **Train**:
 * the member is its trainer (training-call.ts). **Test call**: it rings as it would a new lead and the member plays
 * the customer (practice-call.ts). `row` draws the two as buttons side by side, for the agent's day.
 */
export function RingMe({ caller, row = false }: { caller: CallerState; row?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"train" | "test" | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const name = caller.name;
  const train = TRAINING_COPY.train(name);
  const test = TRAINING_COPY.test(name);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", key, true);
    };
  }, [open]);

  const ring = async (which: "train" | "test") => {
    setBusy(which);
    setSaid(null);
    const res = await (which === "train" ? ringMeToTrain : ringMeToHear)(caller.role ?? "sales");
    setBusy(null);
    if (res.ok) return setOpen(false);
    setSaid(res.message);
  };

  const choice = (which: "train" | "test", words: { label: string; what: string }) => (
    <button
      type="button"
      onClick={() => void ring(which)}
      disabled={busy !== null}
      className={clsx(
        "flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left ring-1 ring-line hover:ring-ink disabled:opacity-60",
        which === "train" ? "bg-sun" : "bg-surface",
      )}
    >
      <span
        className={clsx(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
          which === "train" ? "bg-primary text-white" : "bg-surface-2 text-ink",
        )}
      >
        {busy === which ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : which === "train" ? (
          <GraduationCap className="size-4" aria-hidden />
        ) : (
          <PhoneCall className="size-4" aria-hidden />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{words.label}</span>
        <span className="block text-xs leading-snug text-ink-2">{words.what}</span>
      </span>
    </button>
  );

  if (row)
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Have {name} ring you</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {choice("train", train)}
          {choice("test", test)}
        </div>
        {said ? (
          <p className="text-xs text-danger">{said}</p>
        ) : (
          <p className="text-xs text-muted">
            {TRAINING_COPY.rings} On a training call, try: {TRAINING_COPY.tryThese.join(" · ")}
          </p>
        )}
      </div>
    );

  return (
    <span ref={wrap} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Have ${name} ring you: train ${name}, or a test call`}
        title={`Have ${name} ring you: train or test`}
        className={clsx("grid size-8 place-items-center rounded-full", open ? "bg-white text-ink" : "hover:bg-white/10")}
      >
        <PhoneCall className="size-4" aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={TRAINING_COPY.modeTitle}
          className="absolute left-0 top-10 z-20 w-72 space-y-2 rounded-2xl bg-surface p-3 text-ink shadow-lift ring-1 ring-line"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Have {name} ring you</p>
          {choice("train", train)}
          {choice("test", test)}
          {said ? <p className="text-xs text-danger">{said}</p> : <p className="text-xs text-muted">{TRAINING_COPY.rings}</p>}
        </div>
      )}
    </span>
  );
}

const KIND_TONE: Record<TrainingProposal["kind"], string> = {
  add: "bg-positive-soft text-positive",
  change: "bg-sun text-sun-ink",
  remove: "bg-surface-2 text-muted",
};

/**
 * What came of the agent's latest training call, above its chat (training-call.ts): on the call now, being written
 * up, then the rules locked in on the call and each change it suggests, to **lock in** as a rule, keep as a note or
 * drop. Nothing reaches its script from here without a press.
 */
export function TrainingCard({ caller, onNotes }: { caller: CallerState; onNotes: (notes: CoachNote[]) => void }) {
  const [training, setTraining] = useState<TrainingView | null>(null);
  const [mayKeep, setMayKeep] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [seen, setSeen] = useState<string | null>(seenId);
  const [heard, setHeard] = useState(false);
  const name = caller.name;

  const read = useCallback(async () => {
    const res = await loadTraining();
    if (!res.ok) return;
    setTraining(res.training);
    setMayKeep(res.mayKeep);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the card reads its call as it appears
    void read();
    const placed = () => window.setTimeout(() => void read(), 1500);
    window.addEventListener(TRAINING_PLACED, placed);
    return () => window.removeEventListener(TRAINING_PLACED, placed);
  }, [read]);

  // While the call is on or being written up, it is asked about again; once written up it stays as it is.
  const waiting = training?.standing === "live" || training?.standing === "working";
  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(() => void read(), 4000);
    return () => window.clearInterval(t);
  }, [waiting, read]);

  if (!training) return null;
  const outcome = training.outcome;
  const open = openProposals(outcome);
  const handled = training.standing === "done" && open.length === 0;
  if (handled && seen === training.id) return null;
  // A call fully dealt with has nothing left to show unless it has only just been dealt with in this visit.
  if (handled && outcome?.state === "ready" && training.lockedOnCall.length === 0 && !said) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(SEEN_KEY, training.id);
    } catch {
      // Private window: it goes for this look only.
    }
    setSeen(training.id);
  };

  const answer = async (p: TrainingProposal, what: "lock" | "keep" | "drop") => {
    setBusy(`${p.id}:${what}`);
    setSaid(null);
    const res = await answerProposal(training.id, p.id, what);
    setBusy(null);
    if (!res.ok) return setSaid(res.message);
    setTraining(res.training);
    onNotes(res.notes);
    if (res.full) setSaid(TRAINING_COPY.full);
    else if (res.gone) setSaid(TRAINING_COPY.gone);
  };

  const lockAll = async () => {
    for (const p of open.filter((x) => x.kind !== "remove")) {
      setBusy(`${p.id}:lock`);
      const res = await answerProposal(training.id, p.id, "lock");
      if (!res.ok) {
        setSaid(res.message);
        break;
      }
      setTraining(res.training);
      onNotes(res.notes);
      if (res.full) {
        setSaid(TRAINING_COPY.full);
        break;
      }
    }
    setBusy(null);
  };

  const again = async () => {
    setBusy("retry");
    const res = await retryTraining(training.id);
    setBusy(null);
    if (res.ok) setTraining(res.training);
    else setSaid(res.message);
  };

  const failed = outcome && outcome.state !== "ready" ? TRAINING_COPY[outcome.state] : null;
  const lockable = open.filter((p) => p.kind !== "remove").length;

  return (
    <section aria-label={TRAINING_COPY.heading} className="max-h-[55%] shrink-0 overflow-y-auto border-b border-line bg-canvas px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-white">
          <GraduationCap className="size-3.5" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {TRAINING_COPY.heading}
          {training.by ? <span className="font-normal text-muted"> · with {training.by}</span> : null}
        </p>
        {training.standing === "done" && (
          <button type="button" onClick={dismiss} aria-label="Put this away" title="Put this away" className="text-muted hover:text-ink">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {training.standing === "live" && <p className="mt-2 text-xs text-ink-2">{TRAINING_COPY.live(name)}</p>}
      {training.standing === "working" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-2">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {TRAINING_COPY.working(name)}
        </p>
      )}

      {training.lockedOnCall.length > 0 && (
        <div className="mt-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{TRAINING_COPY.lockedOnCall}</p>
          <ul className="mt-1 space-y-1">
            {training.lockedOnCall.map((t) => (
              <li key={t} className="flex items-start gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-sm text-ink ring-1 ring-line">
                <Lock className="mt-0.5 size-3.5 shrink-0 text-sun-line" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {outcome?.summary && training.standing === "done" && <p className="mt-2 text-sm leading-snug text-ink-2">{outcome.summary}</p>}
      {failed && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-2">
          {failed}
          {(outcome?.state === "failed" || outcome?.state === "out") && mayKeep && (
            <button
              type="button"
              onClick={() => void again()}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 font-medium text-ink ring-1 ring-line hover:ring-ink"
            >
              <RotateCcw className="size-3" aria-hidden /> Try again
            </button>
          )}
        </p>
      )}

      {open.length > 0 && (
        <ul className="mt-2.5 space-y-2">
          {open.map((p) => (
            <li key={p.id} className="rounded-xl bg-surface p-2.5 ring-1 ring-line">
              <div className="flex items-start gap-2">
                <span className={clsx("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium", KIND_TONE[p.kind])}>
                  {TRAINING_COPY.words[p.kind]}
                </span>
                <div className="min-w-0 flex-1 text-sm leading-snug">
                  <p className={clsx(p.kind === "remove" ? "text-muted line-through" : "text-ink")}>{p.text}</p>
                  {p.kind === "change" && p.was && <p className="mt-0.5 text-xs text-muted line-through">{p.was}</p>}
                </div>
              </div>
              {mayKeep && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {p.kind !== "remove" && (
                    <button
                      type="button"
                      onClick={() => void answer(p, "lock")}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-white disabled:bg-surface-2 disabled:text-muted"
                    >
                      {busy === `${p.id}:lock` ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                      ) : (
                        <Lock className="size-3" aria-hidden />
                      )}
                      {TRAINING_COPY.lock}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void answer(p, "keep")}
                    disabled={busy !== null}
                    className={clsx(
                      "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-line hover:ring-ink disabled:text-muted",
                      p.kind === "remove" ? "bg-primary text-white ring-0" : "bg-surface text-ink",
                    )}
                  >
                    {p.kind === "remove" ? "Remove it" : TRAINING_COPY.keep}
                  </button>
                  <button
                    type="button"
                    onClick={() => void answer(p, "drop")}
                    disabled={busy !== null}
                    className="rounded-full px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink disabled:text-muted"
                  >
                    {TRAINING_COPY.drop}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {said && <p className="mt-2 text-xs text-warning">{said}</p>}
      {open.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {mayKeep && lockable > 1 && (
            <button
              type="button"
              onClick={() => void lockAll()}
              disabled={busy !== null}
              className="text-xs font-medium text-ink underline decoration-sun-line underline-offset-2 disabled:text-muted"
            >
              {TRAINING_COPY.lockAll}
            </button>
          )}
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted">
            {mayKeep ? TRAINING_COPY.note : "Only an admin can keep these."}
          </p>
        </div>
      )}

      {training.lines.length > 0 && training.standing !== "live" && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setHeard((h) => !h)}
            aria-expanded={heard}
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink"
          >
            <ChevronDown className={clsx("size-3.5 transition-transform", heard && "rotate-180")} aria-hidden />
            {TRAINING_COPY.transcript}
          </button>
          {heard && (
            <ol className="mt-1.5 space-y-1 rounded-xl bg-surface p-2.5 text-xs leading-snug ring-1 ring-line">
              {training.lines.map((l, i) => (
                <li key={i} className={l.role === "assistant" ? "text-ink-2" : "text-ink"}>
                  <span className="font-medium">{l.role === "assistant" ? name : "You"}:</span> {l.text}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

type Part = keyof typeof DELIVERY_COPY.parts;
const PARTS: Part[] = ["manner", "pace", "opening", "pause", "room"];

/**
 * How the agent speaks (delivery.ts), in its settings beside the chat: one press for a natural phone call, or each
 * part chosen. Saved as it is pressed and used from the next call.
 */
export function DeliverySettings(props: { delivery: Delivery | null; editable: boolean; onSaved: (d: Delivery | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const now = props.delivery ?? DEFAULT_DELIVERY;
  const save = async (next: Delivery | null) => {
    setBusy(true);
    setSaid(null);
    const res = await saveDelivery(next);
    setBusy(false);
    if (!res.ok) return setSaid(res.message);
    props.onSaved(res.delivery);
    setSaid("Saved. Used from the next call.");
  };
  const natural = sameDelivery(now, NATURAL_DELIVERY);
  const usual = sameDelivery(now, DEFAULT_DELIVERY);
  return (
    <div className="space-y-3 px-4 pb-4">
      {props.editable && (
        <div className="rounded-xl bg-sun p-3 ring-1 ring-sun-line/30">
          <button
            type="button"
            onClick={() => void save(NATURAL_DELIVERY)}
            disabled={busy || natural}
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:bg-surface-2 disabled:text-muted"
          >
            {natural ? "It's a natural phone call" : DELIVERY_COPY.preset}
          </button>
          <p className="mt-1.5 text-xs leading-snug text-sun-ink">{DELIVERY_COPY.presetNote}</p>
        </div>
      )}
      {PARTS.map((part) => {
        const copy = DELIVERY_COPY.parts[part];
        const options = Object.entries(copy.options) as [string, readonly [string, string]][];
        return (
          <fieldset key={part} disabled={!props.editable || busy}>
            <legend className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{copy.label}</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {options.map(([value, [label, what]]) => {
                const on = now[part] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    title={what}
                    onClick={() => !on && void save({ ...now, [part]: value } as Delivery)}
                    className={clsx(
                      "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                      on ? "bg-surface text-ink ring-ink" : "bg-surface text-ink-2 ring-line hover:ring-ink",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted">{(copy.options as Record<string, readonly [string, string]>)[now[part]][1]}</p>
          </fieldset>
        );
      })}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {props.editable && !usual && (
          <button
            type="button"
            onClick={() => void save(DEFAULT_DELIVERY)}
            disabled={busy}
            className="text-xs font-medium text-ink-2 hover:text-ink"
          >
            {DELIVERY_COPY.reset}
          </button>
        )}
        {said && <p className="text-xs text-ink-2">{said}</p>}
      </div>
      <p className="text-[11px] leading-snug text-muted">{DELIVERY_COPY.note}</p>
      {!props.editable && <p className="text-xs text-muted">Only an admin can change how it speaks.</p>}
    </div>
  );
}
