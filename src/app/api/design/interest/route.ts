import { normaliseEmail } from "@/lib/domain/accounts";
import { interestEmail } from "@/lib/domain/design/sales-leads";
import { recordLead } from "@/lib/server/design-billing-repo";
import { tellStaff } from "@/lib/server/design-staff-note";
import { dbConfigured } from "@/lib/server/db";
import { allow } from "@/lib/server/rate-limit";

/** POST { email }: registers interest in the marketplace from the sign-up page. Kept, and staff told. */
export async function POST(request: Request) {
  if (!allow(request, "design-interest", 10)) return Response.json({ ok: false, message: "Please try again shortly." }, { status: 429 });
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const email = normaliseEmail(body.email);
  if (!email) return Response.json({ ok: false, message: "Enter a valid email address." }, { status: 422 });
  if (dbConfigured()) await recordLead("marketplace", { email });
  await tellStaff(interestEmail(email));
  return Response.json({ ok: true, message: "You're on the list. We'll email you when the marketplace opens." });
}
