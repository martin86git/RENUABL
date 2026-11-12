"use client";

import { useState } from "react";
import clsx from "clsx";
import { CalendarCheck, ChevronDown, FileText, PhoneIncoming, PhoneMissed, PhoneOff } from "lucide-react";
import { transcriptFor } from "@/lib/domain/call-transcript";
import type { LiveLine } from "@/lib/domain/live-call";
import { useCallTranscripts } from "@/lib/services/call-transcripts";
import { openCoach } from "@/lib/services/coaching";
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
 * Calls the team logged read as they were written. The call's transcript opens under it (12 Nov 2026, Martin) when the
 * deal has one for it: the phone assistant's calls and those made from the computer (`CallTranscriptToggle`).
 */
export function CallEntryText({ text: whole, jobId, at, by }: { text: string; jobId?: string; at?: string; by?: string }) {
  const recorded = recordingOf(whole);
  const text = recorded ? recorded.text : whole;
  const kind = recorded || text.startsWith("Called from the computer") ? "computer" : by && !by.includes("@") ? "assistant" : null;
  const player = (
    <>
      {recorded && <CallRecording callId={recorded.callId} />}
      {jobId && at && kind && <CallTranscriptToggle jobId={jobId} entry={{ text: whole, at }} kind={kind} by={by ?? ""} />}
    </>
  );
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

/** "Read the transcript" under a call on the timeline, opening to the conversation as bubbles. */
function CallTranscriptToggle(props: { jobId: string; entry: { text: string; at: string }; kind: "assistant" | "computer"; by: string }) {
  const list = useCallTranscripts(props.jobId);
  const caller = useCaller();
  const [open, setOpen] = useState(false);
  const found = transcriptFor(props.entry, props.kind, list);
  if (!found) return null;
  const ours = props.kind === "assistant" ? caller.name : "You";
  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="tap-area inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink-2 hover:text-ink"
      >
        <FileText className="size-3.5" aria-hidden />
        {open ? "Hide the transcript" : "Read the transcript"}
        <ChevronDown className={clsx("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="mt-2 max-h-96 space-y-2 overflow-y-auto rounded-xl bg-canvas p-3 ring-1 ring-line">
          {found.lines.map((l, i) => (
            <TranscriptLine key={i} line={l} ours={ours} />
          ))}
          <p className="pt-1 text-[11px] text-muted">Transcribed by machine, so a word may be misheard.</p>
          {props.kind === "assistant" && caller.named && (
            <button
              type="button"
              onClick={() =>
                openCoach({
                  jobId: props.jobId,
                  transcriptId: found.id,
                  about: `A call, ${new Date(found.at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`,
                })
              }
              className="tap-area mt-1 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink ring-1 ring-line hover:ring-sun-line"
            >
              <CallerAvatar caller={caller} size={18} />
              Tell {caller.name} about this call
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TranscriptLine({ line, ours }: { line: LiveLine; ours: string }) {
  const us = line.role !== "customer";
  return (
    <div className={clsx("flex flex-col", us ? "items-start" : "items-end")}>
      <span className="px-1 pb-0.5 text-[11px] text-muted">{us ? ours : "Customer"}</span>
      <p
        className={clsx("max-w-[85%] rounded-2xl px-3 py-1.5 text-sm leading-snug", us ? "bg-surface-2 text-ink" : "bg-primary text-white")}
      >
        {line.text}
      </p>
    </div>
  );
}
