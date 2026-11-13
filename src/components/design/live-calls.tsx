"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { ChevronDown, LayoutGrid, Maximize2, X } from "lucide-react";
import { clockWords, joinRuns, liveNowWords, phaseWords, WALL_MAX, type LiveLine } from "@/lib/domain/live-call";
import { CALL_HEADLINES } from "@/lib/domain/voice-agent";
import {
  setCallWall,
  useCallWall,
  useLiveCall,
  useLiveCallsNow,
  useWatchedCall,
  watchAssistantCall,
  type LiveNowCall,
} from "@/lib/services/assistant-call";
import { useCaller } from "@/lib/services/caller";
import { Bubble } from "./assistant-call";
import { CallerAvatar } from "./settings-caller";

/**
 * Every call the phone assistant has under way, on every page (13 Nov 2026, Martin: if it is calling several customers
 * at once I want to know about them, and to open one, or all of them, and see the calls live). A pill at the bottom
 * right while any call is ringing or on: it opens the list (who, how long, the last thing said); a call in the list
 * opens its live window, and "Watch them all" opens the wall, each call's conversation side by side. While a call's
 * window is open the pill gives way to it, and the window says how many other calls are live.
 */
export function LiveCallsTray() {
  const calls = useLiveCallsNow();
  const watched = useWatchedCall();
  const wall = useCallWall();
  const caller = useCaller();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const now = useTick(calls.length > 0);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  if (typeof document === "undefined") return null;
  if (wall) return createPortal(<CallWall calls={calls} />, document.body);
  if (calls.length === 0 || watched) return null;

  const onCall = calls.some((c) => c.phase === "on-call");
  return createPortal(
    <div ref={box} className="fixed bottom-20 right-4 z-[84] w-[min(21rem,calc(100vw-2rem))] lg:bottom-6 lg:right-6 print:hidden">
      {open && (
        <section aria-label="Calls under way" className="mb-2 overflow-hidden rounded-2xl bg-surface shadow-lift ring-1 ring-line">
          <ul className="max-h-[min(22rem,50dvh)] divide-y divide-line overflow-y-auto">
            {calls.map((c) => (
              <li key={c.jobId}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    watch(c);
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2"
                >
                  <LiveDot on={c.phase === "on-call"} className="mt-1.5" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{c.customer || "A customer"}</span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-sun-line">{clockOf(c, now) ?? "Ringing…"}</span>
                    </span>
                    <span className="block truncate text-xs text-muted">{c.deal}</span>
                    {c.last && (
                      <span className="mt-0.5 block truncate text-xs text-ink/70">
                        {c.last.role === "assistant" ? c.by : firstOf(c.customer)}: {c.last.text}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {calls.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCallWall(true);
              }}
              className="flex w-full items-center justify-center gap-2 border-t border-line bg-surface-2 py-2.5 text-sm font-semibold text-ink hover:bg-line/40"
            >
              <LayoutGrid className="size-4" aria-hidden />
              Watch them all
            </button>
          )}
        </section>
      )}
      <button
        type="button"
        onClick={() => (calls.length === 1 ? watch(calls[0]) : setOpen((o) => !o))}
        aria-expanded={calls.length > 1 ? open : undefined}
        className={clsx(
          "ml-auto flex items-center gap-2.5 rounded-full bg-primary py-1.5 pl-1.5 pr-4 text-sm font-semibold text-white shadow-lift",
          onCall ? "ring-2 ring-sun-line" : "ring-1 ring-white/10",
        )}
      >
        <span className="relative shrink-0">
          <span className="absolute -inset-0.5 animate-ping rounded-full bg-positive/40 motion-reduce:animate-none" aria-hidden />
          <CallerAvatar caller={caller} size={32} className="relative ring-2 ring-white/20" />
        </span>
        <span className="truncate">{liveNowWords(calls)}</span>
        {calls.length === 1 ? (
          <span className="tabular-nums text-sun-bright">{clockOf(calls[0], now) ?? ""}</span>
        ) : (
          <ChevronDown className={clsx("size-4 transition-transform", !open && "rotate-180")} aria-hidden />
        )}
      </button>
    </div>,
    document.body,
  );
}

/** In a call's own window: how many other calls are live, and the way to them all. */
export function OtherCallsStrip({ jobId }: { jobId: string }) {
  const calls = useLiveCallsNow();
  const others = calls.filter((c) => c.jobId !== jobId);
  if (others.length === 0) return null;
  return (
    <div className="flex items-center gap-2 border-b border-line bg-sun px-4 py-1.5 text-xs text-sun-ink">
      <LiveDot on />
      <span className="min-w-0 flex-1 truncate">
        {others.length === 1 ? `Also live: ${others[0].customer || "another call"}` : `${others.length} other calls live`}
      </span>
      {others.length === 1 && (
        <button type="button" onClick={() => watch(others[0])} className="shrink-0 font-semibold underline underline-offset-2">
          Switch
        </button>
      )}
      <button type="button" onClick={() => setCallWall(true)} className="shrink-0 font-semibold underline underline-offset-2">
        Watch them all
      </button>
    </div>
  );
}

const firstOf = (name: string) => name.trim().split(/\s+/)[0] || "Customer";
const watch = (c: LiveNowCall) => watchAssistantCall({ jobId: c.jobId, name: firstOf(c.customer), message: "" });
const clockOf = (c: LiveNowCall, now: number) =>
  c.phase === "on-call" && c.startedAgo !== null ? clockWords(Math.max(0, now - (c.receivedAt - c.startedAgo))) : null;

/** This computer's clock, each second while `on`, for the calls' timers. */
function useTick(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [on]);
  return now;
}

function LiveDot({ on, className }: { on: boolean; className?: string }) {
  return (
    <span className={clsx("relative flex size-2 shrink-0", className)} aria-hidden>
      {on && <span className="absolute inset-0 animate-ping rounded-full bg-sun-line/70 motion-reduce:animate-none" />}
      <span className={clsx("relative size-2 rounded-full", on ? "bg-sun-line" : "bg-muted")} />
    </span>
  );
}

/**
 * The wall: every live call's conversation side by side, over the page. A call that ends while the wall is open stays,
 * showing how it ended, until the wall is closed. A panel's Open button takes that call to its own window, where the
 * assistant can be told something or the call ended.
 */
function CallWall({ calls }: { calls: readonly LiveNowCall[] }) {
  const caller = useCaller();
  // Calls seen since the wall opened, in the order they came, so one that ends doesn't vanish mid-read.
  const [held, setHeld] = useState<{ jobId: string; customer: string; deal: string }[]>([]);
  const fresh = calls.filter((c) => !held.some((h) => h.jobId === c.jobId));
  if (fresh.length) setHeld([...held, ...fresh.map((c) => ({ jobId: c.jobId, customer: c.customer, deal: c.deal }))]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && setCallWall(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const shown = held.slice(0, WALL_MAX);
  const more = held.length - shown.length;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live calls"
      className="theme-studio fixed inset-0 z-[95] flex flex-col bg-ink/60 p-3 backdrop-blur-sm sm:p-6 print:hidden"
      onPointerDown={(e) => e.target === e.currentTarget && setCallWall(false)}
    >
      <header className="mx-auto flex w-full max-w-[88rem] items-center gap-3 pb-3 text-white">
        <CallerAvatar caller={caller} size={36} className="ring-2 ring-white/20" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">Live calls</p>
          <p className="truncate text-xs text-white/70">
            {calls.length === 0 ? "No calls right now" : calls.length === 1 ? "1 call under way" : `${calls.length} calls under way`}
            {more > 0 && ` · showing ${WALL_MAX}, ${more} more in the list`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCallWall(false)}
          aria-label="Close (the calls carry on)"
          title="Close (the calls carry on)"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>
      <div
        className="mx-auto grid min-h-0 w-full max-w-[88rem] flex-1 auto-rows-fr gap-3 overflow-y-auto"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(19rem, 100%), 1fr))" }}
        onPointerDown={(e) => e.target === e.currentTarget && setCallWall(false)}
      >
        {shown.length === 0 ? (
          <p className="place-self-center rounded-2xl bg-surface px-6 py-4 text-sm text-muted">No calls right now.</p>
        ) : (
          shown.map((h) => <WallPanel key={h.jobId} {...h} assistant={caller.name} />)
        )}
      </div>
    </div>
  );
}

function WallPanel({ jobId, customer, deal, assistant }: { jobId: string; customer: string; deal: string; assistant: string }) {
  const { call, loaded } = useLiveCall(jobId);
  const list = useRef<HTMLDivElement>(null);
  const phase = call?.phase ?? "ringing";
  const onCall = phase === "on-call";
  const now = useTick(onCall);
  const first = call?.customer || firstOf(customer);

  const lines: LiveLine[] = call ? joinRuns(call.lines) : [];
  const said = lines.length + (call?.partial ? 1 : 0);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [said, call?.partial?.text]);

  const time =
    onCall && call && call.startedAgo !== null
      ? clockWords(Math.max(0, now - (call.receivedAt - call.startedAgo)))
      : phase === "ended" && call?.ranFor
        ? clockWords(call.ranFor)
        : null;
  const outcome = phase === "ended" && call?.outcome ? `${CALL_HEADLINES[call.outcome]}${call.booked ? ` · ${call.booked}` : ""}` : null;

  return (
    <section
      aria-label={`Call with ${customer || "a customer"}`}
      className={clsx(
        "flex min-h-[16rem] flex-col overflow-hidden rounded-2xl bg-surface shadow-lift",
        onCall ? "ring-2 ring-sun-line" : "ring-1 ring-line",
      )}
    >
      <header className="flex items-center gap-2.5 bg-primary px-3.5 py-2.5 text-white">
        <LiveDot on={onCall} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{customer || "A customer"}</p>
          <p className="truncate text-[11px] text-white/70">
            {deal} · {assistant} {phaseWords(phase, first)}
          </p>
        </div>
        {time && (
          <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", onCall ? "bg-sun-line" : "bg-white/10")}>
            {time}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setCallWall(false);
            watchAssistantCall({ jobId, name: first, message: "" });
          }}
          aria-label={`Open the call with ${customer || "this customer"} on its own`}
          title="Open on its own, to tell the assistant something or hang up"
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          <Maximize2 className="size-4" aria-hidden />
        </button>
      </header>
      {outcome && <p className="border-b border-line bg-surface-2 px-3.5 py-1.5 text-xs font-semibold text-ink">{outcome}</p>}
      <div ref={list} aria-live="off" className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-3">
        {said === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {!loaded
              ? "Opening the call…"
              : phase === "ringing"
                ? `Waiting for ${first} to answer…`
                : phase === "on-call"
                  ? "Listening…"
                  : "Nothing was said on this call."}
          </p>
        ) : (
          <>
            {lines.map((l, i) => (
              <Bubble key={i} line={l} assistant={assistant} customer={first} />
            ))}
            {call?.partial && <Bubble line={call.partial} assistant={assistant} customer={first} saying />}
          </>
        )}
      </div>
    </section>
  );
}
