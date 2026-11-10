import { cleanCommentText, cleanReason } from "@/lib/domain/design/feed-posts";
import { answer, requireMember } from "@/lib/server/design-context";
import {
  addComment,
  keepPost,
  listComments,
  readerOf,
  removeComment,
  removePost,
  reportPost,
  setLike,
} from "@/lib/server/design-feed-posts-repo";
import { tellStaff } from "@/lib/server/design-staff-note";
import { staffBehind } from "@/lib/server/design-staff-view";
import { allow } from "@/lib/server/rate-limit";

const isStaff = async () => Boolean(await staffBehind().catch(() => null));
const ok = (body: object = {}) => Response.json({ ok: true, ...body });
const notFound = () => Response.json({ ok: false, message: "That post isn't there any more." }, { status: 404 });
const refuse = (status: number, message: string) => Response.json({ ok: false, message }, { status });
const validId = (id: string) => /^post_[0-9a-f]{16}$/.test(id);

/** GET → { comments }: a post's comments, while the reader may see it. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/posts/[id]">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const comments = validId(id) ? await listComments(id, readerOf(who.member, await isStaff())) : null;
    return comments ? ok({ comments }) : notFound();
  });
}

/**
 * POST { do: like | unlike | comment (text) | uncomment (comment) | report (reason) | remove | keep }: what a member does
 * to a post. Remove is its writer, their business's owner or staff; keep (clearing its reports) is staff only.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/posts/[id]">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    if (!validId(id)) return notFound();
    if (who.member.viewedBy) return refuse(403, "Not while viewing as someone.");
    const body = (await request.json().catch(() => ({}))) as { do?: string; text?: unknown; comment?: unknown; reason?: unknown };
    const staff = await isStaff();
    const reader = readerOf(who.member, staff);
    switch (body.do) {
      case "like":
      case "unlike":
        return (await setLike(id, reader, body.do === "like")) ? ok() : notFound();
      case "comment": {
        if (!allow(request, "feed-comment", 120)) return refuse(429, "Too many comments this hour.");
        const text = cleanCommentText(body.text);
        if (!text) return refuse(400, "Write a comment first.");
        return (await addComment(id, who.member, reader, text)) ? ok() : notFound();
      }
      case "uncomment":
        return typeof body.comment === "string" && (await removeComment(id, body.comment, reader))
          ? ok()
          : refuse(403, "That comment can't be removed.");
      case "report": {
        if (!allow(request, "feed-report", 30)) return refuse(429, "Too many reports this hour.");
        const reason = cleanReason(body.reason);
        const done = await reportPost(id, reader, reason);
        if (!done) return refuse(400, "That post can't be reported.");
        if (done.first || done.hidden)
          await tellStaff({
            subject: done.hidden ? "A post in the industry feed is hidden after reports" : "A post in the industry feed was reported",
            text: `A post (${id}) was reported${reason ? `: ${reason}` : "."}${done.hidden ? "\nIt is now hidden until staff look at it." : ""}\nReview it on Today's News tab under Reported.`,
          }).catch(() => false);
        return ok({ hidden: done.hidden });
      }
      case "remove":
        return (await removePost(id, reader)) ? ok() : refuse(403, "That post isn't yours to remove.");
      case "keep":
        if (!staff) return notFound();
        await keepPost(id);
        return ok();
      default:
        return refuse(400, "Say what to do.");
    }
  });
}
