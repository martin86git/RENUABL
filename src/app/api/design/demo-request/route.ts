import { cleanDemoRequest, demoRequestEmail } from "@/lib/domain/design/sales-leads";
import { recordLead } from "@/lib/server/design-billing-repo";
import { tellStaff } from "@/lib/server/design-staff-note";
import { dbConfigured } from "@/lib/server/db";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST { name, business, email, mobile, note }: someone on the business page asking to be shown RENUABL. Kept as a sales
 * lead of kind "demo-request" and staff emailed; nothing goes to HubSpot (RENUABL's new work stays in its own CRM).
 * "Sent" once it is kept or staff were told.
 */
export async function POST(request: Request) {
  if (!allow(request, "design-demo-request", 10))
    return Response.json({ ok: false, message: "Please try again shortly." }, { status: 429 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const demo = cleanDemoRequest(body);
  if (typeof demo === "string") return Response.json({ ok: false, message: demo }, { status: 422 });
  let kept = false;
  if (dbConfigured()) {
    try {
      await recordLead("demo-request", { ...demo, users: null });
      kept = true;
    } catch (e) {
      console.error("demo request not kept", e instanceof Error ? e.message : e);
    }
  }
  const told = await tellStaff(demoRequestEmail(demo));
  if (!kept && !told)
    return Response.json({ ok: false, message: "We couldn't send that just now. Email hello@renuabl.com.au instead." }, { status: 502 });
  return Response.json({ ok: true, message: "Thanks. Someone from RENUABL will be in touch within a business day to book it in." });
}
