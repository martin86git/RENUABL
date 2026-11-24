"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  ArrowLeft,
  ArrowUp,
  AudioLines,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Loader2,
  Lock,
  LockOpen,
  MessageCircle,
  Minus,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  SquareKanban,
  Trash2,
  X,
} from "lucide-react";
import { setCallDocked, useWatchedCall } from "@/lib/services/assistant-call";
import { CallPanel } from "./assistant-call";
import { callsToday, dayLine, type AssistantDeal } from "@/lib/domain/design/assistant-deals";
import { LAUNCH_MARKET, todayInMarket } from "@/lib/domain/market";
import {
  COACH_WINDOW_KEY,
  NO_SIZES,
  cleanCoachSizes,
  coachLayout,
  dragCoach,
  type CoachLayout,
  type CoachPane,
  type CoachSizes,
} from "@/lib/domain/design/coach-window";
import { currentChatLine, type CoachChatLine } from "@/lib/domain/design/coach-threads";
import { COACH_COPY, packetsOf, type CoachNote, type CoachTurn } from "@/lib/domain/design/coaching";
import { callerChanged, removeCallerPhoto, saveCallerTint, uploadCallerPhoto, useCaller, useCallerInfo } from "@/lib/services/caller";
import { DELIVERY_COPY, type Delivery } from "@/lib/domain/design/delivery";
import { CALL_SETUP_COPY, DEFAULT_CALL_SETUP, type CallSetup } from "@/lib/domain/design/call-setup";
import { CallSetupSettings } from "./coach-call-setup";
import type { ScriptLine } from "@/lib/domain/design/call-scripts";
import { ScriptPicker } from "./coach-scripts";
import { roleOfKey } from "@/lib/domain/install-call";
import { BrainSettings, DeliverySettings, RingMe, TrainingReview, TrainingStrip, useTraining, type Training } from "./coach-training";
import { TINT_NAMES, tintOf, voiceLabel } from "@/lib/domain/design/caller";
import {
  clearCoachCall,
  closeCoach,
  coachAssistant,
  forgetCoachChat,
  loadAssistantDeals,
  loadCoaching,
  lockNote,
  newCoachChat,
  openCoach,
  openCoachChat,
  removeNote,
  rewordNote,
  useCoachCaller,
  useCoachOpen,
} from "@/lib/services/coaching";
import { CallerAvatar, VoicePicker } from "./settings-caller";
import { VoiceSample } from "./voice-choice";
import { ContactReach } from "./coach-contacts";
import { CoachDeals } from "./coach-deals";
import { CoachWelcome } from "./coach-welcome";
import { DictateButton, withSpoken } from "./dictate";
import { NameHints, RingCard, useContactBook } from "./coach-ring";
import { nameAt, withName, type NameSpan } from "@/lib/domain/design/name-hint";
import type { CallerKey } from "@/lib/domain/install-call";

/** A time in the market's own: "7:02 pm". */
const marketTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: LAUNCH_MARKET.timeZone });

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
/** The window's sizes as the person last dragged them on this device. */
function readSizes(): CoachSizes {
  try {
    return typeof window === "undefined" ? NO_SIZES : cleanCoachSizes(JSON.parse(localStorage.getItem(COACH_WINDOW_KEY) ?? "null"));
  } catch {
    return NO_SIZES;
  }
}
const viewNow = () =>
  typeof window === "undefined" ? { width: 1440, height: 900 } : { width: window.innerWidth, height: window.innerHeight };

/**
 * An edge dragged to resize (14 Nov 2026, Martin: resize the panes): it reports how far the pointer has moved since
 * the press, with the layout it started from. A double click puts that part back to its usual size.
 */
function DragEdge(props: {
  label: string;
  className: string;
  orientation: "vertical" | "horizontal";
  start: () => CoachLayout;
  onDrag: (dx: number, dy: number, from: CoachLayout) => void;
  onReset: () => void;
}) {
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const at = { x: e.clientX, y: e.clientY };
    const from = props.start();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => props.onDrag(m.clientX - at.x, m.clientY - at.y, from);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  return (
    <div
      role="separator"
      aria-orientation={props.orientation}
      aria-label={props.label}
      title={`${props.label} (double-click to reset)`}
      onPointerDown={down}
      onDoubleClick={props.onReset}
      className={clsx("touch-none select-none", props.className)}
    />
  );
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
  // One window, for whichever of the two voice agents was pressed: opening the other starts it afresh (its own notes,
  // chats and deals), so nothing of one is shown under the other.
  const role = useCoachOpen()?.role ?? "sales";
  return <CoachWindowFor key={role} />;
}

function CoachWindowFor() {
  const state = useCoachOpen();
  // Whichever of the two voice agents was pressed: the sales assistant, or the post-sale one.
  const caller = useCoachCaller();
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [turns, setTurns] = useState<CoachTurn[]>([]);
  const [fixed, setFixed] = useState<string[]>([]);
  const [mayCoach, setMayCoach] = useState(false);
  const book = useContactBook(mayCoach);
  // How it speaks (delivery.ts): null until the business has chosen.
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  // Its name as said, who it rings and why (call-setup.ts), and the business it speaks for.
  const [setup, setSetup] = useState<CallSetup>(DEFAULT_CALL_SETUP);
  const [business, setBusiness] = useState("");
  // Its scripts by name, the one in use first (call-scripts.ts).
  const [scripts, setScripts] = useState<ScriptLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  // What the microphone is hearing, shown in the box as it comes (14 Nov 2026, Martin: talk into the chat field).
  const [heard, setHeard] = useState("");
  // A customer's name being typed, offered as chips (name-hint.ts), and the names tapped, for the call card.
  const [nameSpan, setNameSpan] = useState<NameSpan | null>(null);
  const [nameDismissed, setNameDismissed] = useState<number | null>(null);
  const [tapped] = useState(() => new Map<string, string>());
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [settings, setSettings] = useState(() => readSettingsOpen() && !readDealsOpen());
  // Its deals beside the chat (14 Nov 2026, Martin: split screen, the deals wider, pick one and talk about it).
  const [deals, setDeals] = useState(readDealsOpen);
  const [picked, setPicked] = useState<AssistantDeal | null>(null);
  // The window's and its panes' sizes, dragged (14 Nov 2026, Martin), kept on the device.
  const [sizes, setSizes] = useState<CoachSizes>(readSizes);
  const [view, setView] = useState(viewNow);
  useEffect(() => {
    const on = () => setView(viewNow());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  // Folded to its header bar (13 Nov 2026, Martin: minimise it, so what is behind it can be reached).
  const [small, setSmall] = useState(false);
  // Open full, it tells the phone's header to make its wordmark smaller, and the window stops below that header
  // (22 Nov 2026, Martin: the half-covered RENUABL looked like a mistake; `.coach-window` in globals.css).
  const shown = !!state && !small;
  // On a phone, going to another page from inside it (Open deal, a contact's deal) folds it to its bar, so the page it
  // opened is seen and nothing (the deal's tour) starts under it (24 Nov 2026, Martin).
  const path = usePathname();
  const lastPath = useRef(path);
  useEffect(() => {
    if (lastPath.current === path) return;
    lastPath.current = path;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- folds once when the page changes under it */
    if (window.matchMedia("(max-width: 1023px)").matches) setSmall(true);
  }, [path]);
  useEffect(() => {
    if (!shown) return;
    const root = document.documentElement;
    root.dataset.phoneWindow = "";
    return () => {
      delete root.dataset.phoneWindow;
    };
  }, [shown]);
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

  // Where it lands when opened (14 Nov 2026, Martin: a welcome with today's calls, not the last conversation; and the
  // deals beside it, not the settings). Opened about one call, it goes straight to the conversation about that call.
  const [landing, setLanding] = useState(true);
  // The chats kept apart (14 Nov 2026, Martin: typing from the assistant's day carried on an old thread). What is typed
  // from its day starts a new chat; Carry on, or an earlier chat opened, goes on in that one.
  const [past, setPast] = useState<CoachChatLine[]>([]);
  const [startNew, setStartNew] = useState(true);
  // Its day in a line, under its name in the header: on a call, the next to ring, or nothing lined up.
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    const read = () =>
      void loadAssistantDeals().then((res) => {
        if (!live || !res.ok) return;
        const now = new Date();
        setDay(dayLine(callsToday(res.deals, now, todayInMarket), now, marketTime));
      });
    read();
    window.addEventListener("renuabl:assistant-deals", read);
    return () => {
      live = false;
      window.removeEventListener("renuabl:assistant-deals", read);
    };
  }, [isOpen]);
  const staying = useRef(false);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- each open (a new state object) unfolds the window and lands it afresh */
    setSmall(false);
    // An answer about a call lets the call go: the window stays in that chat.
    if (staying.current) {
      staying.current = false;
      return;
    }
    setLanding(!state?.call);
    setStartNew(!state?.call);
    if (state && !state.call && window.innerWidth >= 1024) {
      setDeals(true);
      setSettings(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [state]);

  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    void loadCoaching().then((res) => {
      if (!live) return;
      setLoaded(true);
      if (!res.ok) return setFailed(res.message);
      setNotes(res.notes);
      setTurns(res.turns);
      setPast(res.past);
      setFixed(res.fixed);
      setMayCoach(res.mayCoach);
      setDelivery(res.delivery ?? null);
      setSetup(res.setup ?? DEFAULT_CALL_SETUP);
      setBusiness(res.business ?? "");
      setScripts(res.scripts ?? []);
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
  }, [turns.length, sending, isOpen, reveal?.shown, landing]);

  const training = useTraining(isOpen);
  // A call watched opens joined to this window, emerging from its side (17 Nov 2026, Martin), on a screen wide enough.
  const dockCall = isOpen && Boolean(watching) && !small && view.width >= 1024;
  useEffect(() => {
    setCallDocked(dockCall);
    return () => setCallDocked(false);
  }, [dockCall]);

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
  const pane: CoachPane | null = settings ? "settings" : deals ? "deals" : null;
  const layout = coachLayout(sizes, pane, view);
  const resize = (next: CoachSizes) => {
    setSizes(next);
    try {
      localStorage.setItem(COACH_WINDOW_KEY, JSON.stringify(next));
    } catch {
      // Private window: the size lasts for the visit.
    }
  };
  const edge = (grip: "divider" | "left" | "top") => ({
    start: () => layout,
    // Centred on a wide screen, the window grows both ways from its middle: the top edge follows the pointer at twice dy.
    onDrag: (dx: number, dy: number, from: CoachLayout) =>
      resize(dragCoach(sizes, pane, from, grip, dx, grip === "top" && window.innerWidth >= 1024 ? dy * 2 : dy)),
    onReset: () => resize(grip === "top" ? { ...sizes, height: null } : { ...sizes, chat: null, ...(pane ? { [pane]: null } : {}) }),
  });
  const about = state.call ? null : deals ? picked : null;
  const aboutFirst = about ? about.customer.split(" ")[0] || about.customer : "";

  const send = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setFailed(null);
    // From the assistant's day it is a new chat: the one before is filed away with the earlier ones.
    const fresh = startNew && !state.call && turns.length > 0;
    const before = turns;
    setLanding(false);
    setStartNew(false);
    const at = new Date().toISOString();
    setTurns([
      ...(fresh ? [] : before),
      { role: "you", text: message, at, ...(state.call ? { about: state.call.about } : about ? { about: `${aboutFirst}'s deal` } : {}) },
    ]);
    setText("");
    setNameSpan(null);
    const res = await coachAssistant(message, state.call, about?.jobId ?? null, fresh);
    setSending(false);
    if (!res.ok) {
      setFailed(res.message);
      setTurns(before);
      setStartNew(fresh);
      setText(message);
      return;
    }
    setTurns(res.turns);
    setPast(res.past);
    const last = res.turns.length - 1;
    const of = res.turns[last]?.role === "assistant" ? packetsOf(res.turns[last].text).length : 0;
    setReveal(of > 1 && !reducedMotion() ? { turn: last, shown: 1, of } : null);
    const was = new Map(notes.map((n) => [n.id, n.text]));
    setFresh(new Set(res.notes.filter((n) => was.get(n.id) !== n.text).map((n) => n.id)));
    setNotes(res.notes);
    callerChanged(res.caller);
    if (state.call) {
      staying.current = true;
      clearCoachCall();
    }
  };

  // The chats: an earlier one opened (it becomes the one going), a new one begun, or one forgotten.
  const chats = async (res: ReturnType<typeof openCoachChat>, show: boolean) => {
    setFailed(null);
    const got = await res;
    if (!got.ok) return setFailed(got.message);
    setTurns(got.turns);
    setPast(got.past);
    setReveal(null);
    if (show) {
      setLanding(false);
      setStartNew(false);
      box.current?.focus();
    }
  };

  return createPortal(
    // Drawn on the page body, outside the shell: the wrapper brings the business theme's colours and draws nothing
    // (without it the window took the homeowner site's cream and green, and its parts ran together).
    <div className="theme-studio contents">
      <div
        style={
          small
            ? undefined
            : ({
                height: layout.height,
                // On a wide screen the window's middle is the floating bar's (14 Nov 2026, Martin), never off the top.
                "--coach-top": `max(1rem, calc(50dvh - ${layout.height / 2}px))`,
              } as React.CSSProperties)
        }
        className={clsx(
          "coach-window fixed bottom-20 right-4 z-[86] flex max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-surface text-ink shadow-lift lg:bottom-6 print:hidden",
          // A call on its own window bottom right (folded, or a narrow screen): this one stands beside it.
          watching && !dockCall ? "lg:right-[25.5rem]" : "lg:right-20",
          small ? "w-[min(19rem,calc(100vw-2rem))]" : "lg:bottom-auto lg:top-[var(--coach-top)]",
          dockCall ? "ring-2 ring-call" : "ring-1 ring-line",
        )}
      >
        {dockCall && <CallPanel docked />}
        <section
          role="dialog"
          aria-label={COACH_COPY.title(name)}
          style={
            small
              ? undefined
              : ({
                  width: `min(${layout.pane + layout.chat}px, calc(100vw - 2rem))`,
                  "--coach-pane": `${layout.pane}px`,
                } as React.CSSProperties)
          }
          className={clsx("relative flex min-w-0 shrink flex-col overflow-hidden bg-surface", small && "flex-1")}
        >
          {!small && (
            <>
              <DragEdge
                label="Drag to make the window wider or narrower"
                orientation="vertical"
                className="absolute inset-y-0 left-0 z-10 hidden w-1.5 cursor-ew-resize hover:bg-sun-line/50 sm:block"
                {...edge("left")}
              />
              <DragEdge
                label="Drag to make the window taller or shorter"
                orientation="horizontal"
                className="absolute inset-x-0 top-0 z-10 hidden h-1.5 cursor-ns-resize hover:bg-sun-line/50 sm:block"
                {...edge("top")}
              />
            </>
          )}
          <header className={clsx("flex items-center gap-3 bg-primary text-white", small ? "px-3 py-2" : "px-4 py-3")}>
            {small ? (
              <button type="button" onClick={() => setSmall(false)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <CallerAvatar caller={caller} size={30} className="ring-2 ring-white/20" />
                <span className="truncate text-sm font-semibold">{COACH_COPY.title(name)}</span>
              </button>
            ) : (
              <>
                <AvatarEdit editable={mayCoach} onFailed={setFailed} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{COACH_COPY.title(name)}</p>
                  <p className="truncate text-xs text-white/70">{day ?? "Your phone assistant"}</p>
                </div>
                {/* What the window can show and do, together by the title (14 Nov 2026, Martin: kept away from minimise and
                close, so they aren't taken for window controls). */}
                <div className="ml-1 flex shrink-0 items-center gap-0.5 rounded-full bg-white/10 p-0.5">
                  {mayCoach && <RingMe caller={caller} />}
                  <button
                    type="button"
                    onClick={() => toggleDeals(!deals)}
                    aria-pressed={deals}
                    aria-label={deals ? `Close ${name}'s deals` : `${name}'s deals`}
                    title={deals ? "Close deals" : `${name}'s deals`}
                    className={clsx(
                      "grid size-8 shrink-0 place-items-center rounded-full",
                      deals ? "bg-white text-ink" : "hover:bg-white/10",
                    )}
                  >
                    <SquareKanban className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSettings(!settings)}
                    aria-pressed={settings}
                    aria-label={settings ? `Close ${name}'s settings` : `${name}'s settings: voice and script`}
                    title={settings ? "Close settings" : "Voice and script"}
                    className={clsx(
                      "grid size-8 shrink-0 place-items-center rounded-full",
                      settings ? "bg-white text-ink" : "hover:bg-white/10",
                    )}
                  >
                    <Settings className="size-4" aria-hidden />
                  </button>
                </div>
                <span className="flex-1" aria-hidden />
              </>
            )}
            {/* The window's own controls, alone in the corner. */}
            <div className={clsx("flex shrink-0 items-center gap-0.5", !small && "border-l border-white/15 pl-2")}>
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
                onClick={closeCoach}
                aria-label="Close"
                title="Close"
                className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </header>

          <div className={clsx("flex min-h-0 flex-1", small && "hidden")}>
            {settings && (
              <CoachSettings
                training={training}
                onTrainingNotes={(next) => {
                  const was = new Map(notes.map((n) => [n.id, n.text]));
                  setFresh(new Set(next.filter((n) => was.get(n.id) !== n.text).map((n) => n.id)));
                  setNotes(next);
                }}
                notes={notes}
                fixed={fixed}
                fresh={fresh}
                mayCoach={mayCoach}
                delivery={delivery}
                onDelivery={setDelivery}
                setup={setup}
                onSetup={setSetup}
                scripts={scripts}
                onScripts={setScripts}
                business={business}
                loaded={loaded}
                onNotes={setNotes}
                onBack={() => toggleSettings(false)}
              />
            )}
            {deals && !settings && <CoachDeals picked={picked} onPick={setPicked} onBack={() => toggleDeals(false)} />}
            {pane && (
              <DragEdge
                label="Drag to resize the two sides"
                orientation="vertical"
                className="hidden w-1.5 shrink-0 cursor-col-resize bg-line hover:bg-sun-line/60 active:bg-sun-line sm:block"
                {...edge("divider")}
              />
            )}
            <div className={clsx("flex min-w-0 flex-1 flex-col bg-surface", (settings || deals) && "hidden sm:flex")}>
              <ContactReach open={reaching} onOpen={setReaching} />
              {!reaching && !settings && <TrainingStrip t={training} name={name} onReview={() => toggleSettings(true)} />}
              {landing && !reaching && (
                <div className="min-h-40 flex-1 overflow-y-auto px-4 py-3">
                  <CoachWelcome
                    caller={caller}
                    current={currentChatLine(turns)}
                    past={past}
                    onOpenChat={(id) => void chats(openCoachChat(id), true)}
                    onForgetChat={mayCoach ? (id) => void chats(forgetCoachChat(id), false) : undefined}
                    onPick={(d) => {
                      setPicked(d);
                      toggleDeals(true);
                    }}
                    onDeals={() => toggleDeals(true)}
                    onTalk={() => {
                      setLanding(false);
                      setStartNew(false);
                    }}
                  />
                </div>
              )}
              {!landing && !reaching && !state.call && (
                <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setLanding(true);
                      setStartNew(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-ink-2 hover:bg-canvas hover:text-ink"
                  >
                    <ChevronLeft className="size-3.5" aria-hidden />
                    {name}&apos;s day and chats
                  </button>
                  {mayCoach && turns.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void chats(newCoachChat(), true)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-ink-2 hover:bg-canvas hover:text-ink"
                    >
                      <Plus className="size-3.5" aria-hidden />
                      New chat
                    </button>
                  )}
                </div>
              )}
              <div ref={list} className={clsx("min-h-40 flex-1 space-y-3 overflow-y-auto px-4 py-3", (reaching || landing) && "hidden")}>
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
                          {/deal$/.test(t.about) ? (
                            <SquareKanban className="size-3" aria-hidden />
                          ) : (
                            <PhoneCall className="size-3" aria-hidden />
                          )}
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
                        <Beanstalk
                          packets={packetsOf(t.text)}
                          shown={reveal?.turn === i ? reveal.shown : Infinity}
                          label={`${name} says`}
                        />
                        {(reveal?.turn !== i || reveal.shown >= packetsOf(t.text).length) && <Changes changes={t.changes} />}
                        {/* A call asked for in the chat, ready to send (22 Nov 2026): only under the latest answer. */}
                        {t.ring && i === turns.length - 1 && (reveal?.turn !== i || reveal.shown >= packetsOf(t.text).length) && (
                          <RingCard
                            key={t.at}
                            ring={t.ring}
                            book={book}
                            picked={tapped}
                            agent={(caller.role ?? "sales") as CallerKey}
                            agentName={name}
                          />
                        )}
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
                    <SquareKanban className="size-3.5 text-sun-line" aria-hidden />
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
                {mayCoach && (
                  <NameHints
                    book={book}
                    span={nameSpan && nameSpan.start !== nameDismissed ? nameSpan : null}
                    onPick={(full, id) => {
                      if (!nameSpan) return;
                      const next = withName(text, nameSpan, full);
                      tapped.set(full, id);
                      setText(next.text);
                      setNameSpan(null);
                      requestAnimationFrame(() => {
                        box.current?.focus();
                        box.current?.setSelectionRange(next.caret, next.caret);
                      });
                    }}
                    onDismiss={() => setNameDismissed(nameSpan?.start ?? null)}
                  />
                )}
                {mayCoach ? (
                  <div className="flex items-end gap-2">
                    {/* The microphone sits inside the box, as in Sol's. */}
                    <div className="flex min-h-11 min-w-0 flex-1 items-end gap-1 rounded-2xl bg-canvas py-1 pl-1.5 pr-1 ring-1 ring-line focus-within:ring-sun-line">
                      <DictateButton
                        label={`Speak to ${name}`}
                        onHearing={setHeard}
                        onWords={(w) => setText((was) => withSpoken(was, w).slice(0, 2000))}
                      />
                      <textarea
                        ref={box}
                        value={heard ? withSpoken(text, heard) : text}
                        onChange={(e) => {
                          setHeard("");
                          setText(e.target.value);
                          const span = nameAt(e.target.value, e.target.selectionStart ?? e.target.value.length);
                          setNameSpan(span);
                          if (!span) setNameDismissed(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape" && nameSpan && nameSpan.start !== nameDismissed) {
                            e.stopPropagation();
                            setNameDismissed(nameSpan.start);
                            return;
                          }
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                          }
                        }}
                        rows={2}
                        maxLength={2000}
                        placeholder={
                          state.call
                            ? COACH_COPY.callAbout(name)
                            : about
                              ? `Ask ${name} about ${aboutFirst}…`
                              : landing && turns.length > 0
                                ? `Start a new chat with ${name}…`
                                : `Ask ${name} anything, or to ring someone…`
                        }
                        className="min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none"
                      />
                    </div>
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
        </section>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The assistant's settings beside its chat (13 Nov 2026, Martin: a cog slides out settings, side by side, so nothing
 * means going into Settings). Laid out as cards on the canvas (17 Nov 2026, Martin: it looked messy and overwhelming;
 * use colour for clarity): a training call to review first, in the sun; then **Voice** and **How it speaks**, folded
 * to a line each; then **Script**, what it has been told to say: its locked rules edged in the signal orange, its
 * notes plain, and what no note can change in grey at the foot. A note just added or reworded in the chat is lit. On a
 * phone it takes the window's place, with a way back to the chat.
 */
function CoachSettings(props: {
  training: Training;
  onTrainingNotes: (n: CoachNote[]) => void;
  notes: CoachNote[];
  fixed: string[];
  fresh: Set<string>;
  mayCoach: boolean;
  delivery: Delivery | null;
  onDelivery: (d: Delivery | null) => void;
  setup: CallSetup;
  onSetup: (s: CallSetup) => void;
  scripts: ScriptLine[];
  onScripts: (s: ScriptLine[]) => void;
  business: string;
  loaded: boolean;
  onNotes: (n: CoachNote[]) => void;
  onBack: () => void;
}) {
  const { callsOn } = useCallerInfo();
  const caller = useCoachCaller();
  // Open to start: its name and why it rings are the first things a business sets (18 Nov 2026, Martin).
  const [whoOpen, setWhoOpen] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [speakOpen, setSpeakOpen] = useState(false);
  const [fixedOpen, setFixedOpen] = useState(false);
  const locked = props.notes.filter((n) => n.locked);
  const loose = props.notes.filter((n) => !n.locked);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const name = caller.name;
  const card = "overflow-hidden rounded-2xl bg-surface ring-1 ring-line";
  const head = (icon: React.ReactNode, tile: string, label: string, sub: string, open: boolean, toggle: () => void) => (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-canvas/60"
    >
      <span className={clsx("grid size-8 shrink-0 place-items-center rounded-xl", tile)} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
      <ChevronDown className={clsx("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
    </button>
  );
  return (
    <aside aria-label={`${name}'s settings`} className="flex w-full shrink-0 flex-col overflow-y-auto bg-canvas sm:w-[var(--coach-pane)]">
      <button
        type="button"
        onClick={props.onBack}
        className="flex items-center gap-1.5 border-b border-line bg-surface px-4 py-2.5 text-xs font-medium text-ink-2 hover:text-ink sm:hidden"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Back to the chat
      </button>
      <div className="space-y-3 p-3">
        <TrainingReview t={props.training} caller={caller} onNotes={props.onTrainingNotes} />

        <section className={card}>
          {head(
            <Phone className="size-4" />,
            "bg-sun text-sun-line",
            CALL_SETUP_COPY.title,
            CALL_SETUP_COPY.summary(name, props.setup),
            whoOpen,
            () => setWhoOpen((o) => !o),
          )}
          {whoOpen && props.loaded && (
            <div className="border-t border-line px-3.5 py-3">
              <CallSetupSettings
                key={`${caller.role ?? "sales"}|${caller.name}|${props.scripts[0]?.name ?? ""}|${props.setup.audience}|${props.setup.reason}`}
                caller={caller}
                business={props.business}
                setup={props.setup}
                editable={props.mayCoach}
                onSaved={props.onSetup}
              />
            </div>
          )}
        </section>

        <section className={card}>
          {head(<AudioLines className="size-4" />, "bg-surface-2 text-ink", "Voice", voiceLabel(caller.voice), voiceOpen, () =>
            setVoiceOpen((o) => !o),
          )}
          {voiceOpen && (
            <div className="border-t border-line px-3.5 py-3">
              {props.mayCoach ? (
                <VoicePicker
                  compact
                  caller={caller}
                  callsOn={callsOn}
                  onSaved={() => undefined}
                  onStatus={setStatus}
                  role={caller.role ?? "sales"}
                />
              ) : (
                <p className="text-xs text-muted">Only an admin can change the voice.</p>
              )}
              {status && <p className={clsx("mt-2 text-xs", status.ok ? "text-ink-2" : "text-danger")}>{status.text}</p>}
            </div>
          )}
        </section>

        <section className={card}>
          {head(
            <MessageCircle className="size-4" />,
            "bg-surface-2 text-ink",
            DELIVERY_COPY.title,
            DELIVERY_COPY.summary(props.delivery),
            speakOpen,
            () => setSpeakOpen((o) => !o),
          )}
          {speakOpen && (
            <div className="border-t border-line px-3.5 py-3">
              <DeliverySettings delivery={props.delivery} editable={props.mayCoach} onSaved={props.onDelivery} />
              <div className="mt-3">
                <BrainSettings caller={caller} editable={props.mayCoach} />
              </div>
            </div>
          )}
        </section>

        <section className={card}>
          <div className="flex items-center gap-3 px-3.5 pt-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-sun text-sun-line" aria-hidden>
              <ScrollText className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">Script</span>
              <span className="block text-xs text-muted">{COACH_COPY.script(name)}</span>
            </span>
          </div>
          <div className="space-y-3 px-3.5 pb-3.5 pt-3">
            {props.loaded && props.scripts.length > 0 && (
              <ScriptPicker
                name={name}
                sales={roleOfKey(caller.role ?? "sales") === "sales"}
                scripts={props.scripts.map((s) =>
                  s.id === null
                    ? {
                        ...s,
                        lines: props.notes.length,
                        locked: props.notes.filter((n) => n.locked).length,
                        audience: props.setup.audience,
                      }
                    : s,
                )}
                editable={props.mayCoach}
                onChanged={(r) => {
                  props.onNotes(r.notes);
                  props.onSetup(r.setup);
                  props.onScripts(r.scripts);
                }}
              />
            )}
            {props.notes.length === 0 && <p className="rounded-xl bg-canvas px-3 py-2.5 text-xs text-muted">{COACH_COPY.empty(name)}</p>}
            {locked.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-sun-ink">
                  <Lock className="size-3" aria-hidden />
                  {COACH_COPY.lockedTitle} · {locked.length}
                </p>
                <p className="mt-0.5 text-xs text-muted">{COACH_COPY.lockedNote(name)}</p>
                <div className="mt-1.5 space-y-1 border-l-2 border-sun-line pl-2">
                  {locked.map((n) => (
                    <NoteRow key={n.id} note={n} editable={props.mayCoach} fresh={props.fresh.has(n.id)} onNotes={props.onNotes} />
                  ))}
                </div>
              </div>
            )}
            {loose.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {COACH_COPY.notesTitle} · {loose.length}
                </p>
                <div className="mt-1.5 space-y-1 border-l-2 border-line pl-2">
                  {loose.map((n) => (
                    <NoteRow key={n.id} note={n} editable={props.mayCoach} fresh={props.fresh.has(n.id)} onNotes={props.onNotes} />
                  ))}
                </div>
              </div>
            )}
          </div>
          {props.fixed.length > 0 && (
            <div className="border-t border-line bg-canvas/60">
              <button
                type="button"
                onClick={() => setFixedOpen((o) => !o)}
                aria-expanded={fixedOpen}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-medium text-ink-2 hover:text-ink"
              >
                <ShieldCheck className="size-3.5 shrink-0 text-muted" aria-hidden />
                <span className="flex-1">{COACH_COPY.fixedTitle}</span>
                <ChevronDown className={clsx("size-3.5 shrink-0 transition-transform", fixedOpen && "rotate-180")} aria-hidden />
              </button>
              {fixedOpen && (
                <ul className="space-y-1 px-3.5 pb-3 text-xs leading-snug text-ink-2">
                  {props.fixed.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}

/**
 * The assistant's face at the top of its chat (13 Nov 2026, Martin: hover it for a pencil and change the picture there,
 * not in Settings). For an admin, pressing it picks a new picture, sent as Settings sends it (`uploadCallerPhoto`:
 * checked by its own bytes and redrawn on the server).
 */
function AvatarEdit({ editable, onFailed }: { editable: boolean; onFailed: (m: string | null) => void }) {
  const caller = useCoachCaller();
  const role = caller.role ?? "sales";
  const pick = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  // Closed by a press outside it or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  if (!editable) return <CallerAvatar caller={caller} size={44} className="ring-2 ring-white/20" />;
  const run = async (work: () => Promise<{ ok: true } | { ok: false; message: string }>) => {
    setBusy(true);
    onFailed(null);
    const res = await work();
    setBusy(false);
    if (!res.ok) onFailed(res.message);
    return res.ok;
  };
  // A colour is the sound wave's, so choosing one puts any picture away first.
  const colour = (tint: number | null) =>
    run(async () => {
      if (caller.photoAt) {
        const gone = await removeCallerPhoto(role);
        if (!gone.ok) return gone;
      }
      return saveCallerTint(tint, role);
    });
  const shown = caller.photoAt ? null : tintOf(caller);
  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Change ${caller.name}'s picture`}
        title={`Change ${caller.name}'s picture or colour`}
        className="group relative block rounded-full"
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
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`${caller.name}'s picture`}
          className="absolute left-0 top-full z-50 mt-2 w-56 rounded-2xl bg-surface p-3 text-ink shadow-xl ring-1 ring-line"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Voice</p>
          <div className="mt-1.5">
            <VoiceSample voice={caller.voice} label={voiceLabel(caller.voice)} />
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Colour</p>
          <div className="mt-2 flex items-center gap-2">
            {TINT_NAMES.map((label, i) => (
              <button
                key={label}
                type="button"
                disabled={busy}
                onClick={() => void colour(i)}
                aria-label={label}
                aria-pressed={shown === i}
                title={label}
                className={clsx(
                  "grid size-7 place-items-center rounded-full bg-primary ring-2 ring-offset-2 ring-offset-surface",
                  shown === i ? "ring-ink" : "ring-transparent hover:ring-line",
                )}
              >
                <span className="size-3 rounded-full" style={{ background: `var(--caller-${i})` }} aria-hidden />
              </button>
            ))}
          </div>
          {caller.tint != null && !caller.photoAt && (
            <button type="button" disabled={busy} onClick={() => void colour(null)} className="mt-2 text-xs text-ink-2 hover:text-ink">
              Back to the colour of its name
            </button>
          )}
          <div className="mt-3 border-t border-line pt-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => pick.current?.click()}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-ink hover:bg-canvas"
            >
              <Camera className="size-4 text-ink-2" aria-hidden /> {caller.photoAt ? "Change the picture" : "Upload a picture"}
            </button>
            {caller.photoAt && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => removeCallerPhoto(role))}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-ink hover:bg-canvas"
              >
                <Trash2 className="size-4 text-ink-2" aria-hidden /> Remove the picture
              </button>
            )}
          </div>
          <input
            ref={pick}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void run(() => uploadCallerPhoto(file, role)).then((ok) => ok && setOpen(false));
            }}
          />
        </div>
      )}
    </div>
  );
}

function Changes({ changes }: { changes?: CoachTurn["changes"] }) {
  if (!changes) return null;
  const rows = [
    ...changes.added.map((t) => ({ t, word: "Added" })),
    ...(changes.locked ?? []).map((t) => ({ t, word: "Locked in" })),
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
  // Locked in as a rule it follows on every call, or back to a note (16 Nov 2026, Martin: lock things into its rules).
  const [said, setSaid] = useState<string | null>(null);
  const lock = async () => {
    setBusy(true);
    setSaid(null);
    const res = await lockNote(note.id, !note.locked);
    setBusy(false);
    if (res.ok) onNotes(res.notes);
    else setSaid(res.message);
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
      {note.locked ? (
        <Lock className="mt-1 size-3 shrink-0 text-sun-line" aria-hidden />
      ) : (
        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sun-line" aria-hidden />
      )}
      <span className="flex-1">
        {note.text}
        {said && <span className="block text-xs text-warning">{said}</span>}
      </span>
      {editable && (
        <span className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={() => void lock()}
            disabled={busy}
            aria-pressed={Boolean(note.locked)}
            aria-label={note.locked ? "Unlock this rule: back to a note" : "Lock this in as a rule"}
            title={note.locked ? "Unlock: back to a note" : "Lock in as a rule, followed on every call"}
            className="text-muted hover:text-ink"
          >
            {note.locked ? <LockOpen className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
          </button>
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
