import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { winnableJobs } from "@/lib/server/design-feed-social-repo";

/**
 * GET → { jobs }: the business's installed jobs this member may see that haven't been shared as a win (feed-social.ts).
 * Only a retailer has jobs of its own; anyone else gets none.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const m = who.member;
    const retailer = !m.businessKind || m.businessKind === "retailer";
    return Response.json({ ok: true, jobs: retailer ? await winnableJobs(m, viewerOf(m)) : [] });
  });
}
