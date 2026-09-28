import { plainText } from "@/lib/domain/emails";
import { DOCUMENT_UPLOAD, MAX_DOCUMENT_FILES } from "@/lib/domain/handover";
import { addDocument, getRecord, removeDocument, validKey } from "@/lib/server/handover-store";
import { storageConfigured } from "@/lib/server/storage";
import { mayWriteRecord } from "@/lib/server/partner-context";

/** POST multipart { docId, jobReference, file }: adds a page or file to one of the job's documents (preview portal only). */
export async function POST(request: Request, ctx: RouteContext<"/api/jobs/[key]/documents">) {
  const { key } = await ctx.params;
  if (!validKey(key) || !(await mayWriteRecord(key))) return Response.json({ ok: false }, { status: 404 });
  if (!storageConfigured()) return Response.json({ ok: false, notConfigured: true }, { status: 503 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const docId = String(form.get("docId") ?? "");
  const file = form.get("file");
  if (!/^[a-z0-9_-]{1,20}$/i.test(docId)) return Response.json({ ok: false }, { status: 400 });
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > DOCUMENT_UPLOAD.maxBytes ||
    !(DOCUMENT_UPLOAD.types as readonly string[]).includes(file.type)
  ) {
    return Response.json({ ok: false, message: "Send a PDF or a photo (JPG or PNG) under 4 MB." }, { status: 422 });
  }
  const existing = await getRecord(key);
  if ((existing?.documents ?? []).filter((d) => d.docId === docId).length >= MAX_DOCUMENT_FILES) {
    return Response.json(
      { ok: false, message: `That's the most pages we take for one document (${MAX_DOCUMENT_FILES}).` },
      { status: 422 },
    );
  }
  try {
    const record = await addDocument(key, String(form.get("jobReference") ?? "").slice(0, 20), {
      docId,
      label: plainText(form.get("label"), 80) || undefined,
      name: plainText(file.name, 80) || "document",
      data: await file.arrayBuffer(),
      contentType: file.type,
    });
    return Response.json({ ok: true, record });
  } catch (e) {
    console.error("job document upload failed", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, message: "That didn't upload. Try again." }, { status: 502 });
  }
}

/** DELETE ?id=… removes a page or file (preview portal only). */
export async function DELETE(request: Request, ctx: RouteContext<"/api/jobs/[key]/documents">) {
  const { key } = await ctx.params;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!validKey(key) || !(await mayWriteRecord(key)) || !/^dc_[a-z0-9]{4,20}$/.test(id))
    return Response.json({ ok: false }, { status: 404 });
  if (!storageConfigured()) return Response.json({ ok: false, notConfigured: true }, { status: 503 });
  const record = await removeDocument(key, id);
  return record ? Response.json({ ok: true, record }) : Response.json({ ok: false }, { status: 404 });
}
