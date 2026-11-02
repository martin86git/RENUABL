import { jobAnsweredEmail } from "@/lib/domain/design/job-shares";
import { siteUrl } from "@/lib/domain/sms";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { answerJob, jobsFor, waitingCount } from "@/lib/server/design-job-shares-repo";
import { emailProvider, sendEmail } from "@/lib/server/email";

/** GET → { jobs } | ?count=1 → { waiting }: the jobs retailers have sent this installer (domain/design/job-shares.ts). */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (new URL(request.url).searchParams.get("count"))
      return Response.json({ ok: true, waiting: await waitingCount(who.member.businessId) });
    return Response.json({ ok: true, jobs: await jobsFor(who.member.businessId) });
  });
}

/** POST { id, do: "accept" | "decline" }: the installer's answer; whoever sent it is emailed when email is set up. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const action = read.body.do === "accept" ? "accept" : read.body.do === "decline" ? "decline" : null;
    if (!action) return Response.json({ ok: false, message: "That couldn't be read." }, { status: 400 });
    const done = await answerJob(who.member, typeof read.body.id === "string" ? read.body.id.slice(0, 60) : "", action);
    if (!done.ok) return Response.json({ ok: false, message: done.message }, { status: done.status });
    const site = siteUrl();
    if (site && emailProvider())
      await sendEmail({
        to: done.tell,
        ...jobAnsweredEmail({
          installer: who.member.businessName,
          accepted: action === "accept",
          suburb: done.suburb,
          link: `${site}/design/procurement/scheduler`,
        }),
      }).catch((e) => console.error("job answered email failed", e instanceof Error ? e.message : e));
    return Response.json({ ok: true, jobs: await jobsFor(who.member.businessId) });
  });
}
