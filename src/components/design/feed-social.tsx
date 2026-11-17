"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { Bell, CheckCheck, Mail, MapPin, Plus, Settings2, UserPlus, UserCheck, X, BellOff } from "lucide-react";
import { NEWS_TOPICS, NEWS_TOPIC_LABELS, PART_LABELS, partOf, type NewsTopic } from "@/lib/domain/design/industry-news";
import { agoShort } from "@/lib/domain/design/feed-posts";
import { FOLLOW_LIMITS, noteHref, noteWords, type FeedBusiness, type FeedNote, type Follows } from "@/lib/domain/design/feed-social";
import { connectFromFeed, loadFeedBusiness, loadFeedNotes, readFeedNotes, setFollow } from "@/lib/services/feed-posts";
import { PostCard } from "./feed-posts";

/** Closes a window on Escape or a press outside it. */
function useOutside(open: boolean, close: () => void) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    const down = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && close();
    window.addEventListener("keydown", key);
    window.addEventListener("mousedown", down);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("mousedown", down);
    };
  }, [open, close]);
  return box;
}

/**
 * The feed's own bell (17 Nov 2026, feed-social.ts): likes, comments, replies, votes and Sol's answers on what this
 * member posted or said, newest first. Every kind of business has it here (the rail's bell carries them too for
 * retailers). A press takes the reader to the post or story and reads it.
 */
export function FeedActivity({ onGo }: { onGo: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<FeedNote[] | null>(null);
  const [unread, setUnread] = useState(0);
  const box = useOutside(open, () => setOpen(false));

  useEffect(() => {
    let gone = false;
    const go = () =>
      void loadFeedNotes().then((r) => {
        if (gone || !r.ok) return;
        setNotes(r.notes);
        setUnread(r.unread);
      });
    go();
    const t = window.setInterval(go, 90_000);
    return () => {
      gone = true;
      window.clearInterval(t);
    };
  }, []);

  const read = async (which: { ids?: string[]; all?: boolean }) => {
    await readFeedNotes(which);
    setNotes((all) => (all ?? []).map((n) => (which.all || which.ids?.includes(n.id) ? { ...n, read: true } : n)));
    setUnread((n) => (which.all ? 0 : Math.max(0, n - (which.ids?.length ?? 0))));
    window.dispatchEvent(new Event("renuabl:notifications"));
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={unread ? `Your activity: ${unread} new` : "Your activity"}
        className={clsx(
          "relative grid size-9 place-items-center rounded-full ring-1 transition",
          open ? "bg-primary text-primary-ink ring-primary" : "bg-surface text-ink-2 ring-line hover:text-ink",
        )}
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-sun-line px-1 text-[10.5px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold text-ink">Your activity</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void read({ all: true })}
                className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs text-ink-2 hover:bg-canvas hover:text-ink"
              >
                <CheckCheck className="size-3.5" aria-hidden /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {!notes && <p className="animate-pulse px-3 py-3 text-sm text-muted">Looking…</p>}
            {notes?.length === 0 && (
              <p className="px-3 py-4 text-[13px] text-muted">When someone likes, comments or votes on what you post, it shows here.</p>
            )}
            {notes?.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (!n.read) void read({ ids: [n.id] });
                  setOpen(false);
                  onGo(n.postId ?? n.storyId ?? "");
                }}
                className={clsx("block w-full rounded-xl px-3 py-2.5 text-left hover:bg-canvas", !n.read && "bg-sun/60")}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className={clsx("text-[13px] text-ink", !n.read && "font-semibold")}>{noteWords(n)}</span>
                  <span className="shrink-0 text-[11px] text-muted">{agoShort(n.at, new Date())}</span>
                </span>
                <span className="mt-0.5 line-clamp-1 block text-[12.5px] text-ink-2">{n.about}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A feed note as a link, for the rail's bell (shell-menus.tsx). */
export function FeedNoteLink({ note, onRead }: { note: FeedNote; onRead: () => void }) {
  return (
    <Link
      href={noteHref(note)}
      onClick={onRead}
      className={clsx("block rounded-xl px-3 py-2.5 hover:bg-canvas", !note.read && "bg-sun/60")}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className={clsx("text-[13px] text-ink", !note.read && "font-semibold")}>{noteWords(note)}</span>
        <span className="shrink-0 text-[11px] text-muted">{agoShort(note.at, new Date())}</span>
      </span>
      <span className="mt-0.5 line-clamp-1 block text-[12.5px] text-ink-2">{note.about}</span>
    </Link>
  );
}

/**
 * Follow and mute (17 Nov 2026): words to follow ("Tesla", "Sigenergy"), the businesses followed, topics muted from All,
 * and the Monday email. Only ever the member's own.
 */
export function FollowSettings({ follows, onChange }: { follows: Follows; onChange: (f: Follows) => void }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const box = useOutside(open, () => setOpen(false));

  const send = async (body: Record<string, unknown>) => {
    const r = await setFollow(body);
    if (!r.ok) return setProblem(r.message);
    setProblem(null);
    onChange(r.follows);
  };
  const addWord = async () => {
    if (!word.trim()) return;
    await send({ kind: "word", word, on: true });
    setWord("");
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Follow and mute"
        title="Follow and mute"
        className={clsx(
          "grid size-9 place-items-center rounded-full ring-1 transition",
          open ? "bg-primary text-primary-ink ring-primary" : "bg-surface text-ink-2 ring-line hover:text-ink",
        )}
      >
        <Settings2 className="size-4" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl bg-surface p-4 shadow-2xl ring-1 ring-line">
          <p className="text-sm font-semibold text-ink">Follow and mute</p>

          <p className="mt-3 text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Words you follow</p>
          <p className="mt-0.5 text-[12px] text-muted">Stories and posts naming them show under Following.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {follows.words.map((w) => (
              <span
                key={w}
                className="inline-flex items-center gap-1 rounded-full bg-canvas py-1 pl-2.5 pr-1 text-[12.5px] text-ink ring-1 ring-line"
              >
                {w}
                <button
                  type="button"
                  onClick={() => void send({ kind: "word", word: w, on: false })}
                  aria-label={`Stop following ${w}`}
                  className="grid size-5 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
          {follows.words.length < FOLLOW_LIMITS.words && (
            <div className="mt-2 flex gap-1.5">
              <input
                value={word}
                onChange={(e) => setWord(e.target.value.slice(0, FOLLOW_LIMITS.word))}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void addWord())}
                placeholder="Tesla, Sigenergy, Powerwall…"
                className="min-w-0 flex-1 rounded-full bg-canvas px-3 py-1.5 text-[13px] ring-1 ring-line outline-none"
              />
              <button
                type="button"
                onClick={() => void addWord()}
                disabled={!word.trim()}
                aria-label="Follow this word"
                className="grid size-8 place-items-center rounded-full bg-primary text-primary-ink disabled:bg-line disabled:text-muted"
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          )}

          {follows.businesses.length > 0 && (
            <>
              <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Businesses you follow</p>
              <ul className="mt-1.5 grid gap-1">
                {follows.businesses.map((b) => (
                  <li key={b.key} className="flex items-center justify-between gap-2 text-[13px] text-ink">
                    <span className="truncate">{b.name}</span>
                    <button
                      type="button"
                      onClick={() => void send({ kind: "business", key: b.key, on: false })}
                      className="shrink-0 text-[12px] text-muted hover:text-ink"
                    >
                      Unfollow
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Muted topics</p>
          <p className="mt-0.5 text-[12px] text-muted">Muted topics stay out of All; their chips still show them.</p>
          {(["solar", "wider"] as const).map((part) => (
            <div key={part} className="mt-2">
              <p className="text-[11.5px] text-muted">{PART_LABELS[part]}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {NEWS_TOPICS.filter((t) => partOf(t) === part).map((t: NewsTopic) => {
                  const muted = follows.muted.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => void send({ kind: "mute", topic: t, on: !muted })}
                      aria-pressed={muted}
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] ring-1 transition",
                        muted ? "bg-ink-2 text-canvas ring-ink-2" : "bg-surface text-ink-2 ring-line hover:text-ink",
                      )}
                    >
                      {muted && <BellOff className="size-3" aria-hidden />}
                      {NEWS_TOPIC_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl bg-canvas px-3 py-2.5 ring-1 ring-line">
            <input
              type="checkbox"
              checked={follows.digest}
              onChange={(e) => void send({ digest: e.target.checked })}
              className="mt-0.5 size-4 accent-[var(--primary)]"
            />
            <span className="text-[13px] text-ink">
              <span className="flex items-center gap-1.5 font-medium">
                <Mail className="size-3.5" aria-hidden /> The Monday email
              </span>
              <span className="text-[12px] text-muted">
                The week&apos;s top five stories and the most talked about post, Monday morning.
              </span>
            </span>
          </label>
          {problem && <p className="mt-2 text-[12px] text-warning">{problem}</p>}
        </div>
      )}
    </div>
  );
}

const STANDING_WORDS = {
  none: "",
  requested: "Asked to connect",
  incoming: "They asked to connect: answer on Connections",
  connected: "Connected",
} as const;

/**
 * A business's page in the network (17 Nov 2026): pressed from a post's author. Its name, kind and suburb (only when
 * it lists itself), its posts, Follow, and Connect, so the feed is how businesses find each other.
 */
export function BusinessSheet({
  businessKey,
  staff,
  onClose,
  onFollow,
}: {
  businessKey: string;
  staff: boolean;
  onClose: () => void;
  onFollow: () => void;
}) {
  const [b, setB] = useState<FeedBusiness | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let gone = false;
    void loadFeedBusiness(businessKey).then((r) => {
      if (gone) return;
      if (r.ok) setB(r.business);
      else setProblem(r.message);
    });
    return () => {
      gone = true;
    };
  }, [businessKey, tick]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const follow = async () => {
    if (!b) return;
    setBusy(true);
    const r = await setFollow({ kind: "business", key: b.key, on: !b.following });
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    setB({ ...b, following: !b.following });
    onFollow();
  };
  const connect = async () => {
    if (!b) return;
    setBusy(true);
    const r = await connectFromFeed(b.key);
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    setProblem(null);
    setB({ ...b, standing: "requested" });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="theme-studio flex h-full w-full max-w-xl flex-col overflow-hidden bg-canvas shadow-2xl" aria-label="Business">
        <div className="flex items-start gap-3 border-b border-line bg-surface px-5 py-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-[14px] font-semibold text-primary-ink">
            {(b?.name ?? "?")
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join("")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold text-ink">{b?.name ?? "…"}</p>
            {b && (
              <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
                {b.kind}
                {b.suburb && (
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin className="size-3" aria-hidden />
                    {[b.suburb, b.state].filter(Boolean).join(", ")}
                  </span>
                )}
                <span>· On RENUABL</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {b && !b.own && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-3">
            {b.standing === "none" ? (
              <button
                type="button"
                onClick={() => void connect()}
                disabled={busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-ink disabled:bg-line"
              >
                <UserPlus className="size-4" aria-hidden /> Connect
              </button>
            ) : (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-canvas px-4 text-[13px] text-ink ring-1 ring-line">
                <UserCheck className="size-4" aria-hidden /> {STANDING_WORDS[b.standing]}
              </span>
            )}
            <button
              type="button"
              onClick={() => void follow()}
              disabled={busy}
              aria-pressed={b.following}
              className={clsx(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] ring-1",
                b.following ? "bg-ink-2 text-canvas ring-ink-2" : "bg-surface text-ink ring-line hover:ring-ink",
              )}
            >
              {b.following ? "Following" : "Follow"}
            </button>
            <p className="w-full text-[12px] text-muted">
              Connected businesses can send each other jobs on RENUABL.{" "}
              {b.listed ? "" : "This business isn't in the directory; it can still be asked from its posts."}
            </p>
          </div>
        )}
        {problem && <p className="mx-5 mt-3 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">{problem}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Posts</p>
          {b && b.posts.length === 0 && <p className="mt-3 text-[13px] text-muted">Nothing posted yet.</p>}
          <ul className="mt-3 grid gap-4">
            {b?.posts.map((p) => (
              <PostCard key={p.id} post={p} staff={staff} onChange={() => setTick((n) => n + 1)} />
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
