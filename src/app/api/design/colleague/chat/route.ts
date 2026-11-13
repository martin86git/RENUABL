import { cleanChatHistory, cleanChatText } from "@/lib/domain/design/colleague-chat";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { chatWithColleague } from "@/lib/server/design-colleague-chat";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 120;

/**
 * POST { text, history } → { text }: a written question for the team's own assistant, its chief of staff, answered from
 * the signed-in member's deals (the ones they may see) with reading-only tools. The conversation so far comes from the
 * member's own browser and is cleaned; nothing is kept here. Never while viewing as someone.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (who.member.viewedBy) return Response.json({ ok: false, message: "Not while viewing as someone." }, { status: 403 });
    if (!allow(request, "design-colleague-chat", 120))
      return Response.json({ ok: false, message: "That's a lot of questions at once. Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 80_000);
    if ("refuse" in read) return read.refuse;
    const clean = cleanChatText(read.body.text);
    if (!clean.ok) return Response.json({ ok: false, message: clean.message }, { status: 422 });
    const said = await chatWithColleague(who.member, clean.text, cleanChatHistory(read.body.history));
    if (!said.ok) return Response.json({ ok: false, message: said.message }, { status: said.status });
    return Response.json({ ok: true, text: said.text }, { headers: { "cache-control": "private, no-store" } });
  });
}
