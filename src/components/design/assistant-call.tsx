"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { clockWords, joinRuns, phaseWords, type LiveLine } from "@/lib/domain/live-call";
import { CALL_HEADLINES } from "@/lib/domain/voice-agent";
import { stopWatching, useLiveCall, useWatchedCall } from "@/lib/services/assistant-call";
import { useCaller } from "@/lib/services/caller";
import { CallerAvatar } from "./settings-caller";

/**
 * The window that opens when a call is handed to the phone assistant (12 Nov 2026, Martin): its face and name, where
 * the call stands, how long it has run, and what is being said as it is said. Bottom right of every page while a call
 * is watched (mounted once in the shell); closing it leaves the call going.
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
  const time = phase === "on-call" ? clockWords(elapsed) : phase === "ended" && call?.ranFor ? clockWords(call.ranFor) : null;
  const outcome = phase === "ended" && call?.outcome ? `${CALL_HEADLINES[call.outcome]}${call.booked ? ` · ${call.booked}` : ""}` : null;

  return createPortal(
    <section
      aria-label={`${caller.name}'s call`}
      className="fixed bottom-20 right-4 z-[85] w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-surface shadow-lift ring-1 ring-line lg:bottom-6 lg:right-6 print:hidden"
    >
      <header className="flex items-center gap-3 bg-primary px-4 py-3 text-white">
        <span className="relative shrink-0">
          {live && <span className="absolute -inset-1 animate-ping rounded-full bg-positive/40" aria-hidden />}
          <CallerAvatar caller={caller} size={44} className="relative ring-2 ring-white/20" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{caller.name}</p>
          <p className="truncate text-xs text-white/70">{phaseWords(phase, customer)}</p>
        </div>
        {time && (
          <span className={clsx("rounded-full px-2.5 py-1 text-sm tabular-nums", live ? "bg-positive text-white" : "bg-white/10")}>
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
          <p className="border-t border-line px-4 py-2 text-[11px] text-muted">
            {phase === "ended"
              ? "The call and its summary are on the deal."
              : "Words appear as they're said, transcribed by machine. Closing this leaves the call going."}
          </p>
        </>
      )}
    </section>,
    document.body,
  );
}

function Bubble({ line, assistant, customer, saying }: { line: LiveLine; assistant: string; customer: string; saying?: boolean }) {
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
