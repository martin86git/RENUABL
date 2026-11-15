import { normaliseMobile } from "@/lib/domain/contact";
import { TEXT_WORDS, cleanText, textRecord } from "@/lib/domain/design/contact-reach";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { addActivity, jobById } from "@/lib/server/design-crm-repo";
import { TEXTS_COPY, signedText, textSignOff } from "@/lib/domain/design/texts";
import { memberTextsOnDeal } from "@/lib/server/design-deal-team-repo";
import { keepText, textsOnDeal, textsOnFor, textsStopped } from "@/lib/server/design-texts";
import { allow } from "@/lib/server/rate-limit";
import { sendSms } from "@/lib/server/sms";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);

const PRIVATE = { "cache-control": "private, no-store" };

/**
 * GET → the texts with this deal's customer, both ways, oldest first; whether they replied STOP; and the sign-off this
 * member's texts end with. For a member who may see the deal.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/text">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const found = validId(id) ? await jobById(who.member.businessId, id, viewerOf(who.member)) : null;
    if (!found) return Response.json({ ok: false, message: TEXT_WORDS.missing }, { status: 404 });
    const [lines, stopped] = await Promise.all([
      textsOnDeal(who.member.businessId, id),
      textsStopped(who.member.businessId, found.customer.id),
    ]);
    const signOff = textSignOff(who.member.firstName, who.member.businessName);
    return Response.json({ ok: true, lines, stopped, signOff }, { headers: PRIVATE });
  });
}

/**
 * POST { text } → { message }: a text to this deal's customer, on the mobile on their record (never a number from the
 * browser), for a member who may publish and may see the deal, where texts are on for the business. Written on the
 * deal's record once it has gone. It ends with the member's sign-off ("Regards, <first name> | <business>", added
 * here, never by the browser), and is refused while the customer has replied STOP.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/text">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-text", 30))
      return Response.json({ ok: false, message: "That's a lot of texts at once. Try again later." }, { status: 429 });
    const read = await readBody(request, 4_000);
    if ("refuse" in read) return read.refuse;
    const clean = cleanText(read.body.text);
    if (!clean.ok) return Response.json({ ok: false, message: clean.message }, { status: 422 });
    const found = validId(id) ? await jobById(who.member.businessId, id, viewerOf(who.member)) : null;
    if (!found) return Response.json({ ok: false, message: TEXT_WORDS.missing }, { status: 404 });
    if (!(await textsOnFor(who.member.businessId))) return Response.json({ ok: false, message: TEXT_WORDS.off }, { status: 409 });
    const mobile = normaliseMobile(found.customer.phone);
    if (!mobile) return Response.json({ ok: false, message: TEXT_WORDS.noMobile }, { status: 422 });
    const name = found.customer.firstName || found.customer.name;
    if (await textsStopped(who.member.businessId, found.customer.id))
      return Response.json({ ok: false, message: TEXTS_COPY.stopped(name) }, { status: 409 });
    const words = signedText(clean.text, textSignOff(who.member.firstName, who.member.businessName));
    if ((await sendSms(mobile, words)) !== "sent") return Response.json({ ok: false, message: TEXT_WORDS.failed }, { status: 502 });
    await keepText(who.member.businessId, {
      jobId: id,
      customerId: found.customer.id,
      direction: "out",
      mobile,
      text: words,
      by: who.member.email,
    }).catch(() => console.error("a text couldn't be kept with its deal's texts"));
    // In the deal's team chat too, as a text of theirs, so the conversation reads in one place.
    await memberTextsOnDeal(who.member.businessId, id, who.member.email, words).catch(() =>
      console.error("a text couldn't be shown in its deal's chat"),
    );
    // The text has gone either way: a record that can't be kept doesn't undo it.
    await addActivity(
      who.member.businessId,
      found.customer.id,
      { kind: "note", text: textRecord(mobile, words).slice(0, 2000), jobId: id },
      who.member.email,
    ).catch(() => console.error("a text couldn't be written on its deal"));
    return Response.json({ ok: true, message: `Sent to ${name}.` });
  });
}
