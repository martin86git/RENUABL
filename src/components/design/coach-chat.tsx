"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { ArrowUp, Check, ChevronDown, Loader2, Pencil, PhoneCall, Trash2, Volume2, X } from "lucide-react";
import { COACH_COPY, type CoachNote, type CoachTurn } from "@/lib/domain/design/coaching";
import { callerChanged, ringMeToHear, uploadCallerPhoto, useCaller } from "@/lib/services/caller";
import {
  clearCoachCall,
  closeCoach,
  coachAssistant,
  loadCoaching,
  openCoach,
  removeNote,
  rewordNote,
  useCoachOpen,
} from "@/lib/services/coaching";
import { CallerAvatar } from "./settings-caller";

/**
 * The business's phone assistant on the rail (12 Nov 2026, Martin: the assistant should be reachable to talk to; Sol is
 * the built-in intelligence): its face, opening the window to coach it. Shown once it has been set up.
 */
export function CoachButton() {
  const caller = useCaller();
  if (!caller.named) return null;
  return (
    <button
      type="button"
      onClick={() => openCoach(null)}
      title={COACH_COPY.title(caller.name)}
      aria-label={COACH_COPY.title(caller.name)}
      className="relative grid size-10 place-items-center rounded-full ring-2 ring-transparent transition hover:ring-sun-line"
    >
      <CallerAvatar caller={caller} size={36} />
    </button>
  );
}

/**
 * Talk to <name> (12 Nov 2026, Martin: chat with the assistant and give it feedback on what it says and how): a
 * conversation with the assistant, which answers in its own voice and keeps what is asked as notes used on every call.
 * The notes can be read, reworded or taken away; what no note can change is listed. Opened about one call, that call is
 * given to it with the feedback. Over the page, bottom right; Escape closes it.
 */
export function CoachWindow() {
  const state = useCoachOpen();
  const caller = useCaller();
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [turns, setTurns] = useState<CoachTurn[]>([]);
  const [fixed, setFixed] = useState<string[]>([]);
  const [mayCoach, setMayCoach] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const isOpen = Boolean(state);

  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    void loadCoaching().then((res) => {
      if (!live) return;
      setLoaded(true);
      if (!res.ok) return setFailed(res.message);
      setNotes(res.notes);
      setTurns(res.turns);
      setFixed(res.fixed);
      setMayCoach(res.mayCoach);
    });
    const t = window.setTimeout(() => box.current?.focus(), 50);
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeCoach();
    window.addEventListener("keydown", key);
    return () => {
      live = false;
      window.clearTimeout(t);
      window.removeEventListener("keydown", key);
    };
  }, [isOpen]);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, sending, isOpen]);

  if (!state || typeof document === "undefined") return null;
  const name = caller.name;

  const send = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setFailed(null);
    const at = new Date().toISOString();
    setTurns((t) => [...t, { role: "you", text: message, at, ...(state.call ? { about: state.call.about } : {}) }]);
    setText("");
    const res = await coachAssistant(message, state.call);
    setSending(false);
    if (!res.ok) {
      setFailed(res.message);
      setTurns((t) => t.slice(0, -1));
      setText(message);
      return;
    }
    setTurns(res.turns);
    setNotes(res.notes);
    callerChanged(res.caller);
    clearCoachCall();
  };

  return createPortal(
    <section
      role="dialog"
      aria-label={COACH_COPY.title(name)}
      className="fixed bottom-20 right-4 z-[86] flex max-h-[min(40rem,calc(100dvh-7rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-surface shadow-lift ring-1 ring-line lg:bottom-6 lg:right-20 print:hidden"
    >
      <header className="flex items-center gap-3 bg-primary px-4 py-3 text-white">
        <AvatarEdit editable={mayCoach} onFailed={setFailed} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{COACH_COPY.title(name)}</p>
          <p className="truncate text-xs text-white/70">Your phone assistant · learns from what you tell it</p>
        </div>
        <HearButton />
        <button
          type="button"
          onClick={closeCoach}
          aria-label="Close"
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="border-b border-line">
        <button
          type="button"
          onClick={() => setShowNotes((s) => !s)}
          aria-expanded={showNotes}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-ink-2 hover:text-ink"
        >
          <span>
            <strong className="font-semibold text-ink">{notes.length}</strong> {notes.length === 1 ? "note" : "notes"} {name} uses on every
            call
          </span>
          <ChevronDown className={clsx("size-4 transition-transform", showNotes && "rotate-180")} aria-hidden />
        </button>
        {showNotes && (
          <div className="max-h-56 space-y-1.5 overflow-y-auto px-4 pb-3">
            {notes.length === 0 && <p className="text-xs text-muted">{COACH_COPY.empty(name)}</p>}
            {notes.map((n) => (
              <NoteRow key={n.id} note={n} editable={mayCoach} onNotes={setNotes} />
            ))}
            {fixed.length > 0 && (
              <div className="pt-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{COACH_COPY.fixedTitle}</p>
                <ul className="mt-1 space-y-0.5 text-xs text-ink-2">
                  {fixed.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={list} className="min-h-40 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {loaded && turns.length === 0 && (
          <div className="flex items-start gap-2">
            <CallerAvatar caller={caller} size={28} />
            <p className="rounded-2xl bg-surface-2 px-3 py-2 text-sm leading-snug text-ink">{COACH_COPY.hello(name)}</p>
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "you" ? (
            <div key={i} className="flex flex-col items-end">
              {t.about && (
                <span className="mb-0.5 inline-flex items-center gap-1 text-[11px] text-muted">
                  <PhoneCall className="size-3" aria-hidden />
                  {t.about}
                </span>
              )}
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-sm leading-snug text-white">{t.text}</p>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              <CallerAvatar caller={caller} size={28} />
              <div className="min-w-0 max-w-[85%]">
                <p className="whitespace-pre-wrap rounded-2xl bg-surface-2 px-3 py-2 text-sm leading-snug text-ink">{t.text}</p>
                <Changes changes={t.changes} />
              </div>
            </div>
          ),
        )}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <CallerAvatar caller={caller} size={28} />
            <span className="animate-pulse">{name} is thinking about it…</span>
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        {state.call && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-ink-2">
            <PhoneCall className="size-3.5 text-sun-line" aria-hidden />
            About {state.call.about.replace(/^A /, "a ")}
            <button type="button" onClick={clearCoachCall} className="ml-auto text-muted hover:text-ink" aria-label="Not about this call">
              <X className="size-3.5" aria-hidden />
            </button>
          </p>
        )}
        {failed && <p className="mb-2 text-xs text-danger">{failed}</p>}
        {mayCoach ? (
          <div className="flex items-end gap-2">
            <textarea
              ref={box}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder={state.call ? COACH_COPY.callAbout(name) : `Tell ${name} what to change…`}
              className="min-h-11 flex-1 resize-none rounded-2xl bg-canvas px-3 py-2 text-sm text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-sun-line"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!text.trim() || sending}
              aria-label="Send"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white disabled:bg-surface-2 disabled:text-muted"
            >
              <ArrowUp className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          loaded && <p className="text-xs text-muted">{`Only an admin can coach ${name}. You can read the notes above.`}</p>
        )}
      </div>
    </section>,
    document.body,
  );
}

/**
 * The assistant's face at the top of its chat (13 Nov 2026, Martin: hover it for a pencil and change the picture there,
 * not in Settings). For an admin, pressing it picks a new picture, sent as Settings sends it (`uploadCallerPhoto`:
 * checked by its own bytes and redrawn on the server).
 */
function AvatarEdit({ editable, onFailed }: { editable: boolean; onFailed: (m: string | null) => void }) {
  const caller = useCaller();
  const pick = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!editable) return <CallerAvatar caller={caller} size={44} className="ring-2 ring-white/20" />;
  const chosen = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    onFailed(null);
    const res = await uploadCallerPhoto(file);
    setBusy(false);
    if (!res.ok) onFailed(res.message);
  };
  return (
    <button
      type="button"
      onClick={() => pick.current?.click()}
      disabled={busy}
      aria-label={`Change ${caller.name}'s picture`}
      title={`Change ${caller.name}'s picture`}
      className="group relative shrink-0 rounded-full"
    >
      <CallerAvatar caller={caller} size={44} className="ring-2 ring-white/20" />
      <span
        className={clsx(
          "absolute inset-0 grid place-items-center rounded-full bg-ink/60 text-white transition-opacity",
          busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
        aria-hidden
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
      </span>
      <input
        ref={pick}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void chosen(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </button>
  );
}

/** Ring the member's own mobile to hear the assistant's voice, from its chat (after changing it there). */
function HearButton() {
  const caller = useCaller();
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ring = async () => {
    setBusy(true);
    const res = await ringMeToHear();
    setBusy(false);
    setSaid(res.ok ? "Ringing your mobile now" : res.message);
    window.setTimeout(() => setSaid(null), 6000);
  };
  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={() => void ring()}
        disabled={busy}
        aria-label={`Ring me to hear ${caller.name}`}
        title={`Ring me to hear ${caller.name}`}
        className="grid size-8 place-items-center rounded-full hover:bg-white/10 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
      </button>
      {said && (
        <span className="absolute right-0 top-10 z-10 w-48 rounded-lg bg-surface px-3 py-2 text-xs text-ink shadow-lift ring-1 ring-line">
          {said}
        </span>
      )}
    </span>
  );
}

function Changes({ changes }: { changes?: CoachTurn["changes"] }) {
  if (!changes) return null;
  const rows = [
    ...changes.added.map((t) => ({ t, word: "Added" })),
    ...changes.changed.map((t) => ({ t, word: "Changed" })),
    ...changes.removed.map((t) => ({ t, word: "Removed" })),
    ...(changes.settings ?? []).map((t) => ({ t, word: t.startsWith("Name not changed") ? "Not done" : "Updated" })),
  ];
  if (!rows.length) return null;
  return (
    <ul className="mt-1.5 space-y-1">
      {rows.map((r, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs">
          <span
            className={clsx(
              "shrink-0 rounded px-1.5 py-0.5 font-medium",
              r.word === "Removed"
                ? "bg-surface-2 text-muted line-through"
                : r.word === "Not done"
                  ? "bg-warning-soft text-warning"
                  : "bg-positive-soft text-positive",
            )}
          >
            {r.word}
          </span>
          <span className={clsx("pt-0.5", r.word === "Removed" ? "text-muted line-through" : "text-ink-2")}>{r.t}</span>
        </li>
      ))}
    </ul>
  );
}

function NoteRow({ note, editable, onNotes }: { note: CoachNote; editable: boolean; onNotes: (n: CoachNote[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const res = await rewordNote(note.id, text);
    setBusy(false);
    if (res.ok) {
      onNotes(res.notes);
      setEditing(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    const res = await removeNote(note.id);
    setBusy(false);
    if (res.ok) onNotes(res.notes);
  };
  if (editing)
    return (
      <div className="flex items-center gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void save()}
          maxLength={240}
          autoFocus
          className="min-w-0 flex-1 rounded-lg bg-canvas px-2 py-1 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-sun-line"
        />
        <button type="button" onClick={() => void save()} disabled={busy} aria-label="Save" className="text-positive">
          <Check className="size-4" aria-hidden />
        </button>
      </div>
    );
  return (
    <div className="group flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-surface-2">
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sun-line" aria-hidden />
      <span className="flex-1">{note.text}</span>
      {editable && (
        <span className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <button type="button" onClick={() => setEditing(true)} aria-label="Reword this note" className="text-muted hover:text-ink">
            <Pencil className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            aria-label="Take this note away"
            className="text-muted hover:text-danger"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </span>
      )}
    </div>
  );
}
