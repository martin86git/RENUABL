/**
 * Server only. The practice call (domain/design/practice-call.ts): the business's phone assistant rings the member's own
 * mobile, from their profile, and talks to them as it would a customer. Kept in `design_practice_calls` (business id
 * first, the member's own), never on a deal or the call log. The webhook keeps what is said as it is said, so the live
 * call window shows the call with its clock and transcript, and the member can type to the assistant or hang up.
 */
import { normaliseMobile } from "@/lib/domain/contact";
import { outOfCallCredit } from "@/lib/domain/call-credit";
import { cleanTeamNote, END_CALL_COMMAND, isControlUrl, livePhase, mayEndCall, MAX_LINES, teamCommand } from "@/lib/domain/live-call";
import type { LiveCallView, LiveEvent, LiveLine } from "@/lib/domain/live-call";
import { PRACTICE_SECONDS, PRACTICE_STALE_MINUTES, practiceBlock, practiceBrief } from "@/lib/domain/design/practice-call";
import {
  MAX_LOCKS_A_CALL,
  MIN_TRAINER_LINES,
  TRAINING_LINES_GIVEN,
  TRAINING_TOOL,
  TRAINING_SCHEMA,
  TRAINING_SHOWN_DAYS,
  cleanOutcome,
  cleanTrainingAnswer,
  keepProposal,
  markProposal,
  trainerLines,
  trainingBlock,
  trainingPrompt,
  type CallKind,
  type TrainingOutcome,
  type TrainingView,
} from "@/lib/domain/design/training-call";
import { FIXED_RULES, lockRule, type CoachNote } from "@/lib/domain/design/coaching";
import { assistantConfig, toolWords } from "@/lib/domain/voice-agent";
import { parseApiKey } from "./bill-reader";
import { readWithClaude } from "./claude-reader";
import { newNoteId } from "./design-caller-coach";
import { withSolCredit } from "./sol-credits";
import { ADMIN_FIXED_RULES, cleanCallerKey, type CallerKey } from "@/lib/domain/install-call";
import { newId, query } from "./db";
import { numberOf } from "./business-numbers";
import { callerOf, coachingOf, saveCoaching, scriptFor } from "./design-caller-repo";
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
  kind?: string;
  outcome?: unknown;
  outcome_claimed_at?: Date | null;
  locked?: unknown;
}

const lockedOn = (r: PracticeRow): string[] => (Array.isArray(r.locked) ? r.locked.filter((x): x is string => typeof x === "string") : []);

type Model = { messages: { role: string; content: string }[]; tools: { type?: string }[] };

/**
 * Rings the member's own mobile for a practice call with the assistant of `role`. Only where calls are on for the
 * business; the number is the one on their profile.
 */
export async function startPracticeCall(
  member: { businessId: string; email: string },
  role: CallerKey = "sales",
  kind: CallKind = "practice",
): Promise<{ result: "placed"; assistant: string } | { result: "off" | "no-number" } | { result: "failed"; credit?: boolean }> {
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
    const script = await scriptFor(member.businessId, role);
    const firstName = me[0]?.first_name ?? null;
    const id = newId("pc");
    const config = assistantConfig({
      brief: practiceBrief({ assistant: caller.name, business, memberFirstName: firstName, ...script }),
      slots: [],
      serverUrl: `${s.site}/api/voice/vapi?ref=${encodeURIComponent(id)}`,
      secret: s.secret,
      model: s.model,
      voice: caller.voice ?? s.voice,
    });
    // Nothing on a practice call reaches a deal: only hanging up is connected, and it's told so.
    const model = config.model as unknown as Model;
    model.tools = model.tools.filter((t) => t.type === "endCall");
    // A training call has one tool of its own: a rule the trainer confirmed is locked into the script (training-call.ts).
    if (kind === "training")
      model.tools.unshift({
        type: "function",
        function: {
          name: TRAINING_TOOL,
          description: "Locks in a rule your trainer has just confirmed, so you follow it on every call from now on.",
          parameters: {
            type: "object",
            properties: { rule: { type: "string", description: "The rule as a one-line instruction to yourself." } },
            required: ["rule"],
          },
        },
      } as Model["tools"][number]);
    // A training call: the member is the agent's trainer, not a customer (training-call.ts).
    model.messages[0].content += `\n\n${
      kind === "training"
        ? trainingBlock({ assistant: caller.name, memberFirstName: firstName, business })
        : practiceBlock({ memberFirstName: firstName, business })
    }`;
    const assistant = { ...config, maxDurationSeconds: PRACTICE_SECONDS };
    delete (assistant as { voicemailMessage?: string }).voicemailMessage;

    await query(
      `insert into design_practice_calls (id, business_id, member_email, first_name, role, kind) values ($1, $2, lower($3), $4, $5, $6)`,
      [id, member.businessId, member.email, firstName, role, kind],
    );
    const res = await fetch(`${VAPI}/call`, {
      method: "POST",
      headers: { authorization: `Bearer ${s.key}`, "content-type": "application/json" },
      body: JSON.stringify({
        phoneNumberId: (await numberOf(member.businessId))?.vapiId ?? s.phoneNumberId,
        customer: { number: mobile },
        name: kind === "training" ? "Training call" : "Practice call",
        assistant,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: unknown; message?: unknown; monitor?: { controlUrl?: unknown } };
    if (!res.ok || typeof json.id !== "string") {
      console.error("practice call not placed", `Vapi ${res.status}: ${String(json.message ?? "").slice(0, 200)}`);
      await query(`update design_practice_calls set live_status = 'ended', ended_at = now() where id = $1`, [id]);
      // Out of credit at the phone service: trying again can't help, so the member is told (call-credit.ts).
      return { result: "failed", credit: outOfCallCredit(json.message) };
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
    role: cleanCallerKey(r.role),
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

/* ── Training calls (domain/design/training-call.ts): what the trainer asked for, written up to keep or drop ── */

/**
 * The training call's tool: a rule the trainer confirmed out loud is kept in the agent's script as a locked rule, there
 * and then. Only on a training call still under way, at most MAX_LOCKS_A_CALL a call. Answers what the agent should
 * say. Never throws.
 */
export async function lockInFromTraining(ref: string, args: unknown): Promise<string> {
  try {
    const rows = await query<PracticeRow>(
      `select *, now() as now from design_practice_calls where id = $1 and kind = 'training' and ended_at is null`,
      [ref],
    );
    const r = rows[0];
    if (!r) return "Not locked: this isn't a training call.";
    if (lockedOn(r).length >= MAX_LOCKS_A_CALL)
      return "Not locked: that's as many rules as one call can lock in. Tell them it will be waiting in your chat to lock in after the call.";
    const role = cleanCallerKey(r.role);
    const coaching = await coachingOf(r.business_id, role);
    const got = lockRule(coaching.notes, toolWords(args, "rule", 240), {
      at: new Date().toISOString(),
      by: r.member_email,
      from: "call",
      newId: newNoteId,
    });
    if (!got.text) return "Not locked: say the rule in a few plain words and try again.";
    if (!got.done)
      return "Not locked: there are already as many locked rules as you can keep. Tell them to unlock one in your script first.";
    await saveCoaching(r.business_id, { notes: got.notes, turns: coaching.turns }, r.member_email, role);
    await query(`update design_practice_calls set locked = locked || jsonb_build_array($2::text) where id = $1`, [ref, got.text]);
    return `Locked in: "${got.text}". Tell them it's locked in and that you'll follow it on every call from now on.`;
  } catch (e) {
    console.error("rule not locked in", e instanceof Error ? e.message : e);
    return "Not locked: something went wrong. Tell them it will be waiting in your chat after the call.";
  }
}

const overNow = (r: PracticeRow): boolean => {
  if (r.ended_at || r.live_status === "ended") return true;
  const since = new Date(r.now).getTime() - new Date(r.started_at ?? r.created_at).getTime();
  return since > PRACTICE_STALE_MINUTES * 60_000;
};

/**
 * Reads a finished training call for what the trainer asked to change, once: the row is claimed first, so the webhook
 * and the window asking at the same moment make one reading. One Sol answer (deep), as a message in its chat is.
 * Nothing in the agent's script changes here: the outcome is proposals. Never throws.
 */
export async function writeUpTraining(id: string): Promise<void> {
  try {
    const rows = await query<PracticeRow>(
      `update design_practice_calls set outcome_claimed_at = now()
        where id = $1 and kind = 'training' and outcome is null
          and (outcome_claimed_at is null or outcome_claimed_at < now() - interval '3 minutes')
        returning *, now() as now`,
      [id],
    );
    const r = rows[0];
    if (!r) return;
    const save = (o: TrainingOutcome) =>
      query(`update design_practice_calls set outcome = $2::jsonb where id = $1`, [id, JSON.stringify(o)]).then(() => undefined);
    const empty = (state: TrainingOutcome["state"]) => save({ state, summary: "", items: [] });
    try {
      const lines = Array.isArray(r.lines) ? r.lines : [];
      if (trainerLines(lines) < MIN_TRAINER_LINES) return await empty("short");
      const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
      if (!apiKey) return await empty("failed");
      const role = cleanCallerKey(r.role);
      const [caller, coaching, biz] = await Promise.all([
        callerOf(r.business_id, role),
        coachingOf(r.business_id, role),
        query<{ name: string }>(`select name from businesses where id = $1`, [r.business_id]),
      ]);
      const business = (await loadBrand(r.business_id, biz[0]?.name ?? "").catch(() => null))?.name || biz[0]?.name || "";
      const prompt = trainingPrompt({
        assistant: caller.name,
        business,
        notes: coaching.notes,
        lines,
        fixed: role === "admin" ? ADMIN_FIXED_RULES : FIXED_RULES,
        lockedOnCall: lockedOn(r),
      });
      const raw = await withSolCredit(
        r.business_id,
        "chat",
        r.member_email,
        (ai) => readWithClaude<unknown>([], TRAINING_SCHEMA, prompt, apiKey, ai),
        "deep",
        "training",
      );
      if (raw === "out") return await empty("out");
      const got = cleanTrainingAnswer(raw, coaching.notes);
      await save({ state: got.items.length ? "ready" : "none", ...got });
    } catch (e) {
      console.error("training call not written up", e instanceof Error ? e.message : e);
      await empty("failed").catch(() => undefined);
    }
  } catch (e) {
    console.error("training call not claimed", e instanceof Error ? e.message : e);
  }
}

/**
 * The agent's latest training call, for its chat window: still on, being written up, or what came of it. `writeUp` is
 * the call's id when it is over and nobody has started reading it (the route does so after answering).
 */
export async function trainingFor(businessId: string, role: CallerKey): Promise<{ view: TrainingView | null; writeUp: string | null }> {
  const rows = await query<PracticeRow>(
    `select *, now() as now from design_practice_calls
      where business_id = $1 and role = $2 and kind = 'training' and created_at > now() - make_interval(days => $3)
      order by created_at desc limit 1`,
    [businessId, role, TRAINING_SHOWN_DAYS],
  );
  const r = rows[0];
  if (!r) return { view: null, writeUp: null };
  const outcome = cleanOutcome(r.outcome);
  const over = overNow(r);
  const claimed = r.outcome_claimed_at ? new Date(r.now).getTime() - new Date(r.outcome_claimed_at).getTime() < 3 * 60_000 : false;
  return {
    view: {
      id: r.id,
      at: new Date(r.created_at).toISOString(),
      by: r.first_name,
      standing: outcome ? "done" : over ? "working" : "live",
      outcome,
      lockedOnCall: lockedOn(r),
      lines: (Array.isArray(r.lines) ? r.lines : [])
        .filter((l) => typeof l?.text === "string" && l.text.trim())
        .slice(0, TRAINING_LINES_GIVEN)
        .map((l) => ({ role: l.role, text: l.text.slice(0, 600) })),
    },
    writeUp: over && !outcome && !claimed ? r.id : null,
  };
}

/**
 * A proposal kept or dropped by someone who may change the agent's script. Kept, it goes into the script as any note
 * does; a note a person has changed since the call is left alone (`gone`). A failed write-up can be tried again.
 */
export async function answerTraining(
  businessId: string,
  role: CallerKey,
  by: string,
  o: { id: string; proposal?: string; do: "lock" | "keep" | "drop" | "retry" },
): Promise<{ ok: true; notes: CoachNote[]; gone: boolean; full: boolean } | { ok: false }> {
  const rows = await query<PracticeRow>(
    `select *, now() as now from design_practice_calls where id = $1 and business_id = $2 and role = $3 and kind = 'training'`,
    [o.id, businessId, role],
  );
  const r = rows[0];
  const outcome = cleanOutcome(r?.outcome);
  if (!r || !outcome) return { ok: false };
  const coaching = await coachingOf(businessId, role);
  if (o.do === "retry") {
    if (outcome.state !== "failed" && outcome.state !== "out") return { ok: false };
    await query(`update design_practice_calls set outcome = null, outcome_claimed_at = null where id = $1`, [r.id]);
    return { ok: true, notes: coaching.notes, gone: false, full: false };
  }
  const p = outcome.items.find((x) => x.id === o.proposal && x.state === "open");
  if (!p) return { ok: false };
  let notes = coaching.notes;
  let done = true;
  const keeping = o.do === "keep" || o.do === "lock";
  if (keeping) {
    const kept = keepProposal(coaching.notes, p, { at: new Date().toISOString(), by, newId: newNoteId, lock: o.do === "lock" });
    // No room for another locked rule: nothing changes, and the proposal stays to keep as a note or try again.
    if (kept.full) return { ok: true, notes: coaching.notes, gone: false, full: true };
    done = kept.done;
    if (done) {
      notes = kept.notes;
      await saveCoaching(businessId, { notes, turns: coaching.turns }, by, role);
    }
  }
  const next = markProposal(outcome, p.id, keeping && done ? (o.do === "lock" && p.kind !== "remove" ? "locked" : "kept") : "dropped");
  await query(`update design_practice_calls set outcome = $2::jsonb where id = $1`, [r.id, JSON.stringify(next)]);
  return { ok: true, notes, gone: keeping && !done, full: false };
}
