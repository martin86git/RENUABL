"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Newspaper } from "lucide-react";
import { NEWS_TOPIC_LABELS, newsShown, type NewsItem } from "@/lib/domain/design/industry-news";
import { loadNews } from "@/lib/services/industry-news";

/** How many of the newest stories Today shows. */
const SHOWN = 3;

/**
 * From the industry, at the foot of Today (10 Nov 2026, Martin: Today lost its tabs, and News is part of the platform's
 * future, so it is seen every morning without a press): the newest stories Sol has read, each to its source, with All news
 * opening the whole feed at /design/news. Nothing is shown until there is a story.
 */
export function TodayNews() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  useEffect(() => {
    let gone = false;
    void loadNews().then((r) => !gone && r.ok && setItems(newsShown(r.items, "all").slice(0, SHOWN)));
    return () => {
      gone = true;
    };
  }, []);
  if (!items?.length) return null;
  return (
    <section className="mt-8" aria-label="From the industry">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-market">
          <Newspaper className="size-4" aria-hidden /> From the industry
        </h2>
        <p className="text-[12.5px] text-muted">What Sol read this morning.</p>
        <Link href="/design/news" className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
          All news <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((n) => (
          <a
            key={n.id}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line transition hover:ring-ink-2"
          >
            {n.hasImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/design/news/${encodeURIComponent(n.id)}/image`} alt="" loading="lazy" className="h-28 w-full object-cover" />
            )}
            <div className="flex flex-1 flex-col gap-1.5 p-3.5">
              <p className="text-[11.5px] text-muted">
                {NEWS_TOPIC_LABELS[n.topic]} · {n.site}
              </p>
              <p className="text-[14px] font-medium leading-snug text-ink">{n.headline}</p>
              <p className="line-clamp-2 text-[12.5px] leading-snug text-ink-2">{n.meaning}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
