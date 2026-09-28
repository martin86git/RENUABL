import { COMPLIANCE_UPLOAD, validateComplianceUpdate } from "@/lib/domain/compliance-upload";
import { todayInMarket } from "@/lib/domain/market";
import { saveFile, saveJson, storageConfigured } from "@/lib/server/storage";
import { currentPartner } from "@/lib/server/partner-context";

/**
 * POST multipart { kind, expires, number?, amount?, file }: a renewed licence
 * or insurance certificate from the portal, kept privately for RENUABL to
 * review. For the signed-in partner (or the sample portal, in preview).
 */
export async function POST(request: Request) {
  const acting = await currentPartner();
  if (!acting) return Response.json({ ok: false }, { status: 404 });
  if (!storageConfigured()) return Response.json({ ok: false, notConfigured: true, message: "Storage isn't set up yet." }, { status: 503 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const checked = validateComplianceUpdate(
    { kind: form.get("kind"), expires: form.get("expires"), number: form.get("number"), amount: form.get("amount") },
    todayInMarket(),
  );
  if ("error" in checked) return Response.json({ ok: false, message: checked.error }, { status: 422 });
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > COMPLIANCE_UPLOAD.maxBytes ||
    !(COMPLIANCE_UPLOAD.types as readonly string[]).includes(file.type)
  ) {
    return Response.json({ ok: false, message: "Send a PDF or a photo (JPG or PNG) under 4 MB." }, { status: 422 });
  }
  const partner = acting.id;
  const stamp = new Date().toISOString();
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = await saveFile(`partners/${partner}/compliance/${checked.update.kind}.${ext}`, await file.arrayBuffer(), file.type);
  await saveJson(`partners/${partner}/compliance/${checked.update.kind}-${stamp.slice(0, 10)}.json`, {
    ...checked.update,
    document: path,
    submittedAt: stamp,
    status: "to review",
  });
  return Response.json({ ok: true });
}
