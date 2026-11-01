import { marketClosed, marketplaceOpen } from "@/lib/domain/design/marketplace-launch";
import { cleanListingInput } from "@/lib/domain/design/marketplace";
import { todayInMarket } from "@/lib/domain/market";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadPrefs } from "@/lib/server/design-after-sale-repo";
import { createListing, listListings } from "@/lib/server/design-marketplace-repo";
import { allow } from "@/lib/server/rate-limit";

/** GET → { listings, base }: every open listing, this business's own and those it bid on; and its base, for distance. */
export async function GET() {
  if (!marketplaceOpen()) return marketClosed();
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const [listings, prefs] = await Promise.all([listListings(who.member.businessId), loadPrefs(who.member.businessId)]);
    return Response.json({
      ok: true,
      listings,
      base: prefs.places.base ? { lat: prefs.places.base.lat, lng: prefs.places.base.lng } : null,
    });
  });
}

/**
 * POST { jobId, notes, from, to, guide, openFor }: lists one of the business's sold jobs. What other businesses see is
 * built on the server from the job (suburb, system, dates); the words are scrubbed of contact details and addresses.
 */
export async function POST(request: Request) {
  if (!marketplaceOpen()) return marketClosed();
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "marketplace-list", 30))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 5_000);
    if ("refuse" in read) return read.refuse;
    const jobId = typeof read.body.jobId === "string" ? read.body.jobId.slice(0, 80) : "";
    const input = cleanListingInput(read.body, todayInMarket());
    if (!input.ok) return Response.json(input, { status: 422 });
    const made = await createListing(who.member, jobId, input);
    return made.ok
      ? Response.json({ ok: true, id: made.id })
      : Response.json({ ok: false, message: made.message }, { status: made.status });
  });
}
