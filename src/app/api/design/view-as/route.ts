import { cookies } from "next/headers";
import { normaliseEmail } from "@/lib/domain/accounts";
import { VIEW_AS_COOKIE, mayViewAs } from "@/lib/domain/design/view-as";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { memberByEmail } from "@/lib/server/design-repo";

const cookie = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 };

/** POST { email }: the owner opens the product as another member of their business sees it (read only). */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    if (who.member.viewedBy) return Response.json({ ok: false, message: "Go back to your own view first." }, { status: 409 });
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const email = normaliseEmail(read.body.email);
    const other = email ? await memberByEmail(email) : null;
    if (!mayViewAs(who.member, other)) return Response.json({ ok: false, message: "That person isn't in your business." }, { status: 404 });
    (await cookies()).set(VIEW_AS_COOKIE, other!.email, cookie);
    return Response.json({ ok: true });
  });
}

/** DELETE: back to your own view. Always allowed, signed in or not. */
export async function DELETE() {
  (await cookies()).delete(VIEW_AS_COOKIE);
  return Response.json({ ok: true });
}
