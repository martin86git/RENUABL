"use client";

import clsx from "clsx";
import { Check, Loader2, Mic, NotebookPen, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MIN_WORDS, wordsIn, type CallNotes, type HeardLine } from "@/lib/domain/design/call-notes";
import { MAX_REMIND_DAYS, type DetailChange } from "@/lib/domain/design/prepared";
import { writeUpCall } from "@/lib/services/crm";
import { PREPARED_CHANGED, applyCall } from "@/lib/services/prepared";
import { SolIcon } from "./sol-icon";
import { recognitionClass, useSpeechSupported, type Recognition } from "./speech";

const stamp = () => new Date().toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Melbourne" });

/**
 * The call note-taker on a deal (1 Nov 2026, Martin: Primero's copied across, wave 7). "Note-taker" switches the
 * computer's microphone on for a call taken on the phone: the browser's own speech recognition turns the member's side
 * into words in the page (Chrome and Edge send the sound to Google or Microsoft for that; nothing is recorded or kept).
 * A dark bar at the foot shows what is heard, with Add a note (what is said until Note done is marked as a note), a
 * box to type one, and End and write up: Claude distils it, the member checks the notes and adds them to the deal.
 */
export function CallNotetaker({ jobId, onAdded }: { jobId: string; customerId: string; onAdded?: () => void }) {
  const supported = useSpeechSupported();
  const [on, setOn] = useState(false);
  const [lines, setLines] = useState<HeardLine[]>([]);
  const [hearing, setHearing] = useState("");
  const [noting, setNoting] = useState<"" | "general" | "design">("");
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<"listening" | "writing" | "ready" | "saved">("listening");
  const [notes, setNotes] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  // What Sol found beside the notes (prepared.ts): the deal's fields to fill in, a reminder, a recap email.
  const [found, setFound] = useState<{ notes: CallNotes; changes: DetailChange[] } | null>(null);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [remindOn, setRemindOn] = useState(false);
  const [remindDays, setRemindDays] = useState(2);
  const [recapOn, setRecapOn] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const rec = useRef<Recognition | null>(null);
  const live = useRef(false);
  const notingRef = useRef(noting);
  useEffect(() => {
    notingRef.current = noting;
  }, [noting]);

  const listen = () => {
    const R = recognitionClass();
    if (!R) return;
    const r = new R();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-AU";
    r.onresult = (e) => {
      let now = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0].transcript.trim();
        if (res.isFinal && text) {
          const n = notingRef.current;
          setLines((all) => [...all, { at: stamp(), text, ...(n ? { note: true } : {}), ...(n === "design" ? { design: true } : {}) }]);
        } else now += ` ${text}`;
      }
      setHearing(now.trim());
    };
    // Recognition stops itself after a pause: start it again while the call is on.
    r.onend = () => {
      if (live.current) {
        try {
          r.start();
        } catch {
          // Already starting.
        }
      }
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        live.current = false;
        setProblem("The microphone isn't allowed for this page. Allow it in the browser's address bar and start again.");
      }
    };
    rec.current = r;
    live.current = true;
    r.start();
  };
  const stopListening = () => {
    live.current = false;
    rec.current?.stop();
    rec.current = null;
    setHearing("");
  };
  useEffect(() => () => stopListening(), []);

  const start = () => {
    setLines([]);
    setNotes("");
    setProblem(null);
    setState("listening");
    setOn(true);
    listen();
  };
  const close = () => {
    stopListening();
    setOn(false);
  };
  const addTyped = () => {
    if (!typed.trim()) return;
    setLines((all) => [...all, { at: stamp(), text: typed.trim(), note: true, ...(noting === "design" ? { design: true } : {}) }]);
    setTyped("");
  };
  const writeUp = async () => {
    stopListening();
    setState("writing");
    const res = await writeUpCall(jobId, lines);
    if (!res.ok) {
      setProblem(res.message);
      setState("listening");
      return;
    }
    setNotes(res.text);
    setFound({ notes: res.notes, changes: res.changes ?? [] });
    setTicks(Object.fromEntries((res.changes ?? []).map((c) => [c.key, c.tick])));
    setRemindOn(res.notes.followUpDays > 0);
    setRemindDays(res.notes.followUpDays > 0 ? Math.min(MAX_REMIND_DAYS, res.notes.followUpDays) : 2);
    setRecapOn(Boolean(res.notes.recap.subject && res.notes.recap.body));
    setState("ready");
  };
  const save = async () => {
    setProblem(null);
    const details = Object.fromEntries((found?.changes ?? []).filter((c) => ticks[c.key]).map((c) => [c.key, c.value]));
    const recap = found && recapOn && found.notes.recap.subject && found.notes.recap.body ? found.notes.recap : null;
    const res = await applyCall(jobId, {
      text: notes.trim().slice(0, 4000),
      details,
      remindDays: remindOn ? remindDays : 0,
      nextStep: found?.notes.nextStep ?? "",
      recap,
    });
    if (!res.ok) return setProblem(res.message);
    setDone(res.done);
    setState("saved");
    if (recap) window.dispatchEvent(new Event(PREPARED_CHANGED));
    onAdded?.();
  };

  const words = wordsIn(lines);
  return (
    <>
      <button
        type="button"
        onClick={on ? close : start}
        disabled={!supported}
        title={
          supported
            ? "Listen to your side of a call on your phone, and write it up"
            : "This browser can't turn speech into words: use Chrome or Edge"
        }
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink hover:border-forest disabled:bg-surface-2 disabled:text-muted"
      >
        <NotebookPen className="size-4" aria-hidden /> {on ? "Note-taker on" : "Note-taker"}
      </button>
      {on &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="theme-studio fixed inset-x-3 bottom-3 z-[55] mx-auto max-w-3xl rounded-2xl bg-primary p-4 text-white shadow-lift sm:inset-x-6">
            <div className="flex items-center gap-2">
              {state === "listening" ? (
                <span className="relative flex size-2.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-sun-line/60 motion-reduce:hidden" />
                  <span className="relative size-2.5 rounded-full bg-sun-line" />
                </span>
              ) : (
                <Mic className="size-4 text-white/60" aria-hidden />
              )}
              <p className="flex-1 text-sm font-medium">
                {state === "listening"
                  ? `Listening · ${words} ${words === 1 ? "word" : "words"}`
                  : state === "writing"
                    ? "Writing up…"
                    : state === "ready"
                      ? "Check the notes, then add them to the deal"
                      : "Added to the deal"}
              </p>
              <button
                type="button"
                onClick={close}
                aria-label="Close the note-taker"
                className="flex size-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {state === "listening" && (
              <>
                <p className="mt-1 text-xs text-white/60">
                  Take the call on your phone, to your ear or on a headset, never on speaker: this hears your side only. Nothing is
                  recorded.
                </p>
                <div className="mt-3 max-h-28 overflow-y-auto rounded-lg bg-white/5 px-3 py-2 text-sm text-white/85">
                  {lines.slice(-6).map((l, i) => (
                    <p key={i} className={clsx(l.note && "text-sun-line")}>
                      {l.note ? (l.design ? "Design note: " : "Note: ") : ""}
                      {l.text}
                    </p>
                  ))}
                  {hearing && <p className="text-white/50">{hearing}</p>}
                  {!lines.length && !hearing && <p className="text-white/50">Nothing heard yet.</p>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(["general", "design"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setNoting(noting === k ? "" : k)}
                      className={clsx(
                        "h-8 rounded-md px-3 text-xs font-medium",
                        noting === k ? "bg-sun-line text-white" : "bg-white/10 text-white hover:bg-white/15",
                      )}
                    >
                      {noting === k ? "Note done" : k === "general" ? "Add a note" : "Add a design note"}
                    </button>
                  ))}
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTyped()}
                    placeholder="Or type a note, then Enter"
                    className="h-8 min-w-0 flex-1 rounded-md bg-white/10 px-2.5 text-sm text-white placeholder:text-white/40 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void writeUp()}
                    disabled={words < MIN_WORDS}
                    title={words < MIN_WORDS ? "Not enough heard yet" : "End the call and write up the notes"}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-xs font-medium text-ink disabled:bg-white/20 disabled:text-white/50"
                  >
                    <Square className="size-3" aria-hidden /> End and write up
                  </button>
                </div>
              </>
            )}
            {state === "writing" && (
              <p className="mt-3 flex items-center gap-2 text-sm text-white/70">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Sol is distilling the call into notes.
              </p>
            )}
            {state === "ready" && (
              <>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-3 block max-h-[45dvh] min-h-48 w-full rounded-lg bg-white px-3 py-2 text-sm text-ink outline-none"
                />
                {found && (
                  <SolFound
                    found={found}
                    ticks={ticks}
                    setTicks={setTicks}
                    remind={{ on: remindOn, setOn: setRemindOn, days: remindDays, setDays: setRemindDays }}
                    recap={{ on: recapOn, setOn: setRecapOn, open: recapOpen, setOpen: setRecapOpen }}
                  />
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={close} className="h-9 rounded-md px-3 text-sm text-white/80 hover:bg-white/10">
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={!notes.trim()}
                    className="h-9 rounded-md bg-sun-line px-4 text-sm font-medium text-white"
                  >
                    {applyLabel(found, ticks, remindOn, recapOn)}
                  </button>
                </div>
              </>
            )}
            {state === "saved" && (
              <ul className="mt-2 space-y-0.5 text-sm text-white/80">
                {(done.length ? done : ["The notes are on the deal's record as a call."]).map((d) => (
                  <li key={d} className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-sun-line" aria-hidden /> {d}
                  </li>
                ))}
              </ul>
            )}
            {problem && (
              <p className="mt-2 text-sm text-sun-line" role="alert">
                {problem}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

/** "Apply all" when Sol found more than the notes; else the plain words. */
function applyLabel(found: { changes: DetailChange[] } | null, ticks: Record<string, boolean>, remind: boolean, recap: boolean) {
  const more = (found?.changes.some((c) => ticks[c.key]) ?? false) || remind || recap;
  return more ? "Apply all to the deal" : "Add to the deal as a note";
}

/**
 * What Sol found in the call beside the notes (1 Nov 2026, Martin: the admin after a call in one press): the deal's
 * fields it fills in (ticked only where nothing was typed, so nothing a person wrote is replaced unasked), a reminder
 * to follow up when they said they would, and a recap email that waits in Ready for you to be checked and sent.
 */
function SolFound(props: {
  found: { notes: CallNotes; changes: DetailChange[] };
  ticks: Record<string, boolean>;
  setTicks: (t: Record<string, boolean>) => void;
  remind: { on: boolean; setOn: (b: boolean) => void; days: number; setDays: (n: number) => void };
  recap: { on: boolean; setOn: (b: boolean) => void; open: boolean; setOpen: (b: boolean) => void };
}) {
  const { notes, changes } = props.found;
  const hasRecap = Boolean(notes.recap.subject && notes.recap.body);
  const box = "mt-0.5 size-4 shrink-0 accent-[var(--sun-line)]";
  return (
    <div className="mt-3 rounded-lg bg-white/5 px-3 py-2.5 text-sm">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
        <SolIcon className="size-3.5 text-sun-line" aria-hidden /> Sol also found
      </p>
      {changes.length > 0 && (
        <fieldset className="mt-2">
          <legend className="text-xs text-white/60">Fill in on the deal</legend>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            {changes.map((c) => (
              <label key={c.key} className="flex items-start gap-2 text-white/90">
                <input
                  type="checkbox"
                  className={box}
                  checked={Boolean(props.ticks[c.key])}
                  onChange={(e) => props.setTicks({ ...props.ticks, [c.key]: e.target.checked })}
                />
                <span>
                  {c.label}: <span className="font-medium text-white">{c.value}</span>
                  {c.was && <span className="block text-xs text-white/50">Replaces &ldquo;{c.was}&rdquo;</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="mt-2 flex flex-wrap items-center gap-2 text-white/90">
        <input type="checkbox" className={box} checked={props.remind.on} onChange={(e) => props.remind.setOn(e.target.checked)} />
        <span>Remind me to follow up</span>
        <select
          value={props.remind.days}
          onChange={(e) => {
            props.remind.setDays(Number(e.target.value));
            props.remind.setOn(true);
          }}
          aria-label="When"
          className="h-7 rounded-md bg-white/10 px-1.5 text-xs text-white outline-none"
        >
          {[1, 2, 3, 5, 10].map((d) => (
            <option key={d} value={d} className="text-ink">
              {d === 1 ? "tomorrow" : `in ${d} working days`}
            </option>
          ))}
        </select>
        {notes.nextStep && <span className="basis-full pl-6 text-xs text-white/50">{notes.nextStep}</span>}
      </label>
      {hasRecap && (
        <div className="mt-2">
          <label className="flex items-start gap-2 text-white/90">
            <input type="checkbox" className={box} checked={props.recap.on} onChange={(e) => props.recap.setOn(e.target.checked)} />
            <span>
              A recap email to the customer, waiting in Ready for you to check and send
              <button
                type="button"
                onClick={() => props.recap.setOpen(!props.recap.open)}
                className="ml-2 text-xs text-sun-line underline-offset-2 hover:underline"
              >
                {props.recap.open ? "Hide" : "Read it"}
              </button>
            </span>
          </label>
          {props.recap.open && (
            <div className="mt-1.5 max-h-48 overflow-y-auto rounded-md bg-white px-3 py-2 text-[13px] text-ink">
              <p className="font-medium">{notes.recap.subject}</p>
              <p className="mt-1 whitespace-pre-line text-ink-2">{notes.recap.body}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
