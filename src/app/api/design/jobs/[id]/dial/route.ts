import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { mayCallFromBrowser, openTicket } from "@/lib/server/browser-calls";
import { allow } from "@/lib/server/rate-limit";
import { identityFor } from "@/lib/server/twilio-voice";

/**
 * POST: a ticket for one call from the computer to this deal's customer, on the number on their record (never one
 * sent from the browser), for a member who may see the deal. The browser hands the ticket to Twilio, which brings it
 * back to /api/voice/twilio within two minutes.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/dial">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!(await mayCallFromBrowser(who.member.businessId)))
      return Response.json({ ok: false, message: "Calling from the computer isn't set up for your business." }, { status: 409 });
    if (!allow(request, "design-dial", 60))
      return Response.json({ ok: false, message: "That's a lot of calls: try again in a little while." }, { status: 429 });
    const { id } = await ctx.params;
    const found = await jobById(who.member.businessId, id, viewerOf(who.member));
    if (!found) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    const ticket = await openTicket({
      businessId: who.member.businessId,
      jobId: found.job.id,
      customerId: found.customer.id,
      customerName: found.customer.name,
      phone: found.customer.phone,
      memberEmail: who.member.email,
      identity: identityFor(who.member.businessId, who.member.email),
    });
    if (ticket === "no-number")
      return Response.json({ ok: false, message: "There's no Australian phone number on this customer's record." }, { status: 422 });
    return Response.json({ ok: true, ticket: ticket.id });
  });
}
