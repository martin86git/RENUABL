import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { addExampleDeals, clearExampleDeals, exampleCount } from "@/lib/server/design-feed";

/**
 * POST { do: "add" | "clear" }: puts the example deals (example-deals.ts) into a made-up business, or takes them away.
 * Refused for a real business: only one whose owner's email ends ".example" may have them.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if ((await exampleCount(who.member.businessId)) === null)
      return Response.json({ ok: false, message: "Example deals are only for made-up businesses." }, { status: 403 });
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    if (read.body.do === "clear") await clearExampleDeals(who.member.businessId);
    else await addExampleDeals(who.member.businessId);
    return Response.json({ ok: true, examples: await exampleCount(who.member.businessId) });
  });
}
