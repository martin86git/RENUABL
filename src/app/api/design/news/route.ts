import { after } from "next/server";
import { can } from "@/lib/domain/design/account";
import { NEWS_DAYS, partOf } from "@/lib/domain/design/industry-news";
import { inTheirSystems, needsALook, onTheLists } from "@/lib/domain/design/product-watch";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { loadLists } from "@/lib/server/design-repo";
import { dealKits, recentPriceMoves } from "@/lib/server/design-product-watch";
import { readerOf } from "@/lib/server/design-feed-posts-repo";
import { staffBehind } from "@/lib/server/design-staff-view";
import { storyTalk } from "@/lib/server/design-story-talk-repo";
import { fillPictures, newsFeed, newsReadingsDue, picturesDue, readTheNews } from "@/lib/server/industry-news";

// A morning's reading started from here runs after the answer and can take a few minutes.
export const maxDuration = 300;

/**
 * GET → NewsFeed: the industry news on Today's News tab (domain/design/industry-news.ts), the same for every business.
 * Each story is set against this business's own price lists (`lists`: its products the story names by model, else by maker; names only, never a
 * cost) and the systems on its sold and installed deals that this member may see (`systems`), and marked `look` when a
 * recall, delisting, maker notice or maker leaving touches it (product-watch.ts). Members who see costs also get the
 * business's own price moves (`priceMoves`). When the morning's reading hasn't happened (no cron locally, or it failed),
 * one starts after the answer and the answer says it is reading.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const m = who.member;
    const dueParts = await newsReadingsDue();
    const due = dueParts.includes("solar");
    for (const part of dueParts)
      after(() => readTheNews(false, part).catch((e) => console.error("industry news failed", part, e instanceof Error ? e.message : e)));
    // Stories kept before pictures were looked for (or whose look failed to finish) get theirs after the answer.
    if (!dueParts.length && (await picturesDue())) after(() => fillPictures().catch(() => undefined));
    // Only a retailer has deals (an installer's or inspector's login has none to read).
    const retailer = !m.businessKind || m.businessKind === "retailer";
    const seesCosts = can(m.role, "costs", m.permissions);
    const feed = await newsFeed();
    const staff = Boolean(await staffBehind().catch(() => null));
    const [lists, kits, moves, talk] = await Promise.all([
      loadLists(m.businessId).catch(() => []),
      retailer ? dealKits(m.businessId, viewerOf(m)).catch(() => []) : Promise.resolve([]),
      seesCosts ? recentPriceMoves(m.businessId, NEWS_DAYS).catch(() => []) : Promise.resolve([]),
      storyTalk(
        feed.items.map((n) => n.id),
        readerOf(m, staff),
      ).catch(() => new Map()),
    ]);
    const products = lists.flatMap((l) => [...l.items, ...l.panels, ...l.inverters, ...l.batteries, ...(l.chargers ?? [])]);
    const items = feed.items.map((one) => {
      const n = { ...one, talk: talk.get(one.id) ?? { likes: 0, liked: false, comments: 0 } };
      // Beyond solar is read for interest: never matched to the business's lists or customers ("Tesla" robotaxis aren't its Powerwalls).
      if (partOf(n.topic) === "wider") return { ...n, lists: null, systems: null, look: false };
      const onLists = onTheLists(n, products);
      const systems = inTheirSystems(n, kits);
      return {
        ...n,
        lists: onLists,
        systems,
        look: needsALook(n, systems, onLists),
      };
    });
    return Response.json({ ok: true, ...feed, items, priceMoves: moves, reading: feed.reading || due });
  });
}
