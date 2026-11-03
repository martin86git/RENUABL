import { marketClosed, marketplaceOpen } from "@/lib/domain/design/marketplace-launch";
import { cleanBidInput } from "@/lib/domain/design/marketplace";
import { todayInMarket } from "@/lib/domain/market";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { awardBid, listingDetail, placeBid, withdrawBid, withdrawListing } from "@/lib/server/design-marketplace-repo";
import { withWatches } from "@/lib/server/design-market-watch-repo";
import type { ListingDetail } from "@/lib/server/design-marketplace-repo";
import { allow } from "@/lib/server/rate-limit";

/** The listing with how many are watching it and whether this person is. */
const watched = async (who: { businessId: string; email: string }, d: ListingDetail) => ({
  ...d,
  listing: (await withWatches(who, "listing", [d.listing]))[0],
});

const missing = () => Response.json({ ok: false, message: "That listing isn't there any more." }, { status: 404 });

/** GET → the listing as this business may see it: the poster gets every bid, and once awarded both get the handover. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/marketplace/[id]">) {
  if (!marketplaceOpen()) return marketClosed();
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const detail = await listingDetail(who.member.businessId, id.slice(0, 80));
    return detail ? Response.json({ ok: true, ...(await watched(who.member, detail)) }) : missing();
  });
}

/**
 * POST { do: "bid", amount, start, note } | { do: "withdraw-bid" } | { do: "award", bidId } | { do: "withdraw" }.
 * Bidding and choosing a bid commit the business, so they need the publish permission.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/marketplace/[id]">) {
  if (!marketplaceOpen()) return marketClosed();
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const { id: raw } = await ctx.params;
    const id = raw.slice(0, 80);
    if (!allow(request, "marketplace-act", 120))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 3_000);
    if ("refuse" in read) return read.refuse;
    const b = read.body;
    if (b.do === "bid") {
      const bid = cleanBidInput(b, todayInMarket());
      if (!bid.ok) return Response.json(bid, { status: 422 });
      const done = await placeBid(who.member, id, bid);
      if (!done.ok) return Response.json({ ok: false, message: done.message }, { status: done.status });
    } else if (b.do === "withdraw-bid") {
      if (!(await withdrawBid(who.member.businessId, id)))
        return Response.json({ ok: false, message: "There's no open bid to take back." }, { status: 409 });
    } else if (b.do === "award") {
      const done = await awardBid(who.member, id, typeof b.bidId === "string" ? b.bidId.slice(0, 80) : "");
      if (!done.ok) return Response.json({ ok: false, message: done.message }, { status: done.status });
    } else if (b.do === "withdraw") {
      if (!(await withdrawListing(who.member.businessId, id)))
        return Response.json({ ok: false, message: "Only an open listing of yours can be taken down." }, { status: 409 });
    } else return Response.json({ ok: false, message: "That couldn't be read." }, { status: 400 });
    const detail = await listingDetail(who.member.businessId, id);
    return detail ? Response.json({ ok: true, ...(await watched(who.member, detail)) }) : missing();
  });
}
