"use client";

import { CustomerConversations } from "./customer-conversations";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { AtSign, Check, FileText, Hash, MessagesSquare, Paperclip, Pencil, Reply, SmilePlus, SquareKanban, Trash2, X } from "lucide-react";
import { cleanKind } from "@/lib/domain/design/business-kind";
import {
  CATCH_UP_MIN,
  actionDoneWords,
  actionNotYours,
  actionQuestion,
  type CatchUp,
  type ChatAction,
} from "@/lib/domain/design/sol-chat-work";
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import { matches } from "@/lib/domain/design/find";
import { handleOf } from "@/lib/domain/design/mentions";
import {
  SOL_BY,
  TEAM_CHANNELS,
  TEAM_DEALS_MAX,
  TEAM_EMOJIS,
  TEAM_FILE_ACCEPT,
  TEAM_LINE_MAX,
  TEAM_POLL_MS,
  TEAM_QUICK_REACTIONS,
  asksSol,
  dmWith,
  initialsOf,
  isTeamPicture,
  nameOf,
  replyQuote,
  roomLabel,
  tagsIn,
  teamFilesProblem,
  typingDeal,
  typingTag,
  type TeamDeal,
  type TeamFile,
  type TeamLine,
  type TeamReply,
} from "@/lib/domain/design/team-chat";
import { listJobs, type JobLine } from "@/lib/services/crm";
import {
  ROOM_KEY,
  TEAM_CHANGED,
  TEAM_OPEN,
  teamUnreadCount,
  deleteTeamLine,
  editTeamLine,
  catchUpRoom,
  loadTeamRoom,
  pressSolAction,
  setSolJoinsIn,
  reactToTeamLine,
  sayInTeam,
  teamSeen,
  type TeamRoomView,
} from "@/lib/services/team-chat";
import { dealRoom, jobOfRoom, writerName, type DealChatLine } from "@/lib/domain/design/deal-team";
import { DEAL_TEAM_CHANGED, openDealChat } from "@/lib/services/deal-team";
import { DealTeamChat } from "./deal-team-chat";
import { useDesignAccount } from "./design-account";
import { DictateButton, withSpoken } from "./dictate";
import { SolChat } from "./sol-chat";
import { SolBadge } from "./sol-icon";
import { SolChartView, SolDiagramView } from "./sol-visuals";
import { SolThinking } from "./sol-thinking";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { weekday: "short", hour: "numeric", minute: "2-digit" }).replace(",", "");

/** How long the chat waits for Sol's answer in a channel before it stops showing that he is answering. */
const SOL_WAIT_MS = 120_000;

/**
 * Sol's own conversation, first under Direct messages: the member's chat with him, the same one as his panel (kept by
 * his own service, never a team room), shown in place of a room.
 */
const SOL_ROOM = "sol";

/**
 * The team chat (1 Nov 2026, as Primero's): channels and the people down the left, the room on the right. Lines run
 * oldest first, your own on the right; hover one to reply to it (as iMessage: the reply carries a quote of it, which
 * jumps back to it), to react, or to change or delete your own. In a channel, @ tags a
 * member (or Sol, who answers there), # drops a deal in as a card; files and pictures go with a line (the paperclip,
 * pasting a screenshot, or dropping them on the room). It asks for new lines every ten seconds while open; whatever is
 * on screen counts as read.
 */
export function TeamChatPanel({
  onClose,
  me,
  start,
  customers = 0,
}: {
  onClose?: () => void;
  me: string;
  start?: string | null;
  /** Customers' lines waiting and this member's unread mentions: the count on the Customers side. */
  customers?: number;
}) {
  // Team or Customers (10 Nov 2026, Martin: the bell went; customer chat is a toggle in team chat).
  const [side, setSide] = useState<"team" | "customers">("team");
  const [room, setRoomState] = useState<string>(() => {
    if (start) return start;
    try {
      return localStorage.getItem(ROOM_KEY) || "deals";
    } catch {
      return "deals";
    }
  });
  const [view, setView] = useState<TeamRoomView | null>(null);
  const [error, setError] = useState("");
  // Only a retailer has Sol (installers and inspectors join without him), so only a retailer's members talk to him here.
  const [account] = useDesignAccount();
  const hasSol = cleanKind(account?.signedIn ? account.business?.kind : undefined) === "retailer";
  const solOpen = hasSol && room === SOL_ROOM;
  // A business without Sol that was left on his conversation (another account in this browser) opens on Deals.
  const known = account !== null;
  if (known && !hasSol && room === SOL_ROOM) setRoomState("deals");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [deals, setDeals] = useState<TeamDeal[]>([]);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [reacting, setReacting] = useState<string | null>(null);
  const [emojis, setEmojis] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [solSince, setSolSince] = useState<number | null>(null);
  const [dealAt, setDealAt] = useState<{ start: number; query: string } | null>(null);
  const [tagAt, setTagAt] = useState<{ start: number; query: string } | null>(null);
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  const [hi, setHi] = useState(0);
  /** The message being answered, with the room it is in: a reply is only offered in that room. */
  const [replying, setReplying] = useState<{ room: string; reply: TeamReply } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  /** How many lines were unread when this room was opened (opening it reads them), for Catch me up. */
  const [missed, setMissed] = useState<{ room: string; n: number } | null>(null);
  const [caught, setCaught] = useState<{ room: string; summary: CatchUp } | null>(null);
  const [catching, setCatching] = useState(false);
  /** What the microphone is hearing, shown at the end of the box until the phrase is finished. */
  const [heard, setHeard] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const setRoom = (r: string) => {
    setRoomState(r);
    setView(null);
    setEditing(null);
    setReacting(null);
    setSolSince(null);
    try {
      localStorage.setItem(ROOM_KEY, r);
    } catch {
      // Storage refused: it opens on Deals next time.
    }
  };

  const load = useCallback(async () => {
    const withSol = room === SOL_ROOM || jobOfRoom(room) !== null;
    const r = await loadTeamRoom(withSol ? "deals" : room);
    if (!r.ok) {
      setError(r.message);
      if (room !== "deals") setRoomState("deals");
      return;
    }
    setError("");
    setView(r);
    if (withSol) return window.dispatchEvent(new CustomEvent(TEAM_CHANGED, { detail: r.unread }));
    // What is on screen is read: the room's own unread lines are marked seen.
    const here = [...r.channels, ...r.people].find((x) => x.room === room)?.unread ?? 0;
    if (here > 0) {
      setMissed((m) => (m?.room === room ? { room, n: m.n + here } : { room, n: here }));
      await teamSeen(room);
      window.dispatchEvent(new CustomEvent(TEAM_CHANGED, { detail: Math.max(0, r.unread - here) }));
    } else window.dispatchEvent(new CustomEvent(TEAM_CHANGED, { detail: r.unread }));
  }, [room]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const t = window.setInterval(() => document.visibilityState === "visible" && void load(), TEAM_POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [load]);

  const lines = view?.lines ?? null;
  // Sol's answer arrived: stop showing that he is answering. Waiting too long gives up quietly.
  useEffect(() => {
    if (solSince === null || !lines) return;
    const answered = lines.some((l) => l.by === SOL_BY && Date.parse(l.at) > solSince - 2000);
    const t = answered ? 0 : SOL_WAIT_MS - (Date.now() - solSince);
    const timer = window.setTimeout(() => setSolSince(null), Math.max(0, t));
    return () => window.clearTimeout(timer);
  }, [lines, solSince]);
  // While Sol is answering, look a little more often.
  useEffect(() => {
    if (solSince === null) return;
    const t = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(t);
  }, [solSince, load]);
  useEffect(() => {
    if (!lines || lines.length === lastCount.current) return;
    lastCount.current = lines.length;
    end.current?.scrollIntoView({ block: "end" });
  }, [lines]);
  useEffect(() => {
    if (dealAt && jobs === null) void listJobs().then((r) => setJobs(r.ok ? r.jobs : []));
  }, [dealAt, jobs]);

  // A deal's chat read elsewhere (the feed's pad, the deal's Team tab) changes the Deals list and its counts here.
  useEffect(() => {
    const changed = () => void load();
    window.addEventListener(DEAL_TEAM_CHANGED, changed);
    return () => window.removeEventListener(DEAL_TEAM_CHANGED, changed);
  }, [load]);

  const members = view?.members ?? [];
  const channel = TEAM_CHANNELS.find((c) => c.id === room);
  const dealJob = jobOfRoom(room);
  const dealOpen = dealJob ? (view?.dealChats?.find((d) => d.jobId === dealJob) ?? null) : null;
  const elsewhere = solOpen || dealJob !== null;
  /** Opens a deal's chat here (# and its name, or Open its chat on a deal card): it joins the Deals list. */
  const openDeal = async (jobId: string) => {
    const r = await openDealChat(jobId);
    if (!r.ok) return setError(r.message);
    setRoom(dealRoom(jobId));
  };
  const other = dmWith(room, me);

  const addFiles = (list: File[]) => {
    if (!list.length) return;
    const next = [...files, ...list];
    const problem = teamFilesProblem(next);
    if (problem) return setError(problem);
    setError("");
    setFiles(next);
  };

  // What the box offers: deals after #, people after @ (in a channel).
  type Offer = { key: string; label: string; line?: string; job?: JobLine; person?: string };
  const offers: Offer[] = [];
  if (dealAt && dealAt.query.trim().length >= 1 && jobs) {
    for (const j of jobs
      .filter((x) => dealAt.query.trim().length < 2 || matches({ words: [x.customerName, x.title, x.address] }, dealAt.query))
      .slice(0, 6))
      offers.push({
        key: j.id,
        label: `${j.customerName} · ${j.title}`,
        line: [STAGE_LABELS[j.stage], j.address].filter(Boolean).join(" · "),
        job: j,
      });
  } else if (tagAt && tagsIn(room)) {
    const q = tagAt.query.toLowerCase();
    const people = [SOL_BY, ...members.filter((m) => m !== me.toLowerCase())].filter(
      (m) => (m === SOL_BY ? "sol" : handleOf(m)).startsWith(q) || nameOf(m).toLowerCase().includes(q),
    );
    for (const m of people.slice(0, 6))
      offers.push({ key: m, label: nameOf(m), line: m === SOL_BY ? "Asks Sol, who answers here" : m, person: m });
  }
  const pickOffer = (o: Offer) => {
    if (o.job && dealAt) {
      const j = o.job;
      if (deals.length < TEAM_DEALS_MAX && !deals.some((d) => d.id === j.id))
        setDeals([...deals, { id: j.id, name: `${j.customerName} · ${j.title}`, address: j.address, stage: STAGE_LABELS[j.stage] }]);
      setText((text.slice(0, dealAt.start) + text.slice(dealAt.start + 1 + dealAt.query.length)).replace(/\s{2,}/g, " "));
      setDealAt(null);
      box.current?.focus();
    } else if (o.person && tagAt) {
      const put = `@${o.person === SOL_BY ? "Sol" : handleOf(o.person)} `;
      setText((text.slice(0, tagAt.start) + put + text.slice(tagAt.start + 1 + tagAt.query.length)).slice(0, TEAM_LINE_MAX));
      setTagAt(null);
      const at = tagAt.start + put.length;
      requestAnimationFrame(() => {
        box.current?.focus();
        box.current?.setSelectionRange(at, at);
      });
    }
  };
  const chosen = Math.min(hi, Math.max(0, offers.length - 1));

  const send = async () => {
    const words = text.trim();
    if ((!words && !files.length && !deals.length) || sending) return;
    setSending(true);
    const answering = replying?.room === room ? replying.reply.id : null;
    const r = await sayInTeam(
      room,
      words,
      deals.map((d) => d.id),
      files,
      answering,
    );
    setSending(false);
    if (!r.ok) return setError(r.message);
    setText("");
    setReplying(null);
    setFiles([]);
    setDeals([]);
    setEmojis(false);
    if (asksSol(room, words)) setSolSince(Date.now());
    setView((v) => (v ? { ...v, lines: [...v.lines, r.line] } : v));
  };

  /** Answer this message: it waits over the box, and the box is ready to type in. */
  const replyTo = (l: TeamLine) => {
    setReacting(null);
    setEditing(null);
    setReplying({ room, reply: { id: l.id, by: l.by, text: replyQuote(l) } });
    requestAnimationFrame(() => box.current?.focus());
  };
  /** Back to the message a reply answers: scrolled into the middle and lit for a moment. */
  const showLine = (id: string) => {
    const el = document.getElementById(`tl-${id}`);
    if (!el) return setError("That message is further back than this chat shows.");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(id);
    window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 1600);
  };
  const answering = replying?.room === room ? replying.reply : null;

  const react = async (id: string, emoji: string) => {
    setReacting(null);
    const r = await reactToTeamLine(id, emoji);
    if (!r.ok) setError(r.message);
    void load();
  };
  const saveEdit = async () => {
    if (!editing) return;
    const r = await editTeamLine(editing.id, editing.text);
    if (!r.ok) return setError(r.message);
    setEditing(null);
    void load();
  };
  const remove = async (l: TeamLine) => {
    if (!window.confirm("Delete this message for everyone?")) return;
    const r = await deleteTeamLine(l.id);
    if (!r.ok) return setError(r.message);
    void load();
  };

  const sides = <SideToggle side={side} onSide={setSide} customers={customers} />;
  if (side === "customers")
    return (
      <div className="flex h-full min-h-0 flex-col bg-surface text-ink">
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
          {sides}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <CustomerConversations deal={(id) => `/design/deals/${encodeURIComponent(id)}`} onOpen={onClose} />
      </div>
    );
  return (
    <div className="flex h-full min-h-0 bg-surface text-ink">
      <nav aria-label="Conversations" className="flex w-44 shrink-0 flex-col border-r border-line bg-canvas/60 sm:w-48">
        <div className="px-2 pt-2">{sides}</div>
        <DealChatsList
          deals={view?.dealChats ?? []}
          room={room}
          onPick={(id) => setRoom(dealRoom(id))}
          onStart={(id) => void openDeal(id)}
          jobs={jobs}
          needJobs={() => jobs === null && void listJobs().then((r) => setJobs(r.ok ? r.jobs : []))}
        />
        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Channels</p>
        {(view?.channels ?? TEAM_CHANNELS.map((c) => ({ room: c.id as string, label: c.label, unread: 0 }))).map((c) => (
          <RoomButton key={c.room} on={room === c.room} unread={c.unread} onClick={() => setRoom(c.room)}>
            <Hash className="size-3.5 shrink-0 text-muted" aria-hidden />
            <span className="truncate">{c.label}</span>
          </RoomButton>
        ))}
        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Direct messages</p>
        <div className="staff-scroll min-h-0 flex-1 overflow-y-auto pb-2">
          {hasSol && (
            <RoomButton on={solOpen} unread={0} onClick={() => setRoom(SOL_ROOM)} title="Your own conversation with Sol">
              <Round email={SOL_BY} small />
              <span className="truncate">Sol</span>
            </RoomButton>
          )}
          {view && view.people.length === 0 && (
            <p className="px-3 pt-1 text-xs text-muted">No one else is in the business yet. Add people under Your account.</p>
          )}
          {view?.people.map((p) => (
            <RoomButton key={p.room} on={room === p.room} unread={p.unread} onClick={() => setRoom(p.room)} title={p.email}>
              <Round email={p.email} small />
              <span className="truncate">{p.label}</span>
            </RoomButton>
          ))}
        </div>
      </nav>

      {solOpen && (
        <div className="flex min-w-0 flex-1 flex-col">
          <SolChat side onClose={onClose} />
        </div>
      )}
      {dealJob && (
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                <SquareKanban className="size-3.5 text-sun-line" aria-hidden />
                {dealOpen ? `${dealOpen.customer} · ${dealOpen.title}` : "Deal chat"}
              </p>
              <p className="truncate text-[11px] text-muted">Everyone who may see the deal · never seen by customers</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={`/design/deals/${dealJob}?tab=team`}
                className="rounded-full px-2.5 py-1 text-[12px] font-medium text-ink-2 ring-1 ring-line hover:text-ink"
              >
                Open deal
              </Link>
              {onClose && (
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </header>
          <div className="min-h-0 flex-1 px-4 py-3">
            <DealTeamChat key={dealJob} jobId={dealJob} fill />
          </div>
        </div>
      )}
      <div
        className={clsx("relative flex min-w-0 flex-1 flex-col", dropping && "ring-2 ring-inset ring-sun-line", elsewhere && "hidden")}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDropping(true);
          }
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropping(false);
          addFiles([...e.dataTransfer.files]);
        }}
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-sm font-semibold">
              {channel && <Hash className="size-3.5 text-muted" aria-hidden />}
              {roomLabel(room, me)}
            </p>
            <p className="truncate text-[11px] text-muted">
              {channel ? "Everyone in the business" : "Just the two of you"} · never seen by customers
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {channel && hasSol && missed?.room === room && missed.n >= CATCH_UP_MIN && caught?.room !== room && (
              <button
                type="button"
                disabled={catching}
                onClick={async () => {
                  setCatching(true);
                  const r = await catchUpRoom(room, missed.n);
                  setCatching(false);
                  if (!r.ok) return setError(r.message);
                  setCaught({ room, summary: r.summary });
                }}
                title={`Sol sums up the ${missed.n} messages you missed here`}
                className="flex h-7 items-center gap-1.5 rounded-full bg-primary px-2.5 text-[11px] font-medium text-white hover:brightness-110 disabled:bg-surface-2 disabled:text-muted"
              >
                <SolBadge className="size-3.5" />
                {catching ? "Catching up…" : `Catch me up · ${missed.n}`}
              </button>
            )}
            {channel && view?.solJoinsIn !== undefined && (
              <SolJoinsSwitch
                on={view.solJoinsIn}
                may={!!view.maySwitchSol}
                onChange={async (on) => {
                  setView((v) => (v ? { ...v, solJoinsIn: on } : v));
                  const r = await setSolJoinsIn(on);
                  if (!r.ok) {
                    setView((v) => (v ? { ...v, solJoinsIn: !on } : v));
                    setError(r.message);
                  }
                }}
              />
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close the team chat"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </header>

        <div className="staff-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-3 pt-5">
          {caught?.room === room && <CatchUpCard summary={caught.summary} onClose={() => setCaught(null)} />}
          {lines === null && !error && <p className="text-sm text-muted">Opening…</p>}
          {lines?.length === 0 && (
            <p className="text-sm text-muted">
              {channel
                ? `Nothing said in ${channel.label} yet. Type @ to tag someone, @Sol to ask Sol, or # to bring in a deal.`
                : `Nothing said yet. Say hello to ${nameOf(other ?? "").split(" ")[0] || "them"}.`}
            </p>
          )}
          {lines?.map((l, i) => {
            const mine = l.by === me.toLowerCase();
            const head = lines[i - 1]?.by !== l.by || Date.parse(l.at) - Date.parse(lines[i - 1]?.at ?? "") > 15 * 60_000;
            const isEditing = editing?.id === l.id;
            return (
              <div
                key={l.id}
                id={`tl-${l.id}`}
                className={clsx(
                  "group/line relative flex scroll-my-6 flex-col rounded-2xl transition-colors duration-700",
                  mine ? "items-end" : "items-start",
                  flash === l.id && "bg-sun/70",
                )}
              >
                {head && (
                  <p className={clsx("mb-0.5 mt-2 flex items-center gap-1.5 px-1 text-[11px] text-muted", mine && "flex-row-reverse")}>
                    {!mine && <Round email={l.by} small />}
                    <span className="font-medium text-ink-2">{mine ? "You" : nameOf(l.by)}</span> · {when(l.at)}
                  </p>
                )}
                {l.replyTo && <Quoted reply={l.replyTo} mine={mine} me={me} onShow={showLine} />}
                {l.files?.length ? <Files files={l.files} mine={mine} /> : null}
                {isEditing ? (
                  <div className="flex w-[85%] flex-col items-end gap-1">
                    <textarea
                      autoFocus
                      value={editing.text}
                      onChange={(e) => setEditing({ id: l.id, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void saveEdit();
                        }
                        if (e.key === "Escape") setEditing(null);
                      }}
                      aria-label="Change your message"
                      className="max-h-40 min-h-9 w-full resize-none rounded-2xl border border-ink bg-surface px-3 py-1.5 text-sm outline-none [field-sizing:content]"
                    />
                    <p className="text-[11px] text-muted">
                      Enter to save · Esc to cancel ·{" "}
                      <button type="button" onClick={() => void saveEdit()} className="font-semibold text-ink underline">
                        Save
                      </button>
                    </p>
                  </div>
                ) : (
                  l.text && (
                    <p
                      title={when(l.at)}
                      className={clsx(
                        "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm",
                        mine ? "bg-primary text-white" : l.by === SOL_BY ? "bg-sun text-ink" : "bg-canvas text-ink",
                      )}
                    >
                      {l.by === SOL_BY && <SolBadge className="mr-1 inline size-3.5 -translate-y-px" />}
                      <Tagged text={l.text} members={members} dark={mine} />
                    </p>
                  )
                )}
                {l.edited && !isEditing && <p className="px-1 text-[10px] text-muted">edited</p>}
                {l.action && (
                  <ActionCard
                    lineId={l.id}
                    action={l.action}
                    me={me}
                    seesCosts={view?.seesCosts !== false}
                    onDone={() => void load()}
                    onError={setError}
                  />
                )}
                {(l.diagrams?.length || l.charts?.length) && (
                  <div className="mt-1 w-full max-w-[85%] space-y-2">
                    {l.diagrams?.map((d, k) => (
                      <SolDiagramView key={`d${k}`} diagram={d} />
                    ))}
                    {l.charts?.map((c, k) => (
                      <SolChartView key={`c${k}`} chart={c} />
                    ))}
                  </div>
                )}
                {l.deals?.length ? <Deals deals={l.deals} onOpenChat={(id) => void openDeal(id)} /> : null}
                {l.reactions && (
                  <div className={clsx("mt-1 flex max-w-[85%] flex-wrap gap-1", mine && "justify-end")}>
                    {Object.entries(l.reactions).map(([emoji, who]) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => void react(l.id, emoji)}
                        title={`${who.map(nameOf).join(", ")} reacted with ${emoji}`}
                        aria-pressed={who.includes(me.toLowerCase())}
                        className={clsx(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1",
                          who.includes(me.toLowerCase()) ? "bg-sun ring-sun-line" : "bg-surface ring-line hover:ring-ink",
                        )}
                      >
                        <span>{emoji}</span>
                        <span className="font-semibold text-ink-2">{who.length}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!isEditing && (
                  <div
                    className={clsx(
                      "absolute -top-3 z-10 flex items-center gap-0.5 rounded-full bg-surface p-0.5 shadow-md ring-1 ring-line transition-opacity",
                      mine ? "right-0" : "left-0",
                      reacting === l.id
                        ? "opacity-100"
                        : "pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100 group-hover/line:pointer-events-auto group-hover/line:opacity-100",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => replyTo(l)}
                      aria-label="Reply"
                      title="Reply"
                      className="flex size-7 items-center justify-center rounded-full text-ink-2 hover:bg-canvas hover:text-ink"
                    >
                      <Reply className="size-3.5" aria-hidden />
                    </button>
                    <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />
                    {TEAM_QUICK_REACTIONS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => void react(l.id, e)}
                        aria-label={`React with ${e}`}
                        className="flex size-7 items-center justify-center rounded-full text-sm hover:bg-canvas"
                      >
                        {e}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setReacting(reacting === l.id ? null : l.id)}
                      aria-label="More reactions"
                      title="More reactions"
                      className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
                    >
                      <SmilePlus className="size-3.5" aria-hidden />
                    </button>
                    {mine && l.text && (
                      <button
                        type="button"
                        onClick={() => {
                          setReacting(null);
                          setEditing({ id: l.id, text: l.text });
                        }}
                        aria-label="Edit"
                        title="Edit"
                        className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </button>
                    )}
                    {mine && (
                      <button
                        type="button"
                        onClick={() => void remove(l)}
                        aria-label="Delete"
                        title="Delete"
                        className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-danger"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                )}
                {reacting === l.id && (
                  <div className={clsx("absolute top-6 z-20", mine ? "right-0" : "left-0")}>
                    <EmojiGrid onPick={(e) => void react(l.id, e)} onClose={() => setReacting(null)} />
                  </div>
                )}
              </div>
            );
          })}
          <div ref={end} />
        </div>

        {error && <p className="px-4 pb-1 text-xs text-danger">{error}</p>}
        {solSince !== null && (
          <div className="px-4 pb-1">
            <SolThinking say="Sol is answering…" />
          </div>
        )}
        {offers.length > 0 && (
          <ul
            role="listbox"
            aria-label={dealAt ? "Deals" : "People to tag"}
            className="mx-3 mb-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          >
            {offers.map((o, i) => (
              <li key={o.key} role="option" aria-selected={i === chosen}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickOffer(o)}
                  onMouseEnter={() => setHi(i)}
                  className={clsx("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm", i === chosen && "bg-canvas")}
                >
                  {dealAt ? (
                    <SquareKanban className="size-3.5 shrink-0 text-muted" aria-hidden />
                  ) : o.key === SOL_BY ? (
                    <SolBadge className="size-3.5 shrink-0" />
                  ) : (
                    <AtSign className="size-3.5 shrink-0 text-muted" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.label}</span>
                    {o.line && <span className="block truncate text-xs text-muted">{o.line}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="border-t border-line p-3"
        >
          {answering && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border-l-[3px] border-sun-line bg-canvas py-1.5 pl-2.5 pr-1">
              <Reply className="mt-0.5 size-3.5 shrink-0 text-sun-line" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-ink-2">
                  Replying to {answering.by === me.toLowerCase() ? "yourself" : nameOf(answering.by)}
                </p>
                <p className="truncate text-xs text-muted">{answering.text}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplying(null)}
                aria-label="Don't reply to this message"
                title="Don't reply (Esc)"
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          )}
          {(files.length > 0 || deals.length > 0) && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {deals.map((d) => (
                <span key={d.id} className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full bg-canvas py-1 pl-2.5 pr-1 text-xs">
                  <SquareKanban className="size-3.5 shrink-0 text-sun-line" aria-hidden />
                  <span className="truncate">{d.name}</span>
                  <button
                    type="button"
                    onClick={() => setDeals(deals.filter((x) => x.id !== d.id))}
                    aria-label={`Take off ${d.name}`}
                    className="rounded-full p-0.5 text-muted hover:text-ink"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ))}
              {files.map((f, i) => (
                <span key={i} className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full bg-canvas py-1 pl-2.5 pr-1 text-xs">
                  <FileText className="size-3.5 shrink-0 text-sun-line" aria-hidden />
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    aria-label={`Take off ${f.name}`}
                    className="rounded-full p-0.5 text-muted hover:text-ink"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative flex items-end gap-1.5 rounded-2xl bg-canvas px-1.5 ring-1 ring-line focus-within:ring-sun-line">
            <input
              ref={picker}
              type="file"
              multiple
              accept={TEAM_FILE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                addFiles([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => picker.current?.click()}
              aria-label="Send a file or picture"
              title="Send a file or picture (or paste a screenshot, or drop files here)"
              className="mb-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface hover:text-ink"
            >
              <Paperclip className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setEmojis(!emojis)}
              aria-label="Add an emoji"
              aria-expanded={emojis}
              className="mb-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface hover:text-ink"
            >
              <SmilePlus className="size-4" aria-hidden />
            </button>
            {emojis && (
              <div className="absolute bottom-full left-0 z-20 mb-2">
                <EmojiGrid
                  onPick={(e) => {
                    setText((t) => (t + e).slice(0, TEAM_LINE_MAX));
                    box.current?.focus();
                  }}
                  onClose={() => setEmojis(false)}
                />
              </div>
            )}
            <textarea
              ref={box}
              value={heard ? withSpoken(text, heard) : text}
              rows={1}
              maxLength={TEAM_LINE_MAX}
              onChange={(e) => {
                const caret = e.target.selectionStart ?? e.target.value.length;
                setText(e.target.value);
                setDealAt(typingDeal(e.target.value, caret));
                setTagAt(tagsIn(room) ? typingTag(e.target.value, caret) : null);
                setHi(0);
              }}
              onPaste={(e) => {
                const pasted = [...e.clipboardData.files];
                if (pasted.length) {
                  e.preventDefault();
                  addFiles(pasted);
                }
              }}
              onKeyDown={(e) => {
                if (offers.length) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setHi((h) => (h + (e.key === "ArrowDown" ? 1 : offers.length - 1)) % offers.length);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    if (offers[chosen]) pickOffer(offers[chosen]);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setDealAt(null);
                    setTagAt(null);
                    return;
                  }
                }
                if (e.key === "Escape" && answering) {
                  e.stopPropagation();
                  setReplying(null);
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={channel ? `Message ${channel.label} (@ to tag, # for a deal)` : `Message ${nameOf(other ?? "")}`}
              aria-label="Your message"
              className="max-h-40 min-h-[2.75rem] w-full min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-left text-sm outline-none [field-sizing:content] placeholder:text-muted"
            />
            <div className="mb-1.5">
              <DictateButton
                label="Speak your message"
                onHearing={setHeard}
                onWords={(w) => setText((t) => withSpoken(t, w).slice(0, TEAM_LINE_MAX))}
              />
            </div>
            <button
              type="submit"
              disabled={sending || (!text.trim() && !files.length && !deals.length)}
              aria-label="Send"
              className="mb-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sun-line text-white transition hover:brightness-105 disabled:bg-surface-2 disabled:text-muted"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * The message a reply answers, small and quiet above it, as iMessage shows it: who wrote it and a line of it, with a
 * fine bar on the side the reply is on. Pressing it goes back to that message. A deleted one says so.
 */
function Quoted({ reply, mine, me, onShow }: { reply: TeamReply; mine: boolean; me: string; onShow: (id: string) => void }) {
  const who = reply.by === SOL_BY ? "Sol" : reply.by === me.toLowerCase() ? "You" : nameOf(reply.by);
  if (reply.gone)
    return (
      <p className={clsx("mb-0.5 max-w-[75%] rounded-xl px-2.5 py-1 text-[11px] italic text-muted", mine ? "mr-2" : "ml-2")}>
        Replying to a deleted message
      </p>
    );
  return (
    <button
      type="button"
      onClick={() => onShow(reply.id)}
      title="Go to this message"
      className={clsx(
        "mb-0.5 flex max-w-[75%] items-start gap-1.5 rounded-xl bg-canvas/80 px-2.5 py-1 text-left text-[12px] text-muted ring-1 ring-line hover:text-ink-2",
        mine ? "mr-2 flex-row-reverse border-r-2 border-line-strong text-right" : "ml-2 border-l-2 border-line-strong",
      )}
    >
      <Reply className={clsx("mt-0.5 size-3 shrink-0", mine && "-scale-x-100")} aria-hidden />
      <span className="min-w-0">
        <span className="font-semibold text-ink-2">{who}</span>
        <span className="line-clamp-2"> {reply.text}</span>
      </span>
    </button>
  );
}

/**
 * Whether Sol steps in on the channels unasked: on, he answers a question nobody has after a moment; off, only when
 * tagged. A business setting, switched here by someone who changes the settings; everyone else sees which it is.
 */
function SolJoinsSwitch({ on, may, onChange }: { on: boolean; may: boolean; onChange: (on: boolean) => void }) {
  const words = on ? "Sol joins in" : "Sol when tagged";
  const why = on
    ? "Sol answers a question here when nobody has after a moment, if it's his to answer."
    : "Sol answers here only when someone tags @Sol.";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={!may}
      onClick={() => onChange(!on)}
      title={may ? `${why} Press to switch.` : `${why} Someone who changes the settings can switch it.`}
      className={clsx(
        "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium ring-1 transition-colors",
        on ? "bg-sun/60 text-ink ring-sun-line/40" : "bg-canvas text-muted ring-line",
        may ? "hover:ring-line-strong" : "cursor-default",
      )}
    >
      <SolBadge className="size-3.5" />
      {words}
      <span aria-hidden className={clsx("relative ml-0.5 h-3.5 w-6 rounded-full transition-colors", on ? "bg-sun-line" : "bg-line-strong")}>
        <span className={clsx("absolute top-0.5 size-2.5 rounded-full bg-surface transition-all", on ? "left-3" : "left-0.5")} />
      </span>
    </button>
  );
}

/**
 * What Sol offers to do from what was said (sol-chat-work.ts): the work as a question, Yes and No. Pressed, it is done
 * as the person who pressed it (the server checks they may); once answered it says what came of it, for everyone.
 */
function ActionCard(props: {
  lineId: string;
  action: ChatAction;
  me: string;
  seesCosts: boolean;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const { action } = props;
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const press = async (how: "do" | "dismiss") => {
    setBusy(true);
    const r = await pressSolAction(props.lineId, how);
    setBusy(false);
    if (!r.ok) return props.onError(r.message);
    setSaid(how === "do" ? r.words || actionDoneWords(action) : "Left as it was.");
    props.onDone();
  };
  const settled = action.done ?? action.dismissed;
  const notYours = actionNotYours(action, props.me, { costs: props.seesCosts });
  return (
    <div className="mt-1 w-full max-w-[85%] rounded-2xl bg-surface p-3 text-sm ring-1 ring-sun-line/40">
      <p className="font-medium text-ink">{actionQuestion(action)}</p>
      {settled ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          {action.done ? <Check className="size-3.5 text-sun-line" aria-hidden /> : <X className="size-3.5" aria-hidden />}
          {action.done ? actionDoneWords(action) : "Left as it was"} · {nameOf(settled.by)}
        </p>
      ) : said ? (
        <p className="mt-1 text-xs text-muted">{said}</p>
      ) : notYours ? (
        <p className="mt-1 text-xs text-muted">{notYours}</p>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void press("do")}
            className="min-w-14 rounded-full bg-sun-line px-3 py-1 text-xs font-semibold text-white hover:brightness-105 disabled:bg-surface-2 disabled:text-muted"
          >
            Yes
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void press("dismiss")}
            className="min-w-14 rounded-full px-3 py-1 text-xs font-medium text-ink-2 ring-1 ring-line hover:bg-canvas"
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}

/** Sol's catch-up on a channel, for the reader only: what changed, what was decided, and what waits on them. */
function CatchUpCard({ summary, onClose }: { summary: CatchUp; onClose: () => void }) {
  const parts: [string, string][] = [
    ["What changed", summary.changed],
    ["Decided", summary.decided],
    ["Waiting on you", summary.waiting],
  ];
  return (
    <div className="sticky top-0 z-10 rounded-2xl bg-primary p-4 text-sm text-white shadow-lg">
      <div className="flex items-start gap-2">
        <SolBadge className="mt-0.5 size-4 shrink-0" />
        <p className="flex-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
          Sol caught you up · {summary.lines} messages
        </p>
        <button type="button" onClick={onClose} aria-label="Close the catch-up" className="text-white/70 hover:text-white">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <dl className="mt-2 space-y-1.5">
        {parts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-semibold text-sun-line">{k}</dt>
              <dd className="text-white/90">{v}</dd>
            </div>
          ))}
      </dl>
      <p className="mt-2 text-[11px] text-white/60">Only you see this. Scroll up for the messages themselves.</p>
    </div>
  );
}

function Round({ email, small = false }: { email: string; small?: boolean }) {
  return (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        small ? "size-5 text-[9px]" : "size-7 text-[11px]",
        email === SOL_BY ? "bg-primary" : "bg-primary text-white",
      )}
      aria-hidden
    >
      {email === SOL_BY ? <SolBadge className={small ? "size-3.5" : "size-[18px]"} /> : initialsOf(email)}
    </span>
  );
}

function RoomButton(props: { on: boolean; unread: number; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.title}
      aria-current={props.on ? "true" : undefined}
      className={clsx(
        "mx-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
        props.on
          ? "bg-surface font-medium text-ink shadow-[0_1px_3px_rgba(11,11,12,0.1)]"
          : props.unread
            ? "font-semibold text-ink hover:bg-surface"
            : "text-ink-2 hover:bg-surface",
      )}
    >
      {props.children}
      {props.unread > 0 && !props.on && (
        <span className="ml-auto rounded-full bg-sun-line px-1.5 text-[10px] font-semibold text-white">{props.unread}</span>
      )}
    </button>
  );
}

/** A line's words with each tag (@handle of a member, @Sol) picked out. */
function Tagged({ text, members, dark }: { text: string; members: readonly string[]; dark: boolean }) {
  const handles = new Set(["sol", ...members.map(handleOf)]);
  const parts = text.split(/(@[\w.-]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("@") && handles.has(p.slice(1).toLowerCase().replace(/[.]+$/, "")) ? (
          <span key={i} className={clsx("rounded px-0.5 font-semibold", dark ? "bg-white/20" : "bg-sun text-sun-ink")}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function EmojiGrid({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div role="dialog" aria-label="Emojis" className="grid w-64 grid-cols-8 gap-0.5 rounded-xl bg-surface p-1.5 shadow-lg ring-1 ring-line">
      {TEAM_EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          aria-label={e}
          className="flex size-7 items-center justify-center rounded-md text-base hover:bg-canvas"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function Deals({ deals, onOpenChat }: { deals: TeamDeal[]; onOpenChat: (jobId: string) => void }) {
  return (
    <div className="mt-1 flex max-w-[85%] flex-col gap-1">
      {deals.map((d) => (
        <div
          key={d.id}
          className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-left text-sm ring-1 ring-line hover:ring-sun-line"
        >
          <SquareKanban className="size-4 shrink-0 text-sun-line" aria-hidden />
          <Link href={`/design/deals/${d.id}`} className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink">{d.name}</span>
            <span className="block truncate text-xs text-muted">{[d.stage, d.address].filter(Boolean).join(" · ")}</span>
          </Link>
          <button
            type="button"
            onClick={() => onOpenChat(d.id)}
            className="shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-medium text-ink-2 ring-1 ring-line hover:text-ink"
          >
            Open its chat
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * The Deals section of the team chat window (deal-team.ts): the deal chats this person follows, unread first, each
 * with the customer, the deal, the latest line and its count; and "# a deal" to open any deal's chat by its name.
 */
function DealChatsList(props: {
  deals: DealChatLine[];
  room: string;
  onPick: (jobId: string) => void;
  onStart: (jobId: string) => void;
  jobs: JobLine[] | null;
  needJobs: () => void;
}) {
  const [finding, setFinding] = useState(false);
  const [q, setQ] = useState("#");
  const words = q.replace(/^#/, "").trim();
  const found =
    finding && words && props.jobs
      ? props.jobs.filter((j) => matches({ words: [j.customerName, j.title, j.address] }, words)).slice(0, 6)
      : [];
  return (
    <div className="border-b border-line pb-2">
      <p className="flex items-center justify-between px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        Deals
        <button
          type="button"
          title="Open a deal's chat: type # and its name"
          aria-label="Open a deal's chat"
          onClick={() => {
            setFinding((f) => !f);
            setQ("#");
            props.needJobs();
          }}
          className="rounded-full p-0.5 normal-case tracking-normal text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Hash className="size-3.5" />
        </button>
      </p>
      {finding && (
        <div className="px-2 pb-1">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setFinding(false);
              if (e.key === "Enter" && found[0]) {
                props.onStart(found[0].id);
                setFinding(false);
              }
            }}
            aria-label="A deal's customer or name"
            placeholder="# a deal"
            className="w-full rounded-lg bg-surface px-2 py-1 text-[12.5px] text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-sun-line"
          />
          {words && props.jobs === null && <p className="px-1 pt-1 text-[11px] text-muted">Looking…</p>}
          {found.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => {
                props.onStart(j.id);
                setFinding(false);
              }}
              className="mt-0.5 block w-full rounded-lg px-2 py-1 text-left hover:bg-surface-2"
            >
              <span className="block truncate text-[12.5px] font-medium text-ink">{j.customerName}</span>
              <span className="block truncate text-[11px] text-muted">{j.title}</span>
            </button>
          ))}
          {words && props.jobs && !found.length && <p className="px-1 pt-1 text-[11px] text-muted">No deal by that name.</p>}
        </div>
      )}
      <div className="staff-scroll max-h-56 overflow-y-auto">
        {props.deals.length === 0 && !finding && (
          <p className="px-3 pt-1 text-[11.5px] leading-snug text-muted">
            Deal chats you take part in show here. Press # to open one by its name.
          </p>
        )}
        {props.deals.map((d) => (
          <RoomButton
            key={d.jobId}
            on={props.room === dealRoom(d.jobId)}
            unread={d.unread}
            onClick={() => props.onPick(d.jobId)}
            title={d.last ? `${writerName(d.last.by)}: ${d.last.text}` : undefined}
          >
            <span className="min-w-0">
              <span className="block truncate">{d.customer}</span>
              <span className="block truncate text-[11px] font-normal text-muted">
                {d.last ? `${writerName(d.last.by)}: ${d.last.text}` : d.title}
              </span>
            </span>
          </RoomButton>
        ))}
      </div>
    </div>
  );
}

function Files({ files, mine }: { files: TeamFile[]; mine: boolean }) {
  return (
    <div className={clsx("mb-1 flex max-w-[85%] flex-wrap gap-1.5", mine && "justify-end")}>
      {files.map((f) => {
        const href = `/api/design/team/files/${f.id}`;
        return isTeamPicture(f.type) ? (
          <a key={f.id} href={href} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element -- a member's own upload, served privately */}
            <img src={href} alt={f.name} className="block max-h-48 max-w-[16rem] object-cover" />
          </a>
        ) : (
          <a
            key={f.id}
            href={href}
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-xs ring-1 ring-line hover:ring-sun-line"
          >
            <FileText className="size-4 text-sun-line" aria-hidden />
            <span className="max-w-[12rem] truncate font-medium">{f.name}</span>
            <span className="text-muted">{Math.max(1, Math.round(f.size / 1024))} KB</span>
          </a>
        );
      })}
    </div>
  );
}

/** How many team lines this member hasn't seen, asked every ten seconds and kept in step with the open panel. */
export function useTeamUnread(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    const read = () =>
      void teamUnreadCount().then((r) => {
        if (live && r.ok) setN(r.unread);
      });
    read();
    const t = window.setInterval(() => document.visibilityState === "visible" && read(), TEAM_POLL_MS * 3);
    const changed = (e: Event) => setN(Number((e as CustomEvent<number>).detail) || 0);
    window.addEventListener(TEAM_CHANGED, changed);
    window.addEventListener(DEAL_TEAM_CHANGED, read);
    return () => {
      live = false;
      window.clearInterval(t);
      window.removeEventListener(TEAM_CHANGED, changed);
      window.removeEventListener(DEAL_TEAM_CHANGED, read);
    };
  }, []);
  return n;
}

/**
 * The team chat's place on the rail (as Primero's): a round with the unread count that opens the chat beside the
 * rail, over the page. `?team=<room>` (a tag's email link) opens it on that room; so does `TEAM_OPEN`.
 */
export function TeamChatButton({ me, customers = 0 }: { me: string; customers?: number }) {
  // The team's unread, and the customers' lines and mentions that the bell used to carry.
  const unread = useTeamUnread() + customers;
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  useEffect(() => {
    const openOn = (e: Event) => {
      setStart((e as CustomEvent<string | undefined>).detail ?? null);
      setOpen(true);
    };
    window.addEventListener(TEAM_OPEN, openOn);
    const url = new URL(window.location.href);
    const room = url.searchParams.get("team");
    if (room) {
      url.searchParams.delete("team");
      window.history.replaceState(window.history.state, "", url.toString());
      queueMicrotask(() => {
        setStart(room);
        setOpen(true);
      });
    }
    return () => window.removeEventListener(TEAM_OPEN, openOn);
  }, []);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Team chat"
        aria-label={unread ? `Team chat: ${unread} unread` : "Team chat"}
        aria-pressed={open}
        className={clsx(
          "relative flex size-10 items-center justify-center rounded-full transition-colors",
          open ? "bg-ink text-sun-line" : "text-ink-2 hover:bg-canvas hover:text-ink",
        )}
      >
        <MessagesSquare className="size-[18px]" aria-hidden />
        {unread > 0 && !open && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-sun-line px-1 text-[10px] font-semibold text-white ring-2 ring-surface">
            {unread}
          </span>
        )}
      </button>
      {/* On the page itself, not inside the rail: the rail is moved by a transform, which would carry it along. */}
      {open &&
        createPortal(
          <div className="theme-studio team-pop fixed right-20 top-1/2 z-[52] h-[min(48rem,90dvh)] w-[min(50rem,calc(100vw-7rem))] -translate-y-1/2 overflow-hidden rounded-3xl bg-surface shadow-[0_12px_40px_rgba(20,22,26,0.16)] ring-1 ring-line">
            <TeamChatPanel key={start ?? "last"} me={me} start={start} customers={customers} onClose={() => setOpen(false)} />
          </div>,
          document.body,
        )}
    </>
  );
}

/** Team or Customers, at the top of team chat. */
function SideToggle({
  side,
  onSide,
  customers,
}: {
  side: "team" | "customers";
  onSide: (side: "team" | "customers") => void;
  customers: number;
}) {
  return (
    <div role="tablist" aria-label="Team or customers" className="flex rounded-full bg-canvas p-0.5 ring-1 ring-line">
      {(["team", "customers"] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={side === s}
          onClick={() => onSide(s)}
          className={clsx(
            "relative flex-1 rounded-full px-3 py-1 text-xs font-medium",
            side === s ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:text-ink",
          )}
        >
          {s === "team" ? "Team" : "Customers"}
          {s === "customers" && customers > 0 && (
            <span className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-sun-line px-1 text-[10px] font-semibold text-white">
              {customers}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** The team chat on a page of its own (a phone reaches it from More). */
export function TeamChatPage() {
  const [account] = useDesignAccount();
  if (!account?.signedIn || !("email" in account) || !account.email) return null;
  return (
    <div className="h-[calc(100dvh-12rem)] min-h-[28rem] overflow-hidden rounded-2xl ring-1 ring-line">
      <TeamChatPanel me={account.email} />
    </div>
  );
}
