import { cleanSequence, sequenceProblem } from "@/lib/domain/marketing/sequences";
import { deleteSequence, saveSequence, sequenceById, setSequenceOn } from "@/lib/server/marketing-campaigns-repo";
import { marketingStaff, readJson, refuse, unauthorised } from "@/lib/server/marketing-staff";

const ID = /^msq_[0-9a-f]+$/;

export async function GET(_request: Request, ctx: RouteContext<"/api/admin/marketing/sequences/[id]">) {
  if (!(await marketingStaff())) return unauthorised();
  const { id } = await ctx.params;
  const s = ID.test(id) ? await sequenceById(id) : null;
  return s ? Response.json({ ok: true, sequence: s }) : refuse("Not found", 404);
}

/** PUT (staff) {draft}: saves it (while on, its trigger stays as it was). */
export async function PUT(request: Request, ctx: RouteContext<"/api/admin/marketing/sequences/[id]">) {
  if (!(await marketingStaff())) return unauthorised();
  const { id } = await ctx.params;
  const b = await readJson(request);
  if (!b || !ID.test(id)) return refuse("Bad request", 400);
  return (await saveSequence(id, cleanSequence(b.draft))) ? Response.json({ ok: true }) : refuse("Not found", 404);
}

/** POST (staff) {do: "on" | "off"}: switching on is the deliberate act that lets it send; refused while it isn't ready. */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/marketing/sequences/[id]">) {
  if (!(await marketingStaff())) return unauthorised();
  const { id } = await ctx.params;
  const b = await readJson(request);
  if (!b || !ID.test(id) || (b.do !== "on" && b.do !== "off")) return refuse("Bad request", 400);
  if (b.do === "on") {
    const s = await sequenceById(id);
    if (!s) return refuse("Not found", 404);
    const problem = sequenceProblem(s.draft);
    if (problem) return refuse(problem);
  }
  return (await setSequenceOn(id, b.do === "on")) ? Response.json({ ok: true }) : refuse("Not found", 404);
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/marketing/sequences/[id]">) {
  if (!(await marketingStaff())) return unauthorised();
  const { id } = await ctx.params;
  return ID.test(id) && (await deleteSequence(id)) ? Response.json({ ok: true }) : refuse("Switch it off before deleting it.", 409);
}
