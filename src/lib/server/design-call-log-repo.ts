/**
 * Server only. The call log on Today (domain/design/call-log.ts): Sol's calls through Vapi (`voice_call_events` ended,
 * on `voice_calls` tied to a deal) and the calls the team logged on a deal (`design_activity` kind call by a member),
 * only on the deals this member may see. Business id first, from the signed-in member only.
 */
import type { DealViewer } from "@/lib/domain/design/account";
import { CALL_LOG_DAYS, CALL_LOG_MAX, loggedWords, type CallComing, type CallLogEntry } from "@/lib/domain/design/call-log";
import type { CallOutcome } from "@/lib/domain/voice-agent";
import { query } from "./db";
import { seen, seenParams } from "./design-crm-repo";
import { voiceOnFor } from "./voice-calls";

export interface CallLog {
  calls: CallLogEntry[];
  coming: CallComing[];
  /** Whether Sol's phone calls are on for this business (voiceOnFor). */
  solOn: boolean;
}

export async function callLog(businessId: string, viewer: DealViewer): Promise<CallLog> {
  const p = [businessId, CALL_LOG_DAYS, CALL_LOG_MAX, ...seenParams(viewer)];
  const sol = await query<{
    id: string;
    job_id: string;
    customer: string;
    deal: string;
    at: Date;
    by: string | null;
    outcome: string | null;
    summary: string | null;
    transcript: string | null;
  }>(
    `select e.id, j.id as job_id, cu.name as customer, j.title as deal, e.at, c.lead->>'assistant' as by,
            e.outcome, e.summary, e.transcript
       from voice_call_events e
       join voice_calls c on c.id = e.voice_call_id
       join design_jobs j on j.business_id = c.business_id and j.id = c.job_id
       join design_customers cu on cu.business_id = j.business_id and cu.id = j.customer_id
      where c.business_id = $1 and e.kind = 'ended' and e.at > now() - make_interval(days => $2) and ${seen(viewer, 4)}
      order by e.at desc limit $3`,
    p,
  );
  // The team's own: a call logged by a member (the assistant's lines are written by its name, never an email).
  const team = await query<{ id: string; job_id: string; customer: string; deal: string; at: Date; by: string; text: string }>(
    `select a.id, j.id as job_id, cu.name as customer, j.title as deal, a.at, a.by_email as by, a.text
       from design_activity a
       join design_jobs j on j.business_id = a.business_id and j.id = a.job_id
       join design_customers cu on cu.business_id = j.business_id and cu.id = j.customer_id
      where a.business_id = $1 and a.kind = 'call' and a.by_email like '%@%'
        and a.at > now() - make_interval(days => $2) and ${seen(viewer, 4)}
      order by a.at desc limit $3`,
    p,
  );
  const coming = await query<{
    id: string;
    job_id: string;
    customer: string;
    deal: string;
    mode: string;
    status: string;
    attempts: number;
    at: Date;
  }>(
    `select c.id, j.id as job_id, cu.name as customer, j.title as deal, c.mode, c.status, c.attempts, c.updated_at as at
       from voice_calls c
       join design_jobs j on j.business_id = c.business_id and j.id = c.job_id
       join design_customers cu on cu.business_id = j.business_id and cu.id = j.customer_id
      where c.business_id = $1 and c.status in ('waiting', 'calling') and $2::int > 0 and ${seen(viewer, 4)}
      order by c.updated_at desc limit $3`,
    p,
  );
  const calls: CallLogEntry[] = [
    ...sol.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      customer: r.customer,
      deal: r.deal,
      at: new Date(r.at).toISOString(),
      who: "sol" as const,
      by: r.by || "Sol",
      outcome: (r.outcome as CallOutcome | null) ?? "talked",
      words: r.summary ?? "",
      transcript: r.transcript,
    })),
    ...team.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      customer: r.customer,
      deal: r.deal,
      at: new Date(r.at).toISOString(),
      who: "team" as const,
      by: r.by,
      outcome: null,
      words: loggedWords(r.text),
      transcript: null,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, CALL_LOG_MAX);
  return {
    calls,
    coming: coming.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      customer: r.customer,
      deal: r.deal,
      mode: r.mode === "proposal" ? "proposal" : "lead",
      status: r.status === "calling" ? "calling" : "waiting",
      attempts: r.attempts,
      at: new Date(r.at).toISOString(),
    })),
    solOn: await voiceOnFor(businessId),
  };
}
