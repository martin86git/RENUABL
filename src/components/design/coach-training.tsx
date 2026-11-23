"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, ChevronRight, GraduationCap, Loader2, Lock, PhoneCall, RotateCcw, Sparkles, X } from "lucide-react";
import type { CoachNote } from "@/lib/domain/design/coaching";
import { DEFAULT_DELIVERY, DELIVERY_COPY, NATURAL_DELIVERY, sameDelivery, type Delivery } from "@/lib/domain/design/delivery";
import { TRAINING_COPY, openProposals, type TrainingProposal, type TrainingView } from "@/lib/domain/design/training-call";
import { TRAINING_PLACED, ringMeToHear, ringMeToTrain, saveCallerBrain, type CallerState } from "@/lib/services/caller";
import { BRAIN_WORDS, CALLER_BRAINS, type CallerBrain } from "@/lib/domain/design/caller";
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
 * lead)"): the phone round in the agent's window header, opening the two calls it can make to the member's own mobile.
 * **Train**: the member is its trainer (training-call.ts). **Test call**: it rings as it would a new lead and the member
 * plays the customer (practice-call.ts). The only place they are offered in the window (17 Nov 2026, Martin: the pads
 * on the chat repeated the header's menu and took its room).
 */
export function RingMe({ caller }: { caller: CallerState }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"train" | "test" | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  // Where the card sits under the button, kept inside the screen (23 Nov 2026, Martin: on a phone it ran off the right).
  const [place, setPlace] = useState<{ left: number; width: number } | null>(null);
  const name = caller.name;
  const train = TRAINING_COPY.train(name);
  const test = TRAINING_COPY.test(name);

  useEffect(() => {
    if (!open) return;
    const fit = () => {
      const box = wrap.current?.getBoundingClientRect();
      if (!box) return;
      const gutter = 8;
      const width = Math.min(320, window.innerWidth - gutter * 2);
      const left = Math.min(0, window.innerWidth - gutter - width - box.left);
      setPlace({ left: Math.max(gutter - box.left, left), width });
    };
    fit();
    window.addEventListener("resize", fit);
    const away = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("resize", fit);
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
      className="flex w-full items-start gap-2.5 rounded-xl bg-surface px-3 py-2.5 text-left ring-1 ring-line hover:bg-call-soft hover:ring-call disabled:opacity-60"
    >
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-call text-white">
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
          style={place ? { left: place.left, width: place.width } : undefined}
          className="absolute left-0 top-10 z-20 w-80 max-w-[calc(100vw-1rem)] space-y-2 rounded-2xl bg-surface p-3 text-ink shadow-lift ring-1 ring-line"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Have {name} ring you</p>
          {choice("train", train)}
          {choice("test", test)}
          {said ? (
            <p className="text-xs text-danger" role="alert">
              {said}
            </p>
          ) : (
            <p className="text-xs leading-snug text-muted">
              {TRAINING_COPY.rings} On a training call, try: {TRAINING_COPY.tryThese.join(" · ")}
            </p>
          )}
        </div>
      )}
    </span>
  );
}

/**
 * The agent's latest training call (training-call.ts), read once for its window and shared by the strip over the
 * chat and the review in its settings. Asked about again while the call is on or being written up.
 */
export function useTraining(on: boolean) {
  const [training, setTraining] = useState<TrainingView | null>(null);
  const [mayKeep, setMayKeep] = useState(false);
  const [seen, setSeen] = useState<string | null>(seenId);

  const read = useCallback(async () => {
    const res = await loadTraining();
    if (!res.ok) return;
    setTraining(res.training);
    setMayKeep(res.mayKeep);
  }, []);

  useEffect(() => {
    if (!on) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the window reads its training call as it opens
    void read();
    const placed = () => window.setTimeout(() => void read(), 1500);
    window.addEventListener(TRAINING_PLACED, placed);
    return () => window.removeEventListener(TRAINING_PLACED, placed);
  }, [read, on]);

  const waiting = training?.standing === "live" || training?.standing === "working";
  useEffect(() => {
    if (!waiting || !on) return;
    const t = window.setInterval(() => void read(), 4000);
    return () => window.clearInterval(t);
  }, [waiting, read, on]);

  const open = training ? openProposals(training.outcome) : [];
  const handled = training?.standing === "done" && open.length === 0;
  // A call fully dealt with has nothing left to show, and one put away stays away for the visit.
  const shown = Boolean(
    training &&
    !(handled && seen === training.id) &&
    !(handled && training.outcome?.state === "ready" && training.lockedOnCall.length === 0),
  );

  const dismiss = () => {
    if (!training) return;
    try {
      sessionStorage.setItem(SEEN_KEY, training.id);
    } catch {
      // Private window: it goes for this look only.
    }
    setSeen(training.id);
  };

  return { training, setTraining, mayKeep, shown, open, dismiss };
}
export type Training = ReturnType<typeof useTraining>;

/**
 * The training call in one line over the chat (17 Nov 2026, Martin: the results came in a block above the chat and
 * pushed it down): on the call now (in the call green, beating), being written up, or what there is to review, with
 * Review opening it in the settings beside the chat.
 */
export function TrainingStrip({ t, name, onReview }: { t: Training; name: string; onReview: () => void }) {
  if (!t.shown || !t.training) return null;
  const training = t.training;
  const live = training.standing === "live";
  const working = training.standing === "working";
  const failed = training.outcome && training.outcome.state !== "ready";
  const count = t.open.length;
  const words = live
    ? `On a training call with ${name} now`
    : working
      ? TRAINING_COPY.working(name)
      : count > 0
        ? `Your training call: ${count} ${count === 1 ? "change" : "changes"} to review`
        : failed
          ? "Your training call couldn't be written up"
          : `Your training call: ${training.lockedOnCall.length} locked in`;
  return (
    <div
      className={clsx(
        "mx-3 mt-2.5 flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm ring-1",
        live
          ? "bg-call-soft text-call-ink ring-call/30"
          : count > 0
            ? "bg-sun text-sun-ink ring-sun-line/30"
            : "bg-canvas text-ink-2 ring-line",
      )}
    >
      <span
        className={clsx(
          "grid size-6 shrink-0 place-items-center rounded-full text-white",
          live ? "bg-call" : count > 0 ? "bg-sun-line" : "bg-primary",
        )}
      >
        {working ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <GraduationCap className="size-3.5" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{words}</span>
      {live && (
        <span className="relative flex size-2.5 shrink-0" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-call motion-reduce:animate-none" />
          <span className="relative size-2.5 rounded-full bg-call" />
        </span>
      )}
      {!live && !working && (
        <button
          type="button"
          onClick={onReview}
          className={clsx(
            "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            count > 0 ? "bg-sun-line text-white" : "bg-surface text-ink ring-1 ring-line hover:ring-ink",
          )}
        >
          Review <ChevronRight className="size-3.5" aria-hidden />
        </button>
      )}
      {training.standing === "done" && count === 0 && (
        <button
          type="button"
          onClick={t.dismiss}
          aria-label="Put this away"
          title="Put this away"
          className="shrink-0 text-muted hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

const KIND_TONE: Record<TrainingProposal["kind"], string> = {
  add: "bg-positive-soft text-positive",
  change: "bg-sun text-sun-ink",
  remove: "bg-surface-2 text-muted",
};

/**
 * What came of the agent's latest training call, at the top of its settings (training-call.ts): the rules locked in
 * on the call, the agent's summary, and each change it suggests, to **lock in** as a rule, keep as a note or drop.
 * Nothing reaches its script from here without a press.
 */
export function TrainingReview({ t, caller, onNotes }: { t: Training; caller: CallerState; onNotes: (notes: CoachNote[]) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [heard, setHeard] = useState(false);
  const [why, setWhy] = useState(false);
  const training = t.training;
  if (!training || (!t.shown && !said)) return null;
  const name = caller.name;
  const outcome = training.outcome;
  const open = t.open;

  const answer = async (p: TrainingProposal, what: "lock" | "keep" | "drop") => {
    setBusy(`${p.id}:${what}`);
    setSaid(null);
    const res = await answerProposal(training.id, p.id, what);
    setBusy(null);
    if (!res.ok) return setSaid(res.message);
    t.setTraining(res.training);
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
      t.setTraining(res.training);
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
    if (res.ok) t.setTraining(res.training);
    else setSaid(res.message);
  };

  const failed = outcome && outcome.state !== "ready" ? TRAINING_COPY[outcome.state] : null;
  const lockable = open.filter((p) => p.kind !== "remove").length;

  return (
    <section aria-label={TRAINING_COPY.heading} className="overflow-hidden rounded-2xl bg-surface ring-1 ring-sun-line/40">
      <div className="flex items-center gap-2.5 bg-sun px-3.5 py-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sun-line text-white">
          <GraduationCap className="size-4" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-sun-ink">
          {TRAINING_COPY.heading}
          {training.by ? <span className="font-normal"> · with {training.by}</span> : null}
        </p>
        {training.standing === "done" && (
          <button
            type="button"
            onClick={t.dismiss}
            aria-label="Put this away"
            title="Put this away"
            className="text-sun-ink/70 hover:text-sun-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="space-y-3 p-3.5">
        {training.standing === "live" && <p className="text-xs text-ink-2">{TRAINING_COPY.live(name)}</p>}
        {training.standing === "working" && (
          <p className="flex items-center gap-1.5 text-xs text-ink-2">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {TRAINING_COPY.working(name)}
          </p>
        )}

        {training.lockedOnCall.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{TRAINING_COPY.lockedOnCall}</p>
            <ul className="mt-1.5 space-y-1.5">
              {training.lockedOnCall.map((l) => (
                <li
                  key={l}
                  className="flex items-start gap-2 rounded-lg border-l-2 border-sun-line bg-canvas px-2.5 py-1.5 text-[13px] leading-snug text-ink"
                >
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-sun-line" aria-hidden />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        )}

        {outcome?.summary && training.standing === "done" && (
          <div>
            <button
              type="button"
              onClick={() => setWhy((w) => !w)}
              aria-expanded={why}
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink"
            >
              <ChevronDown className={clsx("size-3.5 transition-transform", why && "rotate-180")} aria-hidden />
              What {name} took from it
            </button>
            {why && <p className="mt-1 text-[13px] leading-snug text-ink-2">{outcome.summary}</p>}
          </div>
        )}
        {failed && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
            {failed}
            {(outcome?.state === "failed" || outcome?.state === "out") && t.mayKeep && (
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
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">To review · {open.length}</p>
              {t.mayKeep && lockable > 1 && (
                <button
                  type="button"
                  onClick={() => void lockAll()}
                  disabled={busy !== null}
                  className="text-xs font-semibold text-sun-ink hover:underline disabled:text-muted"
                >
                  {TRAINING_COPY.lockAll}
                </button>
              )}
            </div>
            <ul className="mt-1.5 space-y-2">
              {open.map((p) => (
                <li key={p.id} className="rounded-xl bg-canvas p-2.5">
                  <div className="flex items-start gap-2">
                    <span className={clsx("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium", KIND_TONE[p.kind])}>
                      {TRAINING_COPY.words[p.kind]}
                    </span>
                    <div className="min-w-0 flex-1 text-[13px] leading-snug">
                      <p className={clsx(p.kind === "remove" ? "text-muted line-through" : "text-ink")}>{p.text}</p>
                      {p.kind === "change" && p.was && <p className="mt-0.5 text-xs text-muted line-through">{p.was}</p>}
                    </div>
                  </div>
                  {t.mayKeep && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {p.kind !== "remove" && (
                        <button
                          type="button"
                          onClick={() => void answer(p, "lock")}
                          disabled={busy !== null}
                          className="inline-flex items-center gap-1 rounded-full bg-sun-line px-2.5 py-1 text-xs font-semibold text-white disabled:bg-surface-2 disabled:text-muted"
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
                          "rounded-full px-2.5 py-1 text-xs font-medium disabled:text-muted",
                          p.kind === "remove" ? "bg-primary text-white" : "bg-surface text-ink ring-1 ring-line hover:ring-ink",
                        )}
                      >
                        {p.kind === "remove" ? "Remove it" : TRAINING_COPY.keep}
                      </button>
                      <button
                        type="button"
                        onClick={() => void answer(p, "drop")}
                        disabled={busy !== null}
                        className="rounded-full px-2.5 py-1 text-xs font-medium text-muted hover:text-ink disabled:text-muted"
                      >
                        {TRAINING_COPY.drop}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] leading-snug text-muted">{t.mayKeep ? TRAINING_COPY.note : "Only an admin can keep these."}</p>
          </div>
        )}

        {said && <p className="text-xs text-warning">{said}</p>}

        {training.lines.length > 0 && training.standing !== "live" && (
          <div>
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
              <ol className="mt-1.5 space-y-1 rounded-xl bg-canvas p-2.5 text-xs leading-snug">
                {training.lines.map((l, i) => (
                  <li key={i} className={l.role === "assistant" ? "text-ink-2" : "text-ink"}>
                    <span className="font-medium">{l.role === "assistant" ? name : "You"}:</span> {l.text}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

type Part = keyof typeof DELIVERY_COPY.parts;
const PARTS: Part[] = ["manner", "pace", "opening", "pause", "room"];

/**
 * How the agent speaks (delivery.ts), in its settings beside the chat (17 Nov 2026, Martin: a cleaner layout): one
 * press for a natural phone call, then each part as a row with its choices side by side and what the chosen one does
 * under it. Saved as it is pressed and used from the next call.
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
    <div className="space-y-4">
      {props.editable && (
        <div className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5", natural ? "bg-positive-soft" : "bg-canvas")}>
          <span
            className={clsx(
              "grid size-7 shrink-0 place-items-center rounded-full",
              natural ? "bg-positive text-white" : "bg-surface text-sun-line ring-1 ring-line",
            )}
          >
            {natural ? <Check className="size-4" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">{natural ? "A natural phone call" : DELIVERY_COPY.preset}</p>
            <p className="text-xs leading-snug text-ink-2">{DELIVERY_COPY.presetNote}</p>
          </div>
          {!natural && (
            <button
              type="button"
              onClick={() => void save(NATURAL_DELIVERY)}
              disabled={busy}
              className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:bg-surface-2 disabled:text-muted"
            >
              Use it
            </button>
          )}
        </div>
      )}
      <div className="divide-y divide-line">
        {PARTS.map((part) => {
          const copy = DELIVERY_COPY.parts[part];
          const options = Object.entries(copy.options) as [string, readonly [string, string]][];
          return (
            <fieldset key={part} disabled={!props.editable || busy} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <legend className="float-left text-[13px] font-medium text-ink">{copy.label}</legend>
                <div className="inline-flex rounded-full bg-surface-2 p-0.5">
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
                          "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                          on ? "bg-surface text-ink shadow-soft" : "text-ink-2 hover:text-ink",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="clear-both mt-1 text-xs text-muted">
                {(copy.options as Record<string, readonly [string, string]>)[now[part]][1]}
              </p>
            </fieldset>
          );
        })}
      </div>
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
        {said && <p className="text-xs text-positive">{said}</p>}
      </div>
      <p className="text-[11px] leading-snug text-muted">{DELIVERY_COPY.note}</p>
      {!props.editable && <p className="text-xs text-muted">Only an admin can change how it speaks.</p>}
    </div>
  );
}

/**
 * The model the agent thinks with on calls (22 Nov 2026, Martin: "build the per-agent model setting"): RENUABL's
 * default, quicker (Claude Haiku) or more careful (Claude Sonnet), each agent its own. Saved as it is pressed and used
 * from the next call, test and training calls too.
 */
export function BrainSettings(props: { caller: CallerState; editable: boolean }) {
  // What was pressed here, until the agent read back from the server says the same (undefined: as the server has it).
  const [picked, setBrain] = useState<CallerBrain | null | undefined>(undefined);
  const brain = picked === undefined ? (props.caller.brain ?? null) : picked;
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (next: CallerBrain | null) => {
    const was = brain;
    setBrain(next);
    setBusy(true);
    setSaid(null);
    const res = await saveCallerBrain(next, props.caller.role ?? "sales");
    setBusy(false);
    if (!res.ok) {
      setBrain(was);
      return setSaid({ ok: false, text: res.message });
    }
    setSaid({ ok: true, text: "Saved. Used from the next call." });
  };
  const options: (CallerBrain | null)[] = [null, ...CALLER_BRAINS];
  return (
    <fieldset disabled={!props.editable || busy} className="border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <legend className="float-left text-[13px] font-medium text-ink">How it thinks</legend>
        <div className="inline-flex rounded-full bg-surface-2 p-0.5">
          {options.map((value) => {
            const on = brain === value;
            const [label, what] = BRAIN_WORDS[value ?? "default"];
            return (
              <button
                key={value ?? "default"}
                type="button"
                aria-pressed={on}
                title={what}
                onClick={() => !on && void save(value)}
                className={clsx(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  on ? "bg-surface text-ink shadow-soft" : "text-ink-2 hover:text-ink",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="clear-both mt-1 text-xs text-muted">{BRAIN_WORDS[brain ?? "default"][1]}</p>
      {said && <p className={clsx("mt-1 text-xs", said.ok ? "text-positive" : "text-danger")}>{said.text}</p>}
    </fieldset>
  );
}
