import { answer, requireMember } from "@/lib/server/design-context";
import { readerOf } from "@/lib/server/design-feed-posts-repo";
import { feedBusiness } from "@/lib/server/design-feed-social-repo";
import { staffBehind } from "@/lib/server/design-staff-view";

/**
 * GET → { business }: a business's page in the industry feed (17 Nov 2026, domain/design/feed-social.ts), reached from
 * its posts by its directory key: its name and kind, its suburb only when it lists itself, its posts, whether the
 * reader follows it and where the reader's business stands with it (Connect).
 */
export async function GET(_request: Request, ctx: { params: Promise<{ key: string }> }) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { key } = await ctx.params;
    if (!/^[a-f0-9]{24}$/.test(key)) return Response.json({ ok: false, message: "That business isn't on RENUABL." }, { status: 404 });
    const staff = Boolean(await staffBehind().catch(() => null));
    const business = await feedBusiness(readerOf(who.member, staff), key);
    return business
      ? Response.json({ ok: true, business })
      : Response.json({ ok: false, message: "That business isn't on RENUABL." }, { status: 404 });
  });
}
