import { cleanProfile } from "@/lib/domain/design/profile";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { saveProfile } from "@/lib/server/design-repo";
import { setPassword } from "@/lib/server/design-passwords";

/**
 * POST { firstName, lastName, mobile?, password? }: About you, given once after signing in (profile.ts). Only ever the
 * signed-in person's own row; a password, when given, is set for the email they are signed in with.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 4_000);
    if ("refuse" in read) return read.refuse;
    const clean = cleanProfile(read.body);
    if (!clean.ok) return Response.json({ ok: false, message: clean.message }, { status: 422 });
    await saveProfile(who.member.businessId, who.member.email, clean.profile);
    if (clean.password) await setPassword(who.member.email, clean.password);
    return Response.json({ ok: true });
  });
}
