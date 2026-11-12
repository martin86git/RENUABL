"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Mic, MicOff, PhoneOff, X } from "lucide-react";
import { dismissCall, hangUp, toggleMute, useComputerCall } from "@/lib/services/computer-call";

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The bar for a call made from the computer, at the foot of every page while it lasts (mounted once in the shell):
 * who, how long, Mute and Hang up; then how it ended, which is written on the deal by itself.
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
  if (!now || typeof document === "undefined") return null;

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

  return createPortal(
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-20 z-[90] flex justify-center px-4 lg:bottom-6 print:hidden">
      <div
        className={clsx(
          "flex max-w-full items-center gap-3 rounded-full py-2 pl-4 pr-2 text-sm shadow-lift ring-1",
          now.phase === "failed" ? "bg-surface text-danger ring-line" : "bg-primary text-white ring-white/10",
        )}
      >
        {on && <span className="size-2 shrink-0 animate-pulse rounded-full bg-positive" aria-hidden />}
        <span className="min-w-0 truncate">{words}</span>
        {now.phase === "live" && now.liveAt && <span className="tabular-nums text-white/70">{clock(elapsed)}</span>}
        {on ? (
          <>
            <button
              type="button"
              onClick={toggleMute}
              disabled={now.phase !== "live"}
              aria-pressed={now.muted}
              aria-label={now.muted ? "Unmute" : "Mute"}
              title={now.muted ? "Unmute" : "Mute"}
              className={clsx(
                "grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-40",
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
              className="grid size-9 shrink-0 place-items-center rounded-full bg-danger text-white hover:opacity-90"
            >
              <PhoneOff className="size-4" aria-hidden />
            </button>
          </>
        ) : (
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
      </div>
    </div>,
    document.body,
  );
}
