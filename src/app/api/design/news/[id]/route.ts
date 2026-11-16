import { cleanCommentText } from "@/lib/domain/design/feed-posts";
import { answer, requireMember } from "@/lib/server/design-context";
import { readerOf } from "@/lib/server/design-feed-posts-repo";
import { staffBehind } from "@/lib/server/design-staff-view";
import { addStoryComment, listStoryComments, removeStoryComment, setStoryLike } from "@/lib/server/design-story-talk-repo";
import { allow } from "@/lib/server/rate-limit";

const isStaff = async () => Boolean(await staffBehind().catch(() => null));
const ok = (body: object = {}) => Response.json({ ok: true, ...body });
const notFound = () => Response.json({ ok: false, message: "That story isn't there any more." }, { status: 404 });
const refuse = (status: number, message: string) => Response.json({ ok: false, message }, { status });
const validId = (id: string) => /^story_[0-9a-f]{16}$/.test(id);

/** GET → { comments }: what businesses have said about one of Sol's stories (domain/design/feed-posts.ts). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const comments = validId(id) ? await listStoryComments(id, readerOf(who.member, await isStaff())) : null;
    return comments ? ok({ comments }) : notFound();
  });
}

/** POST { do: like | unlike | comment (text) | uncomment (comment) }: a member's like or comment on a story, as on a post. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    if (!validId(id)) return notFound();
    if (who.member.viewedBy) return refuse(403, "Not while viewing as someone.");
    const body = (await request.json().catch(() => ({}))) as { do?: string; text?: unknown; comment?: unknown };
    const reader = readerOf(who.member, await isStaff());
    switch (body.do) {
      case "like":
      case "unlike":
        return (await setStoryLike(id, reader, body.do === "like")) ? ok() : notFound();
      case "comment": {
        if (!allow(request, "feed-comment", 120)) return refuse(429, "Too many comments this hour.");
        const text = cleanCommentText(body.text);
        if (!text) return refuse(400, "Write a comment first.");
        return (await addStoryComment(id, who.member, reader, text)) ? ok() : notFound();
      }
      case "uncomment":
        return typeof body.comment === "string" && (await removeStoryComment(id, body.comment, reader))
          ? ok()
          : refuse(403, "That comment can't be removed.");
      default:
        return refuse(400, "Say what to do.");
    }
  });
}
