import { IMAGE_LIMITS, IMAGE_TOO_BIG, IMAGE_WRONG } from "@/lib/domain/design/brand";
import { answer, requireMember } from "@/lib/server/design-context";
import { avatarImage, imageResponse } from "@/lib/server/design-images";
import { memberPhoto, setMemberPhoto } from "@/lib/server/design-member-photos";
import { allow } from "@/lib/server/rate-limit";

/** GET ?email=: a team member's photo, for anyone in the same business. Its address carries a version, so it is cached. */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const email = (new URL(request.url).searchParams.get("email") ?? who.member.email).slice(0, 200);
    const photo = await memberPhoto(who.member.businessId, email);
    return photo ? imageResponse(photo) : new Response("Not found", { status: 404 });
  });
}

/** POST (a form with `file`): the signed-in person's own photo, checked by its own bytes and redrawn square and small. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (who.member.viewedBy) return Response.json({ ok: false, message: "Not while viewing as someone." }, { status: 403 });
    if (!allow(request, "design-member-photo", 30))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    if (Number(request.headers.get("content-length") ?? 0) > IMAGE_LIMITS.uploadBytes + 100_000)
      return Response.json({ ok: false, message: IMAGE_TOO_BIG }, { status: 413 });
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ ok: false, message: IMAGE_WRONG }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof Blob)) return Response.json({ ok: false, message: IMAGE_WRONG }, { status: 400 });
    if (file.size > IMAGE_LIMITS.uploadBytes) return Response.json({ ok: false, message: IMAGE_TOO_BIG }, { status: 413 });
    const safe = await avatarImage(new Uint8Array(await file.arrayBuffer()));
    if ("problem" in safe) return Response.json({ ok: false, message: safe.problem }, { status: 422 });
    return Response.json({ ok: true, photo: await setMemberPhoto(who.member.businessId, who.member.email, safe) });
  });
}

/** DELETE: takes the signed-in person's own photo away (their initials are shown instead). */
export async function DELETE() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (who.member.viewedBy) return Response.json({ ok: false, message: "Not while viewing as someone." }, { status: 403 });
    await setMemberPhoto(who.member.businessId, who.member.email, null);
    return Response.json({ ok: true, photo: null });
  });
}
