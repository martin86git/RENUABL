"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Check } from "lucide-react";
import type { SolState, SolTurn } from "@/lib/domain/design/sol";
import {
  ANSWER_MAX,
  ASK_EACH_TIME,
  PART_WORDS,
  SCOPE_QUESTION,
  SOL_INTRO,
  asksScope,
  manyAnswer,
  questionsFor,
  type InductionQuestion,
} from "@/lib/domain/design/sol-induction";
import {
  SOL_CHANGED,
  SOL_INDUCTION,
  answerInduction,
  answerLearn,
  chooseInductionScope,
  loadSol,
  setInductionStatus,
} from "@/lib/services/sol";
import { SolBadge } from "./sol-sun";

type Run = (go: Promise<{ ok: true; state: SolState } | { ok: false; message: string }>) => Promise<SolState | null>;

const pill =
  "inline-flex min-h-9 items-center rounded-full px-3.5 py-1.5 text-left text-[13px] font-medium ring-1 transition disabled:cursor-not-allowed disabled:text-muted";
const choice = `${pill} sol-choice bg-surface text-ink ring-line hover:ring-sun-line`;
const main = `${pill} bg-sun-line text-white ring-sun-line hover:brightness-110`;
const quiet = "text-[12.5px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline";

type Step = { kind: "intro" } | { kind: "scope" } | { kind: "question"; q: InductionQuestion } | { kind: "done" };

/**
 * Sol's induction (sol-induction.ts), at the top of his chat while it is still to do: who he is, where he is, what he
 * will and won't do, then his questions one at a time, each skippable. "Later" leaves a card on Today.
 */
export function SolInduction({ state, run }: { state: SolState; run: Run }) {
  const ind = state.induction;
  const who = { owner: Boolean(ind?.owner), scope: ind?.scope ?? null };
  // The scope is asked once, just before the first business question; what is asked follows the owner's answer.
  const [scope, setScope] = useState(who.scope);
  // Fixed when it opens, so the steps don't shift once the owner has answered it.
  const [scopeAsked] = useState(() => asksScope(who));
  const asked = questionsFor({ owner: who.owner, scope });
  const steps: Step[] = [{ kind: "intro" }];
  for (const q of asked) {
    if (q.scope === "business" && scopeAsked && !steps.some((s) => s.kind === "scope")) steps.push({ kind: "scope" });
    steps.push({ kind: "question", q });
  }
  steps.push({ kind: "done" });
  const [at, setAt] = useState(0);
  // The introduction is said a line at a time, each on Next.
  const [said, setSaid] = useState(0);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const step = steps[Math.min(at, steps.length - 1)];
  const questions = steps.filter((s) => s.kind === "question").length;
  const number = steps.slice(0, at + 1).filter((s) => s.kind === "question").length;
  const staffSet = !who.owner && who.scope === "all";
  // Each step kept in view as it comes up (the chat may be long above it).
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    box.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [at, said]);

  const next = () => {
    setTyped("");
    setAt((n) => Math.min(n + 1, steps.length - 1));
  };
  const answer = async (q: InductionQuestion, said: string) => {
    if (!said.trim()) return;
    setBusy(true);
    const ok = await run(answerInduction(q.key, said.trim()));
    setBusy(false);
    if (ok) next();
  };
  const pickScope = async (s: "all" | "own") => {
    setBusy(true);
    const ok = await run(chooseInductionScope(s));
    setBusy(false);
    if (ok) {
      setScope(s);
      next();
    }
  };

  return (
    <section ref={box} aria-label="Getting to know you" className="space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-sun-line/40">
      {step.kind === "intro" && (
        <>
          {SOL_INTRO.lines.slice(0, said + 1).map((line, i) => (
            <p key={i} className={clsx("text-[14.5px] leading-relaxed", i === said ? "text-ink" : "text-ink-2")}>
              {line(ind?.business ?? "")}
            </p>
          ))}
          {said < SOL_INTRO.lines.length - 1 ? (
            <button type="button" className={main} onClick={() => setSaid(said + 1)}>
              Next
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={main} onClick={next}>
                {SOL_INTRO.go}
              </button>
              <button type="button" className={quiet} onClick={() => void run(setInductionStatus("later"))}>
                Later
              </button>
            </div>
          )}
        </>
      )}

      {step.kind === "scope" && (
        <>
          <Head part={PART_WORDS.customers} n={number + 1} of={questions} back={() => setAt(at - 1)} />
          <p className="text-[14.5px] leading-relaxed text-ink">{SCOPE_QUESTION.ask}</p>
          <div className="space-y-2">
            {SCOPE_QUESTION.options.map((o) => (
              <button
                key={o.scope}
                type="button"
                disabled={busy}
                onClick={() => void pickScope(o.scope)}
                className={clsx(choice, "w-full flex-col items-start rounded-xl py-2.5")}
              >
                <span>{o.label}</span>
                <span className="mt-0.5 text-[12px] font-normal text-muted">{o.about}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step.kind === "question" && (
        <>
          <Head part={PART_WORDS[step.q.part]} n={number} of={questions} back={at > 1 ? () => setAt(at - 1) : null} />
          <p className="text-[15px] leading-relaxed text-ink">{step.q.ask}</p>
          {step.q.hint && <p className="-mt-2 text-[12.5px] text-muted">{step.q.hint}</p>}
          {step.q.many && <ManyAnswer key={step.q.key} q={step.q} busy={busy} onKeep={(a) => void answer(step.q, a)} />}
          {!step.q.many && step.q.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {step.q.options.map((o) => (
                <button key={o} type="button" disabled={busy} onClick={() => void answer(step.q, o)} className={choice}>
                  {o}
                </button>
              ))}
            </div>
          )}
          {!step.q.many && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void answer(step.q, typed);
              }}
              className="flex items-center gap-2"
            >
              <input
                key={step.q.key}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={
                  step.q.options.length ? "Or in your own words" : step.q.key === "name" ? (ind?.firstName ?? "Your name") : "Type it here"
                }
                maxLength={160}
                className="h-9 min-w-0 flex-1 rounded-full bg-transparent px-3.5 text-[13.5px] text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-sun-line"
              />
              {step.q.key === "name" && !typed && ind?.firstName ? (
                <button type="button" disabled={busy} onClick={() => void answer(step.q, ind.firstName!)} className={main}>
                  {ind.firstName}
                </button>
              ) : (
                <button type="submit" disabled={busy || !typed.trim()} className={main}>
                  Keep
                </button>
              )}
            </form>
          )}
          <div className="flex items-center justify-between gap-3">
            <button type="button" className={quiet} onClick={next}>
              Skip
            </button>
            <button type="button" className={quiet} onClick={() => setAt(steps.length - 1)}>
              That&apos;s enough for now
            </button>
          </div>
        </>
      )}

      {step.kind === "done" && (
        <>
          {staffSet && (
            <p className="text-[13px] leading-relaxed text-muted">
              Your owner has set how I write to your customers, so I didn&apos;t ask about that. Tell me if you&apos;d like something done
              your own way.
            </p>
          )}
          <p className="text-[14.5px] leading-relaxed text-ink">{SOL_INTRO.done}</p>
          <button type="button" className={main} onClick={() => void run(setInductionStatus("done"))}>
            {SOL_INTRO.finish}
          </button>
        </>
      )}
    </section>
  );
}

/**
 * A question with several answers (`many`): the usual ones to tick, and a box that grows with what is typed for the
 * rest, one a line, so nothing typed is hidden and it doesn't read as room for one thing.
 */
function ManyAnswer({ q, busy, onKeep }: { q: InductionQuestion; busy: boolean; onKeep: (answer: string) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [own, setOwn] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [own]);
  const answer = manyAnswer(picked, own);
  const count = answer ? answer.split("; ").length : 0;
  const toggle = (o: string) => setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {q.options.map((o) => {
          const on = picked.includes(o);
          return (
            <button
              key={o}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={busy}
              onClick={() => toggle(o)}
              className={clsx(choice, "gap-1.5", on && "sol-choice-on ring-sun-line")}
            >
              {on && <Check className="size-3.5 text-sun-line" aria-hidden />}
              {o}
            </button>
          );
        })}
      </div>
      <textarea
        ref={area}
        rows={2}
        value={own}
        onChange={(e) => setOwn(e.target.value)}
        placeholder="Anything else? One per line"
        maxLength={ANSWER_MAX}
        className="block max-h-48 w-full resize-none rounded-xl bg-transparent px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-sun-line"
      />
      <button type="button" disabled={busy || !count} onClick={() => onKeep(answer)} className={main}>
        {count ? `Keep ${count === 1 ? "this one" : `these ${count}`}` : "Pick or type at least one"}
      </button>
    </div>
  );
}

function Head({ part, n, of, back }: { part: string; n: number; of: number; back: (() => void) | null }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
      {back && (
        <button type="button" onClick={back} aria-label="Back" className="-ml-1 rounded-full p-1 hover:text-ink">
          <ArrowLeft className="size-3.5" aria-hidden />
        </button>
      )}
      <span>{part}</span>
      <span className="ml-auto tabular-nums">
        {Math.min(n, of)} of {of}
      </span>
    </div>
  );
}

/** One of Sol's questions under an answer (sol-induction.ts `LearnAsk`): pressed once, kept as a preference. */
export function LearnCard({ turn, run }: { turn: SolTurn; run: Run }) {
  const ask = turn.learn!;
  const [busy, setBusy] = useState(false);
  const press = async (c: string) => {
    setBusy(true);
    await run(answerLearn(turn.at, c));
    setBusy(false);
  };
  if (ask.answer)
    return (
      <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
        <Check className="size-3.5 text-positive" aria-hidden />
        {ask.answer === ASK_EACH_TIME
          ? "Got it: I'll ask you each time."
          : `Got it: ${ask.answer.toLowerCase()}. I'll do that from now on.`}
      </p>
    );
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-sun-line/40">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sun-line">Helping me learn how you work</p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink">
        {ask.when}, {ask.question.charAt(0).toLowerCase() + ask.question.slice(1)}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {ask.options.map((o) => (
          <button key={o} type="button" disabled={busy} onClick={() => void press(o)} className={choice}>
            {o}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={() => void press(ASK_EACH_TIME)} className={clsx(choice, "text-muted")}>
          {ASK_EACH_TIME}
        </button>
      </div>
    </div>
  );
}

/**
 * On Today while the induction was put off for later: one quiet card with Sol's mark, opening his panel on it.
 */
export function InductionReminder() {
  const [later, setLater] = useState(false);
  useEffect(() => {
    let live = true;
    void loadSol().then((r) => live && r.ok && setLater(r.state.induction?.status === "later"));
    const changed = (e: Event) => {
      const next = (e as CustomEvent<SolState>).detail;
      if (next?.induction) setLater(next.induction.status === "later");
    };
    window.addEventListener(SOL_CHANGED, changed);
    return () => {
      live = false;
      window.removeEventListener(SOL_CHANGED, changed);
    };
  }, []);
  if (!later) return null;
  const start = async () => {
    const r = await setInductionStatus("pending");
    if (r.ok) window.dispatchEvent(new CustomEvent(SOL_CHANGED, { detail: r.state }));
    setLater(false);
    window.dispatchEvent(new Event(SOL_INDUCTION));
  };
  return (
    <div className="mx-auto mb-4 flex w-full max-w-5xl flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
      <SolBadge className="size-7" />
      <p className="min-w-0 flex-1 text-[14px] text-ink">
        Sol has a few questions so he works the way you do. <span className="text-muted">About 2 minutes.</span>
      </p>
      <button
        type="button"
        onClick={() => void start()}
        className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-[13px] font-medium text-primary-ink hover:brightness-110"
      >
        Answer them now
      </button>
    </div>
  );
}
