"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { AtSign, FileText, Hash, MessagesSquare, Paperclip, Pencil, Reply, SmilePlus, SquareKanban, Trash2, X } from "lucide-react";
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
  loadTeamRoom,
  reactToTeamLine,
  sayInTeam,
  teamSeen,
  type TeamRoomView,
} from "@/lib/services/team-chat";
import { useDesignAccount } from "./design-account";
import { SolIcon } from "./sol-icon";
import { SolChartView, SolDiagramView } from "./sol-visuals";
import { SolThinking } from "./sol-thinking";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { weekday: "short", hour: "numeric", minute: "2-digit" }).replace(",", "");

/** How long the chat waits for Sol's answer in a channel before it stops showing that he is answering. */
const SOL_WAIT_MS = 120_000;

/**
 * The team chat (1 Nov 2026, as Primero's): channels and the people down the left, the room on the right. Lines run
 * oldest first, your own on the right; hover one to reply to it (as iMessage: the reply carries a quote of it, which
 * jumps back to it), to react, or to change or delete your own. In a channel, @ tags a
 * member (or Sol, who answers there), # drops a deal in as a card; files and pictures go with a line (the paperclip,
 * pasting a screenshot, or dropping them on the room). It asks for new lines every ten seconds while open; whatever is
 * on screen counts as read.
 */
export function TeamChatPanel({ onClose, me, start }: { onClose?: () => void; me: string; start?: string | null }) {
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
    const r = await loadTeamRoom(room);
    if (!r.ok) {
      setError(r.message);
      if (room !== "deals") setRoomState("deals");
      return;
    }
    setError("");
    setView(r);
    // What is on screen is read: the room's own unread lines are marked seen.
    const here = [...r.channels, ...r.people].find((x) => x.room === room)?.unread ?? 0;
    if (here > 0) {
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

  const members = view?.members ?? [];
  const channel = TEAM_CHANNELS.find((c) => c.id === room);
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

  return (
    <div className="flex h-full min-h-0 bg-surface text-ink">
      <nav aria-label="Conversations" className="flex w-44 shrink-0 flex-col border-r border-line bg-canvas/60 sm:w-48">
        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Channels</p>
        {(view?.channels ?? TEAM_CHANNELS.map((c) => ({ room: c.id as string, label: c.label, unread: 0 }))).map((c) => (
          <RoomButton key={c.room} on={room === c.room} unread={c.unread} onClick={() => setRoom(c.room)}>
            <Hash className="size-3.5 shrink-0 text-muted" aria-hidden />
            <span className="truncate">{c.label}</span>
          </RoomButton>
        ))}
        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Direct messages</p>
        <div className="staff-scroll min-h-0 flex-1 overflow-y-auto pb-2">
          {view && view.people.length === 0 && (
            <p className="px-3 text-xs text-muted">No one else is in the business yet. Add people under Your account.</p>
          )}
          {view?.people.map((p) => (
            <RoomButton key={p.room} on={room === p.room} unread={p.unread} onClick={() => setRoom(p.room)} title={p.email}>
              <Round email={p.email} small />
              <span className="truncate">{p.label}</span>
            </RoomButton>
          ))}
        </div>
      </nav>

      <div
        className={clsx("relative flex min-w-0 flex-1 flex-col", dropping && "ring-2 ring-inset ring-sun-line")}
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
        </header>

        <div className="staff-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-3 pt-5">
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
                      {l.by === SOL_BY && <SolIcon className="mr-1 inline size-3.5 -translate-y-px text-sun-line" aria-hidden />}
                      <Tagged text={l.text} members={members} dark={mine} />
                    </p>
                  )
                )}
                {l.edited && !isEditing && <p className="px-1 text-[10px] text-muted">edited</p>}
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
                {l.deals?.length ? <Deals deals={l.deals} /> : null}
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
                    <SolIcon className="size-3.5 shrink-0 text-sun-line" aria-hidden />
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
              value={text}
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

function Round({ email, small = false }: { email: string; small?: boolean }) {
  return (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        small ? "size-5 text-[9px]" : "size-7 text-[11px]",
        email === SOL_BY ? "bg-sun text-sun-line" : "bg-primary text-white",
      )}
      aria-hidden
    >
      {email === SOL_BY ? <SolIcon className="size-3" /> : initialsOf(email)}
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

function Deals({ deals }: { deals: TeamDeal[] }) {
  return (
    <div className="mt-1 flex max-w-[85%] flex-col gap-1">
      {deals.map((d) => (
        <Link
          key={d.id}
          href={`/design/deals/${d.id}`}
          className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-left text-sm ring-1 ring-line hover:ring-sun-line"
        >
          <SquareKanban className="size-4 shrink-0 text-sun-line" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">{d.name}</span>
            <span className="block truncate text-xs text-muted">{[d.stage, d.address].filter(Boolean).join(" · ")}</span>
          </span>
        </Link>
      ))}
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
    return () => {
      live = false;
      window.clearInterval(t);
      window.removeEventListener(TEAM_CHANGED, changed);
    };
  }, []);
  return n;
}

/**
 * The team chat's place on the rail (as Primero's): a round with the unread count that opens the chat beside the
 * rail, over the page. `?team=<room>` (a tag's email link) opens it on that room; so does `TEAM_OPEN`.
 */
export function TeamChatButton({ me }: { me: string }) {
  const unread = useTeamUnread();
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
          <div className="theme-studio team-pop fixed right-20 top-1/2 z-30 h-[min(38rem,84dvh)] w-[min(40rem,calc(100vw-7rem))] -translate-y-1/2 overflow-hidden rounded-3xl bg-surface shadow-[0_12px_40px_rgba(20,22,26,0.16)] ring-1 ring-line">
            <TeamChatPanel key={start ?? "last"} me={me} start={start} onClose={() => setOpen(false)} />
          </div>,
          document.body,
        )}
    </>
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
