import { PREVIEW_MODE } from "@/lib/config";
import { todayInMarket } from "@/lib/domain/market";
import { CERTIFICATE_UPLOAD, partnerSummary, validatePartnerApplication } from "@/lib/domain/partner";
import { partnerReceivedEmail } from "@/lib/domain/emails";
import { sendEmail } from "@/lib/server/email";
import { addNote, crmNote, upsertContact } from "@/lib/server/hubspot-crm";
import { saveFile, saveJson, storageConfigured } from "@/lib/server/storage";

/**
 * POST multipart: "application" (JSON) + "certificate" (PDF or photo of the
 * certificate of currency). Validates, stores both privately, adds the partner
 * to HubSpot with a note, and emails them a confirmation. Only reports success
 * once the application is saved somewhere RENUABL can see it.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 400 });
  }
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(String(form.get("application") ?? "{}"));
  } catch {
    return Response.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 400 });
  }
  const certificate = form.get("certificate");
  const file = certificate instanceof File && certificate.size > 0 ? certificate : null;
  if (file && (file.size > CERTIFICATE_UPLOAD.maxBytes || !(CERTIFICATE_UPLOAD.types as readonly string[]).includes(file.type))) {
    return Response.json({ ok: false, errors: { certificate: "Upload a PDF, JPG or PNG under 4 MB." } }, { status: 422 });
  }

  const checked = validatePartnerApplication(raw, { today: todayInMarket(), hasCertificate: Boolean(file) });
  if ("errors" in checked) return Response.json({ ok: false, errors: checked.errors }, { status: 422 });
  const app = checked.application;
  const reference = `PA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  let saved = false;
  let certificatePath: string | undefined;
  const problems: string[] = [];

  if (storageConfigured()) {
    try {
      const ext = file!.type === "application/pdf" ? "pdf" : file!.type === "image/png" ? "png" : "jpg";
      certificatePath = await saveFile(`partners/${reference}/certificate-of-currency.${ext}`, await file!.arrayBuffer(), file!.type);
      await saveJson(`partners/${reference}/application.json`, {
        reference,
        receivedAt: new Date().toISOString(),
        certificate: certificatePath,
        ...app,
      });
      saved = true;
    } catch (e) {
      problems.push(`storage: ${e instanceof Error ? e.message : e}`);
    }
  }

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  if (token) {
    try {
      const [firstName, ...rest] = app.fullName.split(/\s+/);
      const contactId = await upsertContact({ firstName, lastName: rest.join(" "), mobile: app.mobile, email: app.email }, token, {
        lifecycle: "other",
        extra: { company: app.businessName, ...(app.website ? { website: app.website } : {}) },
      });
      await addNote(
        contactId,
        crmNote(`RENUABL partner application ${reference}`, partnerSummary(app, { reference, certificate: certificatePath })),
        token,
      );
      saved = true;
    } catch (e) {
      problems.push(`hubspot: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (problems.length) console.error(`partner application ${reference} problems`, problems.join(" | "));
  if (!saved) {
    // Nothing configured, or both failed: keep it in the logs rather than lose it.
    console.warn(`partner application ${reference} (not stored)`, JSON.stringify({ ...app, certificate: file?.name }));
    if (!PREVIEW_MODE) {
      return Response.json(
        { ok: false, message: "We couldn't save your application just now. Please try again in a moment." },
        { status: 503 },
      );
    }
  }

  try {
    await sendEmail({ to: app.email, ...partnerReceivedEmail({ reference, firstName: app.fullName.split(/\s+/)[0], type: app.type }) });
  } catch (e) {
    console.error(`partner application ${reference} email failed`, e instanceof Error ? e.message : e);
  }
  return Response.json({ ok: true, reference, stored: saved });
}
