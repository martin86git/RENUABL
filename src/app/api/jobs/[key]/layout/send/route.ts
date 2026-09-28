import { layoutReadyEmail } from "@/lib/domain/emails";
import { layoutReadySms, siteUrl } from "@/lib/domain/sms";
import { sendEmail } from "@/lib/server/email";
import { validKey } from "@/lib/server/handover-store";
import { jobLayoutByRecord, partnerOwnsRecord } from "@/lib/server/jobs-repo";
import { customerContactFor } from "@/lib/server/partner-context";
import { portalContext } from "@/lib/server/portal";
import { allow } from "@/lib/server/rate-limit";
import { sendSms } from "@/lib/server/sms";

/**
 * POST { channel: "email" | "sms" }: the job's own partner sends the customer
 * their saved panel layout. The message and link are built here (never from
 * the request); the link opens the layout in My RENUABL after sign-in.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/jobs/[key]/layout/send">) {
  const { key } = await ctx.params;
  if (!validKey(key)) return Response.json({ ok: false }, { status: 404 });
  const portal = await portalContext();
  if (portal?.kind === "demo") return Response.json({ ok: false, message: "The sample portal doesn't send messages." }, { status: 400 });
  if (portal?.kind !== "partner") return Response.json({ ok: false }, { status: 401 });
  if (!allow(request, "layout-send", 20)) return Response.json({ ok: false, message: "Too many sends. Try again later." }, { status: 429 });
  let body: { channel?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const channel = body.channel === "sms" ? "sms" : body.channel === "email" ? "email" : null;
  if (!channel) return Response.json({ ok: false }, { status: 400 });
  if (!(await partnerOwnsRecord(portal.partner.id, key))) return Response.json({ ok: false }, { status: 403 });
  const job = await jobLayoutByRecord(key);
  const panels = job?.layout?.panels?.length ?? 0;
  if (!panels) return Response.json({ ok: false, message: "Save the layout first." }, { status: 400 });
  const site = siteUrl();
  const customer = await customerContactFor(key);
  if (!site || !customer) return Response.json({ ok: false, message: "This job can't be sent yet." }, { status: 400 });
  const link = `${site}/my/layout?record=${key}`;
  try {
    if (channel === "email") {
      if (!customer.email) return Response.json({ ok: false, message: "There's no email address for this customer." }, { status: 400 });
      const sent = await sendEmail({
        to: customer.email,
        ...layoutReadyEmail({ customer: customer.name, panels, partner: portal.partner.business_name, link }),
      });
      if (sent !== "sent") return Response.json({ ok: false, message: "Email isn't set up yet." }, { status: 503 });
    } else {
      if (!customer.mobile) return Response.json({ ok: false, message: "There's no mobile number for this customer." }, { status: 400 });
      const sent = await sendSms(customer.mobile, layoutReadySms({ customer: customer.name, link }));
      if (sent === "skipped") return Response.json({ ok: false, message: "Text messages aren't set up yet." }, { status: 503 });
      if (sent === "failed") return Response.json({ ok: false, message: "The text didn't send. Try again." }, { status: 502 });
    }
  } catch (e) {
    console.error("layout send failed", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, message: "That didn't send. Try again." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
