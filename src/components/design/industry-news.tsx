"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  ArrowUpRight,
  BadgeCheck,
  BadgePercent,
  BatteryCharging,
  Building2,
  CircleHelp,
  Cpu,
  Home,
  ListChecks,
  Newspaper,
  PackageSearch,
  Receipt,
  Scale,
  TriangleAlert,
  UtilityPole,
  Wrench,
  CalendarDays,
  Car,
  Flame,
  Leaf,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import {
  NEWS_STANDING_LABELS,
  NEWS_TOPICS,
  PART_LABELS,
  partOf,
  type NewsPart,
  type NewsStanding,
  NEWS_TOPIC_LABELS,
  newsDayGroup,
  storyDate,
  newsShown,
  type NewsItem,
  type NewsTopic,
} from "@/lib/domain/design/industry-news";
import { todayInMarket } from "@/lib/domain/market";
import { loadNews, type NewsAnswer } from "@/lib/services/industry-news";
import { mergeFeed, talkWords, talkedAbout, type FeedEntry, type FeedPost, type Talked } from "@/lib/domain/design/feed-posts";
import { commentOnStory, likeStory, loadPosts, loadStoryComments, removeStoryComment } from "@/lib/services/feed-posts";
import { PostCard, PostComposer, Talk } from "./feed-posts";
import { BusinessSheet, FeedActivity, FollowSettings } from "./feed-social";
import { NO_FOLLOWS, postFollowed, storyFollowed, type Follows } from "@/lib/domain/design/feed-social";
import { loadFollows } from "@/lib/services/feed-posts";
import { SolBadge } from "./sol-sun";
import { listWords, moveShare, priceMovesWords, systemsWords, type PriceMovesNote } from "@/lib/domain/design/product-watch";

const money = (n: number) => "$" + n.toLocaleString("en-AU", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

/** A story, a post, or the business's own price moves, in the order they happened. */
type Entry = FeedEntry | { kind: "prices"; note: PriceMovesNote; at: number };

/** A story that touches this business: its products on the lists, or its customers' systems. */
const touches = (n: NewsItem) => Boolean(n.lists || n.systems);

const readWords = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: "Australia/Melbourne" });

/**
 * News on Today (10 Nov 2026, Martin, on learning SolarEdge had left Australia): the solar, battery and EV charger news
 * Sol reads each morning, every story in his words with one line on what it means for the business, linked to where it
 * came from; and since the same day the posts businesses share with each other (feed-posts.tsx: every business sees
 * them). Newest first, grouped by day, by topic or posts alone; staff also see what has been reported.
 */
export function NewsPage() {
  const [data, setData] = useState<NewsAnswer | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [staff, setStaff] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [filter, setFilter] = useState<NewsTopic | NewsPart | "all" | "yours" | "posts" | "following" | "reported">("all");
  const [tick, setTick] = useState(0);
  // What this member follows and mutes, and the business whose page is open (17 Nov 2026, feed-social.ts).
  const [follows, setFollows] = useState<Follows>(NO_FOLLOWS);
  const [business, setBusiness] = useState<string | null>(null);
  const went = useRef(false);
  useEffect(() => {
    let gone = false;
    void loadFollows().then((r) => {
      if (!gone && r.ok) setFollows(r.follows);
    });
    return () => {
      gone = true;
    };
  }, [tick]);

  useEffect(() => {
    let gone = false;
    let timer = 0;
    const go = () =>
      void loadNews().then((r) => {
        if (gone) return;
        if (!r.ok) return setProblem(r.message);
        setProblem(null);
        setData({
          items: r.items,
          readAt: r.readAt,
          reading: r.reading,
          configured: r.configured,
          missed: r.missed,
          priceMoves: r.priceMoves ?? [],
        });
        // While Sol is reading, look again shortly; else every ten minutes.
        timer = window.setTimeout(go, r.reading ? 15_000 : 600_000);
      });
    go();
    return () => {
      gone = true;
      window.clearTimeout(timer);
    };
  }, []);

  // Posts: on opening, after posting or changing one, and each minute.
  useEffect(() => {
    let gone = false;
    const go = () =>
      void loadPosts(filter === "reported").then((r) => {
        if (gone || !r.ok) return;
        setPosts(r.posts);
        setStaff(r.staff);
      });
    go();
    const t = window.setInterval(go, 60_000);
    return () => {
      gone = true;
      window.clearInterval(t);
    };
  }, [tick, filter]);
  const refresh = () => setTick((n) => n + 1);

  const today = todayInMarket();
  const muted = new Set(follows.muted);
  const stories =
    data && filter !== "posts" && filter !== "reported"
      ? filter === "yours"
        ? newsShown(data.items, "all").filter(touches)
        : filter === "following"
          ? newsShown(data.items, "all").filter((n) => storyFollowed(n, follows.words))
          : filter === "solar" || filter === "wider"
            ? newsShown(data.items, "all").filter((n) => partOf(n.topic) === filter)
            : filter === "all"
              ? newsShown(data.items, "all").filter((n) => !muted.has(n.topic))
              : newsShown(data.items, filter)
      : [];
  const shownPosts =
    filter === "following"
      ? posts.filter((p) => postFollowed(p, follows))
      : filter === "all" || filter === "posts" || filter === "reported"
        ? posts
        : [];
  const followsAny = follows.words.length > 0 || follows.businesses.length > 0;
  // A link to a post or story (the bell, the Monday email) takes the reader to it once the feed is in.
  const go = (id: string) => {
    if (!id) return;
    setFilter("all");
    window.setTimeout(() => document.getElementById(`feed-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  useEffect(() => {
    if (went.current || !data) return;
    const id = window.location.hash.match(/^#feed-(.+)$/)?.[1];
    went.current = true;
    if (id) window.setTimeout(() => document.getElementById(`feed-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
  }, [data]);
  const notes = filter === "all" || filter === "yours" ? (data?.priceMoves ?? []) : [];
  const entries: Entry[] = [
    ...mergeFeed(stories, shownPosts),
    ...notes.map((note) => ({ kind: "prices" as const, note, at: Date.parse(note.at) })),
  ].sort((a, b) => b.at - a.at);
  const groups: { day: string; entries: Entry[] }[] = [];
  for (const e of entries) {
    const day =
      e.kind === "story"
        ? newsDayGroup(e.item, today)
        : newsDayGroup({ publishedOn: null, foundAt: e.kind === "post" ? e.post.at : e.note.at }, today);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.entries.push(e);
    else groups.push({ day, entries: [e] });
  }
  // The part on show (Solar, Beyond solar), whose topics show as a second row of chips.
  const part: NewsPart | null =
    filter === "solar" || filter === "wider"
      ? filter
      : (NEWS_TOPICS as readonly string[]).includes(filter)
        ? partOf(filter as NewsTopic)
        : null;
  const topics = part ? NEWS_TOPICS.filter((t) => partOf(t) === part && data?.items.some((n) => n.topic === t)) : [];
  const wider = data?.items.some((n) => partOf(n.topic) === "wider") ?? false;
  const talked = filter === "all" ? talkedAbout(mergeFeed(data?.items ?? [], posts), new Date()) : [];
  const touching = data?.items.filter(touches).length ?? 0;
  const looks = data?.items.filter((n) => n.look).length ?? 0;
  const chips: { id: typeof filter; label: string }[] = [
    { id: "all", label: "All" },
    ...(touching || data?.priceMoves.length ? [{ id: "yours" as const, label: "Your products" }] : []),
    { id: "posts", label: "Posts" },
    ...(followsAny ? [{ id: "following" as const, label: "Following" }] : []),
    { id: "solar", label: PART_LABELS.solar },
    ...(wider ? [{ id: "wider" as const, label: PART_LABELS.wider }] : []),
    ...(staff ? [{ id: "reported" as const, label: "Reported" }] : []),
  ];

  return (
    // Outlined in the Marketplace's blue (10 Nov 2026, Martin): the industry's feed, set apart from the business's own work.
    <div className="mx-auto w-full max-w-3xl rounded-[28px] bg-market/[0.04] px-4 pb-8 pt-5 ring-2 ring-market sm:px-6">
      <div className="flex items-start gap-3">
        <SolBadge className="mt-0.5 size-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink">
            Industry news
            <span className="rounded-full bg-market px-2 py-0.5 text-[11px] font-medium text-white">Across RENUABL</span>
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {data?.reading
              ? "Sol is reading this morning's news…"
              : data?.readAt
                ? `Sol reads the solar news each morning, and what's happening beyond it. Last read ${readWords(data.readAt)}.`
                : "Sol reads the solar news each morning, and what's happening beyond it: EVs, clean energy and business."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <FeedActivity onGo={go} />
          <FollowSettings follows={follows} onChange={setFollows} />
        </div>
      </div>
      {business && <BusinessSheet businessKey={business} staff={staff} onClose={() => setBusiness(null)} onFollow={refresh} />}

      {/* The share box and the chips stay at the top as the feed scrolls (26 Nov 2026, Martin: a persistent nav), on
          the panel's own tint so the stories pass under them. */}
      <div className="sticky top-[var(--studio-head,0px)] z-10 -mx-4 bg-[color-mix(in_srgb,var(--market)_4%,var(--canvas))] px-4 pb-3 pt-4 sm:-mx-6 sm:px-6">
        <div>
          <PostComposer
            onPosted={() => {
              if (filter !== "all" && filter !== "posts") setFilter("all");
              refresh();
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              aria-pressed={filter === c.id || part === c.id}
              className={clsx(
                "rounded-full px-3 py-1.5 text-[13px] ring-1 transition",
                filter === c.id || part === c.id
                  ? "bg-primary text-primary-ink ring-primary"
                  : "bg-surface text-ink-2 ring-line hover:text-ink",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        {topics.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Topics">
            {topics.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(filter === t ? (part ?? "all") : t)}
                aria-pressed={filter === t}
                className={clsx(
                  "rounded-full px-2.5 py-1 text-[12.5px] transition",
                  filter === t ? "bg-ink-2 text-canvas" : "text-ink-2 hover:bg-surface hover:text-ink",
                )}
              >
                {NEWS_TOPIC_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {talked.length > 0 && <TalkedAbout talked={talked} />}

      {looks > 0 && filter !== "posts" && filter !== "reported" && filter !== "following" && part !== "wider" && (
        <button
          type="button"
          onClick={() => setFilter("yours")}
          className="mt-4 flex w-full items-start gap-2.5 rounded-2xl bg-warning-soft px-4 py-3 text-left text-[13.5px] text-warning"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">{looks === 1 ? "One story needs a look" : `${looks} stories need a look`}.</span> A recall,
            listing change, maker notice or maker leaving names products in your customers&apos; systems or on your price lists.
          </span>
        </button>
      )}
      {!looks &&
        touching > 0 &&
        filter !== "posts" &&
        filter !== "reported" &&
        filter !== "yours" &&
        filter !== "following" &&
        part !== "wider" && (
          <p className="mt-4 flex items-center gap-2 text-[13px] text-ink">
            <PackageSearch className="size-4 text-sun-line" aria-hidden />
            {touching === 1 ? "One story names" : `${touching} stories name`} your products. They&apos;re marked below.
          </p>
        )}

      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      {data && !data.configured && data.items.length === 0 && filter !== "posts" && (
        <p className="mt-6 rounded-2xl bg-surface px-4 py-3 text-[13px] text-ink-2 ring-1 ring-line">
          The news isn&apos;t set up on this site yet: Sol needs Claude (ANTHROPIC_API_KEY) to read it.
        </p>
      )}

      {data && data.missed && !data.reading && (
        <p className="mt-4 rounded-2xl bg-surface px-4 py-3 text-[13px] text-ink-2 ring-1 ring-line">
          Sol couldn&apos;t read the news on his last try. He&apos;ll try again within the hour.
        </p>
      )}

      {data && entries.length === 0 && (
        <div className="mt-16 text-center">
          <Newspaper className={clsx("mx-auto size-6 text-muted", data.reading && "animate-pulse")} aria-hidden />
          <p className="mt-3 text-[15px] text-ink">
            {filter === "posts" || filter === "reported" || filter === "following"
              ? filter === "reported"
                ? "Nothing reported."
                : filter === "following"
                  ? "Nothing here yet."
                  : "No posts yet."
              : data.reading
                ? "Reading the news…"
                : "No news yet."}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {filter === "following"
              ? "Nothing from what you follow yet. Follow words and businesses from the settings button above."
              : filter === "posts"
                ? "Be the first to share something with solar businesses on RENUABL."
                : data.reading
                  ? "This takes a minute or two. Stories appear here as soon as Sol has them."
                  : "Stories show here after Sol's morning read."}
          </p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.day} className="mt-8">
          <h3 className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">{g.day}</h3>
          <ul className="mt-3 grid gap-5">
            {g.entries.map((e) =>
              e.kind === "story" ? (
                <Story key={e.item.id} item={e.item} />
              ) : e.kind === "prices" ? (
                <PriceMovesCard key={e.note.id} note={e.note} />
              ) : (
                <PostCard
                  key={e.post.id}
                  post={e.post}
                  staff={staff}
                  onChange={refresh}
                  onBusiness={setBusiness}
                  followed={postFollowed(e.post, follows)}
                />
              ),
            )}
          </ul>
        </section>
      ))}

      {stories.length > 0 && (
        <p className="mt-8 text-[12px] text-muted">
          Stories are written by Sol from the pages linked. Check the source before acting on one.
        </p>
      )}
    </div>
  );
}

const STANDING_LOOK: Record<NewsStanding, string> = {
  confirmed: "bg-positive-soft text-positive",
  reported: "bg-canvas text-ink-2 ring-1 ring-line",
  unconfirmed: "bg-warning-soft text-warning",
};

/** Confirmed, Reported or Unconfirmed: how sure the story is. */
function StandingPill({ standing }: { standing: NewsStanding }) {
  const Icon = standing === "confirmed" ? BadgeCheck : standing === "unconfirmed" ? CircleHelp : Newspaper;
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", STANDING_LOOK[standing])}>
      <Icon className="size-3" aria-hidden />
      {NEWS_STANDING_LABELS[standing]}
    </span>
  );
}

/** Each topic's colour and mark, for the drawn picture on a story whose page has none of its own. */
const TOPIC_ART: Record<NewsTopic, { icon: typeof Newspaper; soft: string; ink: string }> = {
  recalls: { icon: TriangleAlert, soft: "bg-warning-soft", ink: "text-warning" },
  listings: { icon: ListChecks, soft: "bg-kind-follow-up-soft", ink: "text-kind-follow-up" },
  notices: { icon: Wrench, soft: "bg-kind-approvals-soft", ink: "text-kind-approvals" },
  companies: { icon: Building2, soft: "bg-kind-message-soft", ink: "text-kind-message" },
  rebates: { icon: BadgePercent, soft: "bg-kind-order-soft", ink: "text-kind-order" },
  rules: { icon: Scale, soft: "bg-canvas", ink: "text-ink-2" },
  networks: { icon: UtilityPole, soft: "bg-kind-lead-soft", ink: "text-kind-lead" },
  products: { icon: BatteryCharging, soft: "bg-kind-install-soft", ink: "text-kind-install" },
  technology: { icon: Cpu, soft: "bg-kind-date-soft", ink: "text-kind-date" },
  ev: { icon: Car, soft: "bg-market/10", ink: "text-market" },
  cleantech: { icon: Leaf, soft: "bg-positive-soft", ink: "text-positive" },
  business: { icon: Briefcase, soft: "bg-sand", ink: "text-ink-2" },
};

/**
 * The picture across the top of a story (10 Nov 2026, Martin: the feed blended into itself, with no pictures): its page's
 * own preview picture, kept by us; else a drawn band in the topic's colour with its mark, so every story reads at a glance.
 */
function StoryPicture({ item }: { item: NewsItem }) {
  const [failed, setFailed] = useState(false);
  if (item.hasImage && !failed)
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden className="block bg-canvas">
        {/* eslint-disable-next-line @next/next/no-img-element -- the story page's preview picture, redrawn and kept by us */}
        <img
          src={`/api/design/news/${encodeURIComponent(item.id)}/image`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="aspect-[2/1] max-h-72 w-full object-cover"
        />
      </a>
    );
  return <TopicArt topic={item.topic} />;
}

/** The drawn band for a story with no picture of its own: the topic's colour and mark. Also on Today's strip (today-news.tsx). */
export function TopicArt({ topic, className = "h-24" }: { topic: NewsTopic; className?: string }) {
  const art = TOPIC_ART[topic];
  const Icon = art.icon;
  return (
    <div aria-hidden className={clsx("relative flex items-center overflow-hidden px-5", className, art.soft)}>
      <Icon className={clsx("absolute -right-3 -top-4 size-36 opacity-15", art.ink)} strokeWidth={1.2} />
      <Icon className={clsx("absolute right-36 top-12 size-10 opacity-10", art.ink)} strokeWidth={1.2} />
      <span className={clsx("grid size-11 place-items-center rounded-full bg-surface shadow-sm", art.ink)}>
        <Icon className="size-5" />
      </span>
      <span className={clsx("ml-3 text-[13px] font-medium", art.ink)}>{NEWS_TOPIC_LABELS[topic]}</span>
    </div>
  );
}

function Story({ item }: { item: NewsItem }) {
  const [open, setOpen] = useState(false);
  const long = item.summary.length > 240;
  const date = storyDate(item, todayInMarket());
  return (
    <li
      id={`feed-${item.id}`}
      className={clsx(
        "scroll-mt-24 overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
        item.look ? "ring-2 ring-warning" : "ring-1 ring-line",
      )}
    >
      {item.look && (
        <p className="flex items-center gap-1.5 bg-warning px-5 py-1.5 text-[12.5px] font-semibold text-canvas">
          <TriangleAlert className="size-3.5" aria-hidden /> Needs a look
        </p>
      )}
      <StoryPicture item={item} />
      <div className="px-5 pb-4 pt-3.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
          <span className="font-medium text-ink-2">{item.site}</span>
          <time
            dateTime={date.day}
            title={date.given ? undefined : "The page gives no date: this is the day Sol found it"}
            className={clsx("flex items-center gap-1", date.given ? "text-ink-2" : "text-muted")}
          >
            <CalendarDays className="size-3.5" aria-hidden />
            {date.words}
            <span className="text-muted">· {date.ago}</span>
          </time>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {partOf(item.topic) === "wider" && (
              <span className="rounded-full bg-market/10 px-2 py-0.5 font-medium text-market">{PART_LABELS.wider}</span>
            )}
            {item.hasImage && (
              <span className="rounded-full bg-canvas px-2 py-0.5 text-ink-2 ring-1 ring-line">{NEWS_TOPIC_LABELS[item.topic]}</span>
            )}
            {item.standing && <StandingPill standing={item.standing} />}
          </span>
        </p>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-2 flex items-start gap-1 text-[17px] font-semibold leading-snug text-ink hover:underline"
        >
          <span>{item.headline}</span>
          <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted group-hover:text-ink" aria-hidden />
        </a>
        <p className={clsx("mt-1.5 text-[14px] leading-relaxed text-ink-2", long && !open && "line-clamp-3")}>{item.summary}</p>
        {long && (
          <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-[13px] font-medium text-ink hover:underline">
            {open ? "Less" : "More"}
          </button>
        )}
        {item.standingNote && (
          <p className="mt-2 flex items-start gap-1.5 text-[12.5px] italic text-muted">
            <SolBadge className="mt-0.5 size-3 shrink-0" />
            <span>{item.standingNote}</span>
          </p>
        )}
        {item.systems && (
          <div className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-[13px] text-ink ring-1 ring-line">
            <p className="flex items-center gap-2 font-medium">
              <Home className="size-3.5 shrink-0 text-sun-line" aria-hidden />
              {systemsWords(item.systems)}
            </p>
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {item.systems.deals.map((d) => (
                <Link
                  key={d.jobId}
                  href={`/design/deals/${encodeURIComponent(d.jobId)}`}
                  className="rounded-full bg-surface px-2.5 py-1 text-[12.5px] text-ink ring-1 ring-line hover:ring-ink"
                >
                  {d.customer}
                  <span className="text-muted"> · {d.installed ? "installed" : "sold"}</span>
                </Link>
              ))}
              {item.systems.installed + item.systems.sold > item.systems.deals.length && (
                <span className="px-1 py-1 text-[12.5px] text-muted">
                  and {item.systems.installed + item.systems.sold - item.systems.deals.length} more
                </span>
              )}
            </p>
          </div>
        )}
        {item.lists && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-canvas px-3 py-2 text-[13px] text-ink ring-1 ring-sun-line">
            <PackageSearch className="mt-0.5 size-3.5 shrink-0 text-sun-line" aria-hidden />
            <span>
              <span className="font-medium">{listWords(item.lists)}</span>
              {item.lists.count > 0 && (
                <span className="text-muted">
                  : {item.lists.examples.join(", ")}
                  {item.lists.count > item.lists.examples.length ? "…" : ""}
                </span>
              )}
              {item.lists.count > 0 && item.lists.replaced.length > 0 && (
                <span className="text-muted">. Replaces {item.lists.replaced.join(", ")}</span>
              )}
            </span>
          </p>
        )}
        {item.meaning && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-sun px-3 py-2 text-[13px] text-sun-ink">
            <SolBadge className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="font-medium">{partOf(item.topic) === "wider" ? "Why it's interesting: " : "For you: "}</span>
              {item.meaning}
            </span>
          </p>
        )}
        <Talk
          liked={item.talk?.liked ?? false}
          likes={item.talk?.likes ?? 0}
          comments={item.talk?.comments ?? 0}
          api={{
            like: (like) => likeStory(item.id, like),
            load: () => loadStoryComments(item.id),
            comment: (text) => commentOnStory(item.id, text),
            uncomment: (id) => removeStoryComment(item.id, id),
          }}
        />
      </div>
    </li>
  );
}

/** What moved when one of the business's price lists was saved (its own costs: only for members who see them). */
function PriceMovesCard({ note }: { note: PriceMovesNote }) {
  const m = note.moves;
  return (
    <li className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-line">
      <div className="flex items-center gap-3 bg-kind-order-soft px-5 py-3 text-kind-order">
        <span className="grid size-9 place-items-center rounded-full bg-surface shadow-sm">
          <Receipt className="size-4" aria-hidden />
        </span>
        <span className="text-[13px] font-medium">Your price lists · only your business sees this</span>
      </div>
      <div className="px-5 pb-4 pt-3.5">
        <p className="text-[17px] font-semibold leading-snug text-ink">{priceMovesWords(m)}</p>
        <ul className="mt-2.5 divide-y divide-line text-[13.5px]">
          {m.biggest.map((x) => (
            <li key={x.sku} className="flex items-baseline gap-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-ink">{x.name}</span>
              <span className="tabular-nums text-muted">
                {money(x.was)} → {money(x.now)}
              </span>
              <span className={clsx("w-14 text-right font-medium tabular-nums", x.now > x.was ? "text-warning" : "text-positive")}>
                {moveShare(x)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12.5px] text-muted">
          Against the prices you had before this list, ex GST.
          {m.added > 0 && ` ${m.added} product${m.added === 1 ? " is" : "s are"} new to your lists.`}
          {m.up + m.down > m.biggest.length && ` The ${m.biggest.length} biggest moves are shown.`}
        </p>
      </div>
    </li>
  );
}

/**
 * Most talked about this week (16 Nov 2026: what businesses on RENUABL are liking, saying and voting on), at the top of
 * All; a press takes the reader to it in the feed.
 */
function TalkedAbout({ talked }: { talked: Talked[] }) {
  const go = (id: string) => document.getElementById(`feed-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <section className="mt-5 rounded-2xl bg-surface p-4 ring-1 ring-line" aria-label="Most talked about this week">
      <h3 className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-muted">
        <Flame className="size-3.5 text-sun-line" aria-hidden /> Most talked about this week
      </h3>
      <ol className="mt-2.5 grid gap-1">
        {talked.map((t, i) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => go(t.id)}
              className="flex w-full items-start gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-canvas"
            >
              <span className="mt-0.5 w-4 shrink-0 text-[13px] font-semibold tabular-nums text-sun-line">{i + 1}</span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-[13.5px] font-medium text-ink">{t.title}</span>
                <span className="text-[12px] text-muted">
                  {t.kind === "story" ? "Sol's story" : "Post"} · {talkWords(t)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
