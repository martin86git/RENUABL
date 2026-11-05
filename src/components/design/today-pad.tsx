"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Eye, HardHat, KanbanSquare, Mail, Phone, Sun } from "lucide-react";
import { LAUNCH_MARKET, greeting } from "@/lib/domain/market";
import { nextHeadline, type NextItem } from "@/lib/domain/design/next-up";
import { WELCOME_TOUR } from "@/lib/domain/design/welcome";
import { agentFor, type AgentStage } from "@/lib/domain/design/sol-agents";
import {
  TODAY_TABS,
  agendaFor,
  beforeYouCall,
  daySoFar,
  jobOf,
  nextWorkingDay,
  pipelineBoard,
  solDayScript,
  type BeforeCall,
  type SolBeat,
  type TodayTab,
} from "@/lib/domain/design/today-pad";
import type { Activity } from "@/lib/domain/design/crm";
import { mailMarkWords, type MailMark } from "@/lib/domain/design/email-opens";
import type { SolFile, SolReminder } from "@/lib/domain/design/sol";
import type { SolDesignShown } from "@/lib/domain/design/sol-designs";
import type { ISODate } from "@/lib/domain/types";
import { dollars, loadCustomer, loadJob, type JobLine } from "@/lib/services/crm";
import { loadMailMarks } from "@/lib/services/deal-pulse";
import { inboxUnread } from "@/lib/services/inbox";
import { SOL_CHANGED, SOL_TOGGLE, askSol, loadSol } from "@/lib/services/sol";
import { PATHS } from "./design-shell";
import { NextCard, Numbers, useNextUp } from "./canvas-pad";
import { InboxPage } from "./inbox";
import { NewLook, Spotlight } from "./new-look";
import { Welcome } from "./today-welcome";
import { ReadyForYou, usePrepared } from "./ready-for-you";
import { SolBadge, SolIcon, SolMark, SolStars } from "./sol-icon";
import { AgentCard, AgentRound, OutboxChip, entryFor, useOutbox } from "./sol-agents";
import { SolDesignView } from "./sol-design-view";
import { SolText } from "./sol-text";
import { AttachButton, AttachedFiles, solFilesOf, useSolAttach } from "./sol-attach";
import { DictateButton, withSpoken } from "./dictate";
import { SolThinking } from "./sol-thinking";

const TAB_ICONS: Record<TodayTab, typeof Sun> = { today: Sun, inbox: Mail, calendar: CalendarDays, pipeline: KanbanSquare };
/** Items under To action before "N more". */
const SHOWN = 5;
/** How long Sol waits for his drafts, and for Before you call, before telling the day without them. */
const WAIT_MS = 2500;
const CALL_WAIT_MS = 9000;
/** A pause between one thing Sol says or puts in place and the next. */
const BEAT_GAP_MS = 260;

const dayWords = (d: string) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${d}T12:00:00Z`));

/** An instant as its day and 24-hour time in the market. */
function timeOf(iso: string): { day: string; time: string } {
  const at = new Date(iso);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: LAUNCH_MARKET.timeZone }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAUNCH_MARKET.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
  return { day, time };
}
const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
};
const hourNow = () => Number(new Date().toLocaleString("en-AU", { hour: "numeric", hourCycle: "h23", timeZone: LAUNCH_MARKET.timeZone }));
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One turn of the conversation on Today: Sol telling the day, or a question and his answer. */
type Turn =
  | { id: number; kind: "day" }
  | { id: number; kind: "ask"; q: string; a: { text: string; more: boolean; designs?: SolDesignShown[] } | null };

/**
 * Today as one chat with Sol (3 Nov 2026, Martin: the pad and Sol's box felt like two things; it should feel like one
 * large chat screen, not a software landing pad). Across its top Today, Calendar and Pipeline, and in the corner "Your
 * day" (the sun keeping time on the day's list). Today opens on the greeting in the middle with **Show me my day** and
 * Sol's box under it; pressing it (or asking anything) folds the greeting away and Sol writes the day up as you watch:
 * his words typed out, and between them **Up first**, **Before you call**, the rest **to action** and what he drafted,
 * each put in place as he gets to it (`solDayScript`). Questions and his answers carry on in the same column, and the
 * box docks at its foot. Calendar is a day's installs and reminders; Pipeline is the deals being sold as a board, or the
 * numbers; asking from either comes back to Today's conversation.
 */
export function TodayPad(props: {
  jobs: JobLine[] | null;
  today: ISODate;
  business: string;
  name: string | null;
  email: string;
  /** What this member did today, from the overview. */
  mine: Pick<Activity, "kind" | "by">[] | null;
  problem: string | null;
  /** The day's list with the sun (the corner's view). */
  day: React.ReactNode;
  /** The welcome is still to be shown (welcome.ts): Sol types it in place of the greeting. */
  welcome?: boolean;
  /** The owner: the welcome asks them to add the team. */
  owner?: boolean;
}) {
  const [tab, setTab] = useState<TodayTab | "day">("today");
  const [welcoming, setWelcoming] = useState(Boolean(props.welcome));
  // The welcome's tour, run once the greeting is back on the page so every place it lights is there.
  const [touring, setTouring] = useState(false);
  const tour = () => {
    setWelcoming(false);
    window.setTimeout(() => setTouring(true), 80);
  };
  // Gmail's own unread count on the Inbox tab (none until a mailbox is connected).
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let gone = false;
    void inboxUnread().then((r) => !gone && r.ok && setUnread(r.unread));
    return () => {
      gone = true;
    };
  }, [tab]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [asking, setAsking] = useState(false);
  const items = useNextUp(props.jobs, props.today);
  const end = useRef<HTMLDivElement>(null);
  const talking = turns.length > 0;
  const dayTold = turns.some((t) => t.kind === "day");

  /** Keeps the newest of the conversation in view, unless the member has scrolled up to read. */
  const follow = useCallback(() => {
    const el = end.current;
    if (!el) return;
    const below = el.getBoundingClientRect().bottom - window.innerHeight;
    if (below > -40 && below < 480) el.scrollIntoView({ block: "end", behavior: reducedMotion() ? "auto" : "smooth" });
  }, []);

  const showDay = () => {
    setTab("today");
    if (!dayTold) setTurns((t) => [...t, { id: Date.now(), kind: "day" }]);
  };
  const ask = async (q: string, files: SolFile[] = []) => {
    if (asking) return;
    const id = Date.now();
    setTab("today");
    setAsking(true);
    const shownQ = q + (files.length ? `${q ? "\n" : ""}(Attached: ${files.map((f) => f.name).join(", ")})` : "");
    setTurns((t) => [...t, { id, kind: "ask", q: shownQ, a: null }]);
    window.setTimeout(() => end.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 60);
    const r = await askSol(q, files);
    setAsking(false);
    let a: { text: string; more: boolean; designs?: SolDesignShown[] };
    if (!r.ok) a = { text: r.message, more: false };
    else {
      window.dispatchEvent(new CustomEvent(SOL_CHANGED, { detail: r.state }));
      const last = [...r.state.turns].reverse().find((t) => t.role === "sol");
      a = {
        text: last?.text ?? "Done.",
        more: Boolean(last?.charts?.length || last?.diagrams?.length || last?.drafts?.length || last?.reminder),
        // A roof design he shows is drawn here, in the conversation itself (3 Nov 2026, Martin).
        ...(last?.designs?.length ? { designs: last.designs } : {}),
      };
    }
    setTurns((all) => all.map((t) => (t.id === id && t.kind === "ask" ? { ...t, a } : t)));
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-13rem)] w-full max-w-6xl flex-col">
      <div className="flex items-center gap-2">
        <span className="hidden w-28 shrink-0 sm:block" aria-hidden />
        <nav aria-label="Today" className="flex min-w-0 flex-1 justify-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-0.5 rounded-full bg-surface p-1 ring-1 ring-line">
            {TODAY_TABS.map((t) => {
              const Icon = TAB_ICONS[t.id];
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-pressed={on}
                  className={clsx(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition",
                    on ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {t.label}
                  {t.id === "inbox" && unread > 0 && (
                    <span
                      className={clsx(
                        "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                        on ? "bg-white/20" : "bg-sun text-sun-ink",
                      )}
                    >
                      {unread}
                    </span>
                  )}
                  {t.id === "today" && items && items.length > 0 && (
                    <span
                      className={clsx(
                        "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                        on ? "bg-white/20" : "bg-sun text-sun-ink",
                      )}
                    >
                      {items.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
        <button
          type="button"
          onClick={() => setTab(tab === "day" ? "today" : "day")}
          aria-pressed={tab === "day"}
          title="Your day: what needs clearing before the sun sets"
          className={clsx(
            "flex w-28 shrink-0 items-center justify-end gap-1.5 rounded-full py-1.5 pl-2 pr-3 text-[13px] text-ink-2 transition hover:text-ink",
            tab === "day" && "bg-surface ring-1 ring-line",
          )}
        >
          <Sun className="size-4 text-sun-line" aria-hidden /> Your day
        </button>
      </div>

      {props.problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {props.problem}
        </p>
      )}

      <div className={clsx("mt-8 flex flex-1 flex-col", tab !== "today" && "hidden")}>
        {welcoming && (
          <Welcome
            firstName={props.name}
            business={props.business}
            owner={Boolean(props.owner)}
            onDone={() => setWelcoming(false)}
            onTour={tour}
          />
        )}
        {!welcoming && (
          <div className="mx-auto w-full max-w-3xl">
            <NewLook name={props.name} />
          </div>
        )}
        {/* The greeting, in the middle of the screen until the conversation starts, then folded away. */}
        <div
          className={clsx(
            "flex flex-col justify-center transition-[flex-grow,opacity] duration-500 ease-out",
            welcoming && "hidden",
            talking ? "grow-0 opacity-0" : "grow opacity-100",
          )}
          aria-hidden={talking}
        >
          <div
            className={clsx("grid transition-[grid-template-rows] duration-500 ease-out", talking ? "grid-rows-[0fr]" : "grid-rows-[1fr]")}
          >
            <div className="overflow-hidden">
              <Hello {...props} count={items?.length ?? null} onDay={showDay} onAsk={ask} asking={asking} hidden={talking} />
            </div>
          </div>
        </div>

        {talking && (
          <div className="mx-auto w-full max-w-3xl flex-1 space-y-7 pb-4 pt-2" aria-live="polite">
            {turns.map((t) =>
              t.kind === "day" ? (
                <SolDay key={t.id} {...props} items={items} onGrow={follow} />
              ) : (
                <div key={t.id} className="space-y-4">
                  <div className="flex justify-end">
                    <p className="max-w-[80%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-ink">
                      {t.q}
                    </p>
                  </div>
                  <SolSays>
                    {!t.a ? (
                      <SolThinking />
                    ) : (
                      <div className="text-[15px] leading-relaxed text-ink">
                        <Typed text={t.a.text} onDone={follow} />
                        {t.a.designs?.length ? (
                          <div className="mt-3 max-w-2xl space-y-3">
                            {t.a.designs.map((d) => (
                              <SolDesignView key={d.jobId} shown={d} />
                            ))}
                          </div>
                        ) : null}
                        {t.a.more && (
                          <button
                            type="button"
                            onClick={() => window.dispatchEvent(new Event(SOL_TOGGLE))}
                            className="mt-2 block text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink"
                          >
                            There is more with it in your conversation with Sol. Open it
                          </button>
                        )}
                      </div>
                    )}
                  </SolSays>
                </div>
              ),
            )}
            <div ref={end} className="scroll-mb-40" />
          </div>
        )}
      </div>

      {tab !== "today" && (
        <div className="mt-8 flex-1">
          {tab === "inbox" && <InboxPage />}
          {tab === "calendar" && <CalendarView jobs={props.jobs} today={props.today} />}
          {tab === "pipeline" && <PipelineView jobs={props.jobs} today={props.today} />}
          {tab === "day" && props.day}
        </div>
      )}

      {touring && <Spotlight steps={WELCOME_TOUR} onEnd={() => setTouring(false)} />}

      {(talking || tab !== "today") && (
        <div className="sticky bottom-0 z-10 bg-gradient-to-t from-canvas from-60% to-transparent pb-5 pt-10 print:hidden">
          <div className="mx-auto max-w-3xl">
            {!dayTold && (
              <button
                type="button"
                onClick={showDay}
                className="mb-2.5 inline-flex h-9 items-center gap-2 rounded-full bg-surface px-3.5 text-[13px] font-medium text-ink ring-1 ring-line hover:ring-sun-line"
              >
                <SolIcon className="size-3.5 text-sun-line" aria-hidden /> Show me my day
              </button>
            )}
            <SolBox onAsk={ask} asking={asking} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Sol's round, small, for the start of each thing he says. */
function SolAvatar() {
  return (
    <span className="sol-orb relative mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full" aria-hidden>
      <SolMark className="size-6" glow={false} />
    </span>
  );
}

/** Something Sol says in the conversation: his round, then his words and what he puts in place. */
export function SolSays({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <SolAvatar />
      <div className="min-w-0 flex-1 pt-1">
        <p className="sr-only">Sol:</p>
        {children}
      </div>
    </div>
  );
}

/** The greeting in the middle of the screen, with Show me my day and Sol's box under it. */
function Hello(props: {
  business: string;
  name: string | null;
  count: number | null;
  asking: boolean;
  hidden: boolean;
  onDay: () => void;
  onAsk: (q: string, files: SolFile[]) => void;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-1 py-10 text-center" inert={props.hidden}>
      <span className="relative">
        <span className="sol-orb sol-breathe inline-flex size-16 items-center justify-center rounded-full">
          <SolMark className="size-12" />
        </span>
        <SolStars className="absolute -right-3 -top-3 size-6" />
      </span>
      <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{props.business || "Your business"}</p>
      <h1 className="mt-2 text-[clamp(30px,4.4vw,48px)] font-light leading-[1.05] tracking-[-0.025em] text-ink">
        {greeting()}
        {props.name ? `, ${props.name}` : ""}.
      </h1>
      <p className="mt-3 text-[15px] text-ink-2">{props.count === null ? "Looking at your day…" : nextHeadline(props.count, hourNow())}</p>
      <div data-tour="today-sol" className="flex w-full flex-col items-center">
        <button
          type="button"
          onClick={props.onDay}
          className="group mt-7 inline-flex h-12 items-center gap-2.5 rounded-full bg-primary pl-2 pr-5 text-[15px] font-medium text-primary-ink shadow-[0_6px_20px_rgb(20_22_26_/_0.18)] transition hover:shadow-[0_6px_24px_rgb(255_90_31_/_0.35)]"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/10">
            <SolBadge className="size-5 transition-transform duration-300 group-hover:scale-110" />
          </span>
          Show me my day
        </button>
        <div className="mt-8 w-full">
          <SolBox onAsk={props.onAsk} asking={props.asking} />
        </div>
      </div>
    </div>
  );
}

/** Sol's box: what is asked goes to Sol, in the same conversation as his panel. */
export function SolBox({
  onAsk,
  asking,
  id = "today-ask",
  placeholder = "Ask Sol about your deals, your day, or what to say to a customer",
}: {
  /** The words, and any PDFs or pictures attached (read for Sol). */
  onAsk: (q: string, files: SolFile[]) => void;
  asking: boolean;
  id?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [heard, setHeard] = useState("");
  // Speak and attach, as in his panel (5 Nov 2026, Martin): the microphone and the paperclip.
  const attach = useSolAttach();
  const ready = text.trim().length >= 2 || attach.files.length > 0;
  const send = async () => {
    const said = text.trim();
    if (!ready || asking) return;
    const files = await solFilesOf(attach.files);
    if (!files) return attach.setProblem("That file couldn't be read: try again.");
    setText("");
    setHeard("");
    attach.clear();
    onAsk(said, files);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      className="rounded-[26px] bg-surface p-2 pl-4 text-left shadow-[0_8px_30px_rgb(20_22_26_/_0.08)] ring-1 ring-line focus-within:ring-sun-line"
    >
      <AttachedFiles attach={attach} />
      <div className="flex items-center gap-1.5">
        <SolBadge className="size-5 shrink-0" />
        <label className="sr-only" htmlFor={id}>
          Ask Sol
        </label>
        <input
          id={id}
          value={heard ? withSpoken(text, heard) : text}
          onChange={(e) => {
            setHeard("");
            setText(e.target.value);
          }}
          maxLength={4000}
          autoComplete="off"
          placeholder={placeholder}
          className="ml-1 h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
        />
        <AttachButton attach={attach} />
        <DictateButton label="Speak to Sol" onHearing={setHeard} onWords={(w) => setText((t) => withSpoken(t, w).slice(0, 4000))} />
        <button
          type="submit"
          disabled={asking || !ready}
          aria-label="Ask Sol"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-sun-line text-white disabled:bg-surface-2 disabled:text-muted"
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </div>
    </form>
  );
}

/** Words Sol is writing, a few letters at a time with his caret, then done. Instant with reduced motion. */
export function Typed({ text, onDone, instant = false }: { text: string; onDone?: () => void; instant?: boolean }) {
  const [shown, setShown] = useState(0);
  const done = useRef(false);
  const all = instant || shown >= text.length;
  useEffect(() => {
    if (instant || reducedMotion()) {
      const t = window.setTimeout(() => setShown(text.length), 0);
      return () => window.clearTimeout(t);
    }
    // A long answer is written faster, so none takes more than about three seconds.
    const step = Math.max(2, Math.ceil(text.length / 160));
    const t = window.setInterval(() => setShown((n) => Math.min(text.length, n + step + (Math.random() < 0.3 ? 1 : 0))), 18);
    return () => window.clearInterval(t);
  }, [text, instant]);
  useEffect(() => {
    if (all && !done.current) {
      done.current = true;
      onDone?.();
    }
  }, [all, onDone]);
  // Laid out as he writes (sol-text.tsx): paragraphs, round bullets, the key point and any question highlighted.
  return (
    <SolText
      text={all ? text : text.slice(0, shown)}
      tail={
        !all && (
          <span
            className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] animate-pulse rounded-full bg-sun-line"
            aria-hidden
          />
        )
      }
    />
  );
}

/**
 * A part of the day Sol puts in place: it comes in out of a soft blur with a warm light passing across it once, as if
 * being made, then says it is done. Still with reduced motion.
 */
function Made({
  children,
  onDone,
  instant,
  after = 650,
}: {
  children: React.ReactNode;
  onDone: () => void;
  instant: boolean;
  after?: number;
}) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    const t = window.setTimeout(
      () => {
        done.current = true;
        onDone();
      },
      instant || reducedMotion() ? 0 : after,
    );
    return () => window.clearTimeout(t);
  }, [instant, after, onDone]);
  return (
    <div className={clsx("relative", !instant && "motion-safe:animate-[sol-made_700ms_cubic-bezier(.2,.7,.2,1)_both]")}>
      {children}
      {!instant && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl motion-safe:animate-[sol-sweep_1200ms_ease-out_both] motion-reduce:hidden"
          style={{
            backgroundImage: "linear-gradient(100deg, transparent 25%, rgb(255 138 61 / 0.16) 50%, transparent 75%)",
            backgroundSize: "250% 100%",
          }}
        />
      )}
      <style>{`@keyframes sol-made{from{opacity:0;filter:blur(8px);transform:translateY(10px) scale(.985)}to{opacity:1;filter:none;transform:none}}@keyframes sol-sweep{from{background-position:120% 0;opacity:1}to{background-position:-20% 0;opacity:0}}@keyframes sol-row{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

/** Before you call, read from the first customer's record: undefined while looking, null when there is none. */
type CallFacts = { id: string; name: string; phone: string; email: string; facts: BeforeCall };
function useBeforeCall(jobId: string | null, today: ISODate): CallFacts | null | undefined {
  const [got, setGot] = useState<{ for: string | null; facts: CallFacts | null } | null>(null);
  useEffect(() => {
    if (!jobId) return;
    let gone = false;
    void loadJob(jobId).then(async (j) => {
      if (gone) return;
      if (!j.ok) return setGot({ for: jobId, facts: null });
      const c = await loadCustomer(j.customer.id);
      if (gone) return;
      setGot({
        for: jobId,
        facts: {
          id: jobId,
          name: j.customer.name,
          phone: j.customer.phone,
          email: j.customer.email,
          facts: beforeYouCall({ job: j.job, customer: j.customer, activity: c.ok ? c.activity : [], today }),
        },
      });
    });
    return () => {
      gone = true;
    };
  }, [jobId, today]);
  if (!jobId) return null;
  return got?.for === jobId ? got.facts : undefined;
}

/** What Sol is telling, fixed when he starts so the list doesn't change under him. */
type Told = {
  beats: SolBeat[];
  first: NextItem | null;
  rest: NextItem[];
  call: CallFacts | null;
};

/**
 * Sol telling the member their day, as they watch: he looks first (his thinking drawings while the list, Before you
 * call and his drafts are read), then writes it up a line at a time, putting each part in place as he reaches it.
 * "Show it all" finishes it at once.
 */
function SolDay(props: {
  jobs: JobLine[] | null;
  today: ISODate;
  name: string | null;
  email: string;
  mine: Pick<Activity, "kind" | "by">[] | null;
  items: NextItem[] | null;
  onGrow: () => void;
}) {
  const { items, onGrow } = props;
  const first = items?.[0] ?? null;
  const call = useBeforeCall(first ? jobOf(first) : null, props.today);
  const { items: prepared } = usePrepared();
  const [told, setTold] = useState<Told | null>(null);
  const [waited, setWaited] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [step, setStep] = useState(0);
  const [instant, setInstant] = useState(false);
  const [all, setAll] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), WAIT_MS);
    const u = window.setTimeout(() => setGaveUp(true), CALL_WAIT_MS);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(u);
    };
  }, []);
  const ready = items !== null && (gaveUp || (call !== undefined && (prepared !== null || waited)));
  useEffect(() => {
    if (!ready || told || !items) return;
    const t = window.setTimeout(() => {
      const facts = call ?? null;
      setTold({
        first: items[0] ?? null,
        rest: items.slice(1),
        call: facts,
        beats: solDayScript({
          count: items.length,
          callName: facts ? facts.name.split(/\s+/)[0] : null,
          done: props.mine ? daySoFar(props.mine, props.email) : null,
          ready: Boolean(prepared?.length),
          hour: hourNow(),
          name: props.name,
        }),
      });
    }, 0);
    return () => window.clearTimeout(t);
  }, [ready, told, items, call, prepared, props.mine, props.email, props.name]);

  const next = useCallback(() => {
    window.setTimeout(() => setStep((s) => s + 1), instant ? 0 : BEAT_GAP_MS);
  }, [instant]);
  useEffect(() => {
    if (told) onGrow();
  }, [step, told, onGrow]);

  if (!told)
    return (
      <SolSays>
        <SolThinking say="Looking at your day…" />
      </SolSays>
    );
  const writing = step < told.beats.length;
  return (
    <SolSays>
      <div className="space-y-4">
        {told.beats.slice(0, step + 1).map((b, i) => {
          const live = i === step;
          const done = live ? next : noop;
          if ("say" in b)
            return (
              <div key={i} className="text-[15.5px] leading-relaxed text-ink">
                <Typed text={b.say} onDone={done} instant={instant || !live} />
              </div>
            );
          const quick = instant || !live;
          if (b.show === "first" && told.first)
            return (
              <Made key={i} onDone={done} instant={quick}>
                <div className="rounded-3xl bg-surface p-2 ring-1 ring-line">
                  <NextCard item={told.first} lead flush />
                </div>
              </Made>
            );
          if (b.show === "call" && told.call)
            return (
              <Made key={i} onDone={done} instant={quick}>
                <CallCard got={told.call} />
              </Made>
            );
          if (b.show === "rest") {
            const shown = all ? told.rest : told.rest.slice(0, SHOWN);
            return (
              <Made key={i} onDone={done} instant={quick} after={400 + Math.min(told.rest.length, SHOWN) * 110}>
                <div className="rounded-3xl bg-surface px-4 py-1 ring-1 ring-line sm:px-5">
                  <ul className="divide-y divide-line">
                    {shown.map((it, n) => (
                      <li
                        key={it.key}
                        className={clsx(!quick && "motion-safe:animate-[sol-row_450ms_ease-out_both]")}
                        style={quick ? undefined : { animationDelay: `${200 + n * 110}ms` }}
                      >
                        <NextCard item={it} />
                      </li>
                    ))}
                  </ul>
                  {told.rest.length > SHOWN && (
                    <button
                      type="button"
                      onClick={() => setAll(!all)}
                      className="tap-area mb-2 mt-1 text-[13px] font-medium text-ink-2 hover:text-ink"
                    >
                      {all ? "Show fewer" : `${told.rest.length - SHOWN} more`}
                    </button>
                  )}
                </div>
              </Made>
            );
          }
          if (b.show === "ready")
            return (
              <Made key={i} onDone={done} instant={quick}>
                <ReadyForYou compact />
              </Made>
            );
          // A part with nothing to show (its data went): move straight on.
          return <Skip key={i} onDone={done} />;
        })}
        {writing && !instant && (
          <button
            type="button"
            onClick={() => setInstant(true)}
            className="text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Show it all
          </button>
        )}
      </div>
    </SolSays>
  );
}

const noop = () => {};

function Skip({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    onDone();
  }, [onDone]);
  return null;
}

/** What to know about the first customer on the list before ringing them, from their record. */
function CallCard({ got }: { got: CallFacts }) {
  return (
    <section aria-label="Before you call" className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Before you call</p>
      <p className="mt-2 text-[15px] font-medium text-ink">{got.name}</p>
      <p className="text-[13px] text-ink-2">{got.facts.deal}</p>
      {got.facts.last && <p className="mt-2 text-[13px] text-ink-2">{got.facts.last}</p>}
      {got.facts.open.length > 0 && (
        <ul className="mt-2 space-y-1 text-[13px] text-ink-2">
          {got.facts.open.map((o) => (
            <li key={o} className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sun-line" aria-hidden />
              {o}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {got.phone && (
          <a
            href={`tel:${got.phone.replace(/\s+/g, "")}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-ink hover:bg-forest"
          >
            <Phone className="size-3.5" aria-hidden /> {got.phone}
          </a>
        )}
        {got.email && (
          <Link
            href={`${PATHS.deals}/${got.id}?tab=email`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-ink ring-1 ring-line hover:ring-ink-2"
          >
            <Mail className="size-3.5" aria-hidden /> Email
          </Link>
        )}
        <Link
          href={`${PATHS.deals}/${got.id}`}
          className="inline-flex h-9 items-center px-2 text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          Open deal
        </Link>
      </div>
    </section>
  );
}

/** A day's installs and the member's own reminders, stepping through the working days. */
function CalendarView({ jobs, today }: { jobs: JobLine[] | null; today: ISODate }) {
  const [days, setDays] = useState<string[]>([today]);
  const [reminders, setReminders] = useState<SolReminder[] | null>(null);
  useEffect(() => {
    let gone = false;
    void loadSol().then((r) => !gone && setReminders(r.ok ? r.state.reminders : []));
    return () => {
      gone = true;
    };
  }, []);
  const day = days[days.length - 1];
  const items = jobs && reminders ? agendaFor(day, { jobs, reminders, timeOf }) : null;
  return (
    <section aria-label="Calendar" className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setDays(days.slice(0, -1))}
          disabled={days.length === 1}
          aria-label="The day before"
          className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-canvas hover:text-ink disabled:text-line"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <p className="min-w-[14rem] text-center text-sm font-semibold text-ink">
          {day === today ? "Today" : days.length === 2 ? "Next working day" : "Ahead"}{" "}
          <span className="font-normal text-muted">· {dayWords(day)}</span>
        </p>
        <button
          type="button"
          onClick={() => setDays([...days, nextWorkingDay(day)])}
          disabled={days.length > 15}
          aria-label="The next working day"
          className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-canvas hover:text-ink disabled:text-line"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      {!items ? (
        <p className="mt-6 animate-pulse text-center text-sm text-muted">Looking…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-center text-sm text-ink-2">
          Nothing booked. Installs on their day, and reminders you ask Sol for, show here.
        </p>
      ) : (
        <ol className="mx-auto mt-5 max-w-2xl divide-y divide-line">
          {items.map((i) => {
            const body = (
              <span className="flex items-center gap-4 py-3">
                <span className="w-16 shrink-0 text-right text-[13px] tabular-nums text-ink-2">{i.time ? clock(i.time) : ""}</span>
                <span
                  className={clsx(
                    "grid size-8 shrink-0 place-items-center rounded-full",
                    i.kind === "install" ? "bg-sun text-sun-line" : "bg-surface-2 text-ink-2",
                  )}
                >
                  {i.kind === "install" ? <HardHat className="size-4" aria-hidden /> : <SolIcon className="size-4" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-ink">{i.title}</span>
                  <span className="block truncate text-[12.5px] text-ink-2">{i.line}</span>
                </span>
              </span>
            );
            return (
              <li key={i.key}>
                {i.jobId ? (
                  <Link href={`${PATHS.deals}/${i.jobId}`} className="block hover:bg-canvas">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-5 text-center text-[12px] text-muted">
        <Link href={PATHS.scheduler} className="underline-offset-4 hover:text-ink hover:underline">
          Open the install calendar
        </Link>
      </p>
    </section>
  );
}

/**
 * The mail mark on a pipeline card (5 Nov 2026, Martin: Sol and his helpers do the reaching out, so the board shows it
 * at a glance): an envelope once an email has gone from the deal, and an eye on its corner, like a notification, once
 * the latest has been opened. The words are in its title. An open is a mail app loading pictures, a guide, not proof.
 */
function MailBadge({ mark }: { mark: MailMark }) {
  const words = mailMarkWords(mark, LAUNCH_MARKET.timeZone);
  return (
    <span
      className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-full bg-canvas text-ink-2"
      title={words}
      role="img"
      aria-label={words}
    >
      <Mail className="size-3.5" aria-hidden />
      {mark.opened && (
        <span
          className="absolute -right-1 -top-1 inline-flex size-3.5 items-center justify-center rounded-full bg-sun-line text-white ring-2 ring-surface"
          aria-hidden
        >
          <Eye className="size-2.5" strokeWidth={2.5} />
        </span>
      )}
    </span>
  );
}

/** The deals being sold as a board, or the numbers. */
function PipelineView({ jobs, today }: { jobs: JobLine[] | null; today: ISODate }) {
  const [numbers, setNumbers] = useState(false);
  // Which deals an email has gone from, and whether the latest was opened (Sol and the team's emails alike).
  const [marks, setMarks] = useState<Record<string, MailMark> | null>(null);
  useEffect(() => {
    let gone = false;
    void loadMailMarks().then((r) => !gone && r.ok && setMarks(r.marks));
    return () => {
      gone = true;
    };
  }, []);
  // Sol's sales agents: one outbox behind a round on each column and a chip on each card (sol-agents.tsx).
  const { box, reload, now } = useOutbox();
  const [agent, setAgent] = useState<AgentStage | null>(null);
  const needing = new Set(box?.needsYou.map((n) => n.jobId) ?? []);
  const pill = (on: boolean) =>
    clsx("rounded-full px-3 py-1 text-[13px] transition", on ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink");
  return (
    <section aria-label="Pipeline" className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <div className="flex justify-center">
        <div className="inline-flex gap-0.5 rounded-full bg-canvas p-1 ring-1 ring-line" role="tablist" aria-label="Pipeline">
          <button type="button" role="tab" aria-selected={!numbers} onClick={() => setNumbers(false)} className={pill(!numbers)}>
            Board
          </button>
          <button type="button" role="tab" aria-selected={numbers} onClick={() => setNumbers(true)} className={pill(numbers)}>
            Numbers
          </button>
        </div>
      </div>
      <div className="mt-5">
        {numbers ? (
          <Numbers jobs={jobs} today={today} />
        ) : !jobs ? (
          <p className="animate-pulse text-center text-sm text-muted">Looking…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pipelineBoard(jobs).map((s) => (
              <div key={s.stage} className="rounded-2xl bg-canvas p-3">
                <div className="flex items-center justify-between gap-2 px-1">
                  <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {s.label} <span className="tabular-nums">{s.count}</span>
                    {s.value > 0 && <span className="ml-2 tabular-nums normal-case tracking-normal">{dollars(s.value)}</span>}
                  </p>
                  {agentFor(s.stage) && <AgentRound stage={agentFor(s.stage)!} box={box} onOpen={() => setAgent(agentFor(s.stage))} />}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {s.jobs.map((j) => (
                    <li key={j.id}>
                      <Link
                        href={`${PATHS.deals}/${j.id}`}
                        className="relative block rounded-xl bg-surface px-3 py-2 ring-1 ring-line hover:ring-sun-line"
                      >
                        {marks?.[j.id] && <MailBadge mark={marks[j.id]} />}
                        <span className={clsx("block truncate text-[13px] font-medium text-ink", marks?.[j.id] && "pr-7")}>
                          {j.customerName}
                        </span>
                        <span className="block truncate text-[12px] text-ink-2">
                          {[j.title, j.value ? dollars(j.value) : null, j.kw ? `${j.kw} kW` : null].filter(Boolean).join(" · ")}
                        </span>
                        <OutboxChip entry={entryFor(box, j.id)} needsYou={needing.has(j.id)} now={now} />
                      </Link>
                    </li>
                  ))}
                  {s.count === 0 && <li className="px-1 text-[12px] text-muted">None</li>}
                </ul>
                {s.more > 0 && (
                  <Link href={PATHS.pipelines} className="mt-2 block px-1 text-[12px] font-medium text-ink-2 hover:text-ink">
                    {s.more} more
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {agent && box && <AgentCard stage={agent} box={box} now={now} onClose={() => setAgent(null)} reload={reload} />}
    </section>
  );
}
