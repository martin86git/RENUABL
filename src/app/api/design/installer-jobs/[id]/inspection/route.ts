import { nominatedEmail } from "@/lib/domain/design/inspections";
import { siteUrl } from "@/lib/domain/sms";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { inspectionForShare, inspectorsToNominate, nominate, withdrawNomination } from "@/lib/server/design-inspections-repo";
import { emailProvider, sendEmail } from "@/lib/server/email";
import { allow } from "@/lib/server/rate-limit";

/** GET → { inspection, inspectors }: the inspection on a job this installer accepted, and the inspectors it is connected with. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/installer-jobs/[id]/inspection">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const [inspection, inspectors] = await Promise.all([
      inspectionForShare(who.member.businessId, id.slice(0, 60)),
      inspectorsToNominate(who.member.businessId),
    ]);
    return Response.json({ ok: true, inspection, inspectors });
  });
}

/** POST { key }: nominates a connected inspector (domain/design/inspections.ts); its owner is emailed when email is set up. */
export async function POST(request: Request, ctx: RouteContext<"/api/design/installer-jobs/[id]/inspection">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "nominate", 60)) return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const { id: raw } = await ctx.params;
    const id = raw.slice(0, 60);
    const done = await nominate(who.member, id, typeof read.body.key === "string" ? read.body.key.slice(0, 40) : "");
    if (!done.ok) return Response.json({ ok: false, message: done.message }, { status: done.status });
    const site = siteUrl();
    if (done.tell && site && emailProvider())
      await sendEmail({
        to: done.tell,
        ...nominatedEmail({ installer: who.member.businessName, suburb: done.suburb, day: done.day, link: `${site}/design/inspections` }),
        replyTo: who.member.email,
      }).catch((e) => console.error("nominated email failed", e instanceof Error ? e.message : e));
    return Response.json({ ok: true, inspection: await inspectionForShare(who.member.businessId, id) });
  });
}

/** DELETE: takes the nomination back; the inspector's view of the job closes. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/design/installer-jobs/[id]/inspection">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const { id: raw } = await ctx.params;
    const id = raw.slice(0, 60);
    if (!(await withdrawNomination(who.member, id)))
      return Response.json({ ok: false, message: "There's no nomination to take back." }, { status: 409 });
    return Response.json({ ok: true, inspection: await inspectionForShare(who.member.businessId, id) });
  });
}
