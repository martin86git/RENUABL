import { HANDOVER_PHOTOS, MAX_ARRAYS, type EvidenceId } from "@/lib/domain/handover";
import { addPhoto, removePhoto, validKey } from "@/lib/server/handover-store";
import { storageConfigured } from "@/lib/server/storage";
import { mayWriteRecord } from "@/lib/server/partner-context";

const MAX_BYTES = 4 * 1024 * 1024;

/** POST multipart { category, array?, jobReference, photo }: adds a handover photo (preview portal only). */
export async function POST(request: Request, ctx: RouteContext<"/api/jobs/[key]/photos">) {
  const { key } = await ctx.params;
  if (!validKey(key) || !(await mayWriteRecord(key))) return Response.json({ ok: false }, { status: 404 });
  if (!storageConfigured()) return Response.json({ ok: false, notConfigured: true }, { status: 503 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const category = String(form.get("category") ?? "") as EvidenceId;
  if (!HANDOVER_PHOTOS.some((p) => p.id === category)) return Response.json({ ok: false }, { status: 400 });
  const arrayRaw = Number(form.get("array"));
  const array = category === "array" && Number.isInteger(arrayRaw) && arrayRaw >= 1 && arrayRaw <= MAX_ARRAYS ? arrayRaw : undefined;
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0 || photo.size > MAX_BYTES || !["image/jpeg", "image/png"].includes(photo.type)) {
    return Response.json({ ok: false, message: "Photos need to be JPG or PNG, under 4 MB." }, { status: 422 });
  }
  const reference = String(form.get("jobReference") ?? "").slice(0, 20);
  try {
    const result = await addPhoto(key, reference, { category, array, data: await photo.arrayBuffer(), contentType: photo.type });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error("handover photo upload failed", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, message: "That photo didn't upload. Try again." }, { status: 502 });
  }
}

/** DELETE ?id=… removes a photo from the record (preview portal only). */
export async function DELETE(request: Request, ctx: RouteContext<"/api/jobs/[key]/photos">) {
  const { key } = await ctx.params;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!validKey(key) || !(await mayWriteRecord(key)) || !/^ph_[a-z0-9]{4,20}$/.test(id))
    return Response.json({ ok: false }, { status: 404 });
  if (!storageConfigured()) return Response.json({ ok: false, notConfigured: true }, { status: 503 });
  const record = await removePhoto(key, id);
  return record ? Response.json({ ok: true, record }) : Response.json({ ok: false }, { status: 404 });
}
