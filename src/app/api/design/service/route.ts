import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { casesToResolve, listCases, raiseCase } from "@/lib/server/design-service-repo";

const validJob = (id: unknown): id is string => typeof id === "string" && /^job_[a-f0-9]{8,64}$/.test(id);

/** GET: the business's service cases with their customers and deals; ?count=1 for just how many are still to resolve. */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (new URL(request.url).searchParams.get("count") === "1")
      return Response.json({ ok: true, open: await casesToResolve(who.member.businessId) });
    return Response.json({ ok: true, cases: await listCases(who.member.businessId) });
  });
}

/** POST { jobId, issue }: flags a deal for service. One open case a deal; written on the deal's record. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 5_000);
    if ("refuse" in read) return read.refuse;
    if (!validJob(read.body.jobId)) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    const made = await raiseCase(who.member.businessId, read.body.jobId, read.body.issue, who.member.email);
    if (made === "missing") return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    if ("refused" in made) return Response.json({ ok: false, message: made.refused }, { status: 422 });
    return Response.json({ ok: true, case: made });
  });
}
