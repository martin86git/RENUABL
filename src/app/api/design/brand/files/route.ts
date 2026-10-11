import { IMAGE_KINDS, IMAGE_LIMITS, IMAGE_TOO_BIG, IMAGE_WRONG, PHOTOS_FULL, type ImageKind } from "@/lib/domain/design/brand";
import { answer, requireMember } from "@/lib/server/design-context";
import { safeImage } from "@/lib/server/design-images";
import { addImage, listImages } from "@/lib/server/design-proposal-repo";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST (a form with `file` and `kind`: logo, cover or photo): a picture for
 * the business's proposals. The file is never kept as sent: it is checked by
 * its own bytes and drawn again, smaller, with everything but the picture
 * dropped (`safeImage`). A new logo or cover replaces the one before.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-brand-files", 60))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    // Refused by its stated size before any of it is read.
    if (Number(request.headers.get("content-length") ?? 0) > IMAGE_LIMITS.uploadBytes + 100_000)
      return Response.json({ ok: false, message: IMAGE_TOO_BIG }, { status: 413 });
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ ok: false, message: IMAGE_WRONG }, { status: 400 });
    }
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof Blob) || !IMAGE_KINDS.includes(kind as ImageKind))
      return Response.json({ ok: false, message: IMAGE_WRONG }, { status: 400 });
    if (file.size > IMAGE_LIMITS.uploadBytes) return Response.json({ ok: false, message: IMAGE_TOO_BIG }, { status: 413 });
    const safe = await safeImage(new Uint8Array(await file.arrayBuffer()), kind as ImageKind);
    if ("problem" in safe) return Response.json({ ok: false, message: safe.problem }, { status: 422 });
    const kept = await addImage(who.member.businessId, kind as ImageKind, safe, who.member.email);
    if (kept === "full") return Response.json({ ok: false, message: PHOTOS_FULL }, { status: 422 });
    return Response.json({ ok: true, image: kept, images: await listImages(who.member.businessId) });
  });
}
