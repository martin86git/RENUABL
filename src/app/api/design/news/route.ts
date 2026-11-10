import { after } from "next/server";
import { onYourLists } from "@/lib/domain/design/industry-news";
import { answer, requireMember } from "@/lib/server/design-context";
import { loadLists } from "@/lib/server/design-repo";
import { newsFeed, newsReadingDue, readTheNews } from "@/lib/server/industry-news";

// A morning's reading started from here runs after the answer and can take a few minutes.
export const maxDuration = 300;

/**
 * GET → NewsFeed: the industry news on Today's News tab (domain/design/industry-news.ts), the same for every business.
 * Each story carries this business's own products that name its makers (`mine`: names only, never a cost).
 * When the morning's reading hasn't happened (no cron locally, or it failed), one starts after the answer and the
 * answer says it is reading.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const due = await newsReadingDue();
    if (due) after(() => readTheNews().catch((e) => console.error("industry news failed", e instanceof Error ? e.message : e)));
    const [feed, lists] = await Promise.all([newsFeed(), loadLists(who.member.businessId).catch(() => [])]);
    // The makers a story names, set against this business's own price lists (product names only, never a cost).
    const products = lists.flatMap((l) => [...l.items, ...l.panels, ...l.inverters, ...l.batteries, ...(l.chargers ?? [])]);
    const items = feed.items.map((n) => ({ ...n, mine: n.brands.length ? onYourLists(n.brands, products) : null }));
    return Response.json({ ok: true, ...feed, items, reading: feed.reading || due });
  });
}
