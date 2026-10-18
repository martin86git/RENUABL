import { FOLLOW_UP_DAYS } from "@/lib/domain/design/proposal-lists";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { markFollowUp } from "@/lib/server/design-after-sale-repo";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);

/** POST { day, how }: a proposal's follow-up done, called or emailed. Kept once, and written on the deal's record. */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/follow-up">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const day = read.body.day;
    const how = read.body.how;
    if (
      !validId(id) ||
      typeof day !== "number" ||
      !(FOLLOW_UP_DAYS as readonly number[]).includes(day) ||
      (how !== "call" && how !== "email")
    )
      return Response.json({ ok: false, message: "Couldn't be saved. Try again." }, { status: 422 });
    const done = await markFollowUp(who.member.businessId, id, day, how, who.member.email);
    if (done === "missing") return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    return Response.json({ ok: true });
  });
}
