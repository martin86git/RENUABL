import { browserCallById } from "@/lib/server/browser-calls";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { browserCallSettings, recordingAudio } from "@/lib/server/twilio-voice";

/** GET: a call's recording, played on its deal, for members of the business who may see that deal. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/calls/browser/[id]/recording">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const s = browserCallSettings();
    const { id } = await ctx.params;
    const row = await browserCallById(id);
    const gone = () => new Response("Not found", { status: 404 });
    if (!s || !row || row.business_id !== who.member.businessId || !row.recording_sid) return gone();
    if (!(await jobById(who.member.businessId, row.job_id, viewerOf(who.member)))) return gone();
    const audio = await recordingAudio(s, row.recording_sid);
    if (!audio?.body) return gone();
    return new Response(audio.body, {
      headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" },
    });
  });
}
