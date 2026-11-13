"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { ArrowUp, ChevronDown, ChevronUp, PhoneOff, X } from "lucide-react";
import { clockWords, joinRuns, phaseWords, TEAM_NOTE_MAX, teamLineWords, type LiveLine } from "@/lib/domain/live-call";
import { CALL_HEADLINES } from "@/lib/domain/voice-agent";
import { endAssistantCall, stopWatching, tellAssistant, useLiveCall, useWatchedCall } from "@/lib/services/assistant-call";
import { useCaller } from "@/lib/services/caller";
import { CallerAvatar } from "./settings-caller";

/**
 * The window that opens when a call is handed to the phone assistant (12 Nov 2026, Martin): its face and name, where
 * the call stands, how long it has run, and what is being said as it is said. Bottom right of every page while a call
 * is watched (mounted once in the shell); closing it leaves the call going. While the call is on, the window pulses in the
 * signal colour with the clock lit, and the team can type to the assistant: an answer to give, or something to mention
 * (or, ticked, words to say as typed).
 */
export function AssistantCallWindow() {
  const watched = useWatchedCall();
  const caller = useCaller();
  const { call, loaded } = useLiveCall(watched?.jobId ?? null);
  const [folded, setFolded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  const startedAt = call && call.phase === "on-call" && call.startedAgo !== null ? call.receivedAt - call.startedAgo : null;
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setElapsed(Date.now() - startedAt);
    const t = window.setInterval(tick, 1000);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(first);
    };
  }, [startedAt]);

  const lines: LiveLine[] = call ? joinRuns(call.lines) : [];
  const said = lines.length + (call?.partial ? 1 : 0);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [said, call?.partial?.text, folded]);

  if (!watched || typeof document === "undefined") return null;

  const customer = call?.customer || watched.name || "the customer";
  const phase = call?.phase ?? "lined-up";
  const live = phase === "ringing" || phase === "on-call";
  const onCall = phase === "on-call";
  const time = phase === "on-call" ? clockWords(elapsed) : phase === "ended" && call?.ranFor ? clockWords(call.ranFor) : null;
  const outcome = phase === "ended" && call?.outcome ? `${CALL_HEADLINES[call.outcome]}${call.booked ? ` · ${call.booked}` : ""}` : null;

  return createPortal(
    <section
      aria-label={`${caller.name}'s call`}
      className={clsx(
        "fixed bottom-20 right-4 z-[85] w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-surface shadow-lift lg:bottom-6 lg:right-6 print:hidden",
        onCall ? "ring-2 ring-sun-line" : "ring-1 ring-line",
      )}
    >
      <header className="relative flex items-center gap-3 bg-primary px-4 py-3 text-white">
        {/* While the call is on, a slow pulse of the signal colour across the header: plain that it's under way. */}
        {onCall && (
          <span className="pointer-events-none absolute inset-0 animate-pulse bg-sun-line/25 motion-reduce:animate-none" aria-hidden />
        )}
        <span className="relative shrink-0">
          {live && <span className="absolute -inset-1 animate-ping rounded-full bg-positive/40" aria-hidden />}
          <CallerAvatar caller={caller} size={44} className="relative ring-2 ring-white/20" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{caller.name}</p>
          <p className="truncate text-xs text-white/70">{phaseWords(phase, customer)}</p>
        </div>
        {time && (
          <span
            className={clsx(
              "relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums",
              onCall ? "bg-sun-line text-white" : "bg-white/10",
            )}
          >
            {onCall && (
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inset-0 animate-ping rounded-full bg-white/80 motion-reduce:animate-none" />
                <span className="relative size-2 rounded-full bg-white" />
              </span>
            )}
            {time}
          </span>
        )}
        <button
          type="button"
          onClick={() => setFolded((f) => !f)}
          aria-label={folded ? "Show the conversation" : "Fold away"}
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          {folded ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={stopWatching}
          aria-label="Close (the call carries on)"
          title="Close (the call carries on)"
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      {!folded && (
        <>
          {outcome && <p className="border-b border-line bg-surface-2 px-4 py-2 text-sm font-semibold text-ink">{outcome}</p>}
          <div ref={list} aria-live="polite" className="max-h-[min(20rem,45dvh)] min-h-24 space-y-2 overflow-y-auto px-4 py-3">
            {said === 0 ? (
              <p className="py-4 text-center text-sm text-muted">
                {!loaded
                  ? "Lining up the call…"
                  : phase === "lined-up"
                    ? watched.message
                    : phase === "ringing"
                      ? `Waiting for ${customer} to answer…`
                      : phase === "trying-again"
                        ? `${caller.name} will try ${customer} again later.`
                        : phase === "ended"
                          ? "Nothing was said on this call."
                          : "Listening…"}
              </p>
            ) : (
              <>
                {lines.map((l, i) => (
                  <Bubble key={i} line={l} assistant={caller.name} customer={customer} />
                ))}
                {call?.partial && <Bubble line={call.partial} assistant={caller.name} customer={customer} saying />}
              </>
            )}
          </div>
          {call?.canSteer && <TellBox jobId={watched.jobId} assistant={caller.name} />}
          {call?.canEnd && <HangUp jobId={watched.jobId} assistant={caller.name} customer={customer} />}
          {!call?.canSteer && (
            <p className="border-t border-line px-4 py-2 text-[11px] text-muted">
              {phase === "ended"
                ? "The call and its summary are on the deal."
                : "Words appear as they're said, transcribed by machine. Closing this leaves the call going."}
            </p>
          )}
        </>
      )}
    </section>,
    document.body,
  );
}

/**
 * Hanging up on the assistant's call (13 Nov 2026, Martin: in case it says something I don't agree with). One press asks
 * "End the call?", a second ends it; nothing more is tried on that run.
 */
function HangUp({ jobId, assistant, customer }: { jobId: string; assistant: string; customer: string }) {
  const [sure, setSure] = useState(false);
  const [ending, setEnding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (!sure) return;
    const t = window.setTimeout(() => setSure(false), 5000);
    return () => window.clearTimeout(t);
  }, [sure]);
  const end = async () => {
    if (!sure) return setSure(true);
    setEnding(true);
    setProblem(null);
    const res = await endAssistantCall(jobId);
    setEnding(false);
    setSure(false);
    if (!res.ok) setProblem(res.message);
  };
  return (
    <div className="border-t border-line px-3 py-2">
      <button
        type="button"
        onClick={() => void end()}
        disabled={ending}
        className={clsx(
          "flex w-full items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold transition-colors",
          sure ? "bg-danger text-white" : "bg-danger/10 text-danger hover:bg-danger/15",
        )}
      >
        <PhoneOff className="size-4" aria-hidden />
        {ending ? "Ending the call…" : sure ? `Yes, end ${assistant}'s call with ${customer}` : "Hang up"}
      </button>
      {problem && <p className="px-1 pt-1 text-[11px] text-danger">{problem}</p>}
    </div>
  );
}

/** Typing to the assistant mid-call: something to work in, or (ticked) words to say as typed. */
function TellBox({ jobId, assistant }: { jobId: string; assistant: string }) {
  const [text, setText] = useState("");
  const [say, setSay] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setProblem(null);
    const res = await tellAssistant(jobId, t, say);
    setSending(false);
    if (!res.ok) return setProblem(res.message);
    setText("");
    setSay(false);
  };
  return (
    <div className="border-t border-line px-3 py-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-3.5 pr-1 ring-1 ring-line focus-within:ring-sun-line"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={TEAM_NOTE_MAX}
          placeholder={say ? `What ${assistant} should say…` : `Tell ${assistant} something…`}
          aria-label={`Tell ${assistant} something during the call`}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Send"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-sun-line text-white disabled:bg-line disabled:text-muted"
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </form>
      <label className="mt-1.5 flex items-center gap-2 px-1 text-[11px] text-muted">
        <input type="checkbox" checked={say} onChange={(e) => setSay(e.target.checked)} className="size-3.5 accent-[var(--sun-line)]" />
        Have {assistant} say it word for word
      </label>
      {problem ? (
        <p className="px-1 pt-1 text-[11px] text-danger">{problem}</p>
      ) : (
        <p className="px-1 pt-1 text-[11px] text-muted">
          {say ? `${assistant} says it next, as typed.` : `Only ${assistant} sees this: an answer to give, or something to mention.`}
        </p>
      )}
    </div>
  );
}

function Bubble({ line, assistant, customer, saying }: { line: LiveLine; assistant: string; customer: string; saying?: boolean }) {
  if (line.role === "team" || line.role === "team-say" || line.role === "team-end")
    return (
      <div className="flex flex-col items-center">
        <p className="max-w-[90%] rounded-xl bg-sun px-3 py-1.5 text-center text-xs leading-snug text-sun-ink">
          <span className="font-semibold">{teamLineWords(line.role, assistant)}:</span> {line.text}
        </p>
      </div>
    );
  const ours = line.role === "assistant";
  return (
    <div className={clsx("flex flex-col", ours ? "items-start" : "items-end")}>
      <span className="px-1 pb-0.5 text-[11px] text-muted">{ours ? assistant : customer}</span>
      <p
        className={clsx(
          "max-w-[85%] rounded-2xl px-3 py-1.5 text-sm leading-snug",
          ours ? "bg-surface-2 text-ink" : "bg-primary text-white",
          saying && "opacity-60",
        )}
      >
        {line.text}
        {saying && "…"}
      </p>
    </div>
  );
}
