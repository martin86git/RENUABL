"use client";

/**
 * A meeting Sol put up (domain/design/sol-meeting.ts; 17 Nov 2026, Martin): nothing is booked until the member presses.
 * When what was asked differs from what the customer agreed, the card asks first whether to keep it; then the day and
 * time to confirm; once booked, the Meet link to press and the reminders to choose from. Drawn in a deal's team chat
 * and in Sol's own chat, on the colours of either.
 */
import { useEffect, useState } from "react";
import { CalendarCheck, Video } from "lucide-react";
import clsx from "clsx";
import { localParts, meetingWhen, remindChoices, remindLabel, type MeetingView } from "@/lib/domain/design/sol-meeting";
import { bookMeetingAt, leaveMeeting, loadMeeting, remindMeBefore } from "@/lib/services/meetings";

const BTN = "rounded-full px-3 py-1.5 text-[12.5px] font-medium transition disabled:opacity-50";
const MAIN = `${BTN} bg-primary text-primary-ink hover:brightness-110`;
const QUIET = `${BTN} ring-1 ring-line text-ink hover:bg-surface-2`;
const FIELD = "rounded-lg bg-surface px-2 py-1 text-[13px] text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-sun-line";

export function MeetingCard({ id }: { id: string }) {
  const [m, setM] = useState<MeetingView | null>(null);
  const [mine, setMine] = useState(false);
  const [gone, setGone] = useState(false);
  const [step, setStep] = useState<"ask" | "time">("ask");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadMeeting(id).then((got) => {
      if (!live) return;
      if (!got.ok) return setGone(true);
      setM(got.meeting);
      setMine(got.mine);
      const at = localParts(got.meeting.start);
      setDay(at.day);
      setTime(at.time);
      setStep(got.meeting.agreed ? "ask" : "time");
    });
    return () => {
      live = false;
    };
  }, [id]);

  if (gone || !m) return null;

  const act = async (run: () => ReturnType<typeof loadMeeting>) => {
    setBusy(true);
    setProblem(null);
    const got = await run();
    setBusy(false);
    if (!got.ok) return setProblem(got.message);
    setM(got.meeting);
  };

  const remind = remindChoices(m.start);
  return (
    <div className="mt-2 max-w-sm rounded-xl bg-surface-2 p-3 text-[13px] text-ink ring-1 ring-line">
      <p className="flex items-center gap-1.5 font-semibold">
        {m.state === "booked" ? (
          <CalendarCheck className="size-4 text-positive" aria-hidden />
        ) : (
          <Video className="size-4 text-sun-line" aria-hidden />
        )}
        {m.title}
      </p>

      {m.state === "booked" && (
        <>
          <p className="mt-1 text-ink-2">
            Booked · {meetingWhen(m.start)} · {m.minutes} min
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {m.meetLink && (
              <a
                href={m.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`${BTN} inline-flex items-center gap-1.5 bg-sun-line text-white hover:brightness-110`}
              >
                <Video className="size-3.5" aria-hidden /> Join Google Meet
              </a>
            )}
            {m.eventLink && (
              <a href={m.eventLink} target="_blank" rel="noopener noreferrer" className={QUIET}>
                Open in Calendar
              </a>
            )}
          </div>
          {m.meetLink && <p className="mt-1.5 break-all text-[11.5px] text-muted">{m.meetLink}</p>}
          {m.remind ? (
            <p className="mt-2 text-ink-2">I&apos;ll remind you {remindLabel(m.remind)} before, in our chat.</p>
          ) : mine && remind.length ? (
            <div className="mt-3">
              <p className="text-ink-2">Want a reminder before the call?</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {remind.map((x) => (
                  <button key={x} type="button" disabled={busy} className={QUIET} onClick={() => void act(() => remindMeBefore(m.id, x))}>
                    {remindLabel(x)} before
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {m.state === "dropped" && <p className="mt-1 text-muted">Not booked.</p>}

      {m.state === "asked" && !mine && (
        <p className="mt-1 text-ink-2">
          {meetingWhen(m.start)} · waiting for {m.forEmail} to book it.
        </p>
      )}

      {m.state === "asked" && mine && step === "ask" && m.agreed && (
        <>
          <p className="mt-1 text-ink-2">
            The customer agreed to {m.agreed}. Still book it for {meetingWhen(m.start)}?
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" className={MAIN} onClick={() => setStep("time")}>
              Yes, keep it
            </button>
            <button
              type="button"
              className={QUIET}
              onClick={() => {
                if (m.agreedDay) setDay(m.agreedDay);
                setStep("time");
              }}
            >
              No, change it
            </button>
          </div>
        </>
      )}

      {m.state === "asked" && mine && step === "time" && (
        <>
          <p className="mt-1 text-ink-2">
            Confirm the time. It goes in your Google Calendar{m.meet ? " with a Google Meet link" : ""}; nobody is invited.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input type="date" aria-label="Day" value={day} onChange={(e) => setDay(e.target.value)} className={FIELD} />
            <input type="time" aria-label="Time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className={FIELD} />
            <span className="text-muted">{m.minutes} min</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy || !day || !time}
              className={MAIN}
              onClick={() => void act(() => bookMeetingAt(m.id, day, time))}
            >
              {busy ? "Booking…" : "Book it"}
            </button>
            <button type="button" disabled={busy} className={QUIET} onClick={() => void act(() => leaveMeeting(m.id))}>
              Not now
            </button>
          </div>
        </>
      )}

      {problem && <p className={clsx("mt-2 text-[12px] text-warning")}>{problem}</p>}
    </div>
  );
}
