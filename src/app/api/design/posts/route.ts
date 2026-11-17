import { after } from "next/server";
import { cleanPoll, cleanPostLink, cleanPostText, postProblem, POST_LIMITS } from "@/lib/domain/design/feed-posts";
import { answer, requireMember } from "@/lib/server/design-context";
import { safeImage } from "@/lib/server/design-images";
import { createPost, listPosts, readerOf, setLinkPreview } from "@/lib/server/design-feed-posts-repo";
import { cleanMemberKind } from "@/lib/domain/design/feed-social";
import { viewerOf } from "@/lib/server/design-context";
import { answerQuestion } from "@/lib/server/design-feed-sol";
import { postWin } from "@/lib/server/design-feed-social-repo";
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
 * POST a form (text, link, photo, poll: a JSON list of choices) → { id }: a post every business sees, as the signed-in member. The words are cleaned
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
    // What it is (17 Nov 2026, feed-social.ts): a post, a question to the industry, or a win shared from an installed job.
    const kind = cleanMemberKind(form.get("kind"));
    if (kind === "win") {
      const jobId = String(form.get("job") ?? "").slice(0, 80);
      if (!/^job_[a-f0-9]{8,64}$/.test(jobId))
        return Response.json({ ok: false, message: "Choose the installed job to share." }, { status: 400 });
      const done = await postWin(who.member, viewerOf(who.member), jobId, text);
      return done.ok
        ? Response.json({ ok: true, id: done.id })
        : Response.json({ ok: false, message: done.message }, { status: done.status });
    }
    if (kind === "question" && !text) return Response.json({ ok: false, message: "Write your question first." }, { status: 400 });
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
    // A poll: its choices sent as a JSON list (domain/design/feed-posts.ts, `cleanPoll`).
    const pollRaw = form.get("poll");
    const asked = typeof pollRaw === "string" && pollRaw.trim() !== "";
    let poll: string[] | null = null;
    if (asked)
      try {
        poll = cleanPoll(JSON.parse(pollRaw));
      } catch {
        poll = null;
      }
    const problem = postProblem(text, link, Boolean(photo), Boolean(typed), { asked, choices: poll });
    if (problem) return Response.json({ ok: false, message: problem }, { status: 400 });
    const id = await createPost(who.member, text, link, photo, poll, { kind });
    // Sol offers an answer under a question, from a short search, paid from the asker's Sol credits.
    if (kind === "question")
      after(() => answerQuestion(id, who.member, text).catch((e) => console.error("feed question", e instanceof Error ? e.message : e)));
    if (link)
      after(async () => {
        const preview = await linkPreview(link).catch(() => null);
        if (preview) await setLinkPreview(id, preview.title, preview.picture);
      });
    return Response.json({ ok: true, id });
  });
}
