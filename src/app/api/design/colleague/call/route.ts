import { answer, requireMember } from "@/lib/server/design-context";
import { startWebCall } from "@/lib/server/design-colleague";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST → { publicKey, assistantId, callId }: a call with the team's own assistant in the browser, for the signed-in
 * member. The assistant is made at Vapi for this call alone, its address carrying our reference and secret (never the
 * browser's); the browser gets only Vapi's public key and that assistant's id. Never while viewing as someone.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (who.member.viewedBy) return Response.json({ ok: false, message: "Not while viewing as someone." }, { status: 403 });
    if (!allow(request, "design-colleague-call", 20))
      return Response.json({ ok: false, message: "That's a lot of calls at once. Try again in a minute." }, { status: 429 });
    const started = await startWebCall(who.member);
    if (!started.ok) return Response.json(started, { status: 409 });
    return Response.json(started);
  });
}
