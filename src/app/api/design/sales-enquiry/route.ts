import { normaliseMobile } from "@/lib/domain/contact";
import { cleanEnquiry, enquiryEmail } from "@/lib/domain/design/sales-leads";
import { recordLead } from "@/lib/server/design-billing-repo";
import { tellStaff } from "@/lib/server/design-staff-note";
import { dbConfigured } from "@/lib/server/db";
import { addNote, crmNote, hubspotToken, upsertContact } from "@/lib/server/hubspot-crm";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST { name, business, email, mobile, users, note }: a business asking to talk about Enterprise (13 users or more).
 * Kept, staff emailed, and added to RENUABL's HubSpot with a note. "Sent" once it is kept or staff were told.
 */
export async function POST(request: Request) {
  if (!allow(request, "design-sales", 10)) return Response.json({ ok: false, message: "Please try again shortly." }, { status: 429 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const enquiry = cleanEnquiry(body);
  if (typeof enquiry === "string") return Response.json({ ok: false, message: enquiry }, { status: 422 });
  let kept = false;
  if (dbConfigured()) {
    await recordLead("enterprise", enquiry);
    kept = true;
  }
  const told = await tellStaff(enquiryEmail(enquiry));
  const token = hubspotToken();
  if (token) {
    try {
      const [firstName, ...rest] = enquiry.name.split(" ");
      const id = await upsertContact(
        {
          email: enquiry.email,
          firstName,
          lastName: rest.join(" "),
          mobile: (enquiry.mobile && normaliseMobile(enquiry.mobile)) ?? "",
        },
        token,
        { extra: { company: enquiry.business } },
      );
      await addNote(
        id,
        crmNote("RENUABL for business: Enterprise enquiry", {
          Business: enquiry.business,
          Users: String(enquiry.users),
          Mobile: enquiry.mobile ?? undefined,
          Note: enquiry.note ?? undefined,
        }),
        token,
      );
    } catch (e) {
      console.error("enterprise enquiry to HubSpot failed", e instanceof Error ? e.message : e);
    }
  }
  if (!kept && !told)
    return Response.json({ ok: false, message: "We couldn't send that just now. Email hello@renuabl.com.au instead." }, { status: 502 });
  return Response.json({ ok: true, message: "Thanks. Someone from RENUABL will be in touch within a business day." });
}
