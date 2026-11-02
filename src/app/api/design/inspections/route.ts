import { answer, requireMember } from "@/lib/server/design-context";
import { inspectionsFor, nominatedCount } from "@/lib/server/design-inspections-repo";

/** GET → { inspections } | ?count=1 → { nominated }: the jobs installers have nominated this inspector for. */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (new URL(request.url).searchParams.get("count"))
      return Response.json({ ok: true, nominated: await nominatedCount(who.member.businessId) });
    return Response.json({ ok: true, inspections: await inspectionsFor(who.member.businessId) });
  });
}
