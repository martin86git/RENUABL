import { cleanDealEmail, dealEmail, emailRecord } from "@/lib/domain/design/deal-email";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { addActivity, jobById } from "@/lib/server/design-crm-repo";
import { loadBrand } from "@/lib/server/design-proposal-repo";
import { emailProvider, sendEmail } from "@/lib/server/email";
import { allow } from "@/lib/server/rate-limit";
import { openPixel, ourCopyNote, splitOurCopies, withPixel } from "@/lib/domain/design/email-opens";
import { siteUrl } from "@/lib/domain/sms";
import { addDealFiles, newOpenToken, recordSent } from "@/lib/server/design-pulse-repo";
import { emailParts, formFiles } from "@/lib/server/email-parts";
import { listMembers } from "@/lib/server/design-repo";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);
const fail = (message: string, status: number) => Response.json({ ok: false, message }, { status });
const NOT_SET_UP = "Email isn't set up on this site yet, so it can't be sent from here.";

/** The business's own addresses: its members' sign-in emails, and its brand and notify addresses. */
async function ownAddresses(businessId: string, brand: { email: string; notify: string[] }): Promise<string[]> {
  const members = await listMembers(businessId).catch(() => []);
  return [...members.map((m) => m.email), brand.email, ...brand.notify].filter(Boolean);
}

/** GET: whether an email can be sent from here at all, so the box can say so before anything is written. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, canSend: Boolean(emailProvider()), replyTo: who.member.email });
  });
}

/**
 * POST { to, cc, subject, body } as JSON, or as a form with up to six files ("file") when pictures or files go with it:
 * emails the deal's customer what the member wrote. `toCustomer` (Sol's draft cards) sends it to the customer's address
 * as kept here, ignoring `to`. Up to five people are copied in (`cleanCc`), listed on the record line; the business's
 * own among them get a copy of their own without the pixel (`splitOurCopies`). It goes from RENUABL's sender in the
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
      raw = {
        to: form.get("to"),
        cc: form.get("cc"),
        subject: form.get("subject"),
        body: form.get("body"),
        toCustomer: form.get("toCustomer"),
      };
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
    // Sol's drafts go to the customer's address as kept here, never one sent from the browser.
    const toCustomer = raw.toCustomer === true || raw.toCustomer === "1";
    const clean = cleanDealEmail(raw, toCustomer ? found.customer.email : undefined);
    if (!clean.ok) return fail(clean.message, 422);
    const brand = await loadBrand(who.member.businessId, who.member.businessName);
    const business = brand.name || who.member.businessName;
    // A pixel of its own, so the deal can say when the customer opened it (only when the site's address is known).
    const site = siteUrl();
    const token = site ? newOpenToken() : null;
    const parts = await emailParts(files);
    const email = dealEmail({ business, subject: clean.subject, body: clean.body, pictures: parts.picturesHtml, attached: parts.textLine });
    const attachments = parts.attachments.length ? { attachments: parts.attachments } : {};
    // On a tracked email the business's own people on Cc get a copy of their own without the pixel, so only the
    // customer's opens are counted (splitOurCopies); anyone else on Cc stays on the customer's copy.
    const ours = token && clean.cc.length ? await ownAddresses(who.member.businessId, brand) : [];
    const split = splitOurCopies(clean.cc, ours);
    await sendEmail({
      to: clean.to,
      ...email,
      ...(split.cc.length ? { cc: split.cc } : {}),
      ...attachments,
      ...(token && site ? { html: withPixel(email.html, openPixel(site, token)) } : {}),
      replyTo: who.member.email,
    });
    if (split.ours.length) {
      const [first, ...rest] = split.ours;
      const note = ourCopyNote(clean.to);
      await sendEmail({
        to: first,
        ...(rest.length ? { cc: rest } : {}),
        subject: email.subject,
        text: `${note}\n\n${email.text}`,
        html: `<p style="font:12px Arial,sans-serif;color:#888;margin:0 0 12px">${note.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>${email.html}`,
        ...attachments,
        replyTo: who.member.email,
      }).catch(() => console.error("the business's own copy of a deal email couldn't be sent"));
    }
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
          clean.cc,
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
      message: `Sent to ${clean.to}${clean.cc.length ? `, copying in ${clean.cc.join(", ")}` : ""}. Replies go to ${who.member.email}.`,
      activity: typeof activity === "string" ? null : activity,
    });
  });
}
