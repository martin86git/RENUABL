import { favouriteCode, isFavouriteKind } from "@/lib/domain/design/favourites";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { favouritesOf, setFavourite } from "@/lib/server/design-draft-repo";

/**
 * The signed-in person's favourite products in the designer (domain/design/favourites.ts). GET: their favourites.
 * POST { kind, sku, on }: star a panel, inverter, battery or EV charger, or take its star off. Each person's own.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, favourites: await favouritesOf(who.member.businessId, who.member.email) });
  });
}

export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const sku = favouriteCode(read.body.sku);
    if (!isFavouriteKind(read.body.kind) || !sku)
      return Response.json({ ok: false, message: "That product couldn't be read." }, { status: 400 });
    const favourites = await setFavourite(who.member.businessId, who.member.email, read.body.kind, sku, read.body.on === true);
    return Response.json({ ok: true, favourites });
  });
}
