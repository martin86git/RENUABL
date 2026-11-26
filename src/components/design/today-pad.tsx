"use client";

import { SolShortcutList, SolShortcutRounds } from "./sol-shortcuts";
import type { SolTopic } from "@/lib/domain/design/sol-suggest";
import { useSolAhead } from "./sol-ahead";
import { useStageNames } from "./stage-select";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, ArrowUpRight, ChevronLeft, ChevronRight, Eye, HardHat, Mail, Phone, Play, RefreshCw, Search, X } from "lucide-react";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { searchNext, searchWords, workThroughAt, type NextItem } from "@/lib/domain/design/next-up";
import { WELCOME_TOUR } from "@/lib/domain/design/welcome";
import { agentFor, type AgentStage } from "@/lib/domain/design/sol-agents";
import {
  agendaFor,
  beforeYouCall,
  daySoFar,
  jobOf,
  nextWorkingDay,
  pipelineBoard,
  solDayScript,
  type BeforeCall,
  type SolBeat,
} from "@/lib/domain/design/today-pad";
import type { Activity } from "@/lib/domain/design/crm";
import { mailMarkWords, type MailMark } from "@/lib/domain/design/email-opens";
import type { SolFile, SolReminder, SolState, SolTurn } from "@/lib/domain/design/sol";
import { roomTurns } from "@/lib/domain/design/sol-rooms";
import type { SolDesignShown } from "@/lib/domain/design/sol-designs";
import type { SolGoTo } from "@/lib/domain/design/sol-goto";
import type { ISODate } from "@/lib/domain/types";
import { dollars, loadCustomer, loadJob, type JobLine } from "@/lib/services/crm";
import { loadMailMarks } from "@/lib/services/deal-pulse";
import {
  DRAFT_KEY,
  SOL_CHANGED,
  SOL_INDUCTION,
  askSol,
  askSolInPanel,
  handsToPanel,
  listSolPast,
  loadSol,
  openSolPast,
  remindAt,
  retrySol,
} from "@/lib/services/sol";
import { chatSince, tabTitle, tabTurns, tabTurnsIn } from "@/lib/domain/design/sol-tabs";
import { OPEN_SOL_TAB, dropTab, keepTab, tabById } from "@/lib/services/sol-tabs";
import { ReminderCard, goWhereAsked, openSolPage } from "./sol-chat";
import { SolChartView, SolDiagramView } from "./sol-visuals";
import { SolDraftCard, type DraftAsEdited } from "./sol-draft-card";
import { MeetingCard } from "./meeting-card";
import { PATHS } from "./design-shell";
import { NextCard, Numbers, useNextUp } from "./canvas-pad";
import { DealFeed } from "./deal-feed";
import { NewDeal } from "./design-customers";
import { Spotlight } from "./new-look";
import { Welcome } from "./today-welcome";
import { TODAY_CALENDAR, TodayChat, useInsights } from "./today-chat";
import { TodayCalendar } from "./today-calendar";
import { InstallListPage } from "./install-lists";
import { useDockSet } from "@/lib/services/dock-set";
import { TODAY_FIRST, learnAsked } from "@/lib/services/sol";
import { useNameHintBox } from "./name-hint-box";
import type { TodayView } from "@/lib/domain/design/today-view";
import { InductionReminder } from "./sol-induction";
import { ReadyForYou, usePrepared } from "./ready-for-you";
import { SolIcon } from "./sol-icon";
import { SolBadge, SolMark } from "./sol-sun";
import { AgentCard, AgentRound, OutboxChip, entryFor, useOutbox } from "./sol-agents";
import { SolDesignView } from "./sol-design-view";
import { SolText, type OnAnswer } from "./sol-text";
import { replyToSol, type SolReply } from "@/lib/domain/design/sol-format";
import { MessageTools, QuotedWords, ReplyBanner } from "./message-tools";
import { AttachButton, AttachedFiles, solFilesOf, useSolAttach } from "./sol-attach";
import { DictateButton, withSpoken } from "./dictate";
import { SolThinking, SolWorking } from "./sol-thinking";

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
type Turn = { id: number; kind: "day" } | { id: number; kind: "ask"; q: string; a: TodayAnswer | null };

/**
 * Sol's answer on Today: `again` when it can be tried again (a real answer), `goTo` a page he opened. What he drew
 * or wrote with it (charts, diagrams, draft emails, a meeting, a reminder) is shown here too: Today's conversation is
 * its own, apart from his side panel's (sol-rooms.ts, 24 Nov 2026, Martin), so nothing of it waits there.
 */
type TodayAnswer = {
  text: string;
  designs?: SolDesignShown[];
  again?: boolean;
  goTo?: SolGoTo;
  with?: Pick<SolTurn, "charts" | "diagrams" | "drafts" | "meeting" | "reminder">;
};

/** Today's own room in the member's conversation with Sol. */
const TODAY_ROOM = "today" as const;

/** His latest answer in Today's conversation, as Today shows it. */
function todayAnswer(state: SolState): TodayAnswer {
  return answerOf(
    roomTurns(state.turns, TODAY_ROOM)
      .reverse()
      .find((t) => t.role === "sol"),
  );
}

/** One answer of his as Today shows it. */
function answerOf(last: SolTurn | undefined): TodayAnswer {
  const extra = last?.charts?.length || last?.diagrams?.length || last?.drafts?.length || last?.meeting || last?.reminder;
  return {
    text: last?.text ?? "Done.",
    ...(last && extra
      ? { with: { charts: last.charts, diagrams: last.diagrams, drafts: last.drafts, meeting: last.meeting, reminder: last.reminder } }
      : {}),
    // A roof design he shows is drawn here, in the conversation itself (3 Nov 2026, Martin).
    ...(last?.designs?.length ? { designs: last.designs } : {}),
    ...(last?.credits ? { again: true } : {}),
    ...(last?.goTo ? { goTo: last.goTo } : {}),
  };
}

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
  /** The feed or the calendar as a page of its own (23 Nov 2026, Martin: Today is Sol's screen alone). */
  only?: "feed" | "calendar";
}) {
  const router = useRouter();
  // The new deal form at the top of Today, opened by the orange + on the feed.
  const [adding, setAdding] = useState(false);
  const [welcoming, setWelcoming] = useState(Boolean(props.welcome));
  // Today is Sol's screen (23 Nov 2026, Martin: no switch; Feed lives in Deals, the calendar beside email). The feed
  // and the calendar are drawn by this same pad on their own pages (`only`).
  const view: TodayView = props.only ?? "chat";
  const onFeed = view === "feed";
  const onCal = view === "calendar";
  useEffect(() => {
    // Come from the phone's Sol round (`?today=first`): the address is tidied.
    if (new URLSearchParams(window.location.search).get("today") !== "first") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("today");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  // The welcome's tour, run once the greeting is back on the page so every place it lights is there.
  const [touring, setTouring] = useState(false);
  const tour = () => {
    setWelcoming(false);
    window.setTimeout(() => setTouring(true), 80);
  };
  const [turns, setTurns] = useState<Turn[]>([]);
  // Set once the chat's own fresh start is defined below (the effect under this one runs after render).
  const freshRef = useRef<() => void>(() => setTurns([]));
  // The phone's Sol round pressed while already on Today: back to the start, out of any conversation.
  useEffect(() => {
    const first = () => {
      freshRef.current();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener(TODAY_FIRST, first);
    return () => window.removeEventListener(TODAY_FIRST, first);
  }, []);
  // The date heading opens the calendar, its own page now (today-chat.tsx).
  useEffect(() => {
    const cal = () => router.push("/design/calendar");
    window.addEventListener(TODAY_CALENDAR, cal);
    return () => window.removeEventListener(TODAY_CALENDAR, cal);
  }, [router]);
  const jobsView = useDockSet() === "post";
  const [asking, setAsking] = useState(false);
  const items = useNextUp(props.jobs, props.today);
  const insights = useInsights();
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

  // My day pressed on the feed: written up in the feed's place, the deals staying beside it.
  const [feedDay, setFeedDay] = useState(false);
  const showDay = () => {
    if (!dayTold) setTurns((t) => [...t, { id: Date.now(), kind: "day" }]);
  };
  // A question of Sol's being answered in the box (8 Nov 2026, Martin): named in what goes to him.
  const [replyTo, setReplyTo] = useState<SolReply | null>(null);
  // The chat as a tab (sol-tabs.ts, 26 Nov 2026, Martin): when it began, the tab it came from, and which ask is this
  // chat's own (an answer to a chat minimised meanwhile lands in its tab, not here).
  const since = useRef<string | null>(null);
  const tabId = useRef<string | null>(null);
  const askedAt = useRef<string | null>(null);
  const seq = useRef(0);
  // A chat reopened from a tab while its answer was still coming: when it was asked.
  const [awaiting, setAwaiting] = useState<string | null>(null);
  const ask = async (q: string, files: SolFile[] = [], about: SolReply | null = null) => {
    if (asking || awaiting) return;
    setReplyTo(null);
    // On a phone a question asked on Today goes to Sol's own chat, not into a conversation under the Business | Feed
    // switch (23 Nov 2026, Martin). A file still goes in here: his panel's ask carries words only.
    if (handsToPanel() && !files.length && q.trim()) {
      const replied = replyToSol(about, q);
      askSolInPanel(replied.shown ? { text: replied.said, shown: replied.shown } : q);
      return;
    }
    const id = Date.now();
    const mine = ++seq.current;
    if (!since.current) since.current = chatSince(id);
    askedAt.current = chatSince(id);
    setAsking(true);
    const replied = replyToSol(about, q);
    const shownQ = (replied.shown ?? q) + (files.length ? `${q ? "\n" : ""}(Attached: ${files.map((f) => f.name).join(", ")})` : "");
    setTurns((t) => [...t, { id, kind: "ask", q: shownQ, a: null }]);
    window.setTimeout(() => end.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 60);
    const r = await askSol(replied.said || q, files, null, false, replied.shown, TODAY_ROOM);
    if (r.ok) window.dispatchEvent(new CustomEvent(SOL_CHANGED, { detail: r.state }));
    // Minimised while he answered: the answer belongs to its tab now.
    if (mine !== seq.current) return;
    setAsking(false);
    let a: TodayAnswer;
    if (!r.ok) a = { text: r.message };
    else {
      a = todayAnswer(r.state);
      goWhereAsked(r.state, router);
    }
    setTurns((all) => all.map((t) => (t.id === id && t.kind === "ask" ? { ...t, a } : t)));
  };
  /** A fresh start: nothing of the chat before carried on. */
  const freshChat = () => {
    seq.current++;
    since.current = null;
    tabId.current = null;
    askedAt.current = null;
    setAwaiting(null);
    setAsking(false);
    setReplyTo(null);
    setTurns([]);
  };
  useEffect(() => {
    freshRef.current = freshChat;
  });
  /** The chat put away as a tab on the left, the page back to the start for something else. */
  const minimise = () => {
    const first = turns.find((t) => t.kind === "ask");
    if (!first || first.kind !== "ask" || !since.current) return;
    const waiting = asking || awaiting !== null;
    keepTab({
      id: tabId.current ?? `tab-${Date.now().toString(36)}`,
      title: tabTitle(first.q),
      since: since.current,
      waitingSince: waiting ? (awaiting ?? askedAt.current) : null,
      status: waiting ? "writing" : "idle",
      at: new Date().toISOString(),
    });
    freshChat();
  };
  const minimiseRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    minimiseRef.current = minimise;
  });
  /** A tab's chat back on the page, read from Sol's conversation. */
  const openTab = useCallback(async (id: string) => {
    const tab = tabById(id);
    if (!tab) return;
    const r = await loadSol();
    if (!r.ok) return;
    let found = tabTurns(r.state.turns, tab);
    // Filed away since (a new chat in his panel files Today's turns with it): read back from his past conversations,
    // so a tab opens wherever its chat now lives (26 Nov 2026, Martin).
    if (!found.length) {
      const list = await listSolPast();
      const near = list.ok ? list.past.filter((p) => p.endedAt >= tab.since && p.startedAt <= tab.at) : [];
      for (const p of near) {
        const one = await openSolPast(p.id);
        if (one.ok) found = tabTurnsIn([one.past], tab);
        if (found.length) break;
      }
    }
    const back: Turn[] = [];
    let n = Date.now();
    for (const t of found) {
      if (t.role === "you") back.push({ id: n++, kind: "ask", q: t.shown ?? t.text, a: null });
      else {
        const last = back[back.length - 1];
        if (last?.kind === "ask" && !last.a) last.a = answerOf(t);
      }
    }
    if (!back.length) return;
    dropTab(id);
    // A chat on screen already is kept as a tab of its own, not lost.
    minimiseRef.current?.();
    seq.current++;
    since.current = tab.since;
    tabId.current = tab.id;
    askedAt.current = null;
    setAsking(false);
    setReplyTo(null);
    const last = back[back.length - 1];
    setAwaiting(tab.status === "writing" && last.kind === "ask" && !last.a ? tab.waitingSince : null);
    setTurns(back);
  }, []);
  // A tab pressed while on Today, or on another page that brought us here (?soltab=).
  useEffect(() => {
    const open = (e: Event) => void openTab((e as CustomEvent<string>).detail);
    window.addEventListener(OPEN_SOL_TAB, open);
    return () => window.removeEventListener(OPEN_SOL_TAB, open);
  }, [openTab]);
  // Read through the router's own search params: on arriving from another page the address isn't updated yet when
  // this page's first effects run.
  const askedTab = useSearchParams().get("soltab");
  useEffect(() => {
    if (!askedTab) return;
    router.replace("/design", { scroll: false });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a tab asked for from another page opens once it's here
    void openTab(askedTab);
  }, [askedTab, openTab, router]);
  // A reopened chat whose answer was still coming: it lands as soon as Sol's conversation has it.
  useEffect(() => {
    if (!awaiting) return;
    const land = (state: SolState) => {
      const answer = roomTurns(state.turns, TODAY_ROOM).find((t) => t.role === "sol" && t.at >= awaiting);
      if (!answer) return;
      setAwaiting(null);
      setTurns((all) => all.map((t, i) => (i === all.length - 1 && t.kind === "ask" && !t.a ? { ...t, a: answerOf(answer) } : t)));
    };
    const heard = (e: Event) => {
      const state = (e as CustomEvent<SolState | undefined>).detail;
      if (state?.turns) land(state);
    };
    window.addEventListener(SOL_CHANGED, heard);
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadSol().then((r) => r.ok && land(r.state));
    }, 4000);
    return () => {
      window.removeEventListener(SOL_CHANGED, heard);
      window.clearInterval(t);
    };
  }, [awaiting]);
  /** A draft of his handed to the deal's Email tab, as his panel hands it. */
  const openDraft = (d: DraftAsEdited) => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ jobId: d.jobId, subject: d.subject, body: d.body, cc: d.cc }));
    } catch {
      // A private window: the deal's email opens empty, and the card can still be copied.
    }
    router.push(`/design/deals/${d.jobId}?tab=email`);
  };
  /** A time picked on a reminder's card: set, and the card says when. */
  const setReminder = async (turnId: number, reminderId: string, when: Parameters<typeof remindAt>[1]) => {
    const r = await remindAt(reminderId, when);
    if (!r.ok) return;
    window.dispatchEvent(new CustomEvent(SOL_CHANGED, { detail: r.state }));
    const set = r.state.turns.find((t) => t.reminder?.id === reminderId)?.reminder;
    if (set)
      setTurns((all) =>
        all.map((t) =>
          t.id === turnId && t.kind === "ask" && t.a?.with ? { ...t, a: { ...t.a, with: { ...t.a.with, reminder: set } } } : t,
        ),
      );
  };
  /** A Yes or No goes straight to Sol; Reply answers the question in the box. */
  const answer: OnAnswer = (question, yes) => {
    if (yes) return void ask(yes, [], { kind: "question", text: question });
    setReplyTo({ kind: "question", text: question });
    window.setTimeout(() => document.getElementById("today-ask")?.focus(), 0);
  };
  const askIn = (q: string, files: SolFile[]) => void ask(q, files, replyTo);
  /** The reply arrow on a message: the box replies to it. */
  const replyToMessage = (from: "you" | "sol", text: string) => {
    setReplyTo({ kind: "message", from, text });
    window.setTimeout(() => document.getElementById("today-ask")?.focus(), 0);
  };
  /** Try another answer: his latest answer replaced by a new one to the same question, a different way. */
  const retry = async (id: number) => {
    if (asking) return;
    const before = turns.find((t) => t.id === id);
    setAsking(true);
    setTurns((all) => all.map((t) => (t.id === id && t.kind === "ask" ? { ...t, a: null } : t)));
    const mine = ++seq.current;
    askedAt.current = chatSince(Date.now());
    const r = await retrySol(null, TODAY_ROOM);
    if (r.ok) window.dispatchEvent(new CustomEvent(SOL_CHANGED, { detail: r.state }));
    if (mine !== seq.current) return;
    setAsking(false);
    let a: TodayAnswer;
    if (!r.ok) a = before?.kind === "ask" && before.a ? { ...before.a, again: false } : { text: r.message };
    else {
      a = todayAnswer(r.state);
      goWhereAsked(r.state, router);
    }
    setTurns((all) => all.map((t) => (t.id === id && t.kind === "ask" ? { ...t, a } : t)));
  };

  return (
    <div data-calm-ground className="mx-auto flex min-h-[calc(100dvh-13rem)] w-full max-w-6xl flex-col">
      {adding && (
        <div className="mx-auto mb-4 w-full max-w-5xl">
          <NewDeal onClose={() => setAdding(false)} />
        </div>
      )}

      {props.problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {props.problem}
        </p>
      )}

      <div className="mt-2 flex flex-1 flex-col">
        {welcoming && (
          <Welcome
            firstName={props.name}
            business={props.business}
            owner={Boolean(props.owner)}
            onDone={() => setWelcoming(false)}
            onTour={tour}
          />
        )}
        {/* On the dock's post-sale tools, Feed is Jobs: every sold job not yet installed (23 Nov 2026, Martin). */}
        {!welcoming && onFeed && jobsView && (
          <div className="pb-6">
            <InstallListPage switcher={null} />
          </div>
        )}
        {!welcoming && onFeed && !jobsView && (
          <div className="pb-6">
            <InductionReminder />
            <DealFeed
              me={props.email}
              onNew={() => setAdding((a) => !a)}
              adding={adding}
              onDay={() => setFeedDay(true)}
              day={feedDay ? <SolDay {...props} items={items} onGrow={() => {}} /> : null}
              onDismissDay={() => setFeedDay(false)}
            />
          </div>
        )}
        {!welcoming && onCal && <TodayCalendar jobs={props.jobs} today={props.today} />}
        {/* The greeting, in the middle of the screen until the conversation starts, then folded away. */}
        <div
          className={clsx(
            "flex flex-col justify-start transition-[flex-grow,opacity] duration-500 ease-out",
            (welcoming || onFeed || onCal) && "hidden",
            talking ? "grow-0 opacity-0" : "grow opacity-100",
          )}
          aria-hidden={talking}
        >
          <div
            className={clsx(
              "grid grid-cols-[minmax(0,1fr)] transition-[grid-template-rows] duration-500 ease-out",
              talking ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
            )}
          >
            {/* Clipped only while it folds away (22 Nov 2026, Martin, on an iPhone: "I can't scroll down"): left on, Safari
                can size the grid's row to the screen and cut Needs you and Performance off under it, so the page has
                nothing more to scroll to. */}
            <div className={clsx("min-w-0", talking && "min-h-0 overflow-hidden")}>
              <TodayChat
                name={props.name}
                views={insights}
                onAsk={ask}
                asking={asking}
                hidden={talking}
                jobs={props.jobs}
                today={props.today}
                items={items}
              />
            </div>
          </div>
        </div>

        {talking && !onFeed && !onCal && (
          <div className="relative mx-auto w-full max-w-3xl flex-1 space-y-7 pb-4 pt-2" aria-live="polite">
            {turns.map((t) =>
              t.kind === "day" ? (
                <SolDay key={t.id} {...props} items={items} onGrow={follow} />
              ) : (
                <div key={t.id} className="space-y-4">
                  <div className="group/turn flex flex-col items-end">
                    <p className="max-w-[75%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-sun px-4 py-2 text-[12.5px] font-normal leading-[1.68] tracking-[-0.008em] [font-feature-settings:'cv11','ss03','tnum'] text-ink ring-1 ring-sun-line/25">
                      <QuotedWords text={t.q} />
                    </p>
                    <MessageTools text={t.q} onReply={() => replyToMessage("you", t.q)} className="mt-0.5" />
                  </div>
                  <SolSays>
                    <SolWorking busy={!t.a} />
                    {!t.a && awaiting && t.id === turns[turns.length - 1]?.id && (
                      <p className="text-[12.5px] text-muted">Still writing it up. It lands here when it&apos;s ready.</p>
                    )}
                    {!t.a ? null : (
                      <div className="sol-prose group/turn">
                        <Typed text={t.a.text} onDone={follow} onAnswer={asking ? undefined : answer} />
                        <MessageTools text={t.a.text} onReply={() => replyToMessage("sol", t.a!.text)} className="-ml-1.5 mt-1" />
                        {t.a.designs?.length ? (
                          <div className="mt-3 max-w-2xl space-y-3">
                            {t.a.designs.map((d) => (
                              <SolDesignView key={d.jobId} shown={d} />
                            ))}
                          </div>
                        ) : null}
                        {t.a.with && (
                          <div className="mt-3 max-w-2xl space-y-3">
                            {t.a.with.charts?.map((c, k) => (
                              <SolChartView key={k} chart={c} />
                            ))}
                            {t.a.with.diagrams?.map((d, k) => (
                              <SolDiagramView key={k} diagram={d} />
                            ))}
                            {t.a.with.drafts?.map((d, k) => (
                              <SolDraftCard key={k} draft={d} onOpen={openDraft} />
                            ))}
                            {t.a.with.meeting && <MeetingCard id={t.a.with.meeting} />}
                            {t.a.with.reminder && (
                              <ReminderCard
                                ask={t.a.with.reminder}
                                busy={asking}
                                choose={(c) => void setReminder(t.id, t.a!.with!.reminder!.id, c)}
                                other={() => document.getElementById("today-ask")?.focus()}
                              />
                            )}
                          </div>
                        )}
                        {(t.a.goTo || (t.a.again && t.id === turns[turns.length - 1]?.id)) && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {t.a.goTo && (
                              <button
                                type="button"
                                onClick={() => openSolPage(t.a!.goTo!, router)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-sun px-3 py-1 text-[13px] font-medium text-sun-ink ring-1 ring-sun-line/30 transition hover:ring-sun-line"
                              >
                                Opened {t.a.goTo.label} <ArrowUpRight className="size-3.5" aria-hidden />
                              </button>
                            )}
                            {/* Not keen on his approach: the same question again, a different way; this answer is replaced. */}
                            {t.a.again && t.id === turns[turns.length - 1]?.id && (
                              <button
                                type="button"
                                onClick={() => void retry(t.id)}
                                disabled={asking}
                                title="Sol answers the same question again, a different way. This answer is replaced. It takes credits like any answer."
                                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium text-ink-2 ring-1 ring-line transition hover:text-ink hover:ring-sun-line disabled:text-muted"
                              >
                                <RefreshCw className="size-3.5" aria-hidden /> Try another answer
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </SolSays>
                </div>
              ),
            )}
            <div ref={end} className="scroll-mb-40" />
            {/* The chat put away as a tab on the left, to carry on elsewhere while Sol answers (sol-tabs.ts). Level with
                the first message, off to its right (26 Nov 2026, Martin), with a mark of its own: the chat folding into
                a tab. */}
            {turns.some((t) => t.kind === "ask") && (
              <button
                type="button"
                onClick={minimise}
                title="Minimise: keep this chat as a tab and start afresh. It lights up when Sol's answer lands."
                aria-label="Minimise this chat into a tab"
                className="group/min absolute left-0 top-2 z-[1] !mt-0 inline-flex size-9 items-center justify-center rounded-full bg-surface text-ink shadow-[0_4px_14px_-8px_rgb(20_22_26_/_0.45)] ring-1 ring-line transition hover:bg-primary hover:text-white hover:ring-primary xl:left-[calc(100%+0.75rem)]"
              >
                <FoldToTab className="size-[18px]" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* The tour ends on Sol: his panel opens on his introduction (sol-induction.ts). */}
      {touring && (
        <Spotlight
          steps={WELCOME_TOUR}
          onEnd={() => {
            setTouring(false);
            window.dispatchEvent(new Event(SOL_INDUCTION));
          }}
        />
      )}

      {/* Not on the deal feed (8 Nov 2026, Martin: a third place to ask Sol confused more than it helped; each deal has
          its own chat and Sol's round is in the nav). */}
      {talking && !onFeed && !onCal && (
        <div className="sticky bottom-0 z-10 bg-gradient-to-t from-canvas from-60% to-transparent pb-5 pt-10 print:hidden">
          <div className="mx-auto max-w-3xl">
            <div className="mb-2.5 flex items-center gap-2">
              {!dayTold && (
                <button
                  type="button"
                  onClick={showDay}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-surface px-3.5 text-[13px] font-medium text-ink ring-1 ring-line hover:ring-sun-line"
                >
                  <SolIcon className="size-3.5 text-sun-line" aria-hidden /> Show me my day
                </button>
              )}
            </div>

            <SolBox onAsk={askIn} asking={asking || awaiting !== null} replyTo={replyTo} onStopReply={() => setReplyTo(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

/** The chat folding into a tab: a window, a corner arrow and the tab it lands in. */
function FoldToTab({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M8 3.5h7.5a1.5 1.5 0 0 1 1.5 1.5v7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M14 6 6.5 13.5M6.5 13.5V9.5M6.5 13.5h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="2.5" y="15.25" width="7" height="2.5" rx="1.25" fill="#ff5a1f" />
    </svg>
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

/** Sol's box: what is asked goes to Sol, in the same conversation as his panel. */
export function SolBox({
  onAsk,
  asking,
  id = "today-ask",
  placeholder = "Ask Sol about your deals, your day, or what to say to a customer",
  replyTo = null,
  onStopReply,
  tall = false,
  corner = null,
  extras = null,
  shortcuts = false,
}: {
  /** Sol's four topics as rounds after the + , each opening its questions in the box (26 Nov 2026, Martin). */
  shortcuts?: boolean;
  /** Kept in the box's top right corner: the lightbulb of a minimised notice (23 Nov 2026, Martin). */
  corner?: ReactNode;
  /** Shown in the box's foot after the +. */
  extras?: React.ReactNode;
  /** Twice as thick (20 Nov 2026, Martin): the words on top, the paperclip, microphone and send along its foot. */
  tall?: boolean;
  /** One of Sol's questions being answered, or a message replied to, shown over the box. */
  replyTo?: SolReply | null;
  onStopReply?: () => void;
  /** The words, and any PDFs or pictures attached (read for Sol). */
  onAsk: (q: string, files: SolFile[]) => void;
  asking: boolean;
  id?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [heard, setHeard] = useState("");
  const [topic, setTopic] = useState<SolTopic | null>(null);
  const field = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const names = useNameHintBox(text, setText, field);
  // Speak and attach, as in his panel (5 Nov 2026, Martin): the microphone and the paperclip.
  const attach = useSolAttach();
  const ready = text.trim().length >= 2 || attach.files.length > 0;
  // The rest of the sentence: their own questions first, then the team's, then the usual ones (26 Nov 2026, Martin).
  const guess = useSolAhead(text, setText, field, !tall || Boolean(heard) || names.showing);
  const send = async () => {
    const said = text.trim();
    if (!ready || asking) return;
    const files = await solFilesOf(attach.files);
    if (!files) return attach.setProblem("That file couldn't be read: try again.");
    setText("");
    setHeard("");
    names.clear();
    attach.clear();
    learnAsked(said);
    onAsk(said, files);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      className={clsx(
        "relative bg-surface text-left shadow-[0_8px_30px_rgb(20_22_26_/_0.08)] ring-1 ring-line focus-within:ring-sun-line",
        tall ? "rounded-[28px] p-3 pl-5 pt-5" : "rounded-[26px] p-2 pl-4",
      )}
    >
      {corner && <div className="absolute right-3 top-3 z-10">{corner}</div>}
      {replyTo && <ReplyBanner reply={replyTo} onStop={() => onStopReply?.()} className="mb-1.5 mr-2 bg-canvas" />}
      <AttachedFiles attach={attach} />
      {names.chips}
      {tall ? (
        <>
          <label className="sr-only" htmlFor={id}>
            Ask Sol
          </label>
          {/* The words with Sol's guess at the rest of the sentence in grey behind them (26 Nov 2026, Martin: "predictive
              auto text"); Tab or → at the end takes it, and on a touch screen the pill under the box. The corner bulb
              keeps its room on the words only, so send and the microphone reach the box's right edge. */}
          <div className={clsx("relative", corner && "pr-12")}>
            {guess.ghost("pr-2 pt-1 text-[15.5px] leading-relaxed")}
            <textarea
              ref={field}
              onPaste={attach.onPaste}
              id={id}
              value={heard ? withSpoken(text, heard) : text}
              onChange={(e) => {
                setHeard("");
                setText(e.target.value);
                guess.changed();
                names.typed(e.target.value, e.target.selectionStart);
              }}
              onKeyDown={(e) => {
                if (guess.key(e)) return;
                if (e.key === "Escape" && names.escape()) {
                  e.stopPropagation();
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={4}
              maxLength={4000}
              autoComplete="off"
              placeholder={placeholder}
              className="relative block min-h-[6.5rem] w-full resize-none bg-transparent pr-2 pt-1 text-[15.5px] leading-relaxed text-ink outline-none placeholder:text-muted"
            />
          </div>
          {guess.pill("mt-1")}
          {shortcuts && (
            <SolShortcutList
              open={topic}
              onClose={() => setTopic(null)}
              onAsk={(q) => {
                setTopic(null);
                if (!asking) onAsk(q, []);
              }}
            />
          )}
          {/* As Claude Code's box (21 Nov 2026, Martin): a + at the left, send then the microphone at the far right. */}
          <div className="mt-2 flex items-center gap-1">
            <AttachButton attach={attach} plus />
            {shortcuts && <SolShortcutRounds open={topic} onOpen={setTopic} />}
            {extras && <span className="ml-1 min-w-0">{extras}</span>}
            {/* Send and the microphone apart from the tools, at the right (26 Nov 2026, Martin). */}
            <span className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-line pl-3">
              <button
                type="submit"
                disabled={asking || !ready}
                aria-label="Ask Sol"
                // Pressed with the keyboard up, the box keeps its focus (23 Nov 2026, Martin, on an iPhone: it "isn't
                // responding"): a first tap that closed the keyboard moved the page under the finger and the press was lost.
                onPointerDown={(e) => e.preventDefault()}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-ink disabled:bg-surface-2 disabled:text-muted"
              >
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <DictateButton label="Speak to Sol" onHearing={setHeard} onWords={(w) => setText((t) => withSpoken(t, w).slice(0, 4000))} />
            </span>
          </div>
        </>
      ) : (
        // With Today's views in it (23 Nov 2026, Martin), the words take a row of their own on top and the + , the views,
        // send and the microphone sit along the foot, so typing keeps its room on a phone.
        <div className={clsx("flex items-center gap-1.5", extras && "flex-wrap gap-y-1")}>
          <AttachButton attach={attach} plus />
          {extras ? <span className="shrink-0">{extras}</span> : <SolBadge className="size-5 shrink-0" />}
          <label className="sr-only" htmlFor={id}>
            Ask Sol
          </label>
          <input
            ref={field}
            onPaste={attach.onPaste}
            id={id}
            value={heard ? withSpoken(text, heard) : text}
            onChange={(e) => {
              setHeard("");
              setText(e.target.value);
              names.typed(e.target.value, e.target.selectionStart);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && names.escape()) e.stopPropagation();
            }}
            maxLength={4000}
            autoComplete="off"
            placeholder={placeholder}
            className={clsx(
              "h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted",
              extras ? "order-first basis-full pl-1 pr-2" : "ml-1",
            )}
          />
          <button
            type="submit"
            disabled={asking || !ready}
            aria-label="Ask Sol"
            onPointerDown={(e) => e.preventDefault()}
            className={clsx(
              extras && "ml-auto",
              "grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-ink disabled:bg-surface-2 disabled:text-muted",
            )}
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
          <DictateButton label="Speak to Sol" onHearing={setHeard} onWords={(w) => setText((t) => withSpoken(t, w).slice(0, 4000))} />
        </div>
      )}
    </form>
  );
}

/** Words Sol is writing, a few letters at a time with his caret, then done. Instant with reduced motion. */
export function Typed({
  text,
  onDone,
  instant = false,
  onAnswer,
}: {
  text: string;
  onDone?: () => void;
  instant?: boolean;
  /** Answering his questions, once he has finished writing. */
  onAnswer?: OnAnswer;
}) {
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
      onAnswer={all ? onAnswer : undefined}
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
  // The business's own names for the stages (pipeline-stages.ts).
  const stageNames = useStageNames();
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
          facts: beforeYouCall({ job: j.job, customer: j.customer, activity: c.ok ? c.activity : [], today, names: stageNames }),
        },
      });
    });
    return () => {
      gone = true;
    };
  }, [jobId, today, stageNames]);
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
              <div key={i} className="sol-prose">
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
                <ToAction all={told.first ? [told.first, ...told.rest] : told.rest}>
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
                </ToAction>
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

/**
 * To action with a search for a customer who has just come to mind and a slim "Work through" pill beside it (5 Nov
 * 2026, from Primero's): searching shows the matches in place of the list; Work through steps through them (or
 * everything) one at a time, large, with Back and Next. `children` is the list as Sol laid it out.
 */
function ToAction({ all, children }: { all: NextItem[]; children: React.ReactNode }) {
  const [q, setQ] = useState("");
  const [working, setWorking] = useState<number | null>(null);
  const found = searchNext(all, q);
  const searching = searchWords(q).length > 0;
  if (!all.length) return <>{children}</>;
  if (working !== null) {
    const at = workThroughAt(working, found.length);
    const item = found[at.at];
    return (
      <div className="rounded-3xl bg-surface p-3 ring-1 ring-line sm:p-4">
        <div className="flex items-center justify-between px-1 text-[12px] text-muted">
          <span className="tabular-nums">
            {at.count}
            {searching ? ` · matching “${q}”` : ""}
          </span>
          <button type="button" onClick={() => setWorking(null)} className="tap-area font-medium text-ink-2 hover:text-ink">
            Back to the list
          </button>
        </div>
        {item ? <NextCard item={item} lead /> : <p className="mt-4 px-1 text-[14px] text-muted">Nothing to work through.</p>}
        <div className="mt-3 flex items-center justify-between px-1">
          <button
            type="button"
            disabled={at.at === 0}
            onClick={() => setWorking(at.at - 1)}
            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] text-ink-2 ring-1 ring-line hover:ring-ink-2 disabled:text-muted disabled:ring-line"
          >
            <ChevronLeft className="size-3.5" aria-hidden /> Back
          </button>
          <span className="text-[12px] text-muted">{at.after}</span>
          <button
            type="button"
            disabled={at.at >= found.length - 1}
            onClick={() => setWorking(at.at + 1)}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-[13px] font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
          >
            Next <ChevronRight className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-full bg-surface px-3 ring-1 ring-line focus-within:ring-sun-line">
          <Search className="size-3.5 shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQ("");
            }}
            placeholder="Search a customer"
            aria-label="Search To action"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear the search" className="text-muted hover:text-ink">
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </label>
        {found.length > 0 && (
          <button
            type="button"
            onClick={() => setWorking(0)}
            title={searching ? "One at a time, through the matches" : "One at a time, through everything waiting"}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary pl-2.5 pr-3 text-[12px] font-medium text-primary-ink hover:bg-forest"
          >
            <Play className="size-3 fill-sun-line text-sun-line" aria-hidden />
            {searching ? `Work through ${found.length}` : "Work through"}
          </button>
        )}
      </div>
      {!searching ? (
        children
      ) : found.length ? (
        <div className="rounded-3xl bg-surface px-4 py-1 ring-1 ring-line sm:px-5">
          <p className="pt-3 text-[12px] text-muted">
            {found.length} of {all.length}
          </p>
          <ul className="divide-y divide-line">
            {found.map((it) => (
              <li key={it.key}>
                <NextCard item={it} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="px-1 text-[13px] text-muted">Nothing waiting for “{q}”.</p>
      )}
    </div>
  );
}

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
export function CalendarView({ jobs, today }: { jobs: JobLine[] | null; today: ISODate }) {
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
export function PipelineView({ jobs, today }: { jobs: JobLine[] | null; today: ISODate }) {
  // The business's own names for the stages (pipeline-stages.ts).
  const stageNames = useStageNames();
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
            {pipelineBoard(jobs, 6, stageNames).map((s) => (
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
