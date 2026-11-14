import { IMAGE_LIMITS, IMAGE_TOO_BIG, IMAGE_WRONG } from "@/lib/domain/design/brand";
import { cleanCallerKey } from "@/lib/domain/install-call";
import { callerPhoto, setCallerPhoto } from "@/lib/server/design-caller-repo";
import { answer, requireMember } from "@/lib/server/design-context";
import { avatarImage, imageResponse } from "@/lib/server/design-images";
import { allow } from "@/lib/server/rate-limit";

/** Which assistant: `?role=admin` for the admin assistant, else the sales one. */
const roleIn = (request: Request) => cleanCallerKey(new URL(request.url).searchParams.get("role"));

/** GET: the phone assistant's picture, for the business's own members. */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const photo = await callerPhoto(who.member.businessId, roleIn(request));
    return photo ? imageResponse(photo) : new Response("Not found", { status: 404 });
  });
}

/** POST (a form with `file`): its picture, checked by its own bytes and redrawn square and small; never kept as sent. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-caller-photo", 30))
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
    return Response.json({ ok: true, caller: await setCallerPhoto(who.member.businessId, safe, who.member.email, roleIn(request)) });
  });
}

/** DELETE: takes the picture away (its initial is shown instead). */
export async function DELETE(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, caller: await setCallerPhoto(who.member.businessId, null, who.member.email, roleIn(request)) });
  });
}
