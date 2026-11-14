"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  LayoutList,
  Loader2,
  Minus,
  Pencil,
  Phone,
  PhoneCall,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useWatchedCall } from "@/lib/services/assistant-call";
import type { AssistantDeal } from "@/lib/domain/design/assistant-deals";
import { COACH_COPY, packetsOf, type CoachNote, type CoachTurn } from "@/lib/domain/design/coaching";
import { callerChanged, ringMeToHear, uploadCallerPhoto, useCaller, useCallerInfo } from "@/lib/services/caller";
import { voiceLabel } from "@/lib/domain/design/caller";
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
import { CallerAvatar, VoicePicker } from "./settings-caller";
import { ContactReach } from "./coach-contacts";
import { CoachDeals } from "./coach-deals";

/** The pause between one packet of an answer and the next. */
const PACKET_GAP_MS = 650;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** How far each packet steps across from the one before, and where the vine meets a bubble. */
const STEP = 22;
const ANCHOR = 18;

/**
 * An answer as packets climbing a beanstalk (13 Nov 2026, Martin: one point a bubble, appearing one after another, like
 * climbing a beanstalk with a link between them): each bubble steps across from the last in a gentle zig-zag, and a fine
 * vine with a leaf at its bend joins each to the next. While packets are still to come, three dots wait on the vine.
 */
function Beanstalk({ packets, shown, label }: { packets: string[]; shown: number; label: string }) {
  const x = (i: number) => (i % 2 ? STEP : 0);
  const visible = packets.slice(0, shown);
  const waiting = shown < packets.length;
  const vine = (i: number) => {
    const from = x(i - 1) + ANCHOR;
    const to = x(i) + ANCHOR;
    const mid = (from + to) / 2;
    return (
      <svg aria-hidden width={STEP + ANCHOR * 2} height={16} className="block text-line-strong" viewBox={`0 0 ${STEP + ANCHOR * 2} 16`}>
        <path d={`M ${from} 0 C ${from} 9, ${to} 7, ${to} 16`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        <ellipse
          cx={mid + (to > from ? 4 : -4)}
          cy={7}
          rx={3.2}
          ry={1.6}
          transform={`rotate(${to > from ? -30 : 30} ${mid} 7)`}
          className="fill-current"
        />
      </svg>
    );
  };
  return (
    <div aria-label={label}>
      {visible.map((p, i) => (
        <div key={i}>
          {i > 0 && vine(i)}
          <p
            style={{ marginLeft: x(i) }}
            className="w-fit max-w-[calc(100%-1.5rem)] whitespace-pre-wrap rounded-2xl bg-surface-2 px-3 py-2 text-sm leading-snug text-ink"
          >
            {p}
          </p>
        </div>
      ))}
      {waiting && (
        <div>
          {vine(visible.length)}
          <span
            style={{ marginLeft: x(visible.length) }}
            className="inline-flex gap-1 rounded-2xl bg-surface-2 px-3 py-2.5"
            aria-label="Typing"
          >
            {[0, 1, 2].map((d) => (
              <span key={d} className="size-1.5 animate-pulse rounded-full bg-ink-2" style={{ animationDelay: `${d * 150}ms` }} />
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

/** Whether the settings beside the chat were left open, kept on the device. */
const SETTINGS_KEY = "renuabl.design.coach-settings";
/** The deals pane beside the chat: open to start on a wide screen, then as the person left it on this device. */
const DEALS_KEY = "renuabl.design.coach-deals";
function readDealsOpen(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const kept = localStorage.getItem(DEALS_KEY);
    return kept === null ? window.innerWidth >= 1024 : kept === "1";
  } catch {
    return false;
  }
}
function readSettingsOpen(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(SETTINGS_KEY) === "1";
  } catch {
    return false;
  }
}

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
      className="relative -mx-1 grid size-12 place-items-center rounded-full shadow-[0_4px_14px_rgba(20,22,26,0.18)] ring-2 ring-transparent transition hover:ring-sun-line"
    >
      <CallerAvatar caller={caller} size={46} />
      {/* Someone to call or text through, not a page (13 Nov 2026, Martin: the two assistants got lost among the rail's icons). */}
      <span
        className="absolute -bottom-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full bg-sun-line text-white ring-2 ring-surface"
        aria-hidden
      >
        <Phone className="size-2.5" />
      </span>
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
  const [settings, setSettings] = useState(() => readSettingsOpen() && !readDealsOpen());
  // Its deals beside the chat (14 Nov 2026, Martin: split screen, the deals wider, pick one and talk about it).
  const [deals, setDeals] = useState(readDealsOpen);
  const [picked, setPicked] = useState<AssistantDeal | null>(null);
  // Folded to its header bar (13 Nov 2026, Martin: minimise it, so what is behind it can be reached).
  const [small, setSmall] = useState(false);
  // Searching a contact to call or text: the contacts take the chat's place (13 Nov 2026, Martin).
  const [reaching, setReaching] = useState(false);
  // The assistant's call window sits bottom right too: while one is open, this window stands beside it, not on it.
  const watching = useWatchedCall();
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  // The newest answer's packets come one after another (13 Nov 2026, Martin), none held back with reduced motion.
  const [reveal, setReveal] = useState<{ turn: number; shown: number; of: number } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const isOpen = Boolean(state);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- each open (a new state object) unfolds the window
  useEffect(() => setSmall(false), [state]);

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
    if (!reveal || reveal.shown >= reveal.of) return;
    const t = window.setTimeout(() => setReveal((r) => (r ? { ...r, shown: r.shown + 1 } : r)), PACKET_GAP_MS);
    return () => window.clearTimeout(t);
  }, [reveal]);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, sending, isOpen, reveal?.shown]);

  if (!state || typeof document === "undefined") return null;
  const name = caller.name;
  const keep = (key: string, open: boolean) => {
    try {
      localStorage.setItem(key, open ? "1" : "0");
    } catch {
      // Private window: it opens as it would the first time.
    }
  };
  // One pane beside the chat at a time: the deals or the settings.
  const toggleSettings = (open: boolean) => {
    setSettings(open);
    keep(SETTINGS_KEY, open);
    if (open && deals) toggleDeals(false);
  };
  const toggleDeals = (open: boolean) => {
    setDeals(open);
    keep(DEALS_KEY, open);
    if (open && settings) {
      setSettings(false);
      keep(SETTINGS_KEY, false);
    }
  };
  const about = state.call ? null : deals ? picked : null;
  const aboutFirst = about ? about.customer.split(" ")[0] || about.customer : "";

  const send = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setFailed(null);
    const at = new Date().toISOString();
    setTurns((t) => [
      ...t,
      { role: "you", text: message, at, ...(state.call ? { about: state.call.about } : about ? { about: `${aboutFirst}'s deal` } : {}) },
    ]);
    setText("");
    const res = await coachAssistant(message, state.call, about?.jobId ?? null);
    setSending(false);
    if (!res.ok) {
      setFailed(res.message);
      setTurns((t) => t.slice(0, -1));
      setText(message);
      return;
    }
    setTurns(res.turns);
    const last = res.turns.length - 1;
    const of = res.turns[last]?.role === "assistant" ? packetsOf(res.turns[last].text).length : 0;
    setReveal(of > 1 && !reducedMotion() ? { turn: last, shown: 1, of } : null);
    const before = new Map(notes.map((n) => [n.id, n.text]));
    setFresh(new Set(res.notes.filter((n) => before.get(n.id) !== n.text).map((n) => n.id)));
    setNotes(res.notes);
    callerChanged(res.caller);
    clearCoachCall();
  };

  return createPortal(
    <section
      role="dialog"
      aria-label={COACH_COPY.title(name)}
      className={clsx(
        "fixed bottom-20 right-4 z-[86] flex flex-col overflow-hidden rounded-2xl bg-surface shadow-lift ring-1 ring-line transition-[width] duration-300 ease-out motion-reduce:transition-none lg:bottom-6 print:hidden",
        watching ? "lg:right-[25.5rem]" : "lg:right-20",
        small
          ? "w-[min(19rem,calc(100vw-2rem))]"
          : clsx(
              "h-[min(40rem,calc(100dvh-7rem))]",
              settings
                ? "w-[min(50rem,calc(100vw-2rem))]"
                : deals
                  ? "w-[min(26rem,calc(100vw-2rem))] sm:w-[min(46rem,calc(100vw-2rem))] lg:w-[min(60rem,calc(100vw-7rem))]"
                  : "w-[min(26rem,calc(100vw-2rem))]",
            ),
      )}
    >
      <header className={clsx("flex items-center gap-3 bg-primary text-white", small ? "px-3 py-2" : "px-4 py-3")}>
        {small ? (
          <button type="button" onClick={() => setSmall(false)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
            <CallerAvatar caller={caller} size={30} className="ring-2 ring-white/20" />
            <span className="truncate text-sm font-semibold">{COACH_COPY.title(name)}</span>
          </button>
        ) : (
          <>
            <AvatarEdit editable={mayCoach} onFailed={setFailed} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{COACH_COPY.title(name)}</p>
              <p className="truncate text-xs text-white/70">Your phone assistant · learns from what you tell it</p>
            </div>
            <HearButton />
          </>
        )}
        <button
          type="button"
          onClick={() => setSmall((v) => !v)}
          aria-label={small ? `Open ${name}'s chat` : "Minimise"}
          title={small ? "Open" : "Minimise"}
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          {small ? <ChevronUp className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={() => toggleDeals(!deals)}
          hidden={small}
          aria-pressed={deals}
          aria-label={deals ? `Close ${name}'s deals` : `${name}'s deals`}
          title={deals ? "Close deals" : `${name}'s deals`}
          className={clsx("grid size-8 shrink-0 place-items-center rounded-full", deals ? "bg-white text-ink" : "hover:bg-white/10")}
        >
          <LayoutList className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => toggleSettings(!settings)}
          hidden={small}
          aria-pressed={settings}
          aria-label={settings ? `Close ${name}'s settings` : `${name}'s settings: voice and script`}
          title={settings ? "Close settings" : "Voice and script"}
          className={clsx("grid size-8 shrink-0 place-items-center rounded-full", settings ? "bg-white text-ink" : "hover:bg-white/10")}
        >
          <Settings className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={closeCoach}
          aria-label="Close"
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className={clsx("flex min-h-0 flex-1", small && "hidden")}>
        {settings && (
          <CoachSettings
            notes={notes}
            fixed={fixed}
            fresh={fresh}
            mayCoach={mayCoach}
            onNotes={setNotes}
            onBack={() => toggleSettings(false)}
          />
        )}
        {deals && !settings && <CoachDeals picked={picked} onPick={setPicked} onBack={() => toggleDeals(false)} />}
        <div className={clsx("flex min-w-0 flex-1 flex-col", (settings || deals) && "hidden sm:flex")}>
          <ContactReach open={reaching} onOpen={setReaching} />
          {!settings && !reaching && (
            <button
              type="button"
              onClick={() => toggleSettings(true)}
              className="flex w-full items-center justify-between border-b border-line px-4 py-2.5 text-left text-sm text-ink-2 hover:text-ink"
            >
              <span>
                <strong className="font-semibold text-ink">{notes.length}</strong> {notes.length === 1 ? "line" : "lines"} in {name}&apos;s
                script
              </span>
              <span className="text-xs font-medium text-ink">Open</span>
            </button>
          )}
          <div ref={list} className={clsx("min-h-40 flex-1 space-y-3 overflow-y-auto px-4 py-3", reaching && "hidden")}>
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
                      {/deal$/.test(t.about) ? <LayoutList className="size-3" aria-hidden /> : <PhoneCall className="size-3" aria-hidden />}
                      {t.about}
                    </span>
                  )}
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-sm leading-snug text-white">
                    {t.text}
                  </p>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <CallerAvatar caller={caller} size={28} />
                  <div className="min-w-0 max-w-[88%] flex-1">
                    <Beanstalk packets={packetsOf(t.text)} shown={reveal?.turn === i ? reveal.shown : Infinity} label={`${name} says`} />
                    {(reveal?.turn !== i || reveal.shown >= packetsOf(t.text).length) && <Changes changes={t.changes} />}
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

          <div className={clsx("border-t border-line p-3", reaching && "hidden")}>
            {state.call && (
              <p className="mb-2 flex items-center gap-1.5 text-xs text-ink-2">
                <PhoneCall className="size-3.5 text-sun-line" aria-hidden />
                About {state.call.about.replace(/^A /, "a ")}
                <button
                  type="button"
                  onClick={clearCoachCall}
                  className="ml-auto text-muted hover:text-ink"
                  aria-label="Not about this call"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </p>
            )}
            {about && (
              <p className="mb-2 flex items-center gap-1.5 text-xs text-ink-2">
                <LayoutList className="size-3.5 text-sun-line" aria-hidden />
                About {aboutFirst}&apos;s deal
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="ml-auto text-muted hover:text-ink"
                  aria-label="Not about this deal"
                >
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
                  placeholder={
                    state.call ? COACH_COPY.callAbout(name) : about ? `Ask ${name} about ${aboutFirst}…` : `Tell ${name} what to change…`
                  }
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
              loaded && (
                <p className="text-xs text-muted">{`Only an admin can coach ${name}. You can read ${name}'s script in settings.`}</p>
              )
            )}
          </div>
        </div>
      </div>
    </section>,
    document.body,
  );
}

/**
 * The assistant's settings beside its chat (13 Nov 2026, Martin: a cog slides out settings, side by side, so nothing
 * means going into Settings): **Voice**, folded until opened, the same picker as Settings → Phone assistant; then
 * **Script**, everything it has been told to say, as notes it keeps for every call, to read, reword or take away, with
 * what no note can change under it. A note just added or reworded in the chat is lit. On a phone it takes the window's
 * place, with a way back to the chat.
 */
function CoachSettings(props: {
  notes: CoachNote[];
  fixed: string[];
  fresh: Set<string>;
  mayCoach: boolean;
  onNotes: (n: CoachNote[]) => void;
  onBack: () => void;
}) {
  const { caller, callsOn } = useCallerInfo();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(true);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const name = caller.name;
  const head = (label: string, sub: string, open: boolean, toggle: () => void) => (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
      <ChevronDown className={clsx("size-4 shrink-0 text-ink-2 transition-transform", open && "rotate-180")} aria-hidden />
    </button>
  );
  return (
    <aside
      aria-label={`${name}'s settings`}
      className="flex w-full shrink-0 flex-col overflow-y-auto border-line bg-canvas sm:w-[22rem] sm:border-r"
    >
      <button
        type="button"
        onClick={props.onBack}
        className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-xs font-medium text-ink-2 hover:text-ink sm:hidden"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Back to the chat
      </button>
      <section className="border-b border-line">
        {head("Voice", voiceLabel(caller.voice), voiceOpen, () => setVoiceOpen((o) => !o))}
        {voiceOpen && (
          <div className="px-4 pb-4">
            {props.mayCoach ? (
              <VoicePicker compact caller={caller} callsOn={callsOn} onSaved={() => undefined} onStatus={setStatus} />
            ) : (
              <p className="text-xs text-muted">Only an admin can change the voice.</p>
            )}
            {status && <p className={clsx("mt-2 text-xs", status.ok ? "text-ink-2" : "text-danger")}>{status.text}</p>}
          </div>
        )}
      </section>
      <section>
        {head(
          "Script",
          `${props.notes.length} ${props.notes.length === 1 ? "line" : "lines"}: what ${name} has been told to say`,
          scriptOpen,
          () => setScriptOpen((o) => !o),
        )}
        {scriptOpen && (
          <div className="space-y-1.5 px-4 pb-4">
            <p className="text-xs text-muted">{COACH_COPY.script(name)}</p>
            {props.notes.length === 0 && <p className="text-xs text-muted">{COACH_COPY.empty(name)}</p>}
            {props.notes.map((n) => (
              <NoteRow key={n.id} note={n} editable={props.mayCoach} fresh={props.fresh.has(n.id)} onNotes={props.onNotes} />
            ))}
            {props.fixed.length > 0 && (
              <div className="pt-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{COACH_COPY.fixedTitle}</p>
                <ul className="mt-1 space-y-0.5 text-xs text-ink-2">
                  {props.fixed.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </aside>
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

/** A practice call: the assistant rings the member's own mobile and talks to them as a customer (practice-call.ts). */
function HearButton() {
  const caller = useCaller();
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ring = async () => {
    setBusy(true);
    const res = await ringMeToHear();
    setBusy(false);
    setSaid(res.ok ? null : res.message);
    window.setTimeout(() => setSaid(null), 6000);
  };
  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={() => void ring()}
        disabled={busy}
        aria-label={`Practice a call with ${caller.name}`}
        title={`Practice a call with ${caller.name}: ${caller.name} rings your mobile`}
        className="grid size-8 place-items-center rounded-full hover:bg-white/10 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PhoneCall className="size-4" aria-hidden />}
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

function NoteRow({
  note,
  editable,
  fresh = false,
  onNotes,
}: {
  note: CoachNote;
  editable: boolean;
  fresh?: boolean;
  onNotes: (n: CoachNote[]) => void;
}) {
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
    <div
      className={clsx(
        "group flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-surface-2",
        fresh && "bg-sun ring-1 ring-sun-line/40",
      )}
    >
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
