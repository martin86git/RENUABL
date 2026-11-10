import { after } from "next/server";
import { cleanPostLink, cleanPostText, postProblem, POST_LIMITS } from "@/lib/domain/design/feed-posts";
import { answer, requireMember } from "@/lib/server/design-context";
import { safeImage } from "@/lib/server/design-images";
import { createPost, listPosts, readerOf, setLinkPreview } from "@/lib/server/design-feed-posts-repo";
import { staffBehind } from "@/lib/server/design-staff-view";
import { linkPreview } from "@/lib/server/industry-news";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

const isStaff = async () => Boolean(await staffBehind().catch(() => null));

/** GET → { posts, staff }: the industry feed's posts (domain/design/feed-posts.ts); `?reported=1` the reported ones (staff). */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const staff = await isStaff();
    const reported = new URL(request.url).searchParams.get("reported") === "1";
    return Response.json({ ok: true, posts: await listPosts(readerOf(who.member, staff), reported), staff });
  });
}

/**
 * POST a form (text, link, photo) → { id }: a post every business sees, as the signed-in member. The words are cleaned
 * (`cleanPostText`), the link checked (`cleanPostLink`), the photo redrawn (`safeImage`); the link's title and picture
 * are read after the answer has gone back.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (who.member.viewedBy) return Response.json({ ok: false, message: "You can't post while viewing as someone." }, { status: 403 });
    if (!allow(request, "feed-post", 20))
      return Response.json({ ok: false, message: "That's a lot of posts this hour. Try again later." }, { status: 429 });
    const form = await request.formData().catch(() => null);
    if (!form) return Response.json({ ok: false, message: "Send the post as a form." }, { status: 400 });
    const text = cleanPostText(form.get("text"));
    const typed = String(form.get("link") ?? "").trim();
    const link = cleanPostLink(typed);
    const file = form.get("photo");
    let photo: Buffer | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > POST_LIMITS.photoBytes) return Response.json({ ok: false, message: "That photo is too large." }, { status: 400 });
      const safe = await safeImage(new Uint8Array(await file.arrayBuffer()), "photo");
      if ("problem" in safe) return Response.json({ ok: false, message: safe.problem }, { status: 400 });
      photo = safe.bytes;
    }
    const problem = postProblem(text, link, Boolean(photo), Boolean(typed));
    if (problem) return Response.json({ ok: false, message: problem }, { status: 400 });
    const id = await createPost(who.member, text, link, photo);
    if (link)
      after(async () => {
        const preview = await linkPreview(link).catch(() => null);
        if (preview) await setLinkPreview(id, preview.title, preview.picture);
      });
    return Response.json({ ok: true, id });
  });
}
