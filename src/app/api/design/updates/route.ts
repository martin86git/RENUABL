import { newestDay, unseenUpdates } from "@/lib/domain/design/updates";
import { answer, requireMember } from "@/lib/server/design-context";
import { markUpdatesSeen, updatesSeen } from "@/lib/server/design-feedback-repo";

/** GET → { unseen }: how many updates came in since this member last opened them. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, unseen: unseenUpdates(await updatesSeen(who.member.businessId, who.member.email)) });
  });
}

/** POST: this member has opened Updates (marks the newest day seen). */
export async function POST() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const day = newestDay();
    if (day) await markUpdatesSeen(who.member.businessId, who.member.email, day);
    return Response.json({ ok: true, unseen: 0 });
  });
}
