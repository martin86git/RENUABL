"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  BarChart3,
  Check,
  CircleHelp,
  Trophy,
  Star,
  Flag,
  Heart,
  ImagePlus,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  POLL_LIMITS,
  POST_LIMITS,
  POST_RULES,
  agoShort,
  pollShare,
  pollTimeWords,
  type FeedComment,
  type FeedPoll,
  type FeedPost,
} from "@/lib/domain/design/feed-posts";
import { SOL_ANSWER_NOTE, winHeadline, type PollResults, type PostKind } from "@/lib/domain/design/feed-social";
import { SolBadge } from "./sol-icon";
import {
  commentOn,
  keepPost,
  likePost,
  loadComments,
  loadWinnable,
  markAnswered,
  postPictureUrl,
  removeComment,
  removePost,
  reportPost,
  sendPost,
  votePoll,
} from "@/lib/services/feed-posts";
import type { Answer } from "@/lib/services/crm";

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
  const [choices, setChoices] = useState<string[] | null>(null);
  // A question to the industry, or a win shared from an installed job (17 Nov 2026, feed-social.ts).
  const [kind, setKind] = useState<PostKind>("post");
  const [wins, setWins] = useState<{ jobId: string; label: string }[]>([]);
  const [job, setJob] = useState("");
  useEffect(() => {
    let gone = false;
    void loadWinnable().then((r) => {
      if (!gone && r.ok) setWins(r.jobs);
    });
    return () => {
      gone = true;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const open = text.length > 0 || showLink || photo !== null || choices !== null || kind !== "post";
  const pollReady = !choices || choices.filter((c) => c.trim()).length >= POLL_LIMITS.min;

  const post = async () => {
    setBusy(true);
    setProblem(null);
    const r =
      kind === "win"
        ? await sendPost({ text, link: "", photo: null, kind, job })
        : await sendPost({ text, link, photo, kind, poll: choices?.map((c) => c.trim()).filter(Boolean) ?? null });
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    setText("");
    setLink("");
    setShowLink(false);
    setPhoto(null);
    setChoices(null);
    if (kind === "win") setWins((w) => w.filter((x) => x.jobId !== job));
    setKind("post");
    setJob("");
    onPosted();
  };

  return (
    <div className="rounded-2xl bg-surface p-3 ring-1 ring-line">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, POST_LIMITS.text))}
        rows={open ? 3 : 1}
        placeholder={
          kind === "question"
            ? "Ask the industry a question…"
            : kind === "win"
              ? "Say something about the install (optional)…"
              : choices
                ? "Ask your question…"
                : "Share something with solar businesses on RENUABL…"
        }
        className="w-full resize-none bg-transparent px-1 text-[14px] text-ink outline-none placeholder:text-muted"
      />
      {kind === "question" && (
        <p className="mt-1 flex items-center gap-1.5 px-1 text-[12px] text-muted">
          <SolBadge className="size-3.5" /> Sol offers an answer underneath, and other businesses can answer too. You mark it answered.
        </p>
      )}
      {kind === "win" && (
        <div className="mt-2 grid gap-1.5">
          <select
            value={job}
            onChange={(e) => setJob(e.target.value)}
            className="w-full rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink ring-1 ring-line outline-none"
          >
            <option value="">Choose an installed job…</option>
            {wins.map((w) => (
              <option key={w.jobId} value={w.jobId}>
                {w.label}
              </option>
            ))}
          </select>
          <p className="px-1 text-[12px] text-muted">
            Others see the roof drawn with its panels (the rest blurred), the system and the suburb. Never the address or the customer.
          </p>
        </div>
      )}
      {showLink && kind !== "win" && (
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Paste a link (https://…)"
          className="mt-2 w-full rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink ring-1 ring-line outline-none"
        />
      )}
      {choices && kind === "post" && (
        <div className="mt-2 grid gap-1.5">
          {choices.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={c}
                onChange={(e) => setChoices((cs) => cs?.map((x, j) => (j === i ? e.target.value.slice(0, POLL_LIMITS.choice) : x)) ?? null)}
                placeholder={`Choice ${i + 1}`}
                className="min-w-0 flex-1 rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink ring-1 ring-line outline-none"
              />
              {choices.length > POLL_LIMITS.min && (
                <button
                  type="button"
                  onClick={() => setChoices((cs) => cs?.filter((_, j) => j !== i) ?? null)}
                  aria-label={`Take choice ${i + 1} off`}
                  className="grid size-7 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 text-[12px]">
            {choices.length < POLL_LIMITS.max && (
              <button
                type="button"
                onClick={() => setChoices((cs) => [...(cs ?? []), ""])}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-ink-2 hover:bg-canvas hover:text-ink"
              >
                <Plus className="size-3.5" aria-hidden /> Add a choice
              </button>
            )}
            <span className="text-muted">Open for a week. Votes show once you&apos;ve voted.</span>
            <button type="button" onClick={() => setChoices(null)} className="ml-auto text-muted hover:text-ink">
              Remove poll
            </button>
          </div>
        </div>
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
        {kind !== "win" && (
          <>
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
          </>
        )}
        {kind === "post" && (
          <button
            type="button"
            onClick={() => setChoices((cs) => (cs ? null : ["", ""]))}
            aria-pressed={choices !== null}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] text-ink-2 hover:bg-canvas hover:text-ink"
          >
            <BarChart3 className="size-4" aria-hidden /> Poll
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setKind((k) => (k === "question" ? "post" : "question"));
            setChoices(null);
          }}
          aria-pressed={kind === "question"}
          className={clsx(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] hover:bg-canvas hover:text-ink",
            kind === "question" ? "bg-canvas text-ink ring-1 ring-line" : "text-ink-2",
          )}
        >
          <CircleHelp className="size-4" aria-hidden /> Question
        </button>
        {wins.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setKind((k) => (k === "win" ? "post" : "win"));
              setChoices(null);
              setShowLink(false);
              setPhoto(null);
            }}
            aria-pressed={kind === "win"}
            className={clsx(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] hover:bg-canvas hover:text-ink",
              kind === "win" ? "bg-canvas text-ink ring-1 ring-line" : "text-ink-2",
            )}
          >
            <Trophy className="size-4" aria-hidden /> Win
          </button>
        )}
        <span className="ml-auto" />
        <button
          type="button"
          onClick={post}
          disabled={busy || !pollReady || (kind === "win" ? !job : !text.trim() && (kind === "question" || (!link.trim() && !photo)))}
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
export function PostCard({
  post,
  staff,
  onChange,
  onBusiness,
  followed,
}: {
  post: FeedPost;
  staff: boolean;
  onChange: () => void;
  /** Opens the writing business's page (17 Nov 2026). */
  onBusiness?: (key: string) => void;
  /** Why it is under Following, when it is: "business" or the word followed. */
  followed?: string | null;
}) {
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);

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
  const answered = async () => {
    const r = await markAnswered(post.id, !post.answered);
    if (r.ok) onChange();
    else setNote(r.message);
  };
  const key = post.businessKey;
  const open = key && onBusiness ? () => onBusiness(key) : null;

  return (
    <li
      id={`feed-${post.id}`}
      className="scroll-mt-24 rounded-2xl bg-surface px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-line"
    >
      <div className="flex items-start gap-3">
        {post.sol ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sun">
            <SolBadge className="size-5" />
          </span>
        ) : (
          <button
            type="button"
            onClick={open ?? undefined}
            disabled={!open}
            aria-label={open ? `See ${post.businessName} on RENUABL` : undefined}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-[12px] font-semibold text-primary-ink"
          >
            {initials(post.author)}
          </button>
        )}
        <div className="min-w-0 flex-1">
          {open ? (
            <button
              type="button"
              onClick={open}
              className="block max-w-full truncate text-left text-[13.5px] font-medium text-ink hover:underline"
            >
              {post.author}
            </button>
          ) : (
            <p className="truncate text-[13.5px] font-medium text-ink">{post.author}</p>
          )}
          <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
            <span>
              {post.kind} · {agoShort(post.at, new Date())}
            </span>
            <KindMark post={post} />
            {followed && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-market/10 px-1.5 py-0.5 text-[11px] font-medium text-market">
                <Star className="size-2.5 fill-current" aria-hidden />
                {followed === "business" ? "Following" : followed}
              </span>
            )}
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

      {post.win && (
        <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-sun px-3 py-2 text-[14px] font-medium text-sun-ink">
          <Trophy className="mt-0.5 size-4 shrink-0" aria-hidden /> {winHeadline(post.win)}
        </p>
      )}
      {post.text && (
        <p
          className={clsx(
            "mt-2.5 whitespace-pre-wrap leading-relaxed text-ink",
            post.poll || post.postKind === "question" ? "text-[15.5px] font-medium" : "text-[14px]",
          )}
        >
          {post.text}
        </p>
      )}
      {post.results && <Results results={post.results} />}
      {post.poll && <Poll postId={post.id} poll={post.poll} at={post.at} onVoted={onChange} />}
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

      {post.postKind === "question" && <QuestionFoot post={post} onAnswered={() => void answered()} />}

      <Talk
        liked={post.liked}
        likes={post.likes}
        comments={post.comments}
        api={{
          like: (like) => likePost(post.id, like),
          load: () => loadComments(post.id),
          comment: (text) => commentOn(post.id, text),
          uncomment: (id) => removeComment(post.id, id),
        }}
      />
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
    </li>
  );
}

/** What a like and comment bar needs to reach its post or story. */
export interface TalkApi {
  like: (like: boolean) => Promise<Answer<unknown>>;
  load: () => Promise<Answer<{ comments: FeedComment[] }>>;
  comment: (text: string) => Promise<Answer<unknown>>;
  uncomment: (id: string) => Promise<Answer<unknown>>;
}

/**
 * Like and comment, under a post or one of Sol's stories (16 Nov 2026: stories can be talked about too). Comments open
 * under the bar; a comment is taken down by its writer, their business's owner or staff.
 */
export function Talk({
  liked: likedAtFirst,
  likes: likesAtFirst,
  comments: countAtFirst,
  api,
}: {
  liked: boolean;
  likes: number;
  comments: number;
  api: TalkApi;
}) {
  const [liked, setLiked] = useState(likedAtFirst);
  const [likes, setLikes] = useState(likesAtFirst);
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [count, setCount] = useState(countAtFirst);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    const r = await api.like(next);
    if (!r.ok) {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  };
  const openComments = async () => {
    if (comments) return setComments(null);
    const r = await api.load();
    if (r.ok) setComments(r.comments);
  };
  const sendComment = async () => {
    if (!draft.trim()) return;
    const r = await api.comment(draft);
    if (!r.ok) return setNote(r.message);
    setNote(null);
    setDraft("");
    setCount((n) => n + 1);
    const again = await api.load();
    if (again.ok) setComments(again.comments);
  };
  const dropComment = async (c: FeedComment) => {
    const r = await api.uncomment(c.id);
    if (r.ok) {
      setComments((cs) => cs?.filter((x) => x.id !== c.id) ?? null);
      setCount((n) => n - 1);
    }
  };

  return (
    <>
      <div className="mt-3 flex items-center gap-1 text-[12.5px] text-ink-2">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          className={clsx("inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 hover:bg-canvas", liked && "text-sun-line")}
        >
          <Heart className={clsx("size-4", liked && "fill-current")} aria-hidden /> {likes > 0 ? likes : "Like"}
        </button>
        <button
          type="button"
          onClick={openComments}
          aria-expanded={comments !== null}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 hover:bg-canvas"
        >
          <MessageCircle className="size-4" aria-hidden /> {count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : "Comment"}
        </button>
      </div>
      {note && <p className="mt-1 text-[12px] text-muted">{note}</p>}
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
              placeholder={comments.length ? "Write a comment…" : "Be the first to say something…"}
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
    </>
  );
}

/** A post's poll: the choices to vote on, then each one's share once the reader may see them (`pollFor`). */
function Poll({ postId, poll, at, onVoted }: { postId: string; poll: FeedPoll; at: string; onVoted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const vote = async (i: number) => {
    if (!poll.open || busy) return;
    setBusy(true);
    const r = await votePoll(postId, i);
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    setProblem(null);
    onVoted();
  };
  const votes = poll.votes;
  return (
    <div className="mt-3 grid gap-1.5">
      {poll.choices.map((c, i) => {
        const share = votes ? pollShare(votes[i] ?? 0, poll.total) : 0;
        const mine = poll.mine === i;
        return (
          <button
            key={i}
            type="button"
            onClick={() => vote(i)}
            disabled={!poll.open || busy}
            aria-pressed={mine}
            className={clsx(
              "relative flex h-10 items-center overflow-hidden rounded-xl px-3 text-left text-[13.5px] ring-1 transition",
              mine ? "ring-ink" : "ring-line",
              poll.open ? "hover:ring-ink-2" : "cursor-default",
            )}
          >
            {votes && (
              <span
                aria-hidden
                className={clsx("absolute inset-y-0 left-0 transition-[width] duration-500", mine ? "bg-market/20" : "bg-canvas")}
                style={{ width: `${share}%` }}
              />
            )}
            <span className="relative flex min-w-0 flex-1 items-center gap-1.5 text-ink">
              {mine && <Check className="size-3.5 shrink-0" aria-hidden />}
              <span className="truncate">{c}</span>
            </span>
            {votes && <span className="relative ml-2 tabular-nums text-ink-2">{share}%</span>}
          </button>
        );
      })}
      <p className="text-[12px] text-muted">
        {poll.total} vote{poll.total === 1 ? "" : "s"} · {pollTimeWords(at, new Date())}
        {!votes && poll.open ? " · Vote to see the results" : poll.open && poll.mine !== null ? " · You can change your vote" : ""}
      </p>
      {problem && <p className="text-[12px] text-warning">{problem}</p>}
    </div>
  );
}

/** Under a question: Sol's answer with its sources, and Mark answered for whoever asked. */
function QuestionFoot({ post, onAnswered }: { post: FeedPost; onAnswered: () => void }) {
  const [now] = useState(() => Date.now());
  const fresh = now - Date.parse(post.at) < 5 * 60_000;
  return (
    <div className="mt-3 grid gap-2">
      {post.solAnswer ? (
        <div className="rounded-xl bg-sun/50 px-3.5 py-3 ring-1 ring-sun-line/30">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-sun-ink">
            <SolBadge className="size-3.5" /> Sol&apos;s answer
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{post.solAnswer.text}</p>
          {post.solAnswer.sources.length > 0 && (
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {post.solAnswer.sources.map((src) => (
                <a
                  key={src.url}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-surface px-2 py-0.5 text-[11.5px] text-ink-2 ring-1 ring-line hover:text-ink"
                >
                  {src.site}
                </a>
              ))}
            </p>
          )}
          <p className="mt-1.5 text-[11.5px] italic text-muted">{SOL_ANSWER_NOTE}</p>
        </div>
      ) : (
        fresh && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <SolBadge className="size-3.5 animate-pulse" /> Sol is looking into it…
          </p>
        )
      )}
      {post.writer && (
        <button
          type="button"
          onClick={onAnswered}
          className={clsx(
            "inline-flex h-8 w-fit items-center gap-1.5 rounded-full px-3 text-[12.5px] ring-1",
            post.answered ? "bg-positive-soft text-positive ring-positive/30" : "bg-surface text-ink-2 ring-line hover:text-ink",
          )}
        >
          <Check className="size-3.5" aria-hidden /> {post.answered ? "Answered · undo" : "Mark answered"}
        </button>
      )}
    </div>
  );
}

/** The small mark beside when it was posted: Question (Answered), Win, Sol's poll or results. */
function KindMark({ post }: { post: FeedPost }) {
  const k = post.postKind;
  if (k === "question")
    return post.answered ? (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-positive-soft px-1.5 py-0.5 text-[11px] font-medium text-positive">
        <Check className="size-2.5" aria-hidden /> Answered
      </span>
    ) : (
      <span className="rounded-full bg-kind-message-soft px-1.5 py-0.5 text-[11px] font-medium text-kind-message">Question</span>
    );
  if (k === "win") return <span className="rounded-full bg-sun px-1.5 py-0.5 text-[11px] font-medium text-sun-ink">Win</span>;
  if (k === "sol-poll")
    return <span className="rounded-full bg-sun px-1.5 py-0.5 text-[11px] font-medium text-sun-ink">This week&apos;s poll</span>;
  if (k === "sol-results")
    return <span className="rounded-full bg-sun px-1.5 py-0.5 text-[11px] font-medium text-sun-ink">Poll results</span>;
  return null;
}

/** Last week's poll as Sol posted its results: each choice's share, the largest first. */
function Results({ results }: { results: PollResults }) {
  const rows = results.choices.map((c, i) => ({ c, v: results.votes[i] ?? 0 })).sort((a, b) => b.v - a.v);
  return (
    <div className="mt-3 grid gap-1.5">
      <p className="text-[13px] font-medium text-ink">{results.question}</p>
      {rows.map((r, i) => {
        const share = pollShare(r.v, results.total);
        return (
          <div key={r.c} className="relative flex h-9 items-center overflow-hidden rounded-xl px-3 text-[13px] ring-1 ring-line">
            <span
              aria-hidden
              className={clsx("absolute inset-y-0 left-0", i === 0 ? "bg-sun-line/25" : "bg-canvas")}
              style={{ width: `${share}%` }}
            />
            <span className="relative min-w-0 flex-1 truncate text-ink">{r.c}</span>
            <span className="relative ml-2 tabular-nums text-ink-2">{share}%</span>
          </div>
        );
      })}
      <p className="text-[12px] text-muted">{results.total} votes · only votes are counted, no business is named</p>
    </div>
  );
}
