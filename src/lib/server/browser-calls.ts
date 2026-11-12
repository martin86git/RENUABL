/**
 * Server only. Calls made from the computer (domain/browser-call.ts), one row a call in `design_browser_calls`,
 * business id first as everywhere. A press on Call makes a ticket for that deal (`openTicket`: the number is the one on
 * the customer's record, never one sent from a browser); Twilio brings the ticket back with the member's identity
 * (`takeTicket`, once, within TICKET_SECONDS); how it ended and its recording follow (`callEnded`, `callRecorded`), and
 * the call is written on the deal, with Sol's write-up of both sides when Twilio's transcripts are on (`writeUp`).
 * Only RENUABL's own business for now: the number rung from is RENUABL's (`mayCallFromBrowser`).
 */
import {
  MIN_WRITE_UP_WORDS,
  NOT_WRITTEN,
  TICKET_SECONDS,
  browserCallHeadline,
  callEnd,
  dialogue,
  recordingLine,
  wordCount,
  type CallEnd,
} from "@/lib/domain/browser-call";
import { normaliseMobile } from "@/lib/domain/contact";
import { CALL_NOTES_SCHEMA, callNotesPrompt, callNotesText, cleanCallNotes } from "@/lib/domain/design/call-notes";
import { USE_TIER } from "@/lib/domain/design/sol-routing";
import { parseApiKey, redactSecrets } from "./bill-reader";
import { readWithClaude } from "./claude-reader";
import { dbConfigured, newId, query, transaction } from "./db";
import { record } from "./design-crm-repo";
import { loadBrand } from "./design-proposal-repo";
import { renuablCrm } from "./renuabl-crm";
import { withSolCredit } from "./sol-credits";
import { browserCallSettings, startTranscript, transcriptSentences, type BrowserCallSettings } from "./twilio-voice";

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
}

/** Whether this business's members may call from the computer: set up, and (for now) RENUABL's own business. */
export async function mayCallFromBrowser(businessId: string): Promise<boolean> {
  if (!browserCallSettings() || !dbConfigured()) return false;
  return (await renuablCrm().catch(() => null))?.businessId === businessId;
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
