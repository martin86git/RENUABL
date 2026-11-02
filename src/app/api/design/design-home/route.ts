import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { attachSite, designHome, siteIdAt } from "@/lib/server/design-home-repo";

/** GET → the design tool's home: the deals waiting for a design, each deal's first proposal, and the roofs drawn. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, ...(await designHome(who.member.businessId, viewerOf(who.member))) });
  });
}

/** POST { projectId, jobId }: puts a site drawn with no deal onto a deal with no design or address yet. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const { jobId } = read.body;
    // The site by its id (the design home), or by the roof it is (the designer, which knows only where it is).
    const projectId =
      typeof read.body.projectId === "string"
        ? read.body.projectId
        : typeof read.body.lat === "number" && typeof read.body.lng === "number"
          ? await siteIdAt(who.member.businessId, read.body.lat, read.body.lng)
          : null;
    if (!projectId) return Response.json({ ok: false, message: "Save this design first, then put it on a deal." }, { status: 404 });
    if (typeof jobId !== "string" || projectId.length > 80 || jobId.length > 80)
      return Response.json({ ok: false, message: "Choose a site and a deal." }, { status: 422 });
    const done = await attachSite(who.member.businessId, viewerOf(who.member), { projectId, jobId }, who.member.email);
    if (!done.ok) return Response.json({ ok: false, message: done.message }, { status: done.status });
    return Response.json({ ok: true });
  });
}
