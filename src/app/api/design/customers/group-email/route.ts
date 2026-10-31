import { cleanGroupEmail } from "@/lib/domain/design/customers";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadBrand } from "@/lib/server/design-proposal-repo";
import { sendGroupEmail } from "@/lib/server/design-people-repo";
import { emailProvider } from "@/lib/server/email";
import { allow } from "@/lib/server/rate-limit";

const fail = (message: string, status: number) => Response.json({ ok: false, message }, { status });

/** GET: whether a group email can go from here at all, so the box can say so before anything is written. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, canSend: Boolean(emailProvider()), replyTo: who.member.email });
  });
}

/**
 * POST { subject, body, ids }: one email to the customers chosen, each their own copy greeted by name ({firstName}),
 * with their own link to stop group emails, replies to the member. Those with no address or who have unsubscribed are
 * left out and counted. Sending needs the publish permission (it speaks for the business to many at once).
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!emailProvider()) return fail("Email isn't set up on this site yet, so a group email can't be sent from here.", 503);
    if (!allow(request, "design-group-email", 10)) return fail("That's a lot of group emails this hour. Try again later.", 429);
    const read = await readBody(request, 40_000);
    if ("refuse" in read) return read.refuse;
    const clean = cleanGroupEmail(read.body);
    if (!clean.ok) return fail(clean.message, 422);
    const brand = await loadBrand(who.member.businessId, who.member.businessName);
    const result = await sendGroupEmail(who.member, { business: brand.name || who.member.businessName, ...clean });
    if (result === "no-site") return fail("The site's address isn't set, so the unsubscribe links can't be made.", 503);
    return Response.json({ ok: true, ...result });
  });
}
