import { marketClosed, marketplaceOpen } from "@/lib/domain/design/marketplace-launch";
import { cleanItemInput } from "@/lib/domain/design/trade";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadPrefs } from "@/lib/server/design-after-sale-repo";
import { createItem, listItems, placeOf, tradeThreads, tradeUnread } from "@/lib/server/design-trade-repo";
import { withWatches } from "@/lib/server/design-market-watch-repo";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET → { items, base }: equipment for sale, this business's own and any it has asked about; `?count=1` → { unread };
 * `?threads=1` → { threads }: every conversation it is in, as seller or buyer (the Marketplace's Messages).
 */
export async function GET(request: Request) {
  if (!marketplaceOpen()) return marketClosed();
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (new URL(request.url).searchParams.get("count") === "1")
      return Response.json({ ok: true, unread: await tradeUnread(who.member.businessId) });
    if (new URL(request.url).searchParams.get("threads") === "1")
      return Response.json({ ok: true, threads: await tradeThreads(who.member.businessId) });
    const [items, prefs] = await Promise.all([listItems(who.member.businessId), loadPrefs(who.member.businessId)]);
    return Response.json({
      ok: true,
      items: await withWatches(who.member, "item", items),
      base: prefs.places.base ? { lat: prefs.places.base.lat, lng: prefs.places.base.lng } : null,
    });
  });
}

/** POST { ...item, place }: puts up spare equipment for sale (photos are added after). Selling speaks for the business: `publish`. */
export async function POST(request: Request) {
  if (!marketplaceOpen()) return marketClosed();
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "trade-list", 60)) return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 8_000);
    if ("refuse" in read) return read.refuse;
    const item = cleanItemInput(read.body);
    if (!item.ok) return Response.json(item, { status: 422 });
    const place = placeOf(read.body.place);
    if (!place.suburb) return Response.json({ ok: false, message: "Say where the equipment is: pick its suburb." }, { status: 422 });
    return Response.json({ ok: true, id: await createItem(who.member, item.value, place) });
  });
}
