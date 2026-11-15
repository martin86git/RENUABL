import { answer, requireMember } from "@/lib/server/design-context";
import { strayTexts, textsOnFor } from "@/lib/server/design-texts";

/**
 * GET → the latest texts that came in from numbers on no customer's record (domain/design/texts.ts), so none is lost.
 * They name no deal, so any member of the business reads them; empty where texts aren't on for the business.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const texts = (await textsOnFor(who.member.businessId)) ? await strayTexts(who.member.businessId) : [];
    return Response.json({ ok: true, texts }, { headers: { "cache-control": "private, no-store" } });
  });
}
