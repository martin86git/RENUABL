"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Mic, MicOff, NotebookPen, PhoneOff, X } from "lucide-react";
import { dismissCall, hangUp, toggleMute, useComputerCall, type ComputerCall } from "@/lib/services/computer-call";
import { CallNotetaker, type NotetakerHandle } from "./call-notetaker";

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The bar for a call made from the computer, at the foot of every page while it lasts (mounted once in the shell):
 * who, how long, Mute and Hang up; then how it ended, which is written on the deal by itself.
 *
 * **Note-taker** on it (26 Nov 2026, Martin: "making calls through the computer, i need to be able to activate the call
 * notetaker. i want a live transcript") opens the deal's call note-taker for this call, listening at once: Twilio
 * transcribes both sides as they talk, shown live, with Sol's points, End and write up, and Apply to the deal as on a
 * deal. While it is open the call's controls sit in its head, and it stays open after the call for the write-up.
 */
export function ComputerCallBar() {
  const now = useComputerCall();
  const [elapsed, setElapsed] = useState(0);
  const liveAt = now?.phase === "live" ? now.liveAt : null;
  useEffect(() => {
    if (!liveAt) return;
    const t = window.setInterval(() => setElapsed(Date.now() - liveAt), 1000);
    return () => {
      window.clearInterval(t);
      setElapsed(0);
    };
  }, [liveAt]);

  // The call the note-taker is for: kept after the call ends, so the write-up outlives the bar.
  const [noted, setNoted] = useState<{ jobId: string; callId: string; name: string } | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const notetaker = useRef<NotetakerHandle>(null);
  const opened = useRef(false);
  const onOpenChange = useCallback((on: boolean) => {
    setNotesOpen(on);
    if (on) opened.current = true;
    else if (opened.current) {
      opened.current = false;
      setNoted(null);
    }
  }, []);
  const openNotes = () => {
    if (!now?.callId) return;
    if (noted?.callId === now.callId) return void notetaker.current?.start({ listen: true });
    setNoted({ jobId: now.jobId, callId: now.callId, name: now.name });
  };
  // Started once its note-taker is on the page.
  useEffect(() => {
    if (noted && !opened.current) notetaker.current?.start({ listen: true });
  }, [noted]);

  if (typeof document === "undefined") return null;
  const ours = Boolean(now && noted && now.callId === noted.callId);
  const underWay = Boolean(now && now.phase !== "ended" && now.phase !== "failed");
  const controls = now && ours ? <CallControls now={now} elapsed={elapsed} compact /> : undefined;

  return (
    <>
      {noted && (
        <CallNotetaker
          key={noted.callId}
          jobId={noted.jobId}
          customerId=""
          button={false}
          handle={notetaker}
          onOpenChange={onOpenChange}
          call={{ callId: noted.callId, live: ours && underWay, name: noted.name, controls }}
        />
      )}
      {now &&
        !(notesOpen && ours) &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 bottom-20 z-[90] flex justify-center px-4 lg:bottom-6 print:hidden"
          >
            <div
              className={clsx(
                "flex max-w-full items-center gap-3 rounded-full py-2 pl-4 pr-2 text-sm shadow-lift ring-1",
                now.phase === "failed" ? "bg-surface text-danger ring-line" : "bg-primary text-white ring-white/10",
              )}
            >
              <CallControls now={now} elapsed={elapsed} onNotes={underWay && now.callId ? openNotes : undefined} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Who, the clock, Note-taker, Mute and Hang up (or Close once it has ended): in the bar, or in the note-taker's head. */
function CallControls({
  now,
  elapsed,
  onNotes,
  compact = false,
}: {
  now: ComputerCall;
  elapsed: number;
  onNotes?: () => void;
  compact?: boolean;
}) {
  const who = now.name || "the customer";
  const words =
    now.phase === "starting"
      ? `Calling ${who}…`
      : now.phase === "ringing"
        ? `Ringing ${who}…`
        : now.phase === "live"
          ? `On a call with ${who}`
          : now.phase === "ended"
            ? "Call ended. It's written on the deal."
            : now.message;
  const on = now.phase !== "ended" && now.phase !== "failed";
  return (
    <>
      {on && <span className="size-2 shrink-0 animate-pulse rounded-full bg-positive" aria-hidden />}
      <span className={clsx("min-w-0 truncate", compact && "text-xs text-white/80")}>{words}</span>
      {now.phase === "live" && now.liveAt && <span className="tabular-nums text-white/70">{clock(elapsed)}</span>}
      {on ? (
        <>
          {onNotes && (
            <button
              type="button"
              onClick={onNotes}
              title="Open the note-taker: both sides typed up live, then written up on the deal"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold hover:bg-white/20"
            >
              <NotebookPen className="size-4" aria-hidden /> Note-taker
            </button>
          )}
          <button
            type="button"
            onClick={toggleMute}
            disabled={now.phase !== "live"}
            aria-pressed={now.muted}
            aria-label={now.muted ? "Unmute" : "Mute"}
            title={now.muted ? "Unmute" : "Mute"}
            className={clsx(
              "grid shrink-0 place-items-center rounded-full disabled:opacity-40",
              compact ? "size-8" : "size-9",
              now.muted ? "bg-white text-ink" : "bg-white/10 hover:bg-white/20",
            )}
          >
            {now.muted ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={hangUp}
            aria-label="Hang up"
            title="Hang up"
            className={clsx(
              "grid shrink-0 place-items-center rounded-full bg-danger text-white hover:opacity-90",
              compact ? "size-8" : "size-9",
            )}
          >
            <PhoneOff className="size-4" aria-hidden />
          </button>
        </>
      ) : compact ? null : (
        <button
          type="button"
          onClick={dismissCall}
          aria-label="Close"
          className={clsx(
            "grid size-8 shrink-0 place-items-center rounded-full",
            now.phase === "failed" ? "text-muted hover:bg-surface-2" : "hover:bg-white/10",
          )}
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </>
  );
}
