import { answer, requireMember } from "@/lib/server/design-context";
import { rememberSignInPage, renewSignInPage, signInPageOf } from "@/lib/server/design-sign-in-page";

/** GET: the business's own sign-in address (made the first time), for anyone in it to share with the team. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { member } = who;
    return Response.json({ ok: true, path: await signInPageOf(member.businessId, member.businessName, member.email) });
  });
}

/** POST: the owner makes a new address in place of the old one, which stops working. */
export async function POST() {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const { member } = who;
    if (member.viewedBy) return Response.json({ ok: false, message: "Go back to your own view first." }, { status: 409 });
    const path = await renewSignInPage(member.businessId, member.businessName, member.email);
    await rememberSignInPage(path);
    return Response.json({ ok: true, path });
  });
}
