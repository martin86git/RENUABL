"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import {
  ArrowRight,
  ArrowUp,
  CalendarPlus,
  Check,
  Clock,
  ChevronDown,
  CornerUpLeft,
  Eye,
  FileText,
  Flame,
  Handshake,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  Snowflake,
  StickyNote,
  PenTool,
  Plus,
  Undo2,
  X,
  UserPlus,
  ChevronLeft,
  Search,
  Truck,
  CalendarCheck,
  HardHat,
  Stamp,
  type LucideIcon,
} from "lucide-react";
import {
  LATER_CHOICES,
  agoWords,
  allClearWords,
  LEAD_RULES,
  teamLines,
  type LeadRule,
  arrivalWords,
  opensOnMine,
  lastAt,
  openAskLine,
  padLines,
  solLine,
  stagePill,
  type StageTone,
  todayParts,
  markHolds,
  markWords,
  caption,
  feedFilter,
  needsYou,
  nextMove,
  systemLine,
  type MoveKind,
  PANEL_TABS,
  panelCounts,
  panelDeals,
  panelMark,
  type PanelTab,
  type NextMove,
  type FeedDeal,
  type FeedEventKind,
  type FeedPipeline,
  type FeedMark,
  type LaterChoice,
} from "@/lib/domain/design/deal-feed";
import { OPEN_STAGES, STAGE_LABELS, type JobStage } from "@/lib/domain/design/crm";
import { countdownWords } from "@/lib/domain/design/sol-agents";
import { emailDeal, listPipelines, saveJob, setDealOwner } from "@/lib/services/crm";
import { dayChip, installDayEmail } from "@/lib/domain/design/install-days";
import { PIPELINES, type Pipeline } from "@/lib/domain/design/deal";
import { actOnOutbox, editOutbox, putOffOutbox } from "@/lib/services/sol-agents";
import { briefHref } from "@/lib/domain/design/deal-team";
import { exampleDeals, loadFeed, markFeedDeal, saveLeadRule, type FeedAnswer } from "@/lib/services/deal-feed";
import { DEAL_TEAM_CHANGED } from "@/lib/services/deal-team";
import { AerialRoof, type AerialRoofSpec, type RoofFinish, type RoofForm } from "./aerial-roof";
import { PATHS } from "./design-shell";
import { DealTeamChat } from "./deal-team-chat";
import { CallNotetaker, type NotetakerHandle } from "./call-notetaker";
import { CallChooser } from "./call-choice";
import { SolIcon } from "./sol-icon";
import { TodayCalls, type CallsSummary } from "./today-calls";
import { TodayNews } from "./today-news";

const FEED_PICK_KEY = "renuabl.design.feed-pipeline";
const POLL_MS = 60_000;

const EVENT_ICONS: Record<FeedEventKind, React.ComponentType<{ className?: string }>> = {
  message: MessageCircle,
  reply: CornerUpLeft,
  email: Mail,
  opened: Eye,
  call: Phone,
  note: StickyNote,
  proposal: FileText,
  stage: ArrowRight,
  sol: SolIcon,
};

/**
 * Today's deal feed (6 Nov 2026, Martin; deal-feed.ts): Sol runs the deals, this is the controls, and the owner steps
 * in wherever their judgement says. One card a deal, newest happening first: the roof, the system and price, how warm,
 * where it's at in Sol's words, the latest of the conversation and what Sol has lined up, with the controls to write
 * to the customer with Sol, have Sol call them, or bring in a teammate, all without leaving Today.
 */
export function DealFeed(props: { me: string; onNew?: () => void; adding?: boolean; onDay?: () => void }) {
  const { me } = props;
  const [showAll, setShowAll] = useState(false);
  // The deal picked in the deals panel, shown as its card on the left.
  const [picked, setPicked] = useState<string | null>(null);
  // What the Calls part says, for the strip and for its place in the column.
  const [calls, setCalls] = useState<CallsSummary | null>(null);
  const [data, setData] = useState<FeedAnswer | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await loadFeed();
    if (r.ok) {
      setData({
        deals: r.deals,
        callsOn: r.callsOn,
        team: r.team,
        examples: r.examples,
        today: r.today ?? null,
        role: r.role,
        leadRule: r.leadRule,
        installDays: r.installDays,
        signOff: r.signOff,
      });
      setProblem(null);
    } else setProblem(r.message);
  }, []);
  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const t = window.setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    // A deal's team chat changed somewhere else (the team chat window, the deal's Team tab): its pad follows at once.
    const changed = () => void load();
    window.addEventListener(DEAL_TEAM_CHANGED, changed);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
      window.removeEventListener(DEAL_TEAM_CHANGED, changed);
    };
  }, [load]);
  // Which pipeline, and whose deals (8 Nov 2026, Martin: an admin sees every deal), kept on the device.
  // Whose deals: the person's own choice once made (null until then: the owner opens on everyone's, others in a team
  // on their own, 10 Nov 2026).
  const [kept, setFeedPick] = useState<{ pipeline: FeedPipeline; mine: boolean | null }>(() => {
    try {
      const k = typeof window !== "undefined" ? JSON.parse(localStorage.getItem(FEED_PICK_KEY) ?? "null") : null;
      return {
        pipeline: typeof k?.pipeline === "string" ? k.pipeline : "all",
        mine: typeof k?.mine === "boolean" ? k.mine : null,
      };
    } catch {
      return { pipeline: "all", mine: null };
    }
  });
  const solo = Boolean(data) && (data?.team.length ?? 0) === 0;
  const feedPick = {
    pipeline: kept.pipeline,
    mine: solo ? false : (kept.mine ?? (data ? opensOnMine(data.role ?? "owner", data.team.length + 1) : false)),
  };
  const choosePick = (next: { pipeline: FeedPipeline; mine: boolean }) => {
    setFeedPick(next);
    try {
      localStorage.setItem(FEED_PICK_KEY, JSON.stringify(next));
    } catch {
      // Private window: it resets next time.
    }
  };
  const [saved, setSaved] = useState<Pipeline[]>([]);
  useEffect(() => {
    let gone = false;
    void listPipelines().then((r) => !gone && r.ok && setSaved(r.pipelines));
    return () => {
      gone = true;
    };
  }, []);
  const pipelines: readonly Pipeline[] = [...PIPELINES, ...saved];
  const pickedPipeline = pipelines.find((p) => p.id === feedPick.pipeline) ?? null;
  const now = new Date();
  const deals = useMemo(
    () =>
      feedFilter(data?.deals ?? [], {
        pipeline: feedPick.pipeline,
        stages: pickedPipeline?.stages ?? null,
        mine: feedPick.mine,
        me,
      }),
    [data, feedPick.pipeline, feedPick.mine, pickedPipeline, me],
  );
  const open = deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const openValue = open.reduce((sum, d) => sum + (d.value ?? 0), 0);
  // Done or Later on a card: the deal's mark put in place at once, then the feed read again (for the day's count).
  const setMark = (jobId: string, mark: FeedMark | null) => {
    setData((all) => (all ? { ...all, deals: all.deals.map((x) => (x.jobId === jobId ? { ...x, mark } : x)) } : all));
    void load();
  };
  const [filling, setFilling] = useState(false);
  const examples = async (what: "add" | "clear") => {
    setFilling(true);
    await exampleDeals(what);
    await load();
    setFilling(false);
  };

  const parts = todayParts(deals, now);
  const pickedDeal = picked ? (deals.find((d) => d.jobId === picked) ?? null) : null;
  // The salespeople (members, not designers or the owner): two or more and the owner sees a line for each, and chooses
  // who their new leads go to (10 Nov 2026).
  const sellers = (data?.team ?? []).filter((m) => m.role === "member");
  const ownerOfTeam = data?.role === "owner" && sellers.length >= 2;
  const [rule, setRule] = useState<LeadRule | null>(null);
  const leadRule = rule ?? data?.leadRule ?? "adder";
  const chooseRule = async (next: LeadRule) => {
    setRule(next);
    const r = await saveLeadRule(next);
    if (!r.ok) setRule(null);
  };
  const needs = parts.needs.length;
  const callsLive = (calls?.live ?? 0) > 0;
  const place = todayPlaces(callsLive);
  const tabs: StripTab[] = [
    {
      id: TODAY_IDS.needs,
      label: "Needs you",
      count: data ? needs : null,
      signal: needs > 0 ? ("needs" as const) : data ? ("clear" as const) : null,
      order: 1,
    },

    ...(calls && (calls.on || calls.live + calls.lined + calls.done > 0)
      ? [
          {
            id: TODAY_IDS.calls,
            label: "Calls",
            count: calls.live + calls.lined + calls.done,
            signal: callsLive ? ("live" as const) : null,
            order: callsLive ? 0 : 3,
          },
        ]
      : []),
    ...(parts.coming.length ? [{ id: TODAY_IDS.coming, label: "Coming up", count: parts.coming.length, order: 4 }] : []),

    { id: TODAY_IDS.news, label: "News", count: null, order: 7 },
  ].sort((a, b) => a.order - b.order);
  // One part of Today at a time (14 Nov 2026, Martin: "revealing", one thing at a time with the edge of the next): the
  // strip chooses it; it opens on the first part with something in it, and the next one peeks in under it, faded, with
  // Next. Each part stays drawn, only hidden, so what it has loaded is kept.
  const [chosen, setChosen] = useState<string | null>(null);
  const shown =
    chosen && tabs.some((t) => t.id === chosen)
      ? chosen
      : (tabs.find((t) => t.id !== TODAY_IDS.news && (t.count ?? 0) > 0)?.id ?? TODAY_IDS.needs);
  const next = tabs.slice(tabs.findIndex((t) => t.id === shown) + 1).find((t) => t.id === TODAY_IDS.news || (t.count ?? 0) > 0) ?? null;
  const view = (id: string) => (id === shown ? "" : id === next?.id ? PEEK : "hidden");
  const go = (id: string) => {
    setChosen(id);
    setPicked(null);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <div className="mx-auto w-full max-w-5xl lg:max-w-[84rem]">
      {/* The overview strip, pinned under the top bar (14 Nov 2026, Martin): the pipeline picked, each part of Today with
          how many, a press to go to it, and the part in view lit. */}
      <TodayStrip
        tabs={tabs}
        lit={shown}
        onGo={go}
        left={
          <>
            <FeedPicker pick={feedPick} pipelines={pipelines} picked={pickedPipeline} onPick={choosePick} solo={solo} />
            <p className="hidden whitespace-nowrap text-[13px] text-ink-2 xl:block">
              {data ? (
                <>
                  <span className="font-semibold text-ink">{open.length}</span> being sold
                  {openValue > 0 && (
                    <>
                      {" "}
                      · <span className="font-semibold text-ink">${Math.round(openValue / 1000).toLocaleString("en-AU")}k</span>
                    </>
                  )}
                </>
              ) : (
                "Looking over your deals…"
              )}
            </p>
          </>
        }
        right={
          data && props.onDay ? (
            <button
              type="button"
              onClick={props.onDay}
              title="Show me my day"
              aria-label="Show me my day"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-medium text-ink-2 ring-1 ring-line transition hover:text-ink hover:ring-ink-2"
            >
              <SolIcon className="size-4 text-sun-line" /> <span className="hidden 2xl:inline">My day</span>
            </button>
          ) : null
        }
      />
      {data?.examples !== null && data?.examples !== undefined && (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
          {data.examples > 0
            ? `This made-up business has ${data.examples} example deals to try the feed with.`
            : "A made-up business: add example deals to try the feed."}
          <button
            type="button"
            disabled={filling}
            onClick={() => void examples(data.examples ? "clear" : "add")}
            className="ml-auto rounded-full bg-surface px-3 py-1 font-medium text-ink ring-1 ring-line hover:ring-ink-2 disabled:text-muted"
          >
            {filling ? "Working…" : data.examples ? "Clear example deals" : "Add example deals"}
          </button>
        </p>
      )}
      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      {/* The parts of Today in one column, in the order of what needs a person (14 Nov 2026, Martin): Needs you, New in,
          Calls, Coming up, In hand; Calls goes first while a call is ringing or on, the most live thing on the page. */}
      {/* Your work on the left, the deals on the right (14 Nov 2026, Martin: as Service lays out its cases). */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-8">
        <div className="min-w-0">
          {/* A deal picked in the panel: its whole card, with the way back. */}
          {pickedDeal && (
            <div className="mt-9">
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="mb-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-surface pl-2.5 pr-4 text-[13px] font-medium text-ink-2 ring-1 ring-line transition hover:text-ink hover:ring-ink-2"
              >
                <ChevronLeft className="size-4" aria-hidden /> Back to your day
              </button>
              <div className="max-w-[40rem]">
                <DealCard
                  key={pickedDeal.jobId}
                  deal={pickedDeal}
                  now={now}
                  me={me}
                  callsOn={Boolean(data?.callsOn)}
                  team={data?.team ?? []}
                  solo={solo}
                  onChanged={load}
                  onMark={(mark) => setMark(pickedDeal.jobId, mark)}
                  installDays={data?.installDays}
                  signOff={data?.signOff}
                  stacked
                />
              </div>
            </div>
          )}
          <div className={clsx(pickedDeal && "hidden")}>
            <div className="flex flex-col">
              {/* The phone assistant's calls: on now, lined up and done today (12 Nov 2026, Martin). */}
              <TodayCalls id={TODAY_IDS.calls} className={clsx(TRAY, place.calls, view(TODAY_IDS.calls))} onSummary={setCalls} />

              {/* The owner of a team: a line for each salesperson, new this week, not yet contacted, in play. */}
              {ownerOfTeam && (
                <section className={clsx(TRAY, place.team, shown !== TODAY_IDS.needs && "hidden")} aria-label="Your team">
                  <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink">Your team</h2>
                  <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
                    <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] gap-2 border-b border-line px-4 py-2 text-[11.5px] text-muted">
                      <span>Salesperson</span>
                      <span>New this week</span>
                      <span>Not contacted</span>
                      <span>In play</span>
                    </div>
                    {teamLines(data?.deals ?? [], sellers, now).map((l) => (
                      <div
                        key={l.email}
                        className="grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] gap-2 px-4 py-2.5 text-[13.5px] text-ink"
                      >
                        <span className="truncate font-medium">{l.name}</span>
                        <span className="tabular-nums">{l.fresh}</span>
                        <span className={clsx("tabular-nums", l.waiting > 0 && "font-semibold text-sun-ink")}>{l.waiting}</span>
                        <span className="tabular-nums">
                          {l.inPlay}
                          {l.value > 0 && <span className="text-muted"> · ${Math.round(l.value / 1000).toLocaleString("en-AU")}k</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* New in (12 Nov 2026, Martin): new leads that need a design, each with Design, so a quote goes out quickly;
              New lead adds one. */}
              <section id={TODAY_IDS.newIn} className={clsx(TRAY, place.newIn, view(TODAY_IDS.newIn))} aria-label="New in">
                <div className="mb-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                  <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink">
                    New in
                    <span className="ml-1.5 font-normal normal-case tracking-normal text-muted">
                      {data ? `${parts.fresh.length} to design` : ""}
                    </span>
                  </h2>
                  {ownerOfTeam && (
                    <label className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
                      Your new leads go to
                      <select
                        value={leadRule}
                        onChange={(e) => void chooseRule(e.target.value as LeadRule)}
                        className="cursor-pointer rounded-full bg-surface px-2.5 py-1 text-[12.5px] font-medium text-ink ring-1 ring-line focus:outline-none"
                      >
                        {LEAD_RULES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.id === "adder" ? "You" : r.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={props.onNew}
                    aria-expanded={props.adding}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface pl-2.5 pr-3.5 text-[12.5px] font-medium text-ink ring-1 ring-line transition hover:ring-ink-2"
                  >
                    <Plus className={clsx("size-4 text-ink-2 transition", props.adding && "rotate-45")} strokeWidth={2.5} aria-hidden /> New
                    lead
                  </button>
                </div>
                {data && parts.fresh.length === 0 ? (
                  <div className="flex justify-center">
                    <p className="rounded-2xl bg-surface px-5 py-5 text-center text-[13.5px] text-ink-2 ring-1 ring-line">
                      Every new lead has a design.
                    </p>
                  </div>
                ) : (
                  // Pads of their own width, centred (14 Nov 2026, Martin): however many there are, they sit in the middle.
                  <div className="flex flex-wrap justify-center gap-3">
                    {parts.fresh.map((d) => (
                      <div key={d.jobId} className={`grid ${PAD}`}>
                        <ArrivalCard
                          deal={d}
                          now={now}
                          team={solo ? null : [{ email: me, name: "You" }, ...(data?.team ?? [])]}
                          mayGive={data?.role === "owner"}
                          onChanged={load}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <Part id={TODAY_IDS.needs} className={clsx(place.needs, view(TODAY_IDS.needs))} title="Needs you" count={data ? needs : null}>
                {/* Needs you emptied (9 Nov 2026, Martin: clearing the list should feel like work getting done). */}
                {data && needs === 0 && (
                  // One quiet line (14 Nov 2026, Martin): an empty Needs you shouldn't take the top of the page.
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-ink-2">
                    <span className="grid size-6 place-items-center rounded-full bg-positive-soft text-positive">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    <span className="font-medium text-ink">{allClearWords(data.today ?? null)}</span>
                    Nothing needs you right now. Sol has the rest in hand.
                  </p>
                )}
                {/* Cards at a width of their own, the one that suits a card (30rem: the need, the days and the email read
                without crowding), centred, two side by side where they fit (14 Nov 2026, Martin: not tied to New in's row). */}
                {parts.needs.length > 0 && (
                  <div className="flex flex-wrap items-start gap-3">
                    {parts.needs.map((d) => (
                      <div key={d.jobId} className="w-full max-w-[30rem]">
                        <DealCard
                          deal={d}
                          now={now}
                          me={me}
                          callsOn={Boolean(data?.callsOn)}
                          team={data?.team ?? []}
                          solo={solo}
                          onChanged={load}
                          onMark={(mark) => setMark(d.jobId, mark)}
                          installDays={data?.installDays}
                          signOff={data?.signOff}
                          stacked
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Part>

              {parts.coming.length > 0 && (
                <Part
                  id={TODAY_IDS.coming}
                  className={clsx(place.coming, view(TODAY_IDS.coming))}
                  title="Coming up"
                  note="What Sol does next. Review one to change it, or let it go."
                >
                  <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
                    {parts.coming.map((d) => (
                      <ComingRow key={d.jobId} deal={d} now={now} onChanged={load} />
                    ))}
                  </ul>
                </Part>
              )}

              {parts.inHand.length > 0 && (
                <Part
                  id={TODAY_IDS.inHand}
                  className={clsx(place.inHand, view(TODAY_IDS.inHand))}
                  title="In hand"
                  count={parts.inHand.length}
                  note="Moving along. Nothing needs you on these."
                >
                  <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
                    {(showAll ? parts.inHand : parts.inHand.slice(0, IN_HAND_SHOWN)).map((d) => (
                      <DealRow
                        key={d.jobId}
                        deal={d}
                        now={now}
                        me={me}
                        callsOn={Boolean(data?.callsOn)}
                        team={data?.team ?? []}
                        solo={solo}
                        onChanged={load}
                        onMark={(mark) => setMark(d.jobId, mark)}
                        installDays={data?.installDays}
                        signOff={data?.signOff}
                      />
                    ))}
                  </ul>
                  {parts.inHand.length > IN_HAND_SHOWN && (
                    <button
                      type="button"
                      onClick={() => setShowAll((v) => !v)}
                      className="mt-2 text-[13px] font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
                    >
                      {showAll ? "Show fewer" : `Show all ${parts.inHand.length}`}
                    </button>
                  )}
                </Part>
              )}

              <div id={TODAY_IDS.news} className={clsx("mt-9", place.news, view(TODAY_IDS.news))}>
                <TodayNews />
              </div>
              {/* The next part, a press away under the edge of it. */}
              {next && (
                <div className="order-last -mt-10 flex">
                  <button
                    type="button"
                    onClick={() => go(next.id)}
                    className="relative z-10 inline-flex h-10 items-center gap-2 rounded-full bg-surface px-5 text-[13.5px] font-medium text-ink shadow-[0_6px_24px_rgba(20,22,26,0.08)] ring-1 ring-line transition hover:ring-ink-2"
                  >
                    Next: {next.label}
                    {next.count ? <span className="text-muted">· {next.count}</span> : null}
                    <ChevronDown className="size-4 text-ink-2" aria-hidden />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <DealsPanel
          deals={deals}
          now={now}
          picked={pickedDeal?.jobId ?? null}
          onPick={(id) => {
            setPicked(id);
            window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          }}
          onNew={props.onNew}
          adding={props.adding}
        />
      </div>
    </div>
  );
}

/**
 * One arrival in New in: who, from where and how long ago, whose it is (with a way for the owner to give it to someone
 * else), how far it has got, and the first call when nobody has been in touch.
 */
function ArrivalCard(props: {
  deal: FeedDeal;
  now: Date;
  /** Everyone in the business, the reader first as "You"; null for a business of one. */
  team: { email: string; name: string }[] | null;
  mayGive: boolean;
  onChanged: () => void;
}) {
  const { deal: d, now } = props;
  const at = arrivalWords(d);
  const owner = props.team?.find((m) => m.email.toLowerCase() === (d.owner ?? "").toLowerCase());
  const [giving, setGiving] = useState(false);
  const give = async (email: string) => {
    setGiving(true);
    await setDealOwner(d.jobId, email || null);
    setGiving(false);
    props.onChanged();
  };
  const first = d.customer.trim().split(/\s+/)[0] || "them";
  const [calling, setCalling] = useState(false);
  // A design Sol asked the team for opens with his brief.
  const designAsk = d.team?.openAsks.find((x) => x.type === "design");
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-2xl bg-surface p-3.5 ring-1 ring-line">
      {calling && <CallChooser jobId={d.jobId} phone={d.phone ?? ""} name={first} onClose={() => setCalling(false)} />}
      <div className="flex items-start gap-3">
        <RoofThumb deal={d} small />
        <div className="min-w-0 flex-1">
          <Link href={`${PATHS.deals}/${d.jobId}`} className="block truncate text-[14px] font-semibold text-ink hover:underline">
            {d.customer}
          </Link>
          <p className="truncate text-[12px] text-muted">{d.suburb || d.title || "No address yet"}</p>
          <StagePill stage={d.stage} className="mt-1" />
        </div>
      </div>
      <p className="text-[12px] text-ink-2">{[d.source || null, agoWords(d.createdAt, now)].filter(Boolean).join(" · ")}</p>
      <p className={clsx("inline-flex items-center gap-1.5 text-[12.5px]", at.waiting ? "text-muted" : "text-ink-2")}>
        {at.waiting ? <span className="size-1.5 rounded-full bg-line" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
        {at.words}
      </p>
      {props.team && (
        <label className="flex items-center gap-1.5 text-[12px] text-muted">
          <span>With</span>
          {props.mayGive ? (
            <select
              value={owner?.email ?? ""}
              disabled={giving}
              onChange={(e) => void give(e.target.value)}
              className="min-w-0 flex-1 cursor-pointer rounded-md bg-surface-2 px-1.5 py-0.5 text-[12px] font-medium text-ink focus:outline-none"
            >
              <option value="">No one yet</option>
              {props.team.map((m) => (
                <option key={m.email} value={m.email}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-medium text-ink">{owner?.name ?? "No one yet"}</span>
          )}
        </label>
      )}
      {/* Design is the one thing to do here (12 Nov 2026, Martin): the roof designed, the quote can go. */}
      <div className="mt-auto flex items-center gap-2 pt-1">
        <Link
          href={designAsk ? briefHref(d.jobId, designAsk.id) : `${PATHS.designer}?job=${encodeURIComponent(d.jobId)}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[12.5px] font-semibold text-primary-ink hover:brightness-125"
        >
          <PenTool className="size-3.5" aria-hidden /> Design
        </Link>
        {at.waiting &&
          (d.phone ? (
            <button
              type="button"
              onClick={() => setCalling(true)}
              title={`Call ${first}`}
              aria-label={`Call ${first}`}
              className="grid size-8 place-items-center rounded-full bg-surface-2 text-ink-2 hover:text-ink"
            >
              <Phone className="size-3.5" aria-hidden />
            </button>
          ) : (
            <Link
              href={`${PATHS.deals}/${d.jobId}?tab=email`}
              title={`Email ${first}`}
              aria-label={`Email ${first}`}
              className="grid size-8 place-items-center rounded-full bg-surface-2 text-ink-2 hover:text-ink"
            >
              <Mail className="size-3.5" aria-hidden />
            </Link>
          ))}
      </div>
    </article>
  );
}

/**
 * A part of Today: its title, then its cards, straight on the pad's ground (14 Nov 2026, Martin: the panel between the
 * pad and the cards put a third near-white layer under them, so no card came forward; room between the parts sets
 * them apart instead).
 */
const TRAY = "mt-9 scroll-mt-44";

/** The next part of Today, peeking in under the one shown: its top only, faded and soft, not to be used until chosen. */
const PEEK =
  "pointer-events-none max-h-52 select-none overflow-hidden opacity-60 blur-[1.5px] [mask-image:linear-gradient(to_bottom,black_25%,transparent)]";

/** Where each part of Today sits on the page, for the strip to go to. */
export const TODAY_IDS = {
  needs: "today-needs",
  newIn: "today-new",
  calls: "today-calls",
  coming: "today-coming",
  inHand: "today-in-hand",
  news: "today-news",
} as const;

/** The order of Today's parts: what needs a person first; Calls first while a call is ringing or on. */
function todayPlaces(callsLive: boolean) {
  return {
    calls: callsLive ? "order-first" : "order-3",
    needs: "order-1",
    newIn: "order-2",
    coming: "order-4",
    inHand: "order-5",
    team: "order-6",
    news: "order-7",
  };
}

interface StripTab {
  id: string;
  label: string;
  /** How many; null when there is nothing to count (or not read yet). */
  count: number | null;
  /** A dot beside the count: something waits on a person, or a call is live. */
  signal?: "needs" | "live" | "clear" | null;
  order: number;
}

/**
 * The overview strip (14 Nov 2026, Martin: a small persistent bar that says what is on Today, each part with how many
 * under it): pinned under the top bar, each part a press away, the part in view lit.
 */
function TodayStrip(props: {
  tabs: StripTab[];
  lit: string | null;
  onGo: (id: string) => void;
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="sticky top-2 z-20 -mx-1 px-1 pb-1 pt-1 lg:top-[calc(var(--studio-head,4.5rem)+0.25rem)]">
      <nav
        aria-label="Today at a glance"
        className="flex items-center gap-2 rounded-2xl bg-surface/90 px-2 py-1.5 shadow-[0_6px_24px_rgba(11,11,12,0.06)] ring-1 ring-line backdrop-blur"
      >
        <div className="flex shrink-0 items-center gap-2">{props.left}</div>
        <div className="staff-scroll flex min-w-0 flex-1 justify-center-safe gap-0.5 overflow-x-auto">
          {props.tabs.map((t) => {
            const on = props.lit === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => props.onGo(t.id)}
                aria-current={on ? "true" : undefined}
                className={clsx(
                  "flex min-w-[4.75rem] shrink-0 flex-col items-center rounded-xl px-3 py-1 transition-colors",
                  on ? "bg-canvas ring-1 ring-line" : "hover:bg-canvas",
                )}
              >
                <span className={clsx("whitespace-nowrap text-[11.5px] font-medium", on ? "text-ink" : "text-muted")}>{t.label}</span>
                <span className="flex h-5 items-center gap-1 text-[15px] font-semibold text-ink">
                  {t.signal === "live" && (
                    <span className="relative flex size-2" aria-label="A call is on now">
                      <span className="absolute inset-0 animate-ping rounded-full bg-positive/60 motion-reduce:hidden" />
                      <span className="relative size-2 rounded-full bg-positive" />
                    </span>
                  )}
                  {t.signal === "needs" && <span className="size-1.5 rounded-full bg-sun-line" aria-hidden />}
                  {t.signal === "clear" ? (
                    <Check className="size-4 text-positive" aria-label="All clear" />
                  ) : (
                    (t.count ?? <span className="text-[12px] font-normal text-muted">Latest</span>)
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center">{props.right}</div>
      </nav>
    </div>
  );
}

/** A pad on Today (New in, Calls): one width for every pad, so a row of them centres whatever its count. */
export const PAD = "w-full sm:w-[14.25rem]";

/** How many deals In hand shows before "Show all". */
const IN_HAND_SHOWN = 5;

/** A part of Today: its title, how many, a line on what it is. */
function Part(props: { id?: string; className?: string; title: string; count?: number | null; note?: string; children: React.ReactNode }) {
  return (
    <section id={props.id} className={clsx(TRAY, props.className)}>
      {/* The title over its cards, centred as they are (14 Nov 2026, Martin: three edges on one page looked messy). */}
      <div className="mb-4 flex flex-col items-start gap-0.5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink">
          {props.title}
          {props.count !== undefined && props.count !== null && <span className="ml-1.5 font-normal text-muted">{props.count}</span>}
        </h2>
        {props.note && <p className="text-[12.5px] text-muted">{props.note}</p>}
      </div>
      <div className="space-y-3">{props.children}</div>
    </section>
  );
}

/** What Sol has lined up on a deal: the email, when it goes, and Review to change, send or stop it. */
function ComingRow({ deal: d, now, onChanged }: { deal: FeedDeal; now: Date; onChanged: () => void }) {
  const [reviewing, setReviewing] = useState(false);
  const sol = d.sol!;
  const state = sol.state ?? (sol.held ? "held" : "counting");
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <RoofThumb deal={d} small />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] text-ink">
            <Link href={`${PATHS.deals}/${d.jobId}`} className="font-medium hover:underline">
              {d.customer}
            </Link>
            {sol.subject && <span className="text-ink-2"> · {sol.subject}</span>}
          </p>
          <p className="text-[12.5px] text-muted">
            {state === "counting"
              ? `Sol emails ${countdownWords(sol.firesAt, now)}`
              : state === "held"
                ? "Held: yours to send"
                : state === "no-email"
                  ? "No email on file"
                  : "Waiting for you to send it"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReviewing((r) => !r)}
          aria-expanded={reviewing}
          className={clsx(
            "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition",
            reviewing ? "bg-primary text-primary-ink" : "bg-surface text-ink ring-1 ring-line hover:bg-surface-2",
          )}
        >
          {state === "counting" ? <Countdown sol={sol} now={now} /> : <Mail className="size-4" aria-hidden />}
          Review
        </button>
      </div>
      {reviewing && sol.id && (
        <ReviewSol
          deal={d}
          now={now}
          onClose={() => setReviewing(false)}
          onDone={() => {
            setReviewing(false);
            onChanged();
          }}
        />
      )}
    </li>
  );
}

/** A deal in hand, as one line: opened in place to its whole card. */
function DealRow(props: {
  deal: FeedDeal;
  now: Date;
  me: string;
  callsOn: boolean;
  team: { email: string; name: string }[];
  solo?: boolean;
  onChanged: () => void;
  onMark: (mark: FeedMark | null) => void;
  /** The days Sol offers for an install, and who an email is signed by (install-days.ts). */
  installDays?: string[];
  signOff?: { sender: string; business: string };
  /** In a column of cards: the team chat goes under the deal, not beside it. */
  stacked?: boolean;
}) {
  const { deal: d, now } = props;
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
      >
        <RoofThumb deal={d} small />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="text-[14px] font-medium text-ink">{d.customer}</span>
            {d.suburb && <span className="text-[12.5px] text-muted">· {d.suburb}</span>}
            <StagePill stage={d.stage} />
            <HeatChip deal={d} />
          </span>
          <span className="block truncate text-[12.5px] text-ink-2">
            {[systemLine(d) || d.title || "Solar", caption(d, now)].filter((w, i, all) => all.indexOf(w) === i).join(" · ")}
          </span>
        </span>
        <span className="shrink-0 text-[12px] text-muted">{agoWords(lastAt(d), now)}</span>
        <ChevronDown className={clsx("size-4 shrink-0 text-muted transition", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-line bg-canvas p-3">
          <DealCard {...props} />
        </div>
      )}
    </li>
  );
}

function DealCard(props: {
  deal: FeedDeal;
  now: Date;
  me: string;
  callsOn: boolean;
  team: { email: string; name: string }[];
  /** A business of one: no team chat. */
  solo?: boolean;
  onChanged: () => void;
  onMark: (mark: FeedMark | null) => void;
  /** The days Sol offers for an install, and who an email is signed by (install-days.ts). */
  installDays?: string[];
  signOff?: { sender: string; business: string };
  /** In a column of cards: the team chat goes under the deal, not beside it. */
  stacked?: boolean;
}) {
  const { deal: d, now } = props;
  const need = needsYou(d, now);
  const move = nextMove(d, now);
  const [reviewing, setReviewing] = useState(false);
  // A card cleared with Done or Later shows a tick for a moment before it leaves Needs you.
  const [cleared, setCleared] = useState<string | null>(null);
  const held = markHolds(d, now) ? d.mark! : null;
  const [marking, setMarking] = useState(false);
  const mark = async (act: "done" | "later", later?: LaterChoice) => {
    if (marking) return;
    setMarking(true);
    const r = await markFeedDeal(d.jobId, act, { later, need: need ?? move?.label ?? "" });
    setMarking(false);
    if (!r.ok) return;
    setCleared(act === "done" ? "Done" : "Later");
    window.setTimeout(() => {
      setCleared(null);
      props.onMark(r.mark);
    }, 650);
  };
  const undo = async () => {
    const r = await markFeedDeal(d.jobId, "undo");
    if (r.ok) props.onMark(null);
  };
  // The deal's chat opened over the page from its glance (null: closed), with what was typed in the glance's box.
  const [chat, setChat] = useState<string | null>(null);
  // The pad beside the card only when the team has said something there (10 Nov 2026, Martin): Sol's open request is
  // already the card's own line.
  const pad = !props.solo && padLines(d).length > 0;
  const hide = openAskLine(d)?.id;
  // Call asks who makes the call (12 Nov 2026, Martin): you on your phone, you with the note-taker, or the business's
  // phone assistant. The note-taker is also its own round, opened by hand with its microphone off (8 Nov 2026).
  const notetaker = useRef<NotetakerHandle>(null);
  const [calling, setCalling] = useState(false);
  const call = () => setCalling(true);
  // The deal and its team chat as two cards side by side (8 Nov 2026, Martin: the chat wider and floating, not inside
  // the deal's post); the chat drops under the deal on a narrow screen.
  return (
    <div className={clsx("grid content-start items-stretch gap-3", pad && !props.stacked && "lg:grid-cols-[minmax(0,1fr)_22rem]")}>
      <article className={clsx("relative flex min-w-0 flex-col rounded-2xl bg-surface p-4 ring-1 sm:p-5", "ring-line")}>
        {cleared && (
          <div className="feed-cleared absolute inset-0 z-10 grid place-items-center rounded-2xl bg-surface/85" role="status">
            <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
              <span className="grid size-9 place-items-center rounded-full bg-positive-soft text-positive">
                <Check className="size-5" aria-hidden />
              </span>
              {cleared}
            </span>
          </div>
        )}
        <div className="flex gap-4">
          <RoofThumb deal={d} mid={props.stacked} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link href={`${PATHS.deals}/${d.jobId}`} className="truncate text-[15px] font-semibold text-ink hover:underline">
                {d.customer}
              </Link>
              {d.suburb && <span className="text-[13px] text-muted">· {d.suburb}</span>}
              <StagePill stage={d.stage} />
              <HeatChip deal={d} />
            </div>
            <p className="mt-0.5 text-[13px] text-ink-2">
              {systemLine(d) || d.title || "Solar"}
              {d.clock && OPEN_STAGES.includes(d.stage) ? ` · ${d.clock}` : ""}
              <span className="text-muted"> · {agoWords(d.events[0]?.at ?? d.createdAt, now)}</span>
            </p>
            {held && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] text-ink-2">
                {held.kind === "done" ? (
                  <Check className="size-3.5 text-positive" aria-hidden />
                ) : (
                  <Clock className="size-3.5" aria-hidden />
                )}
                {markWords(held, now)}
                <button
                  type="button"
                  onClick={() => void undo()}
                  className="ml-1 inline-flex items-center gap-1 font-medium text-ink hover:underline"
                >
                  <Undo2 className="size-3" aria-hidden /> Undo
                </button>
              </p>
            )}
          </div>
          {/* What the deal needs, in the card's top right: the one call to action (14 Nov 2026, Martin). */}
          <div className="hidden w-[38%] max-w-[14rem] shrink-0 sm:block">
            <NeedCall deal={d} move={move} now={now} reviewing={reviewing} onReview={() => setReviewing((r) => !r)} onCall={call} />
          </div>
        </div>
        <div className="mt-3 sm:hidden">
          <NeedCall deal={d} move={move} now={now} reviewing={reviewing} onReview={() => setReviewing((r) => !r)} onCall={call} />
        </div>

        {/* A signed deal: Sol's days to choose from, with the email that goes with the day (install-days.ts). */}
        {move?.kind === "book" && (
          <BookInstall deal={d} days={props.installDays ?? []} signOff={props.signOff} onBooked={props.onChanged} />
        )}
        {reviewing && d.sol?.id && (
          <ReviewSol
            deal={d}
            now={now}
            onClose={() => setReviewing(false)}
            onDone={() => {
              setReviewing(false);
              props.onChanged();
            }}
          />
        )}

        {d.events.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
            {d.events.map((e, i) => {
              const Icon = EVENT_ICONS[e.kind];
              return (
                <li key={i} className="flex items-start gap-2 text-[13.5px] leading-snug">
                  <Icon className={clsx("mt-0.5 size-3.5 shrink-0", e.kind === "message" ? "text-sun-line" : "text-muted")} />
                  <span className="min-w-0 flex-1">
                    {e.by && <span className={clsx("font-medium", e.kind === "message" ? "text-ink" : "text-ink-2")}>{e.by}: </span>}
                    <span className={e.kind === "message" ? "text-ink" : "text-ink-2"}>{e.text}</span>
                  </span>
                  <span className="shrink-0 text-[11.5px] text-muted">{agoWords(e.at, now)}</span>
                </li>
              );
            })}
          </ul>
        )}

        {/* The foot of the card, kept at the bottom however tall the chat beside it makes the row: the deal's tools, quiet,
            and Done / Later (14 Nov 2026, Martin: no box to type Sol an instruction; the next move is the top right). */}
        <div className="mt-auto pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {move?.kind !== "call" && (
              <Tool
                quiet={Boolean(move)}
                label="Call"
                title={d.phone ? `Call ${d.phone}` : "No phone on file"}
                onClick={d.phone ? call : undefined}
              >
                <Phone className="size-4" aria-hidden />
              </Tool>
            )}
            <Tool
              quiet
              label="Note-taker"
              title="Open the note-taker: start it when the call begins"
              onClick={() => notetaker.current?.start()}
            >
              <NotebookPen className="size-4" aria-hidden />
            </Tool>
            {move?.kind !== "design" && (
              <Tool
                quiet={Boolean(move)}
                label="Design"
                title={d.projectId ? "Open the design" : "Design this roof"}
                href={`${PATHS.designer}?job=${encodeURIComponent(d.jobId)}`}
              >
                <PenTool className="size-4" aria-hidden />
              </Tool>
            )}
            {move?.kind !== "proposal" && (
              <Tool
                quiet={Boolean(move)}
                label="Proposal"
                title="The proposal"
                href={`${PATHS.deals}/${encodeURIComponent(d.jobId)}/proposal`}
              >
                <FileText className="size-4" aria-hidden />
              </Tool>
            )}
            {!pad && !props.solo && (
              <Tool quiet={Boolean(move)} label="Team chat" title="Talk about this deal with the team" onClick={() => setChat("")}>
                <MessageCircle className="size-4" aria-hidden />
              </Tool>
            )}
            <Tool quiet={Boolean(move)} label="Deal" title={`${d.customer}'s deal`} href={`${PATHS.deals}/${d.jobId}`}>
              <Handshake className="size-4" aria-hidden />
            </Tool>
            {need && (
              <span className="ml-auto">
                <MarkButtons busy={marking} onDone={() => void mark("done")} onLater={(c) => void mark("later", c)} />
              </span>
            )}
          </div>
        </div>
        <CallNotetaker handle={notetaker} button={false} jobId={d.jobId} customerId="" phone={d.phone ?? ""} onAdded={props.onChanged} />
        {calling && (
          <CallChooser
            jobId={d.jobId}
            phone={d.phone ?? ""}
            name={d.customer.trim().split(/\s+/)[0] ?? ""}
            onNotes={() => notetaker.current?.start()}
            onClose={() => setCalling(false)}
          />
        )}
      </article>
      {/* The deal's team chat: its own card beside the deal (deal-team.ts). */}
      {pad && (
        <aside
          className="flex min-w-0 flex-col gap-2 rounded-2xl bg-surface p-4 shadow-[0_8px_30px_rgba(11,11,12,0.06)] ring-1 ring-line"
          aria-label={`Team chat on ${d.customer}'s deal`}
        >
          <p className="flex items-center justify-between text-[11.5px] font-medium uppercase tracking-wide text-muted">
            Team chat
            <Link href={`${PATHS.deals}/${d.jobId}?tab=team`} className="normal-case tracking-normal text-ink-2 hover:text-ink">
              All
            </Link>
          </p>
          <div
            className="flex min-w-0 flex-1 cursor-pointer flex-col"
            onClick={(e) => {
              // Anywhere on the glance but its buttons and box opens the deal's chat.
              if (!(e.target as HTMLElement).closest("button, a, input, textarea")) setChat("");
            }}
          >
            <DealTeamChat
              jobId={d.jobId}
              pad
              initial={padLines(d)}
              hide={hide ? [hide] : undefined}
              onChanged={props.onChanged}
              onOpen={(typed) => setChat(typed)}
            />
          </div>
        </aside>
      )}
      {chat !== null && <DealChatSheet deal={d} startText={chat} onClose={() => setChat(null)} onChanged={props.onChanged} />}
    </div>
  );
}

const field =
  "w-full rounded-lg bg-surface px-3 py-2 text-[14px] text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-sun-line";
const dark =
  "inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-ink transition hover:brightness-110 disabled:bg-surface-2 disabled:text-muted";

/** One of the deal's tools: labelled while nothing needs doing; a quiet grey round while another is the next move. */
function Tool(props: { quiet: boolean; label: string; title: string; href?: string; onClick?: () => void; children: React.ReactNode }) {
  const look = clsx(
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium ring-1 ring-line transition-colors",
    props.quiet ? "w-9 text-muted hover:bg-surface-2 hover:text-ink" : "px-3.5 text-ink hover:bg-surface-2",
    !props.href && !props.onClick && "pointer-events-none opacity-60",
  );
  const inner = (
    <>
      {props.children}
      {!props.quiet && <span className="hidden sm:inline">{props.label}</span>}
    </>
  );
  return props.href ? (
    <Link href={props.href} title={props.title} aria-label={props.label} className={look}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={props.onClick} disabled={!props.onClick} title={props.title} aria-label={props.label} className={look}>
      {inner}
    </button>
  );
}

const MOVE_ICONS: Record<MoveKind, React.ComponentType<{ className?: string }>> = {
  reply: MessageCircle,
  review: Mail,
  design: PenTool,
  proposal: FileText,
  call: Phone,
  book: CalendarPlus,
  deal: Handshake,
};

/** The one thing to do now, the card's one graphite button (orange is kept for signals, 12 Nov 2026, Martin), with its countdown when it is Sol's email. */
function MoveButton(props: { deal: FeedDeal; move: NextMove; now: Date; reviewing: boolean; onReview: () => void; onCall: () => void }) {
  const { deal: d, move } = props;
  const Icon = MOVE_ICONS[move.kind];
  const look = clsx(
    "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition",
    props.reviewing ? "bg-ink text-canvas ring-2 ring-primary/30" : "bg-primary text-primary-ink hover:brightness-125",
  );
  const ask = d.team?.openAsks.find((a) => a.type === "design");
  const counting = Boolean(d.sol) && (d.sol?.state ?? (d.sol?.held ? "held" : "counting")) === "counting";
  const inner = (
    <>
      {move.kind === "review" && counting && d.sol ? <Countdown sol={d.sol} now={props.now} /> : <Icon className="size-4" />}
      {move.label}
      {move.kind === "review" && counting && d.sol && (
        <span className="font-normal opacity-90">· {countdownWords(d.sol.firesAt, props.now)}</span>
      )}
    </>
  );
  if (move.kind === "review")
    return (
      <button type="button" onClick={props.onReview} aria-expanded={props.reviewing} className={look}>
        {inner}
      </button>
    );
  if (move.kind === "call")
    return (
      <button
        type="button"
        onClick={props.onCall}
        title={d.phone ? `Call ${d.phone} with the note-taker open` : undefined}
        className={look}
      >
        {inner}
      </button>
    );
  const href =
    move.kind === "reply"
      ? `${PATHS.deals}/${d.jobId}?tab=chat`
      : move.kind === "design"
        ? ask
          ? briefHref(d.jobId, ask.id)
          : `${PATHS.designer}?job=${encodeURIComponent(d.jobId)}`
        : move.kind === "proposal"
          ? `${PATHS.deals}/${encodeURIComponent(d.jobId)}/proposal`
          : move.kind === "book"
            ? `${PATHS.deals}/${d.jobId}?tab=details`
            : `${PATHS.deals}/${d.jobId}?tab=team`;
  return (
    <Link href={href} className={look}>
      {inner}
    </Link>
  );
}

/** A ring that empties as Sol's email nears its time. */
function Countdown({ sol, now }: { sol: NonNullable<FeedDeal["sol"]>; now: Date }) {
  const end = Date.parse(sol.firesAt);
  const start = Date.parse(sol.readyAt ?? "") || end - 30 * 60_000;
  const left = Math.max(0, Math.min(1, (end - now.getTime()) / Math.max(1, end - start)));
  const c = 2 * Math.PI * 6;
  return (
    <svg viewBox="0 0 16 16" className="size-4 -rotate-90" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2.2" />
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - left)}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * What Sol has lined up, opened in the card: its words to change, and when it goes, which is the person's to change
 * (LIVE_SOFTWARE.md: Sol gives notice with a countdown instead of asking permission). Send now, an hour later,
 * tomorrow at 9, hold it, or don't send it.
 */
function ReviewSol(props: { deal: FeedDeal; now: Date; onClose: () => void; onDone: () => void }) {
  const sol = props.deal.sol!;
  const first = props.deal.customer.split(/\s+/)[0] || "them";
  const [subject, setSubject] = useState(sol.subject);
  const [body, setBody] = useState(sol.body ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const changed = subject !== sol.subject || body !== (sol.body ?? "");
  const state = sol.state ?? (sol.held ? "held" : "counting");
  const when =
    state === "counting"
      ? `Sol sends it ${countdownWords(sol.firesAt, props.now)} unless you change it.`
      : state === "held"
        ? "Held: it goes only when you send it."
        : state === "no-email"
          ? `There's no email for ${first} on their record.`
          : "Sol's agent for this stage is off, so it waits for you to send it.";
  const run = async (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    setNote(null);
    // Words changed in the box go with whatever is pressed next.
    if (changed) {
      const saved = await editOutbox(sol.id!, { subject, body });
      if (!saved.ok) {
        setBusy(false);
        return setNote("message" in saved && typeof saved.message === "string" ? saved.message : "It couldn't be saved. Try again.");
      }
    }
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setNote(r.message ?? "That couldn't be done. Try again.");
    props.onDone();
  };
  const small =
    "inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-medium text-ink ring-1 ring-line hover:bg-surface-2 disabled:text-muted";
  return (
    <div className="mt-2.5 space-y-2 rounded-xl bg-canvas p-3 ring-1 ring-line" role="group" aria-label={`Sol's email to ${first}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-semibold text-ink">
          Sol&apos;s email to {first}
          {sol.to ? <span className="font-normal text-muted"> · {sol.to}</span> : null}
        </p>
        <button type="button" aria-label="Close" onClick={props.onClose} className="rounded-full p-1 text-muted hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      <p className={clsx("text-[12.5px]", state === "counting" ? "text-sun-ink" : "text-ink-2")}>{when}</p>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        aria-label="Subject"
        className="w-full rounded-lg bg-surface px-3 py-2 text-[13.5px] font-medium text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-sun-line"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={7}
        aria-label="The email"
        className="w-full resize-y rounded-lg bg-surface px-3 py-2 text-[13.5px] leading-relaxed text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-sun-line"
      />
      {note && <p className="text-[12.5px] text-warning">{note}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={busy || !sol.to}
          onClick={() => void run(() => actOnOutbox(sol.id!, "send"))}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[12.5px] font-semibold text-primary-ink hover:brightness-110 disabled:bg-surface-2 disabled:text-muted"
        >
          <ArrowUp className="size-3.5" /> Send now
        </button>
        <button type="button" disabled={busy} className={small} onClick={() => void run(() => putOffOutbox(sol.id!, "hour"))}>
          In an hour
        </button>
        <button type="button" disabled={busy} className={small} onClick={() => void run(() => putOffOutbox(sol.id!, "tomorrow"))}>
          Tomorrow at 9
        </button>
        {state === "held" ? (
          <button type="button" disabled={busy} className={small} onClick={() => void run(() => actOnOutbox(sol.id!, "release"))}>
            Let Sol send it
          </button>
        ) : (
          <button type="button" disabled={busy} className={small} onClick={() => void run(() => actOnOutbox(sol.id!, "hold"))}>
            Hold
          </button>
        )}
        {changed && (
          <button type="button" disabled={busy} className={small} onClick={() => void run(async () => ({ ok: true }))}>
            Save changes
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => actOnOutbox(sol.id!, "skip"))}
          className="ml-auto inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-medium text-muted hover:text-danger"
        >
          Don&apos;t send
        </button>
      </div>
    </div>
  );
}

/**
 * What the deal needs, as the card's call to action (14 Nov 2026, Martin: the need is the most important thing on the
 * card, so it sits in the top right and asks for attention): Sol's words on what is needed, and the button for it. A
 * signed deal's button is its days, under the card's head (BookInstall).
 */
function NeedCall(props: {
  deal: FeedDeal;
  move: NextMove | null;
  now: Date;
  reviewing: boolean;
  onReview: () => void;
  onCall: () => void;
}) {
  const { deal: d, move, now } = props;
  const words = solLine(d, now);
  if (!move)
    return (
      <p className="line-clamp-3 text-[13px] leading-snug text-ink-2 sm:text-right" title={words}>
        {words}
      </p>
    );
  return (
    <div className="flex flex-col gap-2 sm:items-end sm:text-right">
      <p className="line-clamp-3 text-[14px] font-semibold leading-snug text-ink" title={words}>
        <span className="mb-0.5 mr-2 inline-block size-2 rounded-full bg-sun-line align-middle" aria-hidden />
        {words}
      </p>
      {move.kind !== "book" && (
        <MoveButton deal={d} move={move} now={now} reviewing={props.reviewing} onReview={props.onReview} onCall={props.onCall} />
      )}
    </div>
  );
}

/**
 * Book the install with a click (14 Nov 2026, Martin: Sol surfaces dates to choose from, along with a proposed email):
 * the days Sol found free (install-days.ts), the soonest picked, and the email offering it to the customer, worded for the
 * day picked and opened to change. One press books the day on the deal and sends the email through the deal's own email.
 */
function BookInstall(props: { deal: FeedDeal; days: string[]; signOff?: { sender: string; business: string }; onBooked: () => void }) {
  const { deal: d, days } = props;
  const first = d.customer.trim().split(/\s+/)[0] || "them";
  const [chosen, setDay] = useState<string | null>(null);
  // The soonest day is picked until another is (and again if the one picked is no longer free).
  const day = chosen && days.includes(chosen) ? chosen : (days[0] ?? null);
  const [edits, setEdits] = useState<{ subject: string; body: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const email = day
    ? (edits ?? installDayEmail({ firstName: first, day, sender: props.signOff?.sender ?? "", business: props.signOff?.business ?? "" }))
    : null;
  const pick = (next: string) => {
    setDay(next);
    setEdits(null);
  };
  const book = async (send: boolean) => {
    if (!day || busy) return;
    setBusy(true);
    setNote(null);
    const saved = await saveJob(d.jobId, { installDate: day });
    if (!saved.ok) {
      setBusy(false);
      return setNote(saved.message);
    }
    if (send && email) {
      const sent = await emailDeal(d.jobId, { subject: email.subject, body: email.body, toCustomer: true });
      if (!sent.ok) {
        setBusy(false);
        setNote(`Booked for ${dayChip(day)}, but the email didn't go: ${sent.message}`);
        return props.onBooked();
      }
    }
    setBusy(false);
    props.onBooked();
  };
  if (!days.length)
    return (
      <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
        No free install days in the next ten weeks.{" "}
        <Link href={`${PATHS.deals}/${d.jobId}?tab=details`} className="font-medium text-ink underline-offset-4 hover:underline">
          Set a day on the deal
        </Link>
      </p>
    );
  return (
    <div className="mt-4 border-t border-line pt-3.5">
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
        <SolIcon className="size-3.5 text-sun-line" /> Sol found these days free
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Installation day">
        {days.map((x) => (
          <button
            key={x}
            type="button"
            role="radio"
            aria-checked={x === day}
            onClick={() => pick(x)}
            className={clsx(
              "inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium transition",
              x === day ? "bg-primary text-primary-ink" : "bg-surface text-ink ring-1 ring-line hover:ring-ink-2",
            )}
          >
            {dayChip(x)}
          </button>
        ))}
      </div>
      {email && d.canEmail && (
        <div className="mt-3 rounded-xl bg-surface ring-1 ring-line">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
          >
            <Mail className="size-4 shrink-0 text-muted" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{email.subject}</span>
              {!open && <span className="block truncate text-[12px] text-muted">{email.body.split("\n\n")[1]}</span>}
            </span>
            <span className="shrink-0 text-[12px] font-medium text-ink-2">{open ? "Done" : "Edit"}</span>
          </button>
          {open && (
            <div className="space-y-2 border-t border-line p-3">
              <input
                className={field}
                value={email.subject}
                onChange={(e) => setEdits({ ...email, subject: e.target.value })}
                aria-label="Subject"
              />
              <textarea
                className={`${field} min-h-44`}
                value={email.body}
                onChange={(e) => setEdits({ ...email, body: e.target.value })}
                aria-label="Email"
              />
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="button" className={dark} disabled={!day || busy} onClick={() => void book(d.canEmail)}>
          <CalendarPlus className="size-4" aria-hidden />
          {busy ? "Booking…" : day ? (d.canEmail ? `Book ${dayChip(day)} and email ${first}` : `Book ${dayChip(day)}`) : "Pick a day"}
        </button>
        {d.canEmail && (
          <button
            type="button"
            disabled={!day || busy}
            onClick={() => void book(false)}
            className="text-[13px] font-medium text-ink-2 hover:text-ink disabled:text-muted"
          >
            Book without emailing
          </button>
        )}
        {!d.canEmail && <span className="text-[12.5px] text-muted">No email on file for {first}.</span>}
      </div>
      {note && (
        <p className="mt-2 text-[12.5px] text-danger" role="status">
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * The deals on the right of Today (14 Nov 2026, Martin: as Service lists its cases): what is in play in a line, New
 * leads, In progress (a reply needed first, then proposals out) or All, a search, and a row a deal that opens its card on
 * the left. New lead is here too.
 */
function DealsPanel(props: {
  deals: FeedDeal[];
  now: Date;
  picked: string | null;
  onPick: (jobId: string) => void;
  onNew?: () => void;
  adding?: boolean;
}) {
  const counts = panelCounts(props.deals);
  const [chosenTab, setTab] = useState<PanelTab | null>(null);
  const tab = chosenTab ?? (counts.waiting > 0 || counts.fresh === 0 ? "progress" : "new");
  const [search, setSearch] = useState("");
  const rows = panelDeals(props.deals, tab, search);
  return (
    <aside aria-label="Deals" className="mt-9 lg:sticky lg:top-[calc(var(--studio-head,4.5rem)+5rem)]">
      <div className="flex items-center gap-2.5">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">Deals</h2>
        {props.onNew && (
          <button
            type="button"
            onClick={props.onNew}
            aria-expanded={props.adding}
            aria-label="New lead"
            title="New lead"
            className="grid size-9 place-items-center rounded-full bg-primary text-primary-ink transition hover:brightness-125"
          >
            <Plus className={clsx("size-4 transition", props.adding && "rotate-45")} strokeWidth={2.5} aria-hidden />
          </button>
        )}
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {counts.fresh} new · {counts.progress} in progress
        {counts.waiting > 0 && <span className="font-medium text-sun-ink"> · {counts.waiting} waiting on you</span>}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1" role="tablist" aria-label="Which deals">
        {PANEL_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "h-9 rounded-xl text-[13px] font-medium transition",
              tab === t.id ? "bg-surface text-ink shadow-[0_1px_3px_rgba(11,11,12,0.1)]" : "text-ink-2 hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <label className="mt-3 flex h-11 items-center gap-2.5 rounded-2xl bg-surface px-3.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-sun-line">
        <Search className="size-4 shrink-0 text-muted" aria-hidden />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search deals"
          aria-label="Search deals"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-muted focus:outline-none"
        />
      </label>
      <ul className="staff-scroll mt-3 max-h-[calc(100dvh-24rem)] space-y-1.5 overflow-y-auto pr-0.5">
        {rows.map((d) => {
          const mark = panelMark(d);
          const on = props.picked === d.jobId;
          return (
            <li key={d.jobId}>
              <button
                type="button"
                onClick={() => props.onPick(d.jobId)}
                aria-current={on ? "true" : undefined}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-2xl bg-surface p-2.5 text-left ring-1 transition",
                  on ? "ring-2 ring-ink" : "ring-line hover:ring-ink-2",
                )}
              >
                <RoofThumb deal={d} small />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 truncate text-[14px] font-medium text-ink">{d.customer}</span>
                    <span className="ml-auto shrink-0 text-[11.5px] text-muted">{agoWords(lastAt(d), props.now)}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StagePill stage={d.stage} />
                    {mark && (
                      <span
                        className={clsx(
                          "text-[12px]",
                          mark.tone === "reply" ? "inline-flex items-center gap-1 font-medium text-sun-ink" : "text-muted",
                        )}
                      >
                        {mark.tone === "reply" && <span className="size-1.5 rounded-full bg-sun-line" aria-hidden />}
                        {mark.words}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="rounded-2xl bg-surface px-4 py-4 text-[13.5px] text-ink-2 ring-1 ring-line">
            {search ? "No deal matches that." : tab === "new" ? "No new leads." : "Nothing in progress."}
          </li>
        )}
      </ul>
    </aside>
  );
}

const STAGE_ICONS: Partial<Record<JobStage, LucideIcon>> = {
  lead: UserPlus,
  designed: PenTool,
  proposal: FileText,
  won: Handshake,
  ordered: Truck,
  scheduled: CalendarCheck,
  installed: HardHat,
};

const STAGE_TONES: Record<StageTone, string> = {
  lead: "bg-kind-lead-soft text-kind-lead",
  message: "bg-kind-message-soft text-kind-message",
  "follow-up": "bg-kind-follow-up-soft text-kind-follow-up",
  order: "bg-kind-order-soft text-kind-order",
  approvals: "bg-kind-approvals-soft text-kind-approvals",
  date: "bg-kind-date-soft text-kind-date",
  install: "bg-kind-install-soft text-kind-install",
};

/**
 * Where a deal is, as a pill in its stage's colour with its icon, as To action's kinds are (14 Nov 2026, Martin: the New
 * lead pill, blue with its icon, on the feed too, and the same for each stage).
 */
function StagePill({ stage, className }: { stage: JobStage; className?: string }) {
  const pill = stagePill(stage);
  const Icon = STAGE_ICONS[stage] ?? Stamp;
  return (
    <span
      className={clsx(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold uppercase tracking-[0.08em]",
        STAGE_TONES[pill.tone],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {pill.words}
    </span>
  );
}

function HeatChip({ deal: d }: { deal: FeedDeal }) {
  if (!d.heat) return null;
  const title = d.heatWhy.join(" · ") || undefined;
  if (d.heat === "hot")
    return (
      <span
        title={title}
        className="inline-flex items-center gap-1 rounded-full bg-sun px-2 py-0.5 text-[11.5px] font-semibold text-sun-ink"
      >
        <Flame className="size-3" /> Hot
      </span>
    );
  if (d.heat === "cold")
    return (
      <span
        title={title}
        className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-muted"
      >
        <Snowflake className="size-3" /> Cold
      </span>
    );
  return (
    <span title={title} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-ink-2">
      Warm
    </span>
  );
}

const FORMS: RoofForm[] = ["hip", "gable", "ell", "hip", "skillion"];
const FINISHES: RoofFinish[] = ["charcoal-tile", "monument", "terracotta", "surfmist", "woodland", "shale"];

/** A steady number from a deal's id, so its illustrated roof is always the same. */
function seedOf(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** An example deal's roof, drawn (never a real home), panels on it once it is designed. */
function sampleRoof(d: FeedDeal): AerialRoofSpec {
  const s = seedOf(d.jobId);
  const form = FORMS[s % FORMS.length];
  const panels = d.projectId || d.kw ? Math.max(8, Math.round((d.kw ?? 6.6) / 0.44)) : 0;
  return {
    form,
    finish: FINISHES[(s >>> 3) % FINISHES.length],
    at: [160, 64, 320, 186],
    ...(form === "ell" ? { wing: [330, 100, 70] as [number, number, number] } : {}),
    panels: panels ? { north: Math.min(panels, 22) } : {},
    pool: s % 5 === 0,
    seed: s % 97,
  };
}

/**
 * The deal's team chat, larger, over the page (8 Nov 2026, Martin: the pad beside a card is a glance at the latest; typing
 * in it brings this up). Headed by the deal, its address and a small roof, so coming back to it after a minute it is
 * plain which deal the chat is about.
 */
function DealChatSheet(props: { deal: FeedDeal; startText: string; onClose: () => void; onChanged: () => void }) {
  const { deal: d, onClose } = props;
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return createPortal(
    <div
      className="theme-studio fixed inset-0 z-[70] flex items-end justify-center"
      role="dialog"
      aria-modal
      aria-label={`Team chat on ${d.customer}'s deal`}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" />
      <div className="deal-sheet-in relative flex h-[min(82dvh,48rem)] w-full max-w-3xl flex-col rounded-t-[28px] bg-canvas shadow-[0_-12px_48px_rgba(20,22,26,0.22)] ring-1 ring-line sm:mb-4 sm:rounded-[28px]">
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <RoofThumb deal={d} small />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-ink">{d.customer}</p>
            <p className="truncate text-[13px] text-ink-2">{d.address || d.suburb || "No address yet"}</p>
            <p className="truncate text-[12px] text-muted">
              {d.title || "Solar"} · {STAGE_LABELS[d.stage]}
            </p>
          </div>
          <Link
            href={`${PATHS.deals}/${d.jobId}?tab=team`}
            className="hidden h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-surface-2 sm:inline-flex"
          >
            <Handshake className="size-4" aria-hidden /> Deal
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 px-5 pb-5 pt-4">
          <DealTeamChat jobId={d.jobId} fill startText={props.startText} autoFocus onChanged={props.onChanged} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RoofThumb({ deal: d, small, mid }: { deal: FeedDeal; small?: boolean; mid?: boolean }) {
  const frame = small
    ? "relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line"
    : mid
      ? "relative h-[60px] w-[80px] shrink-0 overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line"
      : "relative h-[84px] w-[112px] shrink-0 overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line sm:h-[96px] sm:w-[128px]";
  if (d.sample)
    return (
      <div className={frame}>
        <AerialRoof spec={sampleRoof(d)} className="absolute inset-0 h-full w-full" />
        {d.kw && !small ? <DesignedTag /> : null}
      </div>
    );
  if (d.place)
    return (
      <div className={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/design/roof?lat=${d.place.lat}&lng=${d.place.lng}`}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full scale-150 object-cover"
        />
        {d.projectId && !small && <DesignedTag />}
      </div>
    );
  return (
    <div className={`${frame} flex items-center justify-center text-center text-[11px] leading-tight text-muted`}>
      {small ? "" : "No address on the map yet"}
    </div>
  );
}

function DesignedTag() {
  return (
    <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">Designed</span>
  );
}

/**
 * Done and Later beside what a deal needs (9 Nov 2026, Martin; docs/plans/needs-you-sign-offs.md): Done for something
 * handled where the record can't see it, Later to bring it back tomorrow, next week or when they reply. Either way it
 * comes back the moment anything new happens on the deal.
 */
function MarkButtons(props: { busy: boolean; onDone: () => void; onLater: (c: LaterChoice) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const pill =
    "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12px] font-medium text-ink-2 ring-1 ring-line transition hover:bg-surface-2 hover:text-ink disabled:text-muted";
  return (
    <div ref={box} className="relative flex items-center gap-1">
      <button type="button" disabled={props.busy} onClick={props.onDone} className={pill} title="Handled: take it out of Needs you">
        <Check className="size-3.5" aria-hidden /> Done
      </button>
      <button
        type="button"
        disabled={props.busy}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={pill}
        title="Not now: bring it back later"
      >
        <Clock className="size-3.5" aria-hidden /> Later
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-20 w-44 overflow-hidden rounded-xl bg-surface py-1 shadow-[0_10px_30px_rgba(11,11,12,0.12)] ring-1 ring-line">
          {LATER_CHOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setOpen(false);
                props.onLater(c.id);
              }}
              className="block w-full px-3 py-2 text-left text-[13px] text-ink hover:bg-surface-2"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Whose deals and which pipeline, in one pill (10 Nov 2026, Martin: fewer buttons): it reads "All deals", "My deals" or
 * "Sales · mine", and opens a small menu with Everyone's / Mine over the pipelines.
 */
function FeedPicker({
  pick,
  pipelines,
  picked,
  onPick,
  solo,
}: {
  pick: { pipeline: FeedPipeline; mine: boolean };
  pipelines: readonly Pipeline[];
  picked: Pipeline | null;
  onPick: (next: { pipeline: FeedPipeline; mine: boolean }) => void;
  /** A business of one: there is nobody else's to see. */
  solo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const label = picked ? (pick.mine ? `${picked.name} · mine` : picked.name) : pick.mine ? "My deals" : "All deals";
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-9 items-center gap-2 rounded-full bg-surface pl-3.5 pr-3 text-[12.5px] font-medium text-ink ring-1 ring-line hover:bg-surface-2"
      >
        {label}
        <ChevronDown className={clsx("size-3.5 text-muted transition", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-11 z-30 w-60 rounded-2xl bg-surface p-2 shadow-lg ring-1 ring-line">
          {!solo && (
            <div
              role="radiogroup"
              aria-label="Whose deals"
              className="grid grid-cols-2 gap-0.5 rounded-full bg-canvas p-1 ring-1 ring-line"
            >
              {(
                [
                  [false, "Everyone's"],
                  [true, "Mine"],
                ] as const
              ).map(([mine, words]) => (
                <button
                  key={words}
                  type="button"
                  role="radio"
                  aria-checked={pick.mine === mine}
                  onClick={() => onPick({ ...pick, mine })}
                  className={clsx(
                    "rounded-full py-1 text-[12.5px] font-medium transition",
                    pick.mine === mine ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {words}
                </button>
              ))}
            </div>
          )}
          <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-muted">Pipeline</p>
          {[{ id: "all", name: "All deals" }, ...pipelines].map((p) => {
            const on = (picked?.id ?? "all") === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => {
                  onPick({ ...pick, pipeline: p.id });
                  setOpen(false);
                }}
                className={clsx(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition",
                  on ? "font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                {p.name}
                {on && <Check className="size-4 text-sun-line" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
