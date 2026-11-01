import { normaliseEmail } from "@/lib/domain/accounts";
import { cleanRoles, countLine, rolesNote } from "@/lib/domain/design/marketplace-launch";
import { answer, designAccess, readBody } from "@/lib/server/design-context";
import { dbConfigured } from "@/lib/server/db";
import { joinWaitlist, onWaitlist, waitlistCount } from "@/lib/server/design-marketplace-launch-repo";
import { tellStaff } from "@/lib/server/design-staff-note";
import { allow } from "@/lib/server/rate-limit";

/** GET → { joined, signedIn, count }: whether this business is on the Marketplace's list, and the list's size once it says something. */
export async function GET() {
  return answer(async () => {
    if (!dbConfigured()) return Response.json({ ok: true, joined: false, signedIn: false, count: null });
    const access = await designAccess();
    const email = access.state === "ready" ? access.member.email : null;
    const [joined, n] = await Promise.all([email ? onWaitlist(email) : false, waitlistCount()]);
    return Response.json({ ok: true, joined, signedIn: Boolean(email), count: countLine(n) });
  });
}

/**
 * POST { roles, email? }: saves a place on the list. Signed in, it is the member's own email and business (nothing
 * typed decides it); signed out, the email given. Staff are told.
 */
export async function POST(request: Request) {
  return answer(async () => {
    if (!allow(request, "marketplace-waitlist", 10))
      return Response.json({ ok: false, message: "Please try again shortly." }, { status: 429 });
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const access = await designAccess();
    const member = access.state === "ready" ? access.member : null;
    const email = member ? member.email : normaliseEmail(read.body.email);
    if (!email) return Response.json({ ok: false, message: "Enter a valid email address." }, { status: 422 });
    const roles = rolesNote(cleanRoles(read.body.roles));
    if (!dbConfigured())
      return Response.json({ ok: false, message: "We couldn't save that just now. Try again shortly." }, { status: 503 });
    const fresh = await joinWaitlist({ email, business: member?.businessName ?? null, name: null, note: roles });
    if (fresh)
      await tellStaff({
        subject: "Marketplace: a business saved its place",
        text: `${member ? `${member.businessName} (${email})` : email} saved a place on the RENUABL Marketplace list.\n\nWants to: ${roles}`,
      });
    return Response.json({ ok: true, joined: true });
  });
}
