/**
 * Posts in the industry feed (10 Nov 2026, Martin: "allow users to post, making it somewhat like a social feed"; every
 * business on RENUABL sees them, with comments, likes, a photo or a link, and a way to report one). Posts sit in the
 * News tab beside Sol's stories, newest first.
 *
 * The first thing businesses show each other in words of their own, so the words are cleaned the way the Marketplace's
 * are (`publicWords`: emails, phone numbers, links and street addresses taken out, so no customer's details travel), a
 * link goes in its own field, and a member is shown by first name and business, never by email. A post reported by
 * `REPORT_HIDE` different businesses is hidden until RENUABL's staff look at it. Pure, tested.
 */
import { BUSINESS_KINDS, cleanKind, type BusinessKind } from "./business-kind";
import { publicWords } from "./marketplace";
import { hostOf } from "./sol-knowledge";
import { fetchableUrl } from "../net";
import type { NewsItem } from "./industry-news";
import type { PollResults, PostKind, SolAnswer, WinFacts } from "./feed-social";

export const POST_LIMITS = {
  /** Words in a post and a comment. */
  text: 1500,
  comment: 600,
  /** A reason given with a report. */
  reason: 300,
  /** Posts in the feed, and comments shown under one. */
  shown: 60,
  comments: 100,
  /** A post's own photo, as uploaded (it is redrawn smaller). */
  photoBytes: 5_000_000,
} as const;

/** Reports from this many different businesses hide a post until staff look at it. */
export const REPORT_HIDE = 3;

/** Said above the box. */
export const POST_RULES =
  "Every business on RENUABL sees what you post. Never post a customer's name, address, phone or email: they're taken out.";

/** What a reader sees of who wrote it: first name and business, or the business alone. */
export function authorWords(firstName: string | null | undefined, businessName: string): string {
  const first = (firstName ?? "").trim();
  return first ? `${first} · ${businessName}` : businessName;
}

/** "Solar retailer", "Installer", "Electrical inspector". */
export const kindWords = (kind: unknown): string => {
  const k: BusinessKind = cleanKind(typeof kind === "string" ? kind : undefined);
  return BUSINESS_KINDS.find((b) => b.kind === k)?.label ?? "Solar retailer";
};

/** A post's words, cleaned (`publicWords`), or "" when nothing is left. */
export const cleanPostText = (raw: unknown) => publicWords(raw, POST_LIMITS.text);
export const cleanCommentText = (raw: unknown) => publicWords(raw, POST_LIMITS.comment);
export const cleanReason = (raw: unknown) => publicWords(raw, POST_LIMITS.reason);

/** A link to share: a public https address (`fetchableUrl`), or null. A bare "example.com/x" gets https in front. */
export function cleanPostLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const u = fetchableUrl(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
  return u ? u.toString().slice(0, 1000) : null;
}

/** Why a post can't go up, or null: it needs words, a link or a photo. */
export function postProblem(
  text: string,
  link: string | null,
  hasPhoto: boolean,
  linkTyped: boolean,
  poll: { asked: boolean; choices: string[] | null } = { asked: false, choices: null },
): string | null {
  if (poll.asked && !poll.choices) return "A poll needs at least two different choices.";
  if (poll.asked && !text) return "Write the question for your poll.";
  if (linkTyped && !link) return "That link doesn't look like a web address starting https.";
  if (!text && !link && !hasPhoto) return "Write something, add a link or a photo.";
  return null;
}

/** A page's own title (`og:title`, else `<title>`), short, or null. */
export function pageTitle(html: string): string | null {
  const head = html.slice(0, 600_000);
  const og = head.match(/<meta\b[^>]*property\s*=\s*["']og:title["'][^>]*>/i)?.[0];
  const fromOg = og?.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2];
  const fromTitle = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const t = (fromOg ?? fromTitle ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t.slice(0, 160) : null;
}

/** A post as a reader is sent it: no email, no business id. */
export interface FeedPost {
  id: string;
  author: string;
  businessName: string;
  kind: string;
  text: string;
  link: { url: string; site: string; title: string | null; hasImage: boolean } | null;
  hasPhoto: boolean;
  at: string;
  likes: number;
  liked: boolean;
  comments: number;
  /** The reader wrote it, or owns the business that did: they may delete it. */
  mine: boolean;
  /** The reader's business has reported it. */
  reported: boolean;
  /** Hidden while staff look at it (only its writer and staff still see it). */
  hidden: boolean;
  /** For staff: how many businesses reported it. */
  reports?: number;
  /** A poll asked with it (16 Nov 2026), as this reader may see it. */
  poll?: FeedPoll | null;
  /** What it is (17 Nov 2026, feed-social.ts): a post, a question, a win, Sol's poll or its results. */
  postKind?: PostKind;
  /** The writing business's key in the network, for its page (null for Sol). */
  businessKey?: string | null;
  /** Written by Sol. */
  sol?: boolean;
  /** The reader wrote it (only they mark a question answered). */
  writer?: boolean;
  /** A question its writer has marked answered. */
  answered?: boolean;
  /** Sol's answer under a question. */
  solAnswer?: SolAnswer | null;
  /** A win's facts. */
  win?: WinFacts | null;
  /** The results Sol posted of a poll. */
  results?: PollResults | null;
}

export interface FeedComment {
  id: string;
  author: string;
  text: string;
  at: string;
  mine: boolean;
}

/** Whether reports from this many businesses hide a post. */
export const hiddenByReports = (businesses: number) => businesses >= REPORT_HIDE;

/** One entry in the News tab: a story of Sol's or a business's post. */
export type FeedEntry = { kind: "story"; item: NewsItem; at: number } | { kind: "post"; post: FeedPost; at: number };

const storyTime = (n: NewsItem) => {
  const found = Date.parse(n.foundAt);
  if (!n.publishedOn) return found;
  // A story is placed at its publication day, but never later than when Sol found it.
  return Math.min(Date.parse(`${n.publishedOn}T12:00:00Z`), found);
};

/** Stories and posts together, newest first. */
export function mergeFeed(stories: readonly NewsItem[], posts: readonly FeedPost[]): FeedEntry[] {
  return [
    ...stories.map((item) => ({ kind: "story" as const, item, at: storyTime(item) })),
    ...posts.map((post) => ({ kind: "post" as const, post, at: Date.parse(post.at) })),
  ].sort((a, b) => b.at - a.at);
}

/** "just now", "5 min ago", "3 h ago", else the day and month. */
export function agoShort(iso: string, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short" }).format(new Date(iso));
}

/** The site a link is on, for the card. */
export const linkSite = (url: string) => hostOf(url);

/**
 * Polls (16 Nov 2026, Martin: make the feed more engaging, an internal social network for the industry): a post may ask
 * a question with two to four choices. Each member votes once and may change their vote while it is open
 * (`POLL_DAYS`). The counts are shown to someone who has voted, to the poll's writer, and to everyone once it closes, so
 * nobody votes with the crowd.
 */
export const POLL_LIMITS = { min: 2, max: 4, choice: 60 } as const;
export const POLL_DAYS = 7;

/** The poll's choices cleaned (`publicWords`, no repeats), or null when there aren't two. */
export function cleanPoll(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const c = publicWords(r, POLL_LIMITS.choice);
    if (!c || seen.has(c.toLowerCase())) continue;
    seen.add(c.toLowerCase());
    out.push(c);
    if (out.length === POLL_LIMITS.max) break;
  }
  return out.length >= POLL_LIMITS.min ? out : null;
}

/** Whether a poll posted then still takes votes. */
export const pollOpen = (postedAt: string, now: Date) => now.getTime() - Date.parse(postedAt) < POLL_DAYS * 86_400_000;

export interface FeedPoll {
  choices: string[];
  /** Votes for each choice; null while the reader may not see them yet. */
  votes: number[] | null;
  total: number;
  /** The reader's own vote, by its place. */
  mine: number | null;
  open: boolean;
}

/** A poll as one reader is sent it: counts only once they've voted, wrote it, or it has closed. */
export function pollFor(
  choices: string[],
  counts: readonly number[],
  mine: number | null,
  writer: boolean,
  postedAt: string,
  now: Date,
): FeedPoll {
  const open = pollOpen(postedAt, now);
  const votes = choices.map((_, i) => counts[i] ?? 0);
  const total = votes.reduce((a, b) => a + b, 0);
  return { choices, votes: mine !== null || writer || !open ? votes : null, total, mine, open };
}

/** "3 days left", "Closes today", "Closed": how long a poll has. */
export function pollTimeWords(postedAt: string, now: Date): string {
  const left = Date.parse(postedAt) + POLL_DAYS * 86_400_000 - now.getTime();
  if (left <= 0) return "Closed";
  if (left < 86_400_000) return "Closes today";
  const days = Math.ceil(left / 86_400_000);
  return days === 1 ? "1 day left" : `${days} days left`;
}

/** A choice's share of the votes, whole per cent. */
export const pollShare = (votes: number, total: number) => (total ? Math.round((votes / total) * 100) : 0);

/** Likes and comments on one of Sol's stories, for the reader (added by the news route, never stored on the story). */
export interface StoryTalk {
  likes: number;
  liked: boolean;
  comments: number;
}

/**
 * Most talked about this week (16 Nov 2026): the stories and posts from the last 7 days with the most said and liked,
 * a comment counting twice a like and each vote once; at most `TALKED_SHOWN`, only from `TALKED_MIN`, so the strip
 * shows only when businesses are really talking.
 */
export const TALKED_SHOWN = 3;
export const TALKED_MIN = 3;

export interface Talked {
  id: string;
  kind: "story" | "post";
  title: string;
  likes: number;
  comments: number;
  votes: number;
}

export function talkedAbout(entries: readonly FeedEntry[], now: Date): Talked[] {
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const all: (Talked & { score: number })[] = [];
  for (const e of entries) {
    if (e.at < weekAgo) continue;
    if (e.kind === "story") {
      const t = e.item.talk;
      if (!t) continue;
      all.push({
        id: e.item.id,
        kind: "story",
        title: e.item.headline,
        likes: t.likes,
        comments: t.comments,
        votes: 0,
        score: t.likes + 2 * t.comments,
      });
    } else {
      const p = e.post;
      const votes = p.poll?.total ?? 0;
      const words = p.text || p.link?.title || "A post";
      const title = words.length > 90 ? `${words.slice(0, words.lastIndexOf(" ", 88) > 40 ? words.lastIndexOf(" ", 88) : 88)}…` : words;
      all.push({ id: p.id, kind: "post", title, likes: p.likes, comments: p.comments, votes, score: p.likes + 2 * p.comments + votes });
    }
  }
  return all
    .filter((t) => t.score >= TALKED_MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, TALKED_SHOWN)
    .map((t) => ({ id: t.id, kind: t.kind, title: t.title, likes: t.likes, comments: t.comments, votes: t.votes }));
}

/** "4 likes · 2 comments · 9 votes", only what there is. */
export function talkWords(t: { likes: number; comments: number; votes: number }): string {
  const parts: string[] = [];
  if (t.likes) parts.push(`${t.likes} like${t.likes === 1 ? "" : "s"}`);
  if (t.comments) parts.push(`${t.comments} comment${t.comments === 1 ? "" : "s"}`);
  if (t.votes) parts.push(`${t.votes} vote${t.votes === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
