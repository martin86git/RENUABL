import { BUSINESS_TERMS_VERSION, can } from "@/lib/domain/design/account";
import { sampleByEmail } from "@/lib/domain/design/staff-view";
import { answer, designAccess } from "@/lib/server/design-context";
import { staffBehind } from "@/lib/server/design-staff-view";

/**
 * GET: who the roof designer is being used by. Signed out, the designer keeps
 * its work on the device. `state` says what a signed-in person still has to
 * do before their work is kept for a business: name one ("no-business") or
 * accept the terms ("needs-terms").
 */
export async function GET() {
  return answer(async () => {
    const access = await designAccess();
    if (access.state === "signed-out") return Response.json({ signedIn: false });
    const member = access.state === "no-business" ? null : access.member;
    const staff = await staffBehind().catch(() => null);
    return Response.json({
      signedIn: true,
      state: access.state,
      email: access.email,
      business: member && { id: member.businessId, name: member.businessName, role: member.role, kind: member.businessKind },
      // What this person may do, as the server will enforce it: the screens only use it to show or hide.
      may: member && {
        costs: can(member.role, "costs", member.permissions),
        prices: can(member.role, "prices", member.permissions),
        publish: can(member.role, "publish", member.permissions),
        members: can(member.role, "members", member.permissions),
      },
      termsVersion: BUSINESS_TERMS_VERSION,
      // The owner viewing as this member: whose own view it really is.
      ...(member?.viewedBy ? { viewedBy: member.viewedBy } : {}),
      // RENUABL staff: Settings offers View as a retailer, installer or inspector; while in a sample, which one.
      ...(staff ? { staff: true, ...(sampleByEmail(access.email) ? { staffViewing: sampleByEmail(access.email)!.kind } : {}) } : {}),
    });
  });
}
