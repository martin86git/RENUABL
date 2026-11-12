/**
 * Server only. The transcripts of a deal's calls, for its timeline (domain/call-transcript.ts): the phone assistant's
 * (the lines kept as they were said on that attempt, else Vapi's transcript at the end) and those made from the computer
 * (Twilio's transcript, kept as lines when Sol wrote the call up). Business id first, as everywhere; the route has
 * checked the member may see the deal.
 */
import { linesFromVapi, type CallTranscript } from "@/lib/domain/call-transcript";
import { joinRuns, type LiveLine } from "@/lib/domain/live-call";
import { query } from "./db";

const KEEP = 50;

export async function callTranscriptsFor(businessId: string, jobId: string): Promise<CallTranscript[]> {
  const assistant = await query<{ id: string; at: Date; transcript: string | null; voice_call_id: string; vapi_call_id: string | null }>(
    `select e.id, e.at, e.transcript, e.voice_call_id, e.vapi_call_id
       from voice_call_events e join voice_calls c on c.id = e.voice_call_id
      where c.business_id = $1 and c.job_id = $2 and e.kind = 'ended'
      order by e.at desc limit ${KEEP}`,
    [businessId, jobId],
  );
  const said = assistant.length
    ? await query<{ voice_call_id: string; vapi_call_id: string | null; role: LiveLine["role"]; text: string }>(
        `select voice_call_id, vapi_call_id, role, text from voice_call_lines
          where voice_call_id = any($1) and role in ('assistant', 'customer') order by id`,
        [[...new Set(assistant.map((a) => a.voice_call_id))]],
      )
    : [];
  const out: CallTranscript[] = [];
  for (const a of assistant) {
    const kept = said.filter((l) => l.voice_call_id === a.voice_call_id && a.vapi_call_id && l.vapi_call_id === a.vapi_call_id);
    const lines = kept.length ? joinRuns(kept.map((l) => ({ role: l.role, text: l.text }))) : linesFromVapi(a.transcript ?? "");
    if (lines.length) out.push({ id: a.id, at: new Date(a.at).toISOString(), kind: "assistant", lines });
  }
  const computer = await query<{ id: string; at: Date; lines: LiveLine[] | null }>(
    `select id, coalesce(written_at, ended_at, created_at) as at, transcript_lines as lines from design_browser_calls
      where business_id = $1 and job_id = $2 and transcript_lines is not null
      order by created_at desc limit ${KEEP}`,
    [businessId, jobId],
  );
  for (const c of computer)
    if (Array.isArray(c.lines) && c.lines.length)
      out.push({ id: c.id, at: new Date(c.at).toISOString(), kind: "computer", lines: c.lines });
  return out;
}
