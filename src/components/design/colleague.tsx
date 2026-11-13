"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { ArrowUp, Headset, Loader2, Mic, MicOff, Phone, PhoneOff, X } from "lucide-react";
import { CALLER_VOICES, type CallerVoice } from "@/lib/domain/design/caller";
import { COLLEAGUE_COPY, COLLEAGUE_ROLE, PIN_MAX, PIN_MIN } from "@/lib/domain/design/colleague";
import { CHAT_COPY, CHAT_TEXT_MAX } from "@/lib/domain/design/colleague-chat";
import { clockWords } from "@/lib/domain/live-call";
import {
  askColleague,
  callColleague,
  clearColleagueChat,
  closeColleague,
  readColleagueChat,
  useColleagueChat,
  hangUpColleague,
  loadColleague,
  muteColleague,
  openColleague,
  removePin,
  resetTalk,
  saveColleague,
  savePin,
  useColleagueOpen,
  useTalk,
  type ColleagueState,
} from "@/lib/services/colleague";

const titleOf = (s: ColleagueState | null) => s?.name || COLLEAGUE_ROLE;

/** Its round on the rail, under the phone assistant's (13 Nov 2026, Martin): shown where calls are on for the business. */
export function ColleagueButton() {
  const [state, setState] = useState<ColleagueState | null>(null);
  useEffect(() => {
    let live = true;
    void loadColleague().then((r) => live && r.ok && setState(r));
    return () => {
      live = false;
    };
  }, []);
  if (!state?.ready.on) return null;
  return (
    <button
      type="button"
      onClick={openColleague}
      title={`${titleOf(state)}: your team's assistant`}
      aria-label={`Talk to ${titleOf(state)}`}
      className="relative -mx-1 grid size-12 place-items-center rounded-full bg-primary text-white shadow-[0_4px_14px_rgba(20,22,26,0.18)] ring-2 ring-transparent transition hover:ring-sun-line"
    >
      <Headset className="size-[22px]" aria-hidden />
      {/* Someone to call or chat to, not a page (13 Nov 2026, Martin: the two assistants got lost among the rail's icons). */}
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
 * The team's own assistant, its chief of staff (13 Nov 2026, Martin: call it myself and it speaks to me as a colleague,
 * about my deals; customers never get through to it). Call it here through the microphone, set the PIN for ringing the
 * team line from your phone, name it and pick its voice, and read your own calls with it. Over the page, bottom right.
 */
export function ColleagueWindow() {
  const isOpen = useColleagueOpen();
  const talk = useTalk();
  const [state, setState] = useState<ColleagueState | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // Chat in writing, or call it and its settings (13 Nov 2026, Martin: "I also should be able to chat to it").
  const [view, setView] = useState<"chat" | "call">("chat");
  const list = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    void loadColleague().then((r) => (r.ok ? setState(r) : setProblem(r.message)));
  }, []);
  // Read afresh each time it opens, and after a call ends (its transcript is then on the list).
  const ended = talk.phase === "ended";
  useEffect(() => (isOpen ? reload() : undefined), [isOpen, reload, ended]);

  useEffect(() => {
    if (!talk.startedAt) return;
    const tick = () => setElapsed(Date.now() - (talk.startedAt ?? Date.now()));
    const t = window.setInterval(tick, 1000);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(first);
    };
  }, [talk.startedAt]);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [talk.lines.length, talk.partial?.text]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && talk.phase !== "on" && closeColleague();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, talk.phase]);

  const live = talk.phase === "connecting" || talk.phase === "on";
  if ((!isOpen && !live) || typeof document === "undefined") return null;
  const name = titleOf(state);
  // A call under way is always shown; otherwise the view picked, the chat to start with where it can be had.
  const chatting = !live && Boolean(state?.chatOn) && view === "chat";

  return createPortal(
    <section
      aria-label={name}
      className={clsx(
        "fixed bottom-20 right-4 z-[87] flex w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-surface shadow-lift lg:bottom-6 lg:right-20 print:hidden",
        chatting ? "h-[min(40rem,calc(100dvh-7rem))]" : "max-h-[min(42rem,calc(100dvh-7rem))]",
        talk.phase === "on" ? "ring-2 ring-sun-line" : "ring-1 ring-line",
      )}
    >
      <header className="relative flex items-center gap-3 bg-primary px-4 py-3 text-white">
        {talk.phase === "on" && (
          <span className="pointer-events-none absolute inset-0 animate-pulse bg-sun-line/20 motion-reduce:animate-none" aria-hidden />
        )}
        <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-white/10 ring-2 ring-white/20">
          <Headset className="size-5" aria-hidden />
        </span>
        <div className="relative min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate text-xs text-white/70">Your team&apos;s assistant · customers never reach it</p>
        </div>
        {talk.phase === "on" && (
          <span className="relative rounded-full bg-sun-line px-2.5 py-1 text-sm font-semibold tabular-nums">{clockWords(elapsed)}</span>
        )}
        <button
          type="button"
          onClick={() => (live ? hangUpColleague() : (resetTalk(), closeColleague()))}
          aria-label={live ? "Hang up and close" : "Close"}
          className="relative grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      {state?.chatOn && !live && (
        <div role="tablist" aria-label={`Chat with ${name} or call it`} className="flex gap-1 border-b border-line bg-surface-2 p-1.5">
          {(["chat", "call"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={clsx(
                "flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors",
                view === v ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink",
              )}
            >
              {v === "chat" ? "Chat" : "Call and settings"}
            </button>
          ))}
        </div>
      )}
      {chatting && state && <ChatPanel state={state} />}
      <div className={clsx("min-h-0 flex-1 overflow-y-auto", chatting && "hidden")}>
        {!state ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{problem ?? "Just a moment…"}</p>
        ) : (
          <>
            <CallPanel state={state} list={list} />
            <PhonePanel state={state} onChanged={reload} />
            {state.mayChange && <SettingsPanel state={state} onSaved={setState} />}
            <PastCalls state={state} />
          </>
        )}
      </div>
    </section>,
    document.body,
  );
}

/**
 * The chat in writing (13 Nov 2026, Martin): the member's questions on the right, its answers on the left, from their
 * deals only. Kept in this browser for the visit; Enter sends, Shift+Enter is a new line.
 */
function ChatPanel({ state }: { state: ColleagueState }) {
  const chat = useColleagueChat();
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const name = titleOf(state);

  useEffect(() => {
    readColleagueChat();
    const t = window.setTimeout(() => box.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.lines.length, chat.sending]);

  const send = async () => {
    const words = text.trim();
    if (!words || chat.sending) return;
    setText("");
    if (!(await askColleague(words))) setText(words);
  };

  return (
    <>
      <div ref={list} aria-live="polite" className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        <Bubble you={false} text={CHAT_COPY.hello(state.name, state.firstName ?? null)} />
        {chat.lines.map((l, i) => (
          <Bubble key={i} you={l.role === "you"} text={l.text} />
        ))}
        {chat.sending && <p className="animate-pulse text-xs text-muted motion-reduce:animate-none">{name} is looking it up…</p>}
      </div>
      <div className="border-t border-line p-3">
        {chat.problem && <p className="mb-2 text-xs text-danger">{chat.problem}</p>}
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
            maxLength={CHAT_TEXT_MAX}
            placeholder={CHAT_COPY.placeholder(name)}
            aria-label={`Your question for ${name}`}
            className="min-h-11 flex-1 resize-none rounded-2xl bg-canvas px-3 py-2 text-sm text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-sun-line"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!text.trim() || chat.sending}
            aria-label="Send"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white disabled:bg-line disabled:text-muted"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted">
          <span>{COLLEAGUE_COPY.readOnly}</span>
          {chat.lines.length > 0 && !chat.sending && (
            <button type="button" onClick={clearColleagueChat} className="shrink-0 underline hover:text-ink">
              Start again
            </button>
          )}
        </p>
      </div>
    </>
  );
}

function CallPanel({ state, list }: { state: ColleagueState; list: React.RefObject<HTMLDivElement | null> }) {
  const talk = useTalk();
  const name = titleOf(state);
  const live = talk.phase === "connecting" || talk.phase === "on";
  return (
    <div className="border-b border-line px-4 py-4">
      {!live && <p className="text-sm text-muted">{COLLEAGUE_COPY.intro}</p>}
      {(live || talk.lines.length > 0) && (
        <div ref={list} aria-live="polite" className="mt-1 max-h-60 min-h-20 space-y-2 overflow-y-auto">
          {talk.phase === "connecting" && <p className="py-3 text-center text-sm text-muted">Connecting… allow the microphone if asked.</p>}
          {talk.lines.map((l, i) => (
            <Bubble key={i} you={l.role === "you"} text={l.text} />
          ))}
          {talk.partial && <Bubble you={talk.partial.role === "you"} text={talk.partial.text} faded />}
        </div>
      )}
      {talk.problem && <p className="mt-2 text-xs text-danger">{talk.problem}</p>}
      <div className="mt-3 flex items-center gap-2">
        {live ? (
          <>
            <button
              type="button"
              onClick={muteColleague}
              aria-pressed={talk.muted}
              className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3.5 py-2 text-sm font-semibold text-ink ring-1 ring-line"
            >
              {talk.muted ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
              {talk.muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              onClick={hangUpColleague}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-danger py-2 text-sm font-semibold text-white"
            >
              <PhoneOff className="size-4" aria-hidden /> Hang up
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void callColleague()}
            disabled={!state.ready.web}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-sun-line py-2.5 text-sm font-semibold text-white disabled:bg-line disabled:text-muted"
          >
            {talk.phase === "connecting" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Phone className="size-4" aria-hidden />
            )}
            Call {name}
          </button>
        )}
      </div>
      {!state.ready.web && (
        <p className="mt-2 text-xs text-muted">{state.ready.on ? "Calls from the browser aren't set up yet." : COLLEAGUE_COPY.notOn}</p>
      )}
      <p className="mt-2 text-[11px] text-muted">{COLLEAGUE_COPY.readOnly}</p>
    </div>
  );
}

function Bubble({ you, text, faded }: { you: boolean; text: string; faded?: boolean }) {
  return (
    <div className={clsx("flex", you ? "justify-end" : "justify-start")}>
      <p
        className={clsx(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-sm",
          you ? "bg-primary text-white" : "bg-surface-2 text-ink",
          faded && "opacity-60",
        )}
      >
        {text}
      </p>
    </div>
  );
}

function PhonePanel({ state, onChanged }: { state: ColleagueState; onChanged: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!state.ready.on) return null;
  const save = async () => {
    setBusy(true);
    const r = await savePin(pin);
    setBusy(false);
    setNote(r.ok ? "Your PIN is set." : r.message);
    if (r.ok) {
      setPin("");
      onChanged();
    }
  };
  return (
    <details className="border-b border-line px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-ink">On your phone</summary>
      <p className="mt-2 text-xs text-muted">{COLLEAGUE_COPY.pinIntro}</p>
      {state.ready.teamNumber ? (
        <p className="mt-2 text-sm">
          Team line:{" "}
          <a href={`tel:${state.ready.teamNumber}`} className="font-semibold text-ink underline">
            {state.ready.teamNumber}
          </a>
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">The team line isn&apos;t set up yet.</p>
      )}
      {!state.hasMobile && <p className="mt-2 text-xs text-warning">{COLLEAGUE_COPY.noMobile}</p>}
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX))}
          inputMode="numeric"
          autoComplete="off"
          type="password"
          placeholder={state.pinSet ? "New PIN" : `${PIN_MIN} to ${PIN_MAX} digits`}
          aria-label="Your PIN for the team line"
          className="w-36 rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-ink ring-1 ring-line outline-none focus:ring-sun-line"
        />
        <button
          type="submit"
          disabled={busy || pin.length < PIN_MIN}
          className="rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-white disabled:bg-line disabled:text-muted"
        >
          {state.pinSet ? "Change PIN" : "Set PIN"}
        </button>
        {state.pinSet && (
          <button
            type="button"
            onClick={() => void removePin().then((r) => (setNote(r.ok ? "Your PIN is gone." : r.message), onChanged()))}
            className="text-xs text-muted underline"
          >
            Remove
          </button>
        )}
      </form>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </details>
  );
}

function SettingsPanel({ state, onSaved }: { state: ColleagueState; onSaved: (s: ColleagueState) => void }) {
  const [name, setName] = useState(state.name ?? "");
  const [voice, setVoice] = useState(`${state.voice.provider}:${state.voice.voiceId}`);
  // The phone assistants' voices are shown but can't be picked: nobody should take the two for the same person.
  const taken = (v: { provider: string; voiceId: string }) =>
    state.takenVoices.some((t) => t.provider === v.provider && t.voiceId === v.voiceId);
  const [note, setNote] = useState<string | null>(null);
  const save = async () => {
    const [provider, voiceId] = voice.split(":");
    const v: CallerVoice | null = voice ? { provider: provider as CallerVoice["provider"], voiceId } : null;
    const r = await saveColleague(name, v);
    setNote(r.ok ? "Saved." : r.message);
    if (r.ok) onSaved({ ...state, name: r.name, voice: r.voice });
  };
  return (
    <details className="border-b border-line px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-ink">Name and voice</summary>
      <label className="mt-2 block text-xs text-muted">
        Its name (said out loud, and not your phone assistant&apos;s; leave empty for &ldquo;your chief of staff&rdquo;)
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          className="mt-1 block w-full rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-ink ring-1 ring-line outline-none focus:ring-sun-line"
        />
      </label>
      <label className="mt-2 block text-xs text-muted">
        Its voice (never your phone assistant&apos;s, so nobody takes the two for the same person)
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          className="mt-1 block w-full rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-ink ring-1 ring-line"
        >
          {CALLER_VOICES.map((v) => (
            <option key={`${v.provider}:${v.voiceId}`} value={`${v.provider}:${v.voiceId}`} disabled={taken(v)}>
              {v.label} · {v.words}
              {taken(v) ? " (your phone assistant's)" : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          className="rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-white"
        >
          Save
        </button>
        {note && <span className="text-xs text-muted">{note}</span>}
      </div>
    </details>
  );
}

function PastCalls({ state }: { state: ColleagueState }) {
  if (!state.calls.length) return null;
  return (
    <div className="px-4 py-3">
      <p className="text-sm font-semibold text-ink">Your calls</p>
      <ul className="mt-1 space-y-1">
        {state.calls.map((c) => (
          <li key={c.id}>
            <details>
              <summary className="cursor-pointer text-xs text-muted">
                {new Date(c.at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                {c.channel === "phone" ? "On the phone" : "In the app"}
                {c.minutes ? ` · ${c.minutes} min` : ""}
              </summary>
              {c.summary && <p className="mt-1 text-xs text-ink">{c.summary}</p>}
              <div className="mt-1 space-y-1">
                {c.lines.map((l, i) => (
                  <Bubble key={i} you={l.role === "you"} text={l.text} />
                ))}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
