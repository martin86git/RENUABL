import { jobSentEmail } from "@/lib/domain/design/job-shares";
import { siteUrl } from "@/lib/domain/sms";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { installersToSendTo, sendJob, shareOf, withdrawJob } from "@/lib/server/design-job-shares-repo";
import { emailProvider, sendEmail } from "@/lib/server/email";
import { allow } from "@/lib/server/rate-limit";

/** GET → { share, installers }: where this job stands with an installer on RENUABL, and the connected installers. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/share">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const [share, installers] = await Promise.all([
      shareOf(who.member.businessId, id.slice(0, 80)),
      installersToSendTo(who.member.businessId),
    ]);
    return Response.json({ ok: true, share, installers });
  });
}

/** POST { key }: sends the job to a connected installer (domain/design/job-shares.ts); its owner is emailed when email is set up. */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/share">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "job-share", 60)) return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const { id: raw } = await ctx.params;
    const id = raw.slice(0, 80);
    const done = await sendJob(who.member, id, typeof read.body.key === "string" ? read.body.key.slice(0, 40) : "");
    if (!done.ok) return Response.json({ ok: false, message: done.message }, { status: done.status });
    const site = siteUrl();
    if (done.tell && site && emailProvider())
      await sendEmail({
        to: done.tell,
        ...jobSentEmail({ from: who.member.businessName, suburb: done.suburb, day: done.day, link: `${site}/design/jobs` }),
        replyTo: who.member.email,
      }).catch((e) => console.error("job sent email failed", e instanceof Error ? e.message : e));
    return Response.json({ ok: true, share: await shareOf(who.member.businessId, id) });
  });
}

/** DELETE: takes the job back from the installer; their card closes. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/share">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const { id: raw } = await ctx.params;
    const id = raw.slice(0, 80);
    if (!(await withdrawJob(who.member, id)))
      return Response.json({ ok: false, message: "This job isn't with an installer." }, { status: 409 });
    return Response.json({ ok: true, share: await shareOf(who.member.businessId, id) });
  });
}
