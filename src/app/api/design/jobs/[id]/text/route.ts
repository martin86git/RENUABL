import { normaliseMobile } from "@/lib/domain/contact";
import { TEXT_WORDS, cleanText, textRecord } from "@/lib/domain/design/contact-reach";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { addActivity, jobById } from "@/lib/server/design-crm-repo";
import { textsOnFor } from "@/lib/server/design-texts";
import { allow } from "@/lib/server/rate-limit";
import { sendSms } from "@/lib/server/sms";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);

/**
 * POST { text } → { message }: a text to this deal's customer, on the mobile on their record (never a number from the
 * browser), for a member who may publish and may see the deal, where texts are on for the business. Written on the
 * deal's record once it has gone.
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
    if ((await sendSms(mobile, clean.text)) !== "sent") return Response.json({ ok: false, message: TEXT_WORDS.failed }, { status: 502 });
    // The text has gone either way: a record that can't be kept doesn't undo it.
    await addActivity(
      who.member.businessId,
      found.customer.id,
      { kind: "note", text: textRecord(mobile, clean.text).slice(0, 2000), jobId: id },
      who.member.email,
    ).catch(() => console.error("a text couldn't be written on its deal"));
    return Response.json({ ok: true, message: `Sent to ${found.customer.firstName || found.customer.name}.` });
  });
}
