"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import Link from "next/link";
import { ArrowUp, ArrowUpRight, ChevronDown, ChevronUp, MessageSquare, PhoneOff, PhoneOutgoing, X } from "lucide-react";
import { TEXT_MAX } from "@/lib/domain/design/contact-reach";
import { clockWords, joinRuns, phaseWords, TEAM_NOTE_MAX, teamLineWords, type LiveLine } from "@/lib/domain/live-call";
import { CALL_HEADLINES, TEAM_ASK_MAX } from "@/lib/domain/voice-agent";
import { endAssistantCall, stopWatching, tellAssistant, useLiveCall, useWatchedCall } from "@/lib/services/assistant-call";
import { askAssistantToCallBack, textCustomer, useCallerInfo, type CallerState } from "@/lib/services/caller";
import { openCoach } from "@/lib/services/coaching";
import { OtherCallsStrip } from "./live-calls";
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
  const assistants = useCallerInfo();
  const { call, loaded } = useLiveCall(watched?.jobId ?? null);
  // A booking call is the admin assistant's: its face and name, once the call (or the hand-over) says so.
  const caller = (call?.role ?? watched?.role) === "admin" ? assistants.admin : assistants.caller;
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
          <OtherCallsStrip jobId={watched.jobId} />
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
          {!call?.canSteer && phase !== "ended" && (
            <p className="border-t border-line px-4 py-2 text-[11px] text-muted">
              Words appear as they&apos;re said, transcribed by machine. Closing this leaves the call going.
            </p>
          )}
          <AfterCall
            key={watched.jobId}
            jobId={watched.jobId}
            customer={customer}
            caller={caller}
            ended={phase === "ended"}
            // Calling back and talking the call over are the sales assistant's, once it is set up.
            sales={call?.role !== "admin" && assistants.caller.named}
            callsOn={assistants.callsOn}
            textsOn={assistants.textsOn}
            transcriptId={call?.transcriptId ?? null}
          />
        </>
      )}
    </section>,
    document.body,
  );
}

const PILL =
  "tap-area inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-line hover:ring-sun-line";

/**
 * What to do from a call (13 Nov 2026, Martin: a finished call was only a log, "pointless"): open its deal at any
 * time, and once it is over, have the assistant ring back to ask or confirm the one thing it missed, text the
 * customer, or talk the call over with the assistant. A call back is lined up as any call is (calling hours, the
 * number on the record), with what to ask written on the deal; this window then follows that call.
 */
function AfterCall(p: {
  jobId: string;
  customer: string;
  caller: CallerState;
  ended: boolean;
  sales: boolean;
  callsOn: boolean;
  textsOn: boolean;
  transcriptId: string | null;
}) {
  const [doing, setDoing] = useState<"back" | "text" | null>(null);
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const name = p.caller.name;
  const pick = (d: "back" | "text") => {
    setDoing((now) => (now === d ? null : d));
    setWords("");
    setNote(null);
  };
  const send = async () => {
    const t = words.trim();
    if (!t || busy || !doing) return;
    setBusy(true);
    setNote(null);
    const res = doing === "back" ? await askAssistantToCallBack(p.jobId, t) : await textCustomer(p.jobId, t);
    setBusy(false);
    setNote({ ok: res.ok, text: res.message });
    if (!res.ok) return;
    setWords("");
    setDoing(null);
  };
  const off = doing === "back" ? !p.callsOn : doing === "text" ? !p.textsOn : false;
  return (
    <div className="border-t border-line px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {p.ended && p.sales && (
          <button
            type="button"
            onClick={() => pick("back")}
            aria-expanded={doing === "back"}
            className={clsx(PILL, doing === "back" ? "bg-sun" : "bg-surface")}
          >
            <PhoneOutgoing className="size-3.5" aria-hidden />
            Call back to ask
          </button>
        )}
        {p.ended && (
          <button
            type="button"
            onClick={() => pick("text")}
            aria-expanded={doing === "text"}
            className={clsx(PILL, doing === "text" ? "bg-sun" : "bg-surface")}
          >
            <MessageSquare className="size-3.5" aria-hidden />
            Text {p.customer}
          </button>
        )}
        {p.ended && p.sales && p.transcriptId && (
          <button
            type="button"
            onClick={() =>
              openCoach({
                jobId: p.jobId,
                transcriptId: p.transcriptId!,
                about: `The call with ${p.customer}, ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`,
              })
            }
            className={clsx(PILL, "bg-surface")}
          >
            <CallerAvatar caller={p.caller} size={16} />
            Talk it over with {name}
          </button>
        )}
        <Link href={`/design/deals/${encodeURIComponent(p.jobId)}`} className={clsx(PILL, "bg-surface-2")}>
          Open deal
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {doing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="mt-2"
        >
          <textarea
            value={words}
            onChange={(e) => setWords(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            autoFocus
            disabled={off}
            maxLength={doing === "back" ? TEAM_ASK_MAX : TEXT_MAX}
            placeholder={doing === "back" ? `What should ${name} ask or confirm?` : `Your text to ${p.customer}…`}
            aria-label={doing === "back" ? `What ${name} should ask on the call back` : `A text to ${p.customer}`}
            className="w-full resize-none rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink outline-none ring-1 ring-line placeholder:text-muted focus:ring-sun-line disabled:text-muted"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted">
              {off
                ? doing === "back"
                  ? "Calls from your phone assistant aren't switched on yet."
                  : "Texts aren't switched on yet."
                : doing === "back"
                  ? `${name} rings ${p.customer} back in calling hours, asks this and writes the answer on the deal.`
                  : "It goes as typed, to the mobile on their record. Replies aren't read here yet."}
            </p>
            <button
              type="submit"
              disabled={off || busy || !words.trim()}
              className="shrink-0 rounded-full bg-sun-line px-3.5 py-1.5 text-xs font-semibold text-white disabled:bg-line disabled:text-muted"
            >
              {busy ? "Sending…" : doing === "back" ? `Have ${name} call back` : "Send text"}
            </button>
          </div>
        </form>
      )}
      {note && <p className={clsx("pt-1.5 text-[11px]", note.ok ? "text-positive" : "text-danger")}>{note.text}</p>}
      {p.ended && !doing && !note && <p className="pt-1.5 text-[11px] text-muted">The call and its summary are on the deal.</p>}
    </div>
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

export function Bubble({ line, assistant, customer, saying }: { line: LiveLine; assistant: string; customer: string; saying?: boolean }) {
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
