import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { mailMarks } from "@/lib/server/design-pulse-repo";

/** GET → { marks }: for each deal this member may see that an email has gone from, how many went and whether the latest was opened. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, marks: await mailMarks(who.member.businessId, viewerOf(who.member)) });
  });
}
