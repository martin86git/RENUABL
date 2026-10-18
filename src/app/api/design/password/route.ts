import { passwordProblem } from "@/lib/domain/design/password";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { hasPassword, setPassword } from "@/lib/server/design-passwords";

/** GET: whether the signed-in person has a password. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, hasPassword: await hasPassword(who.member.email) });
  });
}

/** PUT { password }: sets (or changes) the signed-in person's own password. Only ever for the email they are signed in with. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const problem = passwordProblem(read.body.password);
    if (problem) return Response.json({ ok: false, message: problem }, { status: 422 });
    await setPassword(who.member.email, read.body.password as string);
    return Response.json({ ok: true, hasPassword: true });
  });
}
