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
export function postProblem(text: string, link: string | null, hasPhoto: boolean, linkTyped: boolean): string | null {
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
