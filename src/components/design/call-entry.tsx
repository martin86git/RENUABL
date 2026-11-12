"use client";

import clsx from "clsx";
import { CalendarCheck, PhoneIncoming, PhoneMissed, PhoneOff } from "lucide-react";
import { readCallLine, type CallOutcome } from "@/lib/domain/voice-agent";
import { recordingOf } from "@/lib/domain/browser-call";
import { outcomeTone } from "@/lib/domain/design/call-log";
import { useCaller } from "@/lib/services/caller";
import { CallerAvatar } from "./settings-caller";

const ICON: Partial<Record<CallOutcome, typeof CalendarCheck>> = {
  booked: CalendarCheck,
  "no-answer": PhoneMissed,
  voicemail: PhoneMissed,
  failed: PhoneOff,
  "no-more-calls": PhoneOff,
};

/**
 * A call on a deal's record as it reads on the timeline (12 Nov 2026, Martin: a booked call didn't read as booked):
 * the phone assistant's calls lead with what they came to, the time in bold when one was booked, then the summary.
 * Calls the team logged read as they were written.
 */
export function CallEntryText({ text: whole }: { text: string }) {
  const recorded = recordingOf(whole);
  const text = recorded ? recorded.text : whole;
  const player = recorded && <CallRecording callId={recorded.callId} />;
  const read = readCallLine(text);
  if (!read)
    return (
      <>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">{text}</p>
        {player}
      </>
    );
  const tone = outcomeTone(read.outcome);
  const Icon = ICON[read.outcome] ?? PhoneIncoming;
  return (
    <div className="mt-2">
      <p
        className={clsx(
          "inline-flex max-w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm",
          tone === "good"
            ? "bg-positive-soft text-positive"
            : tone === "needs"
              ? "bg-warning-soft text-warning"
              : "bg-surface-2 text-ink-2",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="font-semibold">{read.headline}</span>
        {read.detail && <span className="font-semibold text-ink">{read.detail}</span>}
      </p>
      {read.rest && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{read.rest}</p>}
      {player}
    </div>
  );
}

/** A call made from the computer, played back on its deal (only for members who may see the deal). */
function CallRecording({ callId }: { callId: string }) {
  return (
    <audio
      controls
      preload="none"
      src={`/api/design/calls/browser/${callId}/recording`}
      className="mt-2 h-9 w-full max-w-sm"
      aria-label="The call's recording"
    />
  );
}

/** "Call by Ella", with the assistant's face when it's the business's phone assistant. */
export function CallEntryBy({ by }: { by: string }) {
  const caller = useCaller();
  const assistant = !by.includes("@") && by.trim().toLowerCase() === caller.name.toLowerCase();
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-2">
      by {assistant && <CallerAvatar caller={caller} size={18} />}
      {by.split("@")[0]}
      {assistant && <span className="text-xs text-muted">· phone assistant</span>}
    </span>
  );
}
