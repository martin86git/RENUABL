/**
 * Server only. The call log on Today (domain/design/call-log.ts): Sol's calls through Vapi (`voice_call_events` ended,
 * on `voice_calls` tied to a deal) and the calls the team logged on a deal (`design_activity` kind call by a member),
 * only on the deals this member may see. Business id first, from the signed-in member only.
 */
import type { DealViewer } from "@/lib/domain/design/account";
import { CALL_LOG_DAYS, CALL_LOG_MAX, loggedWords, type CallComing, type CallLogEntry } from "@/lib/domain/design/call-log";
import { LIVE_NOW_MAX, liveNowOrder, livePhase, underWay, type LiveCallNow } from "@/lib/domain/live-call";
import {
  ASSISTANT_DEAL_DAYS,
  ASSISTANT_DEALS_MAX,
  dealOrder,
  headlineOf,
  standingOf,
  type AssistantDeal,
  type AssistantDealCall,
} from "@/lib/domain/design/assistant-deals";
import { STAGE_LABELS, type JobStage } from "@/lib/domain/design/crm";
import { CALL_HEADLINES, type CallOutcome } from "@/lib/domain/voice-agent";
import { callTranscriptsFor } from "./call-transcripts";
import { cleanCallerKey, type CallerKey } from "@/lib/domain/install-call";
import { query } from "./db";
import { seen, seenParams } from "./design-crm-repo";
import { voiceOnFor } from "./voice-calls";

export interface CallLog {
  calls: CallLogEntry[];
  coming: CallComing[];
  /** Whether Sol's phone calls are on for this business (voiceOnFor). */
  solOn: boolean;
}

/**
 * Every call of the phone assistant's that is ringing or on right now, on the deals this member may see (13 Nov 2026,
 * Martin: several customers called at once should be plain to see, each one a press away). An answered call older than
 * two hours is taken as one whose end never reached us and left out.
 */
export async function liveCallsNow(businessId: string, viewer: DealViewer): Promise<LiveCallNow[]> {
  const rows = await query<{
    job_id: string;
    customer: string;
    deal: string;
    status: string;
    live_status: string | null;
    live_started_at: Date | null;
    by: string | null;
    last_role: string | null;
    last_text: string | null;
    now: Date;
  }>(
    `select j.id as job_id, cu.name as customer, j.title as deal, c.status, c.live_status, c.live_started_at,
            c.lead->>'assistant' as by, l.role as last_role, l.text as last_text, now() as now
       from voice_calls c
       join design_jobs j on j.business_id = c.business_id and j.id = c.job_id
       join design_customers cu on cu.business_id = j.business_id and cu.id = j.customer_id
       left join lateral (
         select role, text from voice_call_lines
          where voice_call_id = c.id and vapi_call_id = c.live_vapi_id and role in ('assistant', 'customer')
          order by id desc limit 1
       ) l on true
      where c.business_id = $1 and c.status in ('waiting', 'calling')
        and c.live_status in ('ringing', 'in-progress', 'forwarding')
        and (c.live_started_at is null or c.live_started_at > now() - interval '2 hours')
        and ${seen(viewer, 3)}
      limit $2`,
    [businessId, LIVE_NOW_MAX, ...seenParams(viewer)],
  );
  const calls: LiveCallNow[] = [];
  for (const r of rows) {
    const phase = livePhase({ status: r.status, liveStatus: r.live_status });
    if (!underWay(phase)) continue;
    const started = r.live_started_at ? new Date(r.live_started_at).getTime() : null;
    calls.push({
      jobId: r.job_id,
      customer: r.customer,
      deal: r.deal,
      phase,
      startedAgo: phase === "on-call" && started !== null ? new Date(r.now).getTime() - started : null,
      by: r.by || "Sol",
      last: r.last_text && (r.last_role === "assistant" || r.last_role === "customer") ? { role: r.last_role, text: r.last_text } : null,
    });
  }
  return liveNowOrder(calls);
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
    live_status: string | null;
    live_started_at: Date | null;
    by: string | null;
  }>(
    `select c.id, j.id as job_id, cu.name as customer, j.title as deal, c.mode, c.status, c.attempts, c.updated_at as at,
            c.live_status, c.live_started_at, c.lead->>'assistant' as by
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
      phase: livePhase({ status: r.status, liveStatus: r.live_status }),
      startedAt: r.live_started_at ? new Date(r.live_started_at).toISOString() : null,
      by: r.by || "Sol",
    })),
    solOn: await voiceOnFor(businessId),
  };
}

/**
 * The deals the sales phone assistant is across (domain/design/assistant-deals.ts): every deal this member may see with
 * a call of its own in the last ASSISTANT_DEAL_DAYS, lined up, on now or ended, with where each stands. The admin
 * assistant's booking calls are left out.
 */
/**
 * Whose calls: booking calls are the post-sale agent's; every other call is the sales agent's it was handed to (the
 * first when none is named). `t` is the voice_calls alias with its dot. The key is from cleanCallerKey's fixed list.
 */
const callsOf = (role: CallerKey, t: string) =>
  role === "admin" ? "= 'install'" : `<> 'install' and coalesce(${t}lead->>'agent', 'sales') = '${cleanCallerKey(role)}'`;

export async function assistantDeals(businessId: string, viewer: DealViewer, role: CallerKey = "sales"): Promise<AssistantDeal[]> {
  // Each assistant's own calls: booking calls are the post-sale assistant's, every other the sales assistant's.
  const mine = (t: string) => callsOf(role, t);
  const rows = await query<{
    job_id: string;
    customer: string;
    deal: string;
    stage: JobStage;
    address: string | null;
    status: string;
    live_status: string | null;
    attempts: number;
    updated_at: Date;
    due_at: Date | null;
    outcome: string | null;
    summary: string | null;
    ended_at: Date | null;
    calls: number;
  }>(
    `select j.id as job_id, cu.name as customer, j.title as deal, j.stage, j.address,
            c.status, c.live_status, c.attempts, c.updated_at, c.due_at, e.outcome, e.summary, e.at as ended_at,
            coalesce(n.calls, 0) as calls
       from design_jobs j
       join design_customers cu on cu.business_id = j.business_id and cu.id = j.customer_id
       join lateral (
         select status, live_status, attempts, updated_at, due_at from voice_calls
          where business_id = j.business_id and job_id = j.id and mode ${mine("")}
          order by updated_at desc limit 1
       ) c on true
       left join lateral (
         select ev.outcome, ev.summary, ev.at from voice_call_events ev
           join voice_calls vc on vc.id = ev.voice_call_id
          where vc.business_id = j.business_id and vc.job_id = j.id and vc.mode ${mine("vc.")} and ev.kind = 'ended'
          order by ev.at desc limit 1
       ) e on true
       left join lateral (
         select count(*)::int as calls from voice_call_events ev
           join voice_calls vc on vc.id = ev.voice_call_id
          where vc.business_id = j.business_id and vc.job_id = j.id and vc.mode ${mine("vc.")} and ev.kind = 'ended'
       ) n on true
      where j.business_id = $1 and c.updated_at > now() - make_interval(days => $2) and ${seen(viewer, 4)}
      order by c.updated_at desc limit $3`,
    [businessId, ASSISTANT_DEAL_DAYS, ASSISTANT_DEALS_MAX, ...seenParams(viewer)],
  );
  return dealOrder(
    rows.map((r) => {
      const open = r.status === "waiting" || r.status === "calling";
      const phase = livePhase({ status: r.status, liveStatus: r.live_status });
      const outcome = (r.outcome as CallOutcome | null) ?? null;
      const standing = standingOf({ open, live: open && underWay(phase), outcome });
      const at = [r.updated_at, r.ended_at].filter((d): d is Date => Boolean(d)).map((d) => new Date(d).getTime());
      return {
        jobId: r.job_id,
        customer: r.customer,
        deal: r.deal,
        stage: STAGE_LABELS[r.stage] ?? r.stage,
        address: r.address ?? "",
        standing,
        headline: headlineOf(standing, outcome, r.attempts),
        words: r.summary ?? "",
        calls: r.calls,
        at: new Date(Math.max(...at)).toISOString(),
        dueAt: open && r.due_at ? new Date(r.due_at).toISOString() : null,
      };
    }),
  );
}

/** The sales assistant's calls on one deal that have ended, newest first, each as it was said. The caller has checked the member may see the deal. */
export async function assistantDealCalls(businessId: string, jobId: string, role: CallerKey = "sales"): Promise<AssistantDealCall[]> {
  const mine = (t: string) => callsOf(role, t);
  const [ended, said] = await Promise.all([
    query<{ id: string; at: Date; outcome: string | null; summary: string | null }>(
      `select e.id, e.at, e.outcome, e.summary from voice_call_events e join voice_calls c on c.id = e.voice_call_id
        where c.business_id = $1 and c.job_id = $2 and c.mode ${mine("c.")} and e.kind = 'ended'
        order by e.at desc limit 20`,
      [businessId, jobId],
    ),
    callTranscriptsFor(businessId, jobId),
  ]);
  return ended.map((e) => {
    const outcome = (e.outcome as CallOutcome | null) ?? "talked";
    return {
      id: e.id,
      at: new Date(e.at).toISOString(),
      outcome,
      headline: CALL_HEADLINES[outcome] ?? "Called",
      words: e.summary ?? "",
      lines: said.find((t) => t.id === e.id)?.lines.map((l) => ({ role: l.role, text: l.text })) ?? [],
    };
  });
}
