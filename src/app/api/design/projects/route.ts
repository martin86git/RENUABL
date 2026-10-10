import { MAX_PROJECTS, MAX_PROJECT_BYTES, cleanRoofPlace, cleanRoofWork } from "@/lib/domain/design/account";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { createProject, listProjects, projectAt } from "@/lib/server/design-repo";

/**
 * GET: the business's roofs, most recently changed first (where each is, not
 * the drawings). GET ?lat=&lng=: the business's work on the roof at that
 * place, or `project: null` when it has none yet.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const params = new URL(request.url).searchParams;
    if (!params.has("lat")) return Response.json({ ok: true, projects: await listProjects(who.member.businessId) });
    const roof = cleanRoofPlace({ lat: Number(params.get("lat")), lng: Number(params.get("lng")) });
    if (!roof) return Response.json({ ok: false }, { status: 400 });
    return Response.json({ ok: true, project: await projectAt(who.member.businessId, roof) });
  });
}

/**
 * POST { address, lat, lng, design, extras }: the first save of a roof. If
 * the business already has that roof (a teammate got there first), theirs is
 * handed back with `existed` and nothing is overwritten.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, MAX_PROJECT_BYTES);
    if ("refuse" in read) return read.refuse;
    const roof = cleanRoofPlace(read.body);
    const work = roof && cleanRoofWork(roof, read.body.design, read.body.extras);
    if (!roof || !work) return Response.json({ ok: false, message: "That design couldn't be read." }, { status: 422 });
    const made = await createProject(who.member.businessId, roof, work, who.member.email);
    if (made === "full")
      return Response.json(
        { ok: false, message: `A business can keep up to ${MAX_PROJECTS.toLocaleString("en-AU")} roofs for now.` },
        { status: 422 },
      );
    return Response.json({ ok: true, project: made.project, existed: made.existed });
  });
}
