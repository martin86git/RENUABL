import { answer, requireMember } from "@/lib/server/design-context";
import { chatThreads, unreadCount } from "@/lib/server/design-chat-repo";

/**
 * GET: the business's conversations a customer has written in, the most
 * recent first, and how many of their lines nobody has seen yet (the number
 * beside Messages). GET ?count=1 answers with the number alone, for the nav.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const unread = await unreadCount(who.member.businessId);
    if (new URL(request.url).searchParams.has("count")) return Response.json({ ok: true, unread });
    return Response.json({ ok: true, unread, threads: await chatThreads(who.member.businessId) });
  });
}
