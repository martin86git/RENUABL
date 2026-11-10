"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  ArrowUpRight,
  BadgeCheck,
  BadgePercent,
  BatteryCharging,
  Building2,
  CircleHelp,
  Cpu,
  Newspaper,
  PackageSearch,
  Scale,
  UtilityPole,
} from "lucide-react";
import {
  NEWS_STANDING_LABELS,
  NEWS_TOPICS,
  type NewsStanding,
  NEWS_TOPIC_LABELS,
  newsDayGroup,
  newsShown,
  onYourListsWords,
  type NewsItem,
  type NewsTopic,
} from "@/lib/domain/design/industry-news";
import { todayInMarket } from "@/lib/domain/market";
import { loadNews, type NewsAnswer } from "@/lib/services/industry-news";
import { mergeFeed, type FeedEntry, type FeedPost } from "@/lib/domain/design/feed-posts";
import { loadPosts } from "@/lib/services/feed-posts";
import { PostCard, PostComposer } from "./feed-posts";
import { SolBadge } from "./sol-icon";

const dayWords = (d: string) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00Z`));

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
  const [filter, setFilter] = useState<NewsTopic | "all" | "posts" | "reported">("all");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let gone = false;
    let timer = 0;
    const go = () =>
      void loadNews().then((r) => {
        if (gone) return;
        if (!r.ok) return setProblem(r.message);
        setProblem(null);
        setData({ items: r.items, readAt: r.readAt, reading: r.reading, configured: r.configured, missed: r.missed });
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
  const stories = data && filter !== "posts" && filter !== "reported" ? newsShown(data.items, filter === "all" ? "all" : filter) : [];
  const shownPosts = filter === "all" || filter === "posts" || filter === "reported" ? posts : [];
  const entries = mergeFeed(stories, shownPosts);
  const groups: { day: string; entries: FeedEntry[] }[] = [];
  for (const e of entries) {
    const day = e.kind === "story" ? newsDayGroup(e.item, today) : newsDayGroup({ publishedOn: null, foundAt: e.post.at }, today);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.entries.push(e);
    else groups.push({ day, entries: [e] });
  }
  const topics = NEWS_TOPICS.filter((t) => data?.items.some((n) => n.topic === t));
  const chips: { id: typeof filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "posts", label: "Posts" },
    ...topics.map((t) => ({ id: t, label: NEWS_TOPIC_LABELS[t] })),
    ...(staff ? [{ id: "reported" as const, label: "Reported" }] : []),
  ];
  const touching = data?.items.filter((n) => n.mine).length ?? 0;

  return (
    <div className="mx-auto w-full max-w-3xl pb-10">
      <div className="flex items-start gap-3">
        <SolBadge className="mt-0.5 size-6 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink">Industry news</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {data?.reading
              ? "Sol is reading this morning's solar news…"
              : data?.readAt
                ? `Sol reads the solar news each morning. Last read ${readWords(data.readAt)}.`
                : "Sol reads the solar news each morning: companies, rebates, rules, networks and new products."}
          </p>
        </div>
      </div>

      <div className="mt-4">
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
            aria-pressed={filter === c.id}
            className={clsx(
              "rounded-full px-3 py-1.5 text-[13px] ring-1 transition",
              filter === c.id ? "bg-primary text-primary-ink ring-primary" : "bg-surface text-ink-2 ring-line hover:text-ink",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {touching > 0 && filter !== "posts" && filter !== "reported" && (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-ink">
          <PackageSearch className="size-4 text-sun-line" aria-hidden />
          {touching === 1 ? "One story names" : `${touching} stories name`} a maker on your price lists. They&apos;re marked below.
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
            {filter === "posts" || filter === "reported"
              ? filter === "reported"
                ? "Nothing reported."
                : "No posts yet."
              : data.reading
                ? "Reading the news…"
                : "No news yet."}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {filter === "posts"
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
              ) : (
                <PostCard key={e.post.id} post={e.post} staff={staff} onChange={refresh} />
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
  companies: { icon: Building2, soft: "bg-kind-approvals-soft", ink: "text-kind-approvals" },
  rebates: { icon: BadgePercent, soft: "bg-kind-order-soft", ink: "text-kind-order" },
  rules: { icon: Scale, soft: "bg-kind-message-soft", ink: "text-kind-message" },
  networks: { icon: UtilityPole, soft: "bg-kind-lead-soft", ink: "text-kind-lead" },
  products: { icon: BatteryCharging, soft: "bg-kind-install-soft", ink: "text-kind-install" },
  technology: { icon: Cpu, soft: "bg-kind-date-soft", ink: "text-kind-date" },
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
  const art = TOPIC_ART[item.topic];
  const Icon = art.icon;
  return (
    <div aria-hidden className={clsx("relative flex h-24 items-center overflow-hidden px-5", art.soft)}>
      <Icon className={clsx("absolute -right-3 -top-4 size-36 opacity-15", art.ink)} strokeWidth={1.2} />
      <Icon className={clsx("absolute right-36 top-12 size-10 opacity-10", art.ink)} strokeWidth={1.2} />
      <span className={clsx("grid size-11 place-items-center rounded-full bg-surface shadow-sm", art.ink)}>
        <Icon className="size-5" />
      </span>
      <span className={clsx("ml-3 text-[13px] font-medium", art.ink)}>{NEWS_TOPIC_LABELS[item.topic]}</span>
    </div>
  );
}

function Story({ item }: { item: NewsItem }) {
  const [open, setOpen] = useState(false);
  const long = item.summary.length > 240;
  return (
    <li className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-line">
      <StoryPicture item={item} />
      <div className="px-5 pb-4 pt-3.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
          <span className="font-medium text-ink-2">{item.site}</span>
          {item.publishedOn && <span>· {dayWords(item.publishedOn)}</span>}
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
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
        {item.mine && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-canvas px-3 py-2 text-[13px] text-ink ring-1 ring-sun-line">
            <PackageSearch className="mt-0.5 size-3.5 shrink-0 text-sun-line" aria-hidden />
            <span>
              <span className="font-medium">{onYourListsWords(item.mine)}</span>
              <span className="text-muted">
                : {item.mine.examples.join(", ")}
                {item.mine.count > item.mine.examples.length ? "…" : ""}
              </span>
            </span>
          </p>
        )}
        {item.meaning && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-sun px-3 py-2 text-[13px] text-sun-ink">
            <SolBadge className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="font-medium">For you: </span>
              {item.meaning}
            </span>
          </p>
        )}
      </div>
    </li>
  );
}
