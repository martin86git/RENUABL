"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowUpRight, BadgeCheck, CircleHelp, Newspaper, PackageSearch } from "lucide-react";
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
import { SolBadge } from "./sol-icon";

const dayWords = (d: string) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00Z`));

const readWords = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: "Australia/Melbourne" });

/**
 * News on Today (10 Nov 2026, Martin, on learning SolarEdge had left Australia): the solar, battery and EV charger news
 * Sol reads each morning, every story in his words with one line on what it means for the business, linked to where it
 * came from. By topic, grouped by day.
 */
export function NewsPage() {
  const [data, setData] = useState<NewsAnswer | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [topic, setTopic] = useState<NewsTopic | "all">("all");

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

  const today = todayInMarket();
  const shown = data ? newsShown(data.items, topic) : [];
  const groups: { day: string; items: NewsItem[] }[] = [];
  for (const n of shown) {
    const day = newsDayGroup(n, today);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(n);
    else groups.push({ day, items: [n] });
  }
  const topics = NEWS_TOPICS.filter((t) => data?.items.some((n) => n.topic === t));
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

      {topics.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Topic">
          {(["all", ...topics] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(t)}
              aria-pressed={topic === t}
              className={clsx(
                "rounded-full px-3 py-1.5 text-[13px] ring-1 transition",
                topic === t ? "bg-primary text-primary-ink ring-primary" : "bg-surface text-ink-2 ring-line hover:text-ink",
              )}
            >
              {t === "all" ? "All" : NEWS_TOPIC_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {touching > 0 && (
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

      {data && !data.configured && data.items.length === 0 && (
        <p className="mt-6 rounded-2xl bg-surface px-4 py-3 text-[13px] text-ink-2 ring-1 ring-line">
          The news isn&apos;t set up on this site yet: Sol needs Claude (ANTHROPIC_API_KEY) to read it.
        </p>
      )}

      {data && data.missed && !data.reading && (
        <p className="mt-4 rounded-2xl bg-surface px-4 py-3 text-[13px] text-ink-2 ring-1 ring-line">
          Sol couldn&apos;t read the news on his last try. He&apos;ll try again within the hour.
        </p>
      )}

      {data && data.configured && shown.length === 0 && (
        <div className="mt-16 text-center">
          <Newspaper className={clsx("mx-auto size-6 text-muted", data.reading && "animate-pulse")} aria-hidden />
          <p className="mt-3 text-[15px] text-ink">{data.reading ? "Reading the news…" : "No news yet."}</p>{" "}
          <p className="mt-1 text-[13px] text-muted">
            {data.reading
              ? "This takes a minute or two. Stories appear here as soon as Sol has them."
              : "Stories show here after Sol's morning read."}
          </p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.day} className="mt-6">
          <h3 className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">{g.day}</h3>
          <ul className="mt-2 grid gap-2">
            {g.items.map((n) => (
              <Story key={n.id} item={n} />
            ))}
          </ul>
        </section>
      ))}

      {shown.length > 0 && (
        <p className="mt-8 text-[12px] text-muted">Written by Sol from the pages linked. Check the source before acting on a story.</p>
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

function Story({ item }: { item: NewsItem }) {
  return (
    <li className="rounded-2xl bg-surface px-4 py-3.5 ring-1 ring-line">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
        <span className="rounded-full bg-canvas px-2 py-0.5 text-ink-2 ring-1 ring-line">{NEWS_TOPIC_LABELS[item.topic]}</span>
        {item.standing && <StandingPill standing={item.standing} />}
        <span>{item.site}</span>
        {item.publishedOn && <span>· {dayWords(item.publishedOn)}</span>}
      </p>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group mt-1.5 flex items-start gap-1 text-[15px] font-medium leading-snug text-ink hover:underline"
      >
        <span>{item.headline}</span>
        <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted group-hover:text-ink" aria-hidden />
      </a>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{item.summary}</p>
      {item.standingNote && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] italic text-muted">
          <SolBadge className="mt-0.5 size-3 shrink-0" />
          <span>{item.standingNote}</span>
        </p>
      )}
      {item.mine && (
        <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-canvas px-3 py-2 text-[13px] text-ink ring-1 ring-sun-line">
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
        <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-sun px-3 py-2 text-[13px] text-sun-ink">
          <SolBadge className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <span className="font-medium">For you: </span>
            {item.meaning}
          </span>
        </p>
      )}
    </li>
  );
}
