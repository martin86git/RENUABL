import { cleanDealEmail, dealEmail, emailRecord } from "@/lib/domain/design/deal-email";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { addActivity, jobById } from "@/lib/server/design-crm-repo";
import { loadBrand } from "@/lib/server/design-proposal-repo";
import { emailProvider, sendEmail } from "@/lib/server/email";
import { allow } from "@/lib/server/rate-limit";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);
const fail = (message: string, status: number) => Response.json({ ok: false, message }, { status });
const NOT_SET_UP = "Email isn't set up on this site yet, so it can't be sent from here.";

/** GET: whether an email can be sent from here at all, so the box can say so before anything is written. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, canSend: Boolean(emailProvider()), replyTo: who.member.email });
  });
}

/**
 * POST { to, subject, body }: emails the deal's customer what the member wrote. It goes from RENUABL's sender in the
 * business's name (its trading name when it has one), with replies to the member who wrote it, and is written on the
 * deal's record as an email. Only the member's own words: nothing is added from the proposal.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/email">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-deal-email", 30)) return fail("That's a lot of emails at once. Try again in a minute.", 429);
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    if (!emailProvider()) return fail(NOT_SET_UP, 503);
    if (!validId(id)) return fail("There's no such deal.", 404);
    const found = await jobById(who.member.businessId, id, viewerOf(who.member));
    if (!found) return fail("There's no such deal.", 404);
    const clean = cleanDealEmail(read.body);
    if (!clean.ok) return fail(clean.message, 422);
    const brand = await loadBrand(who.member.businessId, who.member.businessName);
    const business = brand.name || who.member.businessName;
    await sendEmail({ to: clean.to, ...dealEmail({ business, subject: clean.subject, body: clean.body }), replyTo: who.member.email });
    const activity = await addActivity(
      who.member.businessId,
      found.customer.id,
      { kind: "email", text: emailRecord(clean.to, clean.subject, clean.body).slice(0, 2000), jobId: id },
      who.member.email,
    );
    return Response.json({
      ok: true,
      message: `Sent to ${clean.to}. Replies go to ${who.member.email}.`,
      activity: typeof activity === "string" ? null : activity,
    });
  });
}
