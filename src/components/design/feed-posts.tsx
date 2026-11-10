"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Flag, Heart, ImagePlus, Link2, MessageCircle, MoreHorizontal, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { POST_LIMITS, POST_RULES, agoShort, type FeedComment, type FeedPost } from "@/lib/domain/design/feed-posts";
import {
  commentOn,
  keepPost,
  likePost,
  loadComments,
  postPictureUrl,
  removeComment,
  removePost,
  reportPost,
  sendPost,
} from "@/lib/services/feed-posts";

const initials = (words: string) =>
  words
    .split("·")[0]
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/**
 * The box at the top of the News tab (10 Nov 2026, Martin: let businesses post, like a social feed): words, a link or a
 * photo, seen by every business on RENUABL. Customers' details are taken out on the server (`POST_RULES` says so).
 */
export function PostComposer({ onPosted }: { onPosted: () => void }) {
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const open = text.length > 0 || showLink || photo !== null;

  const post = async () => {
    setBusy(true);
    setProblem(null);
    const r = await sendPost({ text, link, photo });
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    setText("");
    setLink("");
    setShowLink(false);
    setPhoto(null);
    onPosted();
  };

  return (
    <div className="rounded-2xl bg-surface p-3 ring-1 ring-line">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, POST_LIMITS.text))}
        rows={open ? 3 : 1}
        placeholder="Share something with solar businesses on RENUABL…"
        className="w-full resize-none bg-transparent px-1 text-[14px] text-ink outline-none placeholder:text-muted"
      />
      {showLink && (
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Paste a link (https://…)"
          className="mt-2 w-full rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink ring-1 ring-line outline-none"
        />
      )}
      {photo && (
        <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1 text-[12px] text-ink-2 ring-1 ring-line">
          <ImagePlus className="size-3.5" aria-hidden /> {photo.name}
          <button type="button" onClick={() => setPhoto(null)} aria-label="Take the photo off" className="text-muted hover:text-ink">
            <X className="size-3.5" aria-hidden />
          </button>
        </p>
      )}
      {problem && <p className="mt-2 text-[12px] text-warning">{problem}</p>}
      <div className="mt-2 flex items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] text-ink-2 hover:bg-canvas hover:text-ink"
        >
          <ImagePlus className="size-4" aria-hidden /> Photo
        </button>
        <button
          type="button"
          onClick={() => setShowLink((v) => !v)}
          aria-pressed={showLink}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] text-ink-2 hover:bg-canvas hover:text-ink"
        >
          <Link2 className="size-4" aria-hidden /> Link
        </button>
        <span className="ml-auto" />
        <button
          type="button"
          onClick={post}
          disabled={busy || (!text.trim() && !link.trim() && !photo)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-ink disabled:bg-line disabled:text-muted"
        >
          <Send className="size-3.5" aria-hidden /> {busy ? "Posting…" : "Post"}
        </button>
      </div>
      {open && <p className="mt-2 px-1 text-[11.5px] text-muted">{POST_RULES}</p>}
    </div>
  );
}

/** One post: who and when, the words, its photo or link, then like, comments and the menu (report, remove). */
export function PostCard({ post, staff, onChange }: { post: FeedPost; staff: boolean; onChange: () => void }) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [count, setCount] = useState(post.comments);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    const r = await likePost(post.id, next);
    if (!r.ok) {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  };
  const openComments = async () => {
    if (comments) return setComments(null);
    const r = await loadComments(post.id);
    if (r.ok) setComments(r.comments);
  };
  const sendComment = async () => {
    if (!draft.trim()) return;
    const r = await commentOn(post.id, draft);
    if (!r.ok) return setNote(r.message);
    setDraft("");
    setCount((n) => n + 1);
    const again = await loadComments(post.id);
    if (again.ok) setComments(again.comments);
  };
  const dropComment = async (c: FeedComment) => {
    const r = await removeComment(post.id, c.id);
    if (r.ok) {
      setComments((cs) => cs?.filter((x) => x.id !== c.id) ?? null);
      setCount((n) => n - 1);
    }
  };
  const report = async () => {
    const r = await reportPost(post.id, reason);
    setReporting(false);
    setNote(r.ok ? "Thanks. RENUABL's team will look at it." : r.message);
    if (r.ok) onChange();
  };
  const remove = async () => {
    const r = await removePost(post.id);
    if (r.ok) onChange();
    else setNote(r.message);
  };
  const keep = async () => {
    const r = await keepPost(post.id);
    if (r.ok) onChange();
  };

  return (
    <li className="rounded-2xl bg-surface px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-line">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-[12px] font-semibold text-primary-ink">
          {initials(post.author)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium text-ink">{post.author}</p>
          <p className="text-[12px] text-muted">
            {post.kind} · {agoShort(post.at, new Date())}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-label="More"
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
          {menu && (
            <div className="absolute right-0 top-9 z-10 w-44 rounded-xl bg-surface p-1 text-[13px] shadow-lg ring-1 ring-line">
              {!post.mine && !post.reported && (
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setReporting(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-ink-2 hover:bg-canvas"
                >
                  <Flag className="size-3.5" aria-hidden /> Report this post
                </button>
              )}
              {post.mine && (
                <button
                  type="button"
                  onClick={remove}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-ink-2 hover:bg-canvas"
                >
                  <Trash2 className="size-3.5" aria-hidden /> {staff ? "Remove (staff)" : "Delete"}
                </button>
              )}
              {post.reported && <p className="px-2.5 py-2 text-muted">Your business reported this.</p>}
            </div>
          )}
        </div>
      </div>

      {post.hidden && (
        <p className="mt-2 rounded-lg bg-warning-soft px-3 py-1.5 text-[12px] text-warning">
          Hidden from other businesses while RENUABL looks at reports.
        </p>
      )}
      {staff && (post.reports ?? 0) > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-canvas px-3 py-1.5 text-[12px] text-ink-2 ring-1 ring-line">
          <ShieldCheck className="size-3.5" aria-hidden /> Reported by {post.reports} business{post.reports === 1 ? "" : "es"}
          <button type="button" onClick={keep} className="rounded-full bg-surface px-2.5 py-0.5 ring-1 ring-line hover:text-ink">
            Keep it
          </button>
          <button type="button" onClick={remove} className="rounded-full bg-surface px-2.5 py-0.5 ring-1 ring-line hover:text-ink">
            Remove it
          </button>
        </p>
      )}

      {post.text && <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{post.text}</p>}
      {post.hasPhoto && (
        // eslint-disable-next-line @next/next/no-img-element -- the post's own photo, redrawn and kept by us
        <img
          src={postPictureUrl(post.id, "photo")}
          alt=""
          loading="lazy"
          className="mt-3 max-h-[28rem] w-full rounded-xl object-cover ring-1 ring-line"
        />
      )}
      {post.link && (
        <a
          href={post.link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex overflow-hidden rounded-xl bg-canvas ring-1 ring-line hover:ring-ink-2"
        >
          {post.link.hasImage && (
            // eslint-disable-next-line @next/next/no-img-element -- the linked page's preview picture, redrawn and kept by us
            <img src={postPictureUrl(post.id, "link")} alt="" loading="lazy" className="aspect-[16/9] w-36 shrink-0 object-cover sm:w-44" />
          )}
          <span className="min-w-0 self-center px-3 py-2.5">
            <span className="block truncate text-[12px] text-muted">{post.link.site}</span>
            <span className="line-clamp-2 text-[13.5px] font-medium text-ink">{post.link.title ?? post.link.url}</span>
          </span>
        </a>
      )}

      <div className="mt-3 flex items-center gap-1 text-[12.5px] text-ink-2">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          className={clsx("inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 hover:bg-canvas", liked && "text-sun-line")}
        >
          <Heart className={clsx("size-4", liked && "fill-current")} aria-hidden /> {likes > 0 ? likes : "Like"}
        </button>
        <button type="button" onClick={openComments} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 hover:bg-canvas">
          <MessageCircle className="size-4" aria-hidden /> {count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : "Comment"}
        </button>
      </div>

      {note && <p className="mt-1 text-[12px] text-muted">{note}</p>}

      {reporting && (
        <div className="mt-2 rounded-xl bg-canvas p-3 ring-1 ring-line">
          <p className="text-[13px] text-ink">What&apos;s wrong with this post?</p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, POST_LIMITS.reason))}
            placeholder="A customer's details, abuse, spam… (optional)"
            className="mt-2 w-full rounded-lg bg-surface px-3 py-2 text-[13px] ring-1 ring-line outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={report} className="rounded-full bg-primary px-3 py-1.5 text-[12.5px] text-primary-ink">
              Report it
            </button>
            <button
              type="button"
              onClick={() => setReporting(false)}
              className="rounded-full px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {comments && (
        <div className="mt-2 border-t border-line pt-2">
          <ul className="grid gap-2">
            {comments.map((c) => (
              <li key={c.id} className="group flex items-start gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-canvas text-[10.5px] font-semibold text-ink-2 ring-1 ring-line">
                  {initials(c.author)}
                </span>
                <div className="min-w-0 flex-1 rounded-xl bg-canvas px-3 py-1.5">
                  <p className="text-[12px] text-muted">
                    <span className="font-medium text-ink-2">{c.author}</span> · {agoShort(c.at, new Date())}
                  </p>
                  <p className="whitespace-pre-wrap text-[13.5px] text-ink">{c.text}</p>
                </div>
                {c.mine && (
                  <button
                    type="button"
                    onClick={() => dropComment(c)}
                    aria-label="Delete comment"
                    className="mt-1 text-muted opacity-0 hover:text-ink group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, POST_LIMITS.comment))}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void sendComment())}
              placeholder="Write a comment…"
              className="min-w-0 flex-1 rounded-full bg-canvas px-3.5 py-2 text-[13px] ring-1 ring-line outline-none"
            />
            <button
              type="button"
              onClick={sendComment}
              aria-label="Send comment"
              className="grid size-8 place-items-center rounded-full bg-primary text-primary-ink disabled:bg-line"
              disabled={!draft.trim()}
            >
              <Send className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
