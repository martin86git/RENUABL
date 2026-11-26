/**
 * Server only. Calls made from the computer (domain/browser-call.ts), one row a call in `design_browser_calls`,
 * business id first as everywhere. A press on Call makes a ticket for that deal (`openTicket`: the number is the one on
 * the customer's record, never one sent from a browser); Twilio brings the ticket back with the member's identity
 * (`takeTicket`, once, within TICKET_SECONDS); how it ended and its recording follow (`callEnded`, `callRecorded`), and
 * the call is written on the deal, with Sol's write-up of both sides when Twilio's transcripts are on (`writeUp`).
 * The number rung from is the business's own (voice add-on), RENUABL's for RENUABL's own business (`mayCallFromBrowser`).
 */
import {
  MAX_LIVE_WORDS,
  MIN_WRITE_UP_WORDS,
  NOT_WRITTEN,
  TICKET_SECONDS,
  browserCallHeadline,
  callEnd,
  dialogue,
  recordingLine,
  wordCount,
  type CallEnd,
  type LiveEvent,
  type LiveWords,
} from "@/lib/domain/browser-call";
import { normaliseMobile } from "@/lib/domain/contact";
import { MAX_LINES, joinRuns } from "@/lib/domain/live-call";
import { CALL_NOTES_SCHEMA, callNotesPrompt, callNotesText, cleanCallNotes } from "@/lib/domain/design/call-notes";
import { USE_TIER } from "@/lib/domain/design/sol-routing";
import { parseApiKey, redactSecrets } from "./bill-reader";
import { readWithClaude } from "./claude-reader";
import { dbConfigured, newId, query, transaction } from "./db";
import { record } from "./design-crm-repo";
import { loadBrand } from "./design-proposal-repo";
import { numberOf } from "./business-numbers";
import { hasAddOn } from "./design-addons";
import { renuablCrm } from "./renuabl-crm";
import { withSolCredit } from "./sol-credits";
import {
  browserCallSettings,
  startLiveTranscription,
  startTranscript,
  stopLiveTranscription,
  transcriptSentences,
  type BrowserCallSettings,
} from "./twilio-voice";

export interface BrowserCallRow {
  id: string;
  business_id: string;
  job_id: string;
  customer_id: string;
  customer_name: string;
  member_email: string;
  identity: string;
  number: string;
  status: "ready" | "ringing" | "ended" | "written";
  call_end: CallEnd | null;
  seconds: number | null;
  recording_sid: string | null;
  transcript_sid: string | null;
  call_sid?: string | null;
  live_sid?: string | null;
}

/**
 * Whether this business's members may call from the computer: set up, and a number to ring from (business-numbers.ts):
 * RENUABL's for RENUABL's own business, else the business's own, which comes with the voice add-on.
 */
export async function mayCallFromBrowser(businessId: string): Promise<boolean> {
  if (!browserCallSettings() || !dbConfigured()) return false;
  if ((await renuablCrm().catch(() => null))?.businessId === businessId) return true;
  const [addOn, number] = await Promise.all([hasAddOn(businessId, "voice").catch(() => false), numberOf(businessId).catch(() => null)]);
  return addOn && Boolean(number);
}

/** The number a business's calls from the computer show: its own, else the site's (RENUABL's). */
export async function callerIdFor(businessId: string, fallback: string): Promise<string> {
  const n = await numberOf(businessId).catch(() => null);
  return n && !n.renuabl ? n.e164 : fallback;
}

/** A ticket for one call to this deal's customer, or why there can't be one. */
export async function openTicket(o: {
  businessId: string;
  jobId: string;
  customerId: string;
  customerName: string;
  phone: string;
  memberEmail: string;
  identity: string;
}): Promise<{ id: string } | "no-number"> {
  const number = normaliseMobile(o.phone) ?? (/^\+61\d{9}$/.test(o.phone.replace(/[\s()-]/g, "")) ? o.phone.replace(/[\s()-]/g, "") : null);
  if (!number) return "no-number";
  const rows = await query<{ id: string }>(
    `insert into design_browser_calls (id, business_id, job_id, customer_id, customer_name, member_email, identity, number)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [newId("bc"), o.businessId, o.jobId, o.customerId, o.customerName.slice(0, 120), o.memberEmail, o.identity, number],
  );
  return { id: rows[0].id };
}

/** Twilio bringing a ticket back: once, by the member it was made for, while it is fresh. */
export async function takeTicket(id: string, identity: string, callSid: string): Promise<BrowserCallRow | null> {
  if (!/^bc_[0-9a-f]{24}$/.test(id)) return null;
  const rows = await query<BrowserCallRow>(
    `update design_browser_calls set status = 'ringing', call_sid = $3, used_at = now()
      where id = $1 and identity = $2 and status = 'ready' and created_at > now() - make_interval(secs => $4)
      returning *`,
    [id, identity, callSid.slice(0, 64), TICKET_SECONDS],
  );
  return rows[0] ?? null;
}

export async function browserCallById(id: string): Promise<BrowserCallRow | null> {
  if (!/^bc_[0-9a-f]{24}$/.test(id)) return null;
  return (await query<BrowserCallRow>(`select * from design_browser_calls where id = $1`, [id]))[0] ?? null;
}

async function onDeal(row: BrowserCallRow, text: string) {
  await transaction((q) =>
    record(q, row.business_id, { customerId: row.customer_id, jobId: row.job_id, kind: "call", text, by: row.member_email }),
  ).catch((e) => console.error("browser call not written on the deal", e instanceof Error ? e.message : e));
}

/**
 * Twilio says how the call ended. A call not answered, or not recorded, is written on the deal now; an answered,
 * recorded one waits for its recording (`callRecorded`).
 */
export async function callEnded(id: string, status: string, seconds: number): Promise<void> {
  const s = browserCallSettings();
  const end = callEnd(status, seconds);
  const rows = await query<BrowserCallRow>(
    `update design_browser_calls set status = 'ended', call_end = $2, seconds = $3, ended_at = now()
      where id = $1 and status = 'ringing' returning *`,
    [id, end, Math.max(0, Math.round(seconds))],
  );
  const row = rows[0];
  if (!row) return;
  if (end !== "answered" || !s?.record) await written(row, browserCallHeadline(end, row.seconds ?? 0));
}

async function written(row: BrowserCallRow, text: string) {
  const claimed = await query<{ id: string }>(
    `update design_browser_calls set status = 'written', written_at = now() where id = $1 and status <> 'written' returning id`,
    [row.id],
  );
  if (claimed[0]) await onDeal(row, text);
}

/** The recording is ready: keep it, and have the call written up on the deal (after the answer to Twilio). */
export async function callRecorded(id: string, recordingSid: string, seconds: number): Promise<BrowserCallRow | null> {
  const rows = await query<BrowserCallRow>(
    `update design_browser_calls set recording_sid = $2, seconds = coalesce(seconds, $3) where id = $1 returning *`,
    [id, recordingSid.slice(0, 64), Math.max(0, Math.round(seconds))],
  );
  return rows[0] ?? null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** How long a write-up waits for Twilio's transcript before giving up (the route has `maxDuration` 300). */
const TRANSCRIPT_WAIT_MS = 240_000;

/** The call written on the deal: what it came to, Sol's write-up of both sides when there is one, and its recording. */
export async function writeUp(row: BrowserCallRow): Promise<void> {
  const s = browserCallSettings();
  const head = browserCallHeadline("answered", row.seconds ?? 0);
  const done = (words: string) => written(row, [head, words, row.recording_sid ? recordingLine(row.id) : ""].filter(Boolean).join("\n"));
  if (!s || !row.recording_sid) return done("");
  if (!s.intelligence) return done(NOT_WRITTEN.noTranscripts);
  try {
    const sid = row.transcript_sid ?? (await startTranscript(s, row.recording_sid, row.id));
    if (!sid) return done(NOT_WRITTEN.failed);
    await query(`update design_browser_calls set transcript_sid = $2 where id = $1`, [row.id, sid]);
    const sentences = await transcriptReady(s, sid);
    if (sentences === "waiting") return done(NOT_WRITTEN.late);
    if (!sentences) return done(NOT_WRITTEN.failed);
    const transcript = dialogue(sentences, row.customer_name);
    // Kept as lines for the deal's timeline (channel 1 is ours, as `dialogue` reads it).
    const lines = joinRuns(
      sentences.map((x) => ({ role: x.channel === 1 ? ("assistant" as const) : ("customer" as const), text: x.text })),
    );
    await query(`update design_browser_calls set transcript_lines = $2 where id = $1`, [
      row.id,
      JSON.stringify(lines.slice(0, MAX_LINES)),
    ]).catch((e) => console.error("browser call transcript not kept", e instanceof Error ? e.message : e));
    if (wordCount(transcript) < MIN_WRITE_UP_WORDS) return done(NOT_WRITTEN.short);
    const notes = await solWritesUp(row, transcript);
    return done(notes ?? NOT_WRITTEN.failed);
  } catch (e) {
    console.error("browser call not written up", redactSecrets(e instanceof Error ? e.message : String(e)));
    return done(NOT_WRITTEN.failed);
  }
}

async function transcriptReady(s: BrowserCallSettings, sid: string) {
  const until = Date.now() + TRANSCRIPT_WAIT_MS;
  for (;;) {
    const got = await transcriptSentences(s, sid);
    if (got !== "waiting" || Date.now() > until) return got;
    await wait(5_000);
  }
}

/** Sol's write-up, as the note-taker's, from both sides; null when Claude isn't set up or fails; NOT_WRITTEN's words when out of credits. */
async function solWritesUp(row: BrowserCallRow, transcript: string): Promise<string | null> {
  const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
  if (!apiKey) return null;
  const biz = await query<{ name: string }>(`select name from businesses where id = $1`, [row.business_id]);
  const brand = await loadBrand(row.business_id, biz[0]?.name ?? "");
  const raw = await withSolCredit(
    row.business_id,
    "call-notes",
    row.member_email,
    (ai) =>
      readWithClaude<unknown>(
        [],
        CALL_NOTES_SCHEMA,
        callNotesPrompt(brand.name || biz[0]?.name || "", row.customer_name, transcript, true),
        apiKey,
        ai,
      ),
    USE_TIER["call-notes"],
  );
  if (raw === "out") return NOT_WRITTEN.noCredits;
  return callNotesText(cleanCallNotes(raw));
}

// --- Live words while the note-taker is on (26 Nov 2026, domain/browser-call.ts) ------------------------------------

/** The member's own call under way, or null: only they may switch its live words on or read them. */
export async function ownCall(id: string, businessId: string, memberEmail: string): Promise<BrowserCallRow | null> {
  const row = await browserCallById(id);
  return row && row.business_id === businessId && row.member_email === memberEmail ? row : null;
}

/**
 * Has Twilio transcribe both sides of the call from now on. Only while it is ringing or on, and only where the call
 * is recorded, so the customer has heard that it may be (`noticeTwiml`); "off" otherwise, and the note-taker hears the
 * member's side in the browser instead.
 */
export async function startLiveWords(row: BrowserCallRow): Promise<"on" | "off" | "failed"> {
  const s = browserCallSettings();
  if (!s || !s.record || row.status !== "ringing" || !row.call_sid) return "off";
  if (row.live_sid) await stopLiveTranscription(s, row.call_sid, row.live_sid);
  const got = await startLiveTranscription(s, row.call_sid, `${s.site}/api/voice/twilio/live?call=${row.id}`);
  if ("problem" in got) {
    console.error("live words not started", redactSecrets(got.problem));
    return "failed";
  }
  await query(`update design_browser_calls set live_sid = $2, live_problem = null, live_partial = null where id = $1`, [row.id, got.sid]);
  return "on";
}

export async function stopLiveWords(row: BrowserCallRow): Promise<void> {
  const s = browserCallSettings();
  if (s && row.call_sid && row.live_sid) await stopLiveTranscription(s, row.call_sid, row.live_sid);
  await query(`update design_browser_calls set live_sid = null, live_partial = null where id = $1`, [row.id]);
}

/** One of Twilio's callbacks kept: a final stretch added, a partial one shown on its side until it is final. */
export async function keepLiveEvent(id: string, transcriptionSid: string, e: LiveEvent): Promise<void> {
  if (!/^bc_[0-9a-f]{24}$/.test(id)) return;
  if (e.kind === "words") {
    const side = e.who;
    if (e.final)
      await query(
        `update design_browser_calls
            set live_words = coalesce(live_words, '[]'::jsonb) || $2::jsonb,
                live_partial = coalesce(live_partial, '{}'::jsonb) - $3::text
          where id = $1 and coalesce(jsonb_array_length(live_words), 0) < $4`,
        [id, JSON.stringify([{ who: side, text: e.text }]), side, MAX_LIVE_WORDS],
      );
    else
      await query(
        `update design_browser_calls set live_partial = coalesce(live_partial, '{}'::jsonb) || $2::jsonb
          where id = $1 and live_sid = $3`,
        [id, JSON.stringify({ [side]: e.text }), transcriptionSid],
      );
  } else if (e.kind === "error") {
    await query(`update design_browser_calls set live_problem = $2 where id = $1 and live_sid = $3`, [
      id,
      e.message || "error",
      transcriptionSid,
    ]);
  } else if (e.kind === "stopped") {
    await query(`update design_browser_calls set live_partial = null where id = $1 and live_sid = $2`, [id, transcriptionSid]);
  }
}

/** What the note-taker shows: the final stretches from `from` on, what is still being made out, and whether it's on. */
export async function liveWordsOf(
  id: string,
  from: number,
): Promise<{ words: LiveWords[]; total: number; partial: Partial<Record<"us" | "them", string>>; on: boolean; problem: string | null }> {
  const rows = await query<{
    live_words: LiveWords[] | null;
    live_partial: Record<string, string> | null;
    live_sid: string | null;
    live_problem: string | null;
    status: string;
  }>(`select live_words, live_partial, live_sid, live_problem, status from design_browser_calls where id = $1`, [id]);
  const r = rows[0];
  const all = Array.isArray(r?.live_words) ? r.live_words : [];
  const partial: Partial<Record<"us" | "them", string>> = {};
  for (const k of ["us", "them"] as const) if (typeof r?.live_partial?.[k] === "string") partial[k] = r.live_partial[k];
  return {
    words: all.slice(Math.max(0, from)),
    total: all.length,
    partial,
    on: Boolean(r?.live_sid) && r?.status === "ringing",
    problem: r?.live_problem ?? null,
  };
}
