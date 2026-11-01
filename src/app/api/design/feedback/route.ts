import { can } from "@/lib/domain/design/account";
import { cleanComment, cleanFeedback } from "@/lib/domain/design/feedback";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { addFeedback, addFeedbackComment, listFeedback, removeFeedback, setFeedbackDone } from "@/lib/server/design-feedback-repo";
import { allow } from "@/lib/server/rate-limit";

/** GET → { items, owner }: the business's feedback, and whether this member may tick items off. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({
      ok: true,
      items: await listFeedback(who.member.businessId),
      owner: can(who.member.role, "members", who.member.permissions),
    });
  });
}

/**
 * POST { do: "add", kind, text } | { do: "comment", id, text } | { do: "done", id, done } | { do: "remove", id }.
 * Anyone in the business adds and comments; only the owner ticks off; the person who raised it or the owner removes.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-feedback", 120))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 6_000);
    if ("refuse" in read) return read.refuse;
    const b = read.body;
    const { businessId, email } = who.member;
    const owner = can(who.member.role, "members", who.member.permissions);
    const id = typeof b.id === "string" ? b.id.slice(0, 40) : "";
    const missing = () => Response.json({ ok: false, message: "That item isn't there any more." }, { status: 404 });
    if (b.do === "add") {
      const item = cleanFeedback(b);
      if (!item.ok) return Response.json(item, { status: 422 });
      await addFeedback(businessId, email, item);
    } else if (b.do === "comment") {
      const text = cleanComment(b.text);
      if (!text) return Response.json({ ok: false, message: "Write a comment first." }, { status: 422 });
      if (!(await addFeedbackComment(businessId, id, email, text))) return missing();
    } else if (b.do === "done") {
      if (!owner) return Response.json({ ok: false, message: "Only the owner of the business ticks items off." }, { status: 403 });
      if (!(await setFeedbackDone(businessId, id, b.done === true, email))) return missing();
    } else if (b.do === "remove") {
      if (!(await removeFeedback(businessId, id, email, owner))) return missing();
    } else return Response.json({ ok: false, message: "That couldn't be read." }, { status: 400 });
    return Response.json({ ok: true, items: await listFeedback(businessId), owner });
  });
}
