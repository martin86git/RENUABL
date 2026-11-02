import { cleanDealEmail, dealEmail, emailRecord } from "@/lib/domain/design/deal-email";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { addActivity, jobById } from "@/lib/server/design-crm-repo";
import { loadBrand } from "@/lib/server/design-proposal-repo";
import { emailProvider, sendEmail } from "@/lib/server/email";
import { allow } from "@/lib/server/rate-limit";
import { openPixel, withPixel } from "@/lib/domain/design/email-opens";
import { siteUrl } from "@/lib/domain/sms";
import { addDealFiles, newOpenToken, recordSent } from "@/lib/server/design-pulse-repo";
import { emailParts, formFiles } from "@/lib/server/email-parts";

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
 * POST { to, subject, body } as JSON, or as a form with up to six files ("file") when pictures or files go with it:
 * emails the deal's customer what the member wrote. It goes from RENUABL's sender in the
 * business's name (its trading name when it has one), with replies to the member who wrote it, and is written on the
 * deal's record as an email. Only the member's own words: nothing is added from the proposal, but a one-pixel picture
 * so the deal can say when it was opened (domain/design/email-opens.ts). Pictures show inside the email under the words;
 * other files are attached; each is also kept in the deal's Attachments, so the team can see what went out.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/email">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-deal-email", 30)) return fail("That's a lot of emails at once. Try again in a minute.", 429);
    let raw: Record<string, unknown>;
    let files: File[] = [];
    if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      const form = await request.formData().catch(() => null);
      if (!form) return fail("That couldn't be read.", 400);
      raw = { to: form.get("to"), subject: form.get("subject"), body: form.get("body") };
      const got = formFiles(form);
      if ("problem" in got) return fail(got.problem, 422);
      files = got.files;
    } else {
      const read = await readBody(request, 20_000);
      if ("refuse" in read) return read.refuse;
      raw = read.body;
    }
    if (!emailProvider()) return fail(NOT_SET_UP, 503);
    if (!validId(id)) return fail("There's no such deal.", 404);
    const found = await jobById(who.member.businessId, id, viewerOf(who.member));
    if (!found) return fail("There's no such deal.", 404);
    const clean = cleanDealEmail(raw);
    if (!clean.ok) return fail(clean.message, 422);
    const brand = await loadBrand(who.member.businessId, who.member.businessName);
    const business = brand.name || who.member.businessName;
    // A pixel of its own, so the deal can say when the customer opened it (only when the site's address is known).
    const site = siteUrl();
    const token = site ? newOpenToken() : null;
    const parts = await emailParts(files);
    const email = dealEmail({ business, subject: clean.subject, body: clean.body, pictures: parts.picturesHtml, attached: parts.textLine });
    await sendEmail({
      to: clean.to,
      ...email,
      ...(parts.attachments.length ? { attachments: parts.attachments } : {}),
      ...(token && site ? { html: withPixel(email.html, openPixel(site, token)) } : {}),
      replyTo: who.member.email,
    });
    const activity = await addActivity(
      who.member.businessId,
      found.customer.id,
      {
        kind: "email",
        text: emailRecord(
          clean.to,
          clean.subject,
          clean.body,
          parts.kept.map((f) => f.name),
        ).slice(0, 2000),
        jobId: id,
      },
      who.member.email,
    );
    if (token)
      await recordSent(who.member.businessId, token, id, typeof activity === "string" ? null : activity.id).catch(() =>
        console.error("an email's open tracking couldn't be kept"),
      );
    // What went out is kept on the deal too; the email has gone either way.
    if (parts.kept.length)
      await addDealFiles(who.member.businessId, id, parts.kept, who.member.email, viewerOf(who.member)).catch(() =>
        console.error("an email's files couldn't be kept on the deal"),
      );
    return Response.json({
      ok: true,
      message: `Sent to ${clean.to}. Replies go to ${who.member.email}.`,
      activity: typeof activity === "string" ? null : activity,
    });
  });
}
