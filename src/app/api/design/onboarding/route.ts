import { answer, requireMember } from "@/lib/server/design-context";
import { markWelcomed } from "@/lib/server/design-repo";

/** POST: the signed-in person has been through the welcome on Today, or skipped it (welcome.ts). Only their own row. */
export async function POST() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    await markWelcomed(who.member.businessId, who.member.email);
    return Response.json({ ok: true });
  });
}
