import { installerBy, isJobToken } from "@/lib/domain/design/job-card";
import { answer } from "@/lib/server/design-context";
import { readNote } from "@/lib/server/design-job-card";
import { addJobNote, cardByToken, jobCard } from "@/lib/server/design-job-card-repo";
import { allow } from "@/lib/server/rate-limit";

const gone = () => Response.json({ ok: false, message: "This job card isn't available." }, { status: 404 });

/**
 * GET → { card, installer }: the job card behind an installer's private link, with no sign-in: only that job, only
 * while they are on the business's file, and never the customer's email.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/job/[token]">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "job-card-link", 120)) return new Response(null, { status: 429 });
    const link = isJobToken(token) ? await cardByToken(token) : null;
    if (!link) return gone();
    const card = await jobCard({ businessId: link.businessId, businessName: link.businessName }, link.jobId, true);
    return card ? Response.json({ ok: true, card, installer: link.installer.name }) : gone();
  });
}

/** POST (a form: text, files, person): the installer's note and photos on the card, named for them. */
export async function POST(request: Request, ctx: RouteContext<"/api/job/[token]">) {
  return answer(async () => {
    const { token } = await ctx.params;
    if (!allow(request, "job-card-link-note", 60))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const link = isJobToken(token) ? await cardByToken(token) : null;
    if (!link) return gone();
    const note = await readNote(request);
    if (!note.ok) return Response.json(note, { status: 422 });
    const made = await addJobNote(link.businessId, link.jobId, {
      side: "installer",
      by: installerBy(link.installer.name, note.person),
      byEmail: null,
      text: note.text,
      files: note.files,
    });
    return made ? Response.json({ ok: true, note: made }) : gone();
  });
}
