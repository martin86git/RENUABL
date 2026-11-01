import { addJobNote, jobCard } from "@/lib/server/design-job-card-repo";
import { readNote, sendJobCard } from "@/lib/server/design-job-card";
import { jobById } from "@/lib/server/design-crm-repo";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

const missing = () => Response.json({ ok: false, message: "There's no such job." }, { status: 404 });

/** GET → { card }: the job card, for the business's own people who may see the deal. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/card">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    if (!(await jobById(who.member.businessId, id, viewerOf(who.member)))) return missing();
    const card = await jobCard(who.member, id);
    return card ? Response.json({ ok: true, card }) : missing();
  });
}

/** POST (a form: text, files): a note from the team on the card's thread, also written on the deal's record. */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/card">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    if (!(await jobById(who.member.businessId, id, viewerOf(who.member)))) return missing();
    if (!allow(request, "job-card-note", 120))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const note = await readNote(request);
    if (!note.ok) return Response.json(note, { status: 422 });
    const made = await addJobNote(who.member.businessId, id, {
      side: "team",
      by: who.member.email.split("@")[0],
      byEmail: who.member.email,
      text: note.text,
      files: note.files,
    });
    return made ? Response.json({ ok: true, note: made }) : missing();
  });
}

/** PUT { send: installerId }: emails the card to an installer on file, with its drawings and their private link. */
export async function PUT(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/card">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    if (!(await jobById(who.member.businessId, id, viewerOf(who.member)))) return missing();
    if (!allow(request, "job-card-send", 30)) return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 500);
    if ("refuse" in read) return read.refuse;
    if (typeof read.body.send !== "string") return Response.json({ ok: false, message: "Choose an installer." }, { status: 422 });
    const sent = await sendJobCard(who.member, id, read.body.send);
    if (!sent.ok) return Response.json({ ok: false, message: sent.message }, { status: sent.status });
    return Response.json({ ok: true, to: sent.to, card: await jobCard(who.member, id) });
  });
}
