"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { clockWords } from "@/lib/domain/live-call";
import { callInitials, railCallWords, railCalls } from "@/lib/domain/design/rail-calls";
import { setCallWall, useLiveCallsNow, useWatchedCall, watchAssistantCall, type LiveNowCall } from "@/lib/services/assistant-call";

const firstOf = (name: string) => name.trim().split(/\s+/)[0] || "Customer";

/**
 * Each call under way as a round on the rail, under the phone assistant's face (13 Nov 2026, Martin: especially when
 * several calls are under way, I need to see a representation of each one). One round a call with the customer's
 * initials: ringed and beating in the signal orange while they are talking, a quiet dashed ring while it rings; the
 * one whose live window is open is filled. A press opens that call's live window; past a few, "+N" opens them all side
 * by side. Nothing is shown while no call is under way.
 */
export function RailCalls() {
  const calls = useLiveCallsNow();
  const watched = useWatchedCall();
  const [now, setNow] = useState(() => Date.now());
  const any = calls.length > 0;
  useEffect(() => {
    if (!any) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [any]);
  if (!any) return null;
  const { shown, more } = railCalls(calls);
  const clockOf = (c: LiveNowCall) =>
    c.phase === "on-call" && c.startedAgo !== null ? clockWords(Math.max(0, now - (c.receivedAt - c.startedAgo))) : null;

  return (
    <ul aria-label="Calls under way" className="flex flex-col items-center gap-1.5">
      {shown.map((c) => {
        const on = c.phase === "on-call";
        const open = watched?.jobId === c.jobId;
        const words = railCallWords(c, clockOf(c));
        return (
          <li key={c.jobId} className="relative">
            {on && <span className="absolute inset-0 animate-ping rounded-full bg-sun-line/30 motion-reduce:animate-none" aria-hidden />}
            <button
              type="button"
              onClick={() => watchAssistantCall({ jobId: c.jobId, name: firstOf(c.customer), message: "" })}
              title={words}
              aria-label={`${words}. Open the call.`}
              aria-pressed={open}
              className={clsx(
                "relative grid size-9 place-items-center rounded-full text-[11px] font-semibold tracking-wide transition-colors",
                open ? "bg-sun-line text-white" : "bg-surface text-ink hover:bg-surface-2",
                on ? "ring-2 ring-sun-line" : "border border-dashed border-muted",
              )}
            >
              {callInitials(c.customer)}
            </button>
          </li>
        );
      })}
      {more > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setCallWall(true)}
            title={`${more} more calls under way: watch them all`}
            aria-label={`${more} more calls under way. Watch them all side by side.`}
            className="grid size-9 place-items-center rounded-full bg-primary text-[11px] font-semibold text-white"
          >
            +{more}
          </button>
        </li>
      )}
    </ul>
  );
}
