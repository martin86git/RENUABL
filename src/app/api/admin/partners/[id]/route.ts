import { partnerApprovedEmail } from "@/lib/domain/emails";
import { siteUrl } from "@/lib/domain/sms";
import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { sendEmail } from "@/lib/server/email";
import { addNote, contactIdByEmail, crmNote } from "@/lib/server/hubspot-crm";
import { processOffers } from "@/lib/server/offers-engine";
import { setPartnerStatus } from "@/lib/server/partners-repo";

const STATUS = { approve: "approved", decline: "declined", pause: "paused" } as const;

/**
 * POST { action: "approve" | "decline" | "pause", priority? } from RENUABL staff.
 * Approving emails the partner a link to the portal, notes it on their HubSpot
 * contact, and offers them any jobs waiting in their area.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/partners/[id]">) {
  const { id } = await ctx.params;
  if (!dbConfigured() || !/^pa_[a-f0-9]{24}$/.test(id)) return Response.json({ ok: false }, { status: 404 });
  const session = await currentSession();
  if (session?.role !== "staff") return Response.json({ ok: false }, { status: 401 });
  let body: { action?: unknown; priority?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const status = STATUS[body.action as keyof typeof STATUS];
  if (!status) return Response.json({ ok: false }, { status: 400 });
  const priority =
    typeof body.priority === "number" && Number.isInteger(body.priority) ? Math.max(0, Math.min(10, body.priority)) : undefined;
  const partner = await setPartnerStatus(id, status, priority);
  if (!partner) return Response.json({ ok: false }, { status: 404 });

  const site = siteUrl();
  if (status === "approved" && site) {
    await sendEmail({
      to: partner.email,
      ...partnerApprovedEmail({ firstName: partner.full_name.split(" ")[0], link: `${site}/login?as=partner` }),
    }).catch((e) => console.error("approval email failed", e instanceof Error ? e.message : e));
  }
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  if (token) {
    try {
      const contactId = await contactIdByEmail(partner.email, token);
      await addNote(contactId, crmNote(`RENUABL partner ${partner.reference}: ${status}`, { "Decided by": session.email }), token);
    } catch (e) {
      console.error("partner decision note to HubSpot failed", e instanceof Error ? e.message : e);
    }
  }
  if (status === "approved") await processOffers().catch(() => undefined);
  return Response.json({ ok: true, status });
}
