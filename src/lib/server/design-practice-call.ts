/**
 * Server only. The practice call (domain/design/practice-call.ts): the business's phone assistant rings the member's own
 * mobile, from their profile, and talks to them as it would a customer. Kept in `design_practice_calls` (business id
 * first, the member's own), never on a deal or the call log. The webhook keeps what is said as it is said, so the live
 * call window shows the call with its clock and transcript, and the member can type to the assistant or hang up.
 */
import { normaliseMobile } from "@/lib/domain/contact";
import { cleanTeamNote, END_CALL_COMMAND, isControlUrl, livePhase, mayEndCall, MAX_LINES, teamCommand } from "@/lib/domain/live-call";
import type { LiveCallView, LiveEvent, LiveLine } from "@/lib/domain/live-call";
import { PRACTICE_SECONDS, PRACTICE_STALE_MINUTES, practiceBlock, practiceBrief } from "@/lib/domain/design/practice-call";
import { assistantConfig } from "@/lib/domain/voice-agent";
import type { CallerRole } from "@/lib/domain/install-call";
import { newId, query } from "./db";
import { callerOf, coachingOf } from "./design-caller-repo";
import { loadBrand } from "./design-proposal-repo";
import { voiceOnFor, voiceSettings } from "./voice-calls";

const VAPI = "https://api.vapi.ai";

interface PracticeRow {
  id: string;
  business_id: string;
  member_email: string;
  first_name: string | null;
  role: string;
  vapi_call_id: string | null;
  control_url: string | null;
  live_status: string | null;
  started_at: Date | null;
  ended_at: Date | null;
  partial: LiveLine | null;
  lines: LiveLine[];
  created_at: Date;
  now: Date;
}

type Model = { messages: { role: string; content: string }[]; tools: { type?: string }[] };

/**
 * Rings the member's own mobile for a practice call with the assistant of `role`. Only where calls are on for the
 * business; the number is the one on their profile.
 */
export async function startPracticeCall(
  member: { businessId: string; email: string },
  role: CallerRole = "sales",
): Promise<{ result: "placed"; assistant: string } | { result: "off" | "no-number" | "failed" }> {
  const s = voiceSettings();
  if (!s || !(await voiceOnFor(member.businessId).catch(() => false))) return { result: "off" };
  const me = await query<{ mobile: string | null; first_name: string | null }>(
    `select mobile, first_name from business_members where business_id = $1 and lower(email) = lower($2)`,
    [member.businessId, member.email],
  );
  const mobile = normaliseMobile(me[0]?.mobile ?? "");
  if (!mobile) return { result: "no-number" };
  try {
    const caller = await callerOf(member.businessId, role);
    const biz = await query<{ name: string }>(`select name from businesses where id = $1`, [member.businessId]);
    const business = (await loadBrand(member.businessId, biz[0]?.name ?? "").catch(() => null))?.name || biz[0]?.name || "";
    const coaching = (await coachingOf(member.businessId, role).catch(() => null))?.notes.map((n) => n.text) ?? [];
    const firstName = me[0]?.first_name ?? null;
    const id = newId("pc");
    const config = assistantConfig({
      brief: practiceBrief({ assistant: caller.name, business, memberFirstName: firstName, coaching }),
      slots: [],
      serverUrl: `${s.site}/api/voice/vapi?ref=${encodeURIComponent(id)}`,
      secret: s.secret,
      model: s.model,
      voice: caller.voice ?? s.voice,
    });
    // Nothing on a practice call reaches a deal: only hanging up is connected, and it's told so.
    const model = config.model as unknown as Model;
    model.tools = model.tools.filter((t) => t.type === "endCall");
    model.messages[0].content += `\n\n${practiceBlock({ memberFirstName: firstName, business })}`;
    const assistant = { ...config, maxDurationSeconds: PRACTICE_SECONDS };
    delete (assistant as { voicemailMessage?: string }).voicemailMessage;

    await query(`insert into design_practice_calls (id, business_id, member_email, first_name, role) values ($1, $2, lower($3), $4, $5)`, [
      id,
      member.businessId,
      member.email,
      firstName,
      role,
    ]);
    const res = await fetch(`${VAPI}/call`, {
      method: "POST",
      headers: { authorization: `Bearer ${s.key}`, "content-type": "application/json" },
      body: JSON.stringify({ phoneNumberId: s.phoneNumberId, customer: { number: mobile }, name: "Practice call", assistant }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: unknown; message?: unknown; monitor?: { controlUrl?: unknown } };
    if (!res.ok || typeof json.id !== "string") {
      console.error("practice call not placed", `Vapi ${res.status}: ${String(json.message ?? "").slice(0, 200)}`);
      await query(`update design_practice_calls set live_status = 'ended', ended_at = now() where id = $1`, [id]);
      return { result: "failed" };
    }
    const control = typeof json.monitor?.controlUrl === "string" && isControlUrl(json.monitor.controlUrl) ? json.monitor.controlUrl : null;
    await query(`update design_practice_calls set vapi_call_id = $2, control_url = coalesce($3, control_url) where id = $1`, [
      id,
      json.id,
      control,
    ]);
    return { result: "placed", assistant: caller.name };
  } catch (e) {
    console.error("practice call not placed", e instanceof Error ? e.message : e);
    return { result: "failed" };
  }
}

/** From the webhook: keeps a practice call's status and what is said. Never throws. */
export async function keepPracticeLive(ref: string, e: LiveEvent): Promise<void> {
  try {
    if (e.kind === "status") {
      await query(
        `update design_practice_calls set live_status = $2, control_url = coalesce($3, control_url),
           vapi_call_id = coalesce(vapi_call_id, $4),
           started_at = case when $2 = 'in-progress' then coalesce(started_at, now()) else started_at end,
           ended_at = case when $2 = 'ended' then coalesce(ended_at, now()) else ended_at end,
           partial = case when $2 = 'ended' then null else partial end
         where id = $1`,
        [ref, e.status, e.controlUrl, e.callId],
      );
      return;
    }
    const line = JSON.stringify({ role: e.role, text: e.text });
    if (!e.final) {
      await query(`update design_practice_calls set partial = $2 where id = $1`, [ref, line]);
      return;
    }
    await query(
      `update design_practice_calls set lines = lines || jsonb_build_array($2::jsonb),
         partial = case when partial->>'role' = $3 then null else partial end
       where id = $1 and jsonb_array_length(lines) < $4`,
      [ref, line, e.role, MAX_LINES],
    );
  } catch (err) {
    console.error("practice call not kept", err instanceof Error ? err.message : err);
  }
}

async function latest(businessId: string, email: string): Promise<PracticeRow | null> {
  const rows = await query<PracticeRow>(
    `select *, now() as now from design_practice_calls
      where business_id = $1 and member_email = lower($2) and created_at > now() - interval '6 hours'
      order by created_at desc limit 1`,
    [businessId, email],
  );
  return rows[0] ?? null;
}

/** The member's latest practice call, for the live call window. */
export async function practiceLive(businessId: string, email: string): Promise<LiveCallView | null> {
  const r = await latest(businessId, email);
  if (!r) return null;
  const now = new Date(r.now).getTime();
  const started = r.started_at ? new Date(r.started_at).getTime() : null;
  const ended = r.ended_at ? new Date(r.ended_at).getTime() : null;
  const since = now - new Date(started ?? r.created_at).getTime();
  // A call Vapi never told us the end of is over once it has run past what a practice call can.
  const stale = !ended && since > PRACTICE_STALE_MINUTES * 60_000;
  const liveStatus = stale ? "ended" : r.live_status;
  const over = Boolean(ended) || stale;
  return {
    phase: livePhase({ status: over ? "done" : "calling", liveStatus }),
    customer: "you",
    outcome: null,
    booked: null,
    role: r.role === "admin" ? "admin" : "sales",
    attempts: 1,
    startedAgo: started === null ? null : now - started,
    ranFor: started !== null && ended !== null ? ended - started : null,
    lines: Array.isArray(r.lines) ? r.lines : [],
    partial: !over && r.partial && (r.partial.role === "assistant" || r.partial.role === "customer") ? r.partial : null,
    canSteer: !over && Boolean(r.control_url) && liveStatus === "in-progress",
    canEnd: !over && mayEndCall({ controlUrl: r.control_url, liveStatus }),
    transcriptId: null,
  };
}

/** The member types to the assistant on their practice call. */
export async function steerPractice(
  businessId: string,
  email: string,
  o: { text: unknown; say: boolean },
): Promise<"sent" | "not-on" | "failed" | "empty"> {
  const text = cleanTeamNote(o.text);
  if (!text) return "empty";
  const r = await latest(businessId, email);
  if (!r?.control_url || r.live_status !== "in-progress" || r.ended_at) return "not-on";
  try {
    const res = await fetch(r.control_url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(teamCommand({ text, say: o.say, business: "" })),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return res.status === 400 ? "not-on" : "failed";
    await query(`update design_practice_calls set lines = lines || jsonb_build_array($2::jsonb) where id = $1`, [
      r.id,
      JSON.stringify({ role: o.say ? "team-say" : "team", text }),
    ]);
    return "sent";
  } catch {
    return "failed";
  }
}

/** The member hangs up their practice call. */
export async function endPractice(businessId: string, email: string): Promise<"ended" | "not-on" | "failed"> {
  const r = await latest(businessId, email);
  if (!r || r.ended_at || !mayEndCall({ controlUrl: r.control_url, liveStatus: r.live_status })) return "not-on";
  try {
    const res = await fetch(r.control_url!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(END_CALL_COMMAND),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Vapi ${res.status}`);
  } catch (e) {
    console.error("practice call not ended", e instanceof Error ? e.message : e);
    return "failed";
  }
  await query(
    `update design_practice_calls set live_status = 'ended', ended_at = coalesce(ended_at, now()), partial = null,
       lines = lines || jsonb_build_array(jsonb_build_object('role', 'team-end', 'text', 'Ended the call'))
     where id = $1`,
    [r.id],
  );
  return "ended";
}
