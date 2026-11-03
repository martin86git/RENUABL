/**
 * Server only. The assistant's phone calls on a CRM deal, through Vapi (vapi.ai): a new lead rung to answer their
 * questions and book the 15-minute call, or a customer who pressed "Call me" on their proposal, rung to go through it
 * and guide them to sign it online (domain/voice-agent.ts holds the rules and what it says).
 *
 * Off unless VOICE_CALLS_ENABLED=true and VAPI_API_KEY, VAPI_PHONE_NUMBER_ID (a number imported into Vapi, e.g.
 * RENUABL's Twilio number), VAPI_WEBHOOK_SECRET (20+ characters, our own) and SITE_URL are set. Optional: VAPI_MODEL
 * (default claude-sonnet-5), VAPI_VOICE_PROVIDER + VAPI_VOICE_ID, VOICE_TRANSFER_NUMBER (put through to a person).
 * For now only RENUABL's own deals are called (`voiceOnFor`: the business behind RENUABL_CRM_EMAIL); other
 * businesses come later.
 *
 * One row a run of calls on a deal (`voice_calls`). Calls start only in calling hours: outside them Vapi is asked to
 * call at the next window (`schedulePlan`), so no cron is needed; unanswered calls are tried again the same way. Every
 * call ends on the deal's own record (and `voice_call_events`, with the transcript, on /admin). Never HubSpot. Never
 * throws into the request that asked for the call.
 */
import { buildIcs, consultEvent, staffCallEvent } from "@/lib/domain/calendar";
import { normaliseMobile } from "@/lib/domain/contact";
import { customerFacts } from "@/lib/domain/design/sol-customer";
import { callbackRequestEmail, consultBookedEmail } from "@/lib/domain/emails";
import { todayInMarket } from "@/lib/domain/market";
import { publicSiteUrl } from "@/lib/domain/site";
import { siteUrl } from "@/lib/domain/sms";
import {
  assistantConfig,
  callRecordLine,
  type CallBrief,
  type CallMode,
  type CallOutcome,
  MAX_ASKED_ATTEMPTS,
  MAX_ATTEMPTS,
  missedCallSms,
  nextAttemptAt,
  nextCallWindow,
  outcomeOf,
  proposalLinkSms,
  readBooking,
  shouldRetry,
  speakableName,
  strongerOutcome,
  toolWords,
  type VapiEvent,
  VOICE_TOOLS,
  voiceSlots,
  whenWords,
} from "@/lib/domain/voice-agent";
import { dbConfigured, newId, query, transaction } from "./db";
import { jobById, record } from "./design-crm-repo";
import { loadBrand, publicProposal, tokenForJob } from "./design-proposal-repo";
import { emailProvider, sendEmail } from "./email";
import { alertNewLead, textStaff } from "./lead-alert";
import { addHomeLead, type HomeLead, renuablCrm } from "./renuabl-crm";
import { sendSms, smsConfigured } from "./sms";

const VAPI = "https://api.vapi.ai";

export interface VoiceSettings {
  key: string;
  phoneNumberId: string;
  secret: string;
  site: string;
  model: string;
  voice: { provider: string; voiceId: string } | null;
  transferNumber: string | null;
}

/** The settings when calling is switched on and complete, else null. */
export function voiceSettings(env: Record<string, string | undefined> = process.env): VoiceSettings | null {
  const key = env.VAPI_API_KEY?.trim();
  const phoneNumberId = env.VAPI_PHONE_NUMBER_ID?.trim();
  const secret = env.VAPI_WEBHOOK_SECRET?.trim();
  const site = siteUrl(env);
  if (env.VOICE_CALLS_ENABLED?.trim() !== "true" || !key || !phoneNumberId || !secret || secret.length < 20 || !site) return null;
  const voiceId = env.VAPI_VOICE_ID?.trim();
  const transfer = (env.VOICE_TRANSFER_NUMBER ?? "").replace(/[\s()-]/g, "");
  return {
    key,
    phoneNumberId,
    secret,
    site,
    model: env.VAPI_MODEL?.trim() || "claude-sonnet-5",
    voice: voiceId ? { provider: env.VAPI_VOICE_PROVIDER?.trim() || "11labs", voiceId } : null,
    transferNumber: /^\+61\d{9}$/.test(transfer) ? transfer : transfer ? normaliseMobile(transfer) : null,
  };
}

/** For /api/status: what's set, yes/no only. */
export function voiceStatus(env: Record<string, string | undefined> = process.env) {
  const set = (v: string | undefined) => Boolean(v?.trim());
  return {
    enabled: env.VOICE_CALLS_ENABLED?.trim() === "true",
    ready: Boolean(voiceSettings(env)) && dbConfigured() && set(env.RENUABL_CRM_EMAIL),
    apiKey: set(env.VAPI_API_KEY),
    phoneNumber: set(env.VAPI_PHONE_NUMBER_ID),
    webhookSecret: (env.VAPI_WEBHOOK_SECRET?.trim().length ?? 0) >= 20,
    renuablCrm: set(env.RENUABL_CRM_EMAIL),
    transfer: set(env.VOICE_TRANSFER_NUMBER),
  };
}

/** Whether this business's deals may be called: calling set up, and (for now) RENUABL's own business only. */
export async function voiceOnFor(businessId: string): Promise<boolean> {
  if (!voiceSettings() || !dbConfigured()) return false;
  const own = await renuablCrm().catch(() => null);
  return own?.businessId === businessId;
}

export interface VoiceRow {
  id: string;
  business_id: string;
  job_id: string;
  customer_id: string;
  mode: CallMode;
  asked: boolean;
  first_name: string | null;
  mobile: string;
  email: string | null;
  lead: { about?: string[]; source?: string; texted?: boolean; assistant?: string };
  status: "waiting" | "calling" | "booked" | "done" | "stopped";
  attempts: number;
  vapi_call_id: string | null;
  outcome: CallOutcome | null;
  call_label: string | null;
  stop_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type QueueResult = { result: "off" | "missing" | "no-number" | "already" | "failed" } | { result: "placed"; when: string };

/**
 * Calls a deal's customer: a new lead (`mode: "lead"`), or a customer who asked about their proposal (`"proposal"`,
 * `asked`). The number is the one on their record, never one sent from a browser. Does nothing when calling is off for
 * the business, or the deal already has calls under way.
 */
export async function queueCall(o: {
  businessId: string;
  jobId: string;
  mode: CallMode;
  asked: boolean;
  source?: string;
}): Promise<QueueResult> {
  const s = voiceSettings();
  if (!s || !(await voiceOnFor(o.businessId))) return { result: "off" };
  try {
    const found = await jobById(o.businessId, o.jobId);
    if (!found) return { result: "missing" };
    const { job, customer } = found;
    const mobile = normaliseMobile(customer.phone);
    if (!mobile) return { result: "no-number" };
    const suburb = (job.address || customer.address).split(",").slice(-2, -1)[0]?.trim();
    const about = [job.title && `Looking for: ${job.title}`, suburb && `Suburb: ${suburb}`, o.source && `Came from: ${o.source}`].filter(
      (l): l is string => Boolean(l),
    );
    const rows = await query<VoiceRow>(
      `insert into voice_calls (id, business_id, job_id, customer_id, mode, asked, first_name, mobile, email, lead)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (business_id, job_id) where status in ('waiting', 'calling') do nothing
       returning *`,
      [
        newId("vc"),
        o.businessId,
        o.jobId,
        customer.id,
        o.mode,
        o.asked,
        speakableName(customer.firstName || customer.name.split(" ")[0]) || null,
        mobile,
        customer.email || null,
        JSON.stringify({ about, source: o.source }),
      ],
    );
    if (!rows[0]) return { result: "already" };
    if (o.asked)
      await onDeal(
        { ...rows[0], lead: { ...rows[0].lead, assistant: (await callMeFor(o.businessId))?.assistant } },
        "They asked for a call about their proposal (Call me on the proposal page).",
      );
    const window = nextCallWindow(new Date());
    if (!(await placeCall(s, rows[0], window)) || !window) return { result: "failed" };
    return { result: "placed", when: whenWords(window, new Date()) };
  } catch (e) {
    console.error("voice call not queued", e instanceof Error ? e.message : e);
    return { result: "failed" };
  }
}

/**
 * A homeowner lead from RENUABL's own site: kept as a deal in RENUABL's CRM, and rung (`call`) when calling is on and
 * they left a mobile. Run after the lead page has answered; never throws.
 */
export async function takeHomeLead(lead: HomeLead, call: boolean): Promise<void> {
  try {
    const deal = await addHomeLead(lead);
    if (!deal || !call) return;
    const r = await queueCall({ businessId: deal.businessId, jobId: deal.jobId, mode: "lead", asked: false, source: lead.source });
    if (r.result !== "off") console.info(`voice call: ${r.result}`);
  } catch (e) {
    console.error("home lead not taken", e instanceof Error ? e.message : e);
  }
}

/** For the customer's proposal page: whether "Call me" is offered, and who would call. Null when it isn't. */
export async function callMeFor(businessId: string): Promise<{ assistant: string } | null> {
  if (!(await voiceOnFor(businessId).catch(() => false))) return null;
  const own = (await renuablCrm().catch(() => null))?.businessId === businessId;
  return { assistant: own ? "Revo" : "Sol" };
}

/** What the assistant is told for this call, read fresh each time (the proposal as it stands now). */
async function briefFor(row: VoiceRow): Promise<{ brief: CallBrief; token: string | null }> {
  const biz = await query<{ name: string }>(`select name from businesses where id = $1`, [row.business_id]);
  const brand = await loadBrand(row.business_id, biz[0]?.name ?? "");
  const own = (await renuablCrm().catch(() => null))?.businessId === row.business_id;
  const token = row.mode === "proposal" ? await tokenForJob(row.business_id, row.job_id) : null;
  const view = token ? (await publicProposal(token, todayInMarket()))?.view : null;
  return {
    token: view ? token : null,
    brief: {
      mode: view ? "proposal" : "lead",
      assistant: own ? "Revo" : "Sol",
      business: brand.name || biz[0]?.name || "",
      firstName: row.first_name,
      about: row.lead.about ?? [],
      proposal: view ? customerFacts(view) : null,
      asked: row.asked,
      canBook: own && !view,
      canSendLink: Boolean(view) && smsConfigured(),
      hasEmail: Boolean(row.email),
    },
  };
}

/** Asks Vapi to call now, or at the window's start. True when Vapi took it. */
async function placeCall(s: VoiceSettings, row: VoiceRow, window: { from: Date; until: Date } | null): Promise<boolean> {
  if (!window) {
    await finish(row.id, "stopped", { stop_reason: "no calling hours in the next fortnight" });
    return false;
  }
  const { brief } = await briefFor(row);
  const scheduled = window.from.getTime() > Date.now() + 60_000;
  const body = {
    phoneNumberId: s.phoneNumberId,
    customer: { number: row.mobile, ...(row.first_name ? { name: row.first_name } : {}) },
    name: `RENUABL deal ${row.id}`,
    assistant: assistantConfig({
      brief,
      slots: brief.canBook ? voiceSlots(todayInMarket(window.from)) : [],
      serverUrl: `${s.site}/api/voice/vapi?ref=${encodeURIComponent(row.id)}`,
      secret: s.secret,
      model: s.model,
      voice: s.voice,
      transferNumber: s.transferNumber,
    }),
    ...(scheduled ? { schedulePlan: { earliestAt: window.from.toISOString(), latestAt: window.until.toISOString() } } : {}),
  };
  try {
    const res = await fetch(`${VAPI}/call`, {
      method: "POST",
      headers: { authorization: `Bearer ${s.key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: unknown; message?: unknown };
    if (!res.ok || typeof json.id !== "string") {
      const why = `Vapi ${res.status}: ${String(json.message ?? "").slice(0, 200)}`;
      console.error("voice call not placed", why);
      await finish(row.id, "stopped", { stop_reason: why });
      return false;
    }
    await query(
      `update voice_calls set status = 'calling', attempts = attempts + 1, vapi_call_id = $2,
         lead = lead || jsonb_build_object('assistant', $3::text), updated_at = now() where id = $1`,
      [row.id, json.id, brief.assistant],
    );
    return true;
  } catch (e) {
    console.error("voice call not placed", e instanceof Error ? e.message : e);
    await finish(row.id, "stopped", { stop_reason: "Vapi didn't answer" });
    return false;
  }
}

async function finish(
  id: string,
  status: VoiceRow["status"] | null,
  set: { outcome?: CallOutcome; stop_reason?: string; call_label?: string },
) {
  await query(
    `update voice_calls set status = coalesce($2, status), outcome = coalesce($3, outcome), stop_reason = coalesce($4, stop_reason),
       call_label = coalesce($5, call_label), updated_at = now() where id = $1`,
    [id, status, set.outcome ?? null, set.stop_reason ?? null, set.call_label ?? null],
  ).catch((e) => console.error("voice call not updated", e instanceof Error ? e.message : e));
}

/** A line in the call's own log (with the transcript once it ends), shown on /admin. */
async function event(
  row: VoiceRow,
  kind: "booked" | "ended" | "stopped" | "callback" | "link",
  e: { outcome?: CallOutcome; endedReason?: string; summary?: string; transcript?: string } = {},
) {
  await query(
    `insert into voice_call_events (id, voice_call_id, attempt, kind, outcome, ended_reason, summary, transcript, vapi_call_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      newId("vce"),
      row.id,
      row.attempts,
      kind,
      e.outcome ?? null,
      e.endedReason || null,
      e.summary || null,
      e.transcript || null,
      row.vapi_call_id,
    ],
  ).catch((err) => console.error("voice call event not kept", err instanceof Error ? err.message : err));
}

/** A line on the deal's own record, by the assistant. */
async function onDeal(row: VoiceRow, text: string) {
  await transaction((q) =>
    record(q, row.business_id, { customerId: row.customer_id, jobId: row.job_id, kind: "call", text, by: row.lead.assistant || "Sol" }),
  ).catch((e) => console.error("voice call not written on the deal", e instanceof Error ? e.message : e));
}

async function said(
  row: VoiceRow,
  outcome: CallOutcome,
  extra: { status?: VoiceRow["status"]; stop_reason?: string; call_label?: string } = {},
) {
  await finish(row.id, extra.status ?? null, {
    outcome: strongerOutcome(row.outcome, outcome),
    stop_reason: extra.stop_reason,
    call_label: extra.call_label,
  });
}

export async function voiceCallByRef(ref: string): Promise<VoiceRow | null> {
  if (!/^vc_[0-9a-f]{24}$/.test(ref)) return null;
  return (await query<VoiceRow>(`select * from voice_calls where id = $1`, [ref]))[0] ?? null;
}

/** The business's own people for a notice: its listed addresses, else its owners. */
async function teamOf(businessId: string): Promise<string[]> {
  const biz = await query<{ name: string }>(`select name from businesses where id = $1`, [businessId]);
  const brand = await loadBrand(businessId, biz[0]?.name ?? "");
  if (brand.notify.length) return brand.notify;
  const owners = await query<{ email: string }>(`select email from business_members where business_id = $1 and role = 'owner'`, [
    businessId,
  ]);
  return owners.map((o) => o.email);
}

/**
 * One of the assistant's tools during a call. Answers in words for it to act on (Vapi wants a string). `later` takes
 * the emails off the call's critical path (the route runs it after answering).
 */
export async function handleToolCall(
  row: VoiceRow,
  name: string,
  args: unknown,
  later: (fn: () => Promise<void>) => void,
): Promise<string> {
  const assistant = row.lead.assistant || "Sol";
  const site = siteUrl() ?? publicSiteUrl();

  if (name === VOICE_TOOLS.book) {
    const own = (await renuablCrm().catch(() => null))?.businessId === row.business_id;
    if (!own) return "Booking times isn't available on this call. Use request_callback instead.";
    if (row.status === "booked" && row.call_label) return `Already booked for ${row.call_label}.`;
    const today = todayInMarket();
    const slot = readBooking(args, today);
    if (!slot)
      return `That time isn't free. Times you can offer: ${voiceSlots(today)
        .slice(0, 6)
        .map((s) => `${s.label} (date ${s.date}, time ${s.time})`)
        .join("; ")}.`;
    await said(row, "booked", { status: "booked", call_label: slot.label });
    await event(row, "booked", { outcome: "booked", summary: slot.label });
    await onDeal(row, `${assistant} booked a 15-minute call on the phone (automated): ${slot.label}.`);
    const who = row.first_name || "New lead";
    const details = {
      Stage: `Booked a 15-minute call on a call from ${assistant} (automated)`,
      Call: slot.label,
      "Ad source": row.lead.source,
    };
    later(async () => {
      const id = `call-${slot.date}-${slot.time.replace(":", "")}`;
      const staffIcs = buildIcs([staffCallEvent({ id, date: slot.date, time: slot.time, name: who, phone: row.mobile })]);
      await alertNewLead({ kind: "call", name: who, email: row.email ?? undefined, mobile: row.mobile, details }, [
        { filename: "renuabl-call.ics", content: staffIcs, contentType: "text/calendar" },
      ]);
      if (row.email) {
        try {
          const ics = buildIcs([consultEvent({ id, date: slot.date, time: slot.time })]);
          await sendEmail({
            to: row.email,
            ...consultBookedEmail({ firstName: row.first_name || "there", call: slot.label, link: `${site}/` }),
            attachments: [{ filename: "renuabl-call.ics", content: ics, contentType: "text/calendar" }],
          });
        } catch (e) {
          console.error("voice booking email failed", e instanceof Error ? e.message : e);
        }
      }
    });
    return `Booked for ${slot.label}.${row.email ? " A calendar invite is on its way by email." : ""}`;
  }

  if (name === VOICE_TOOLS.callback) {
    const about = toolWords(args, "about");
    const when = toolWords(args, "when", 120);
    await said(row, "callback");
    await event(row, "callback", { outcome: "callback", summary: [about, when && `when: ${when}`].filter(Boolean).join("; ") });
    await onDeal(
      row,
      `${assistant} on the phone (automated): they'd like a call back from the team${when ? ` (${when})` : ""}. About: ${about || "not said"}.`,
    );
    later(async () => {
      if (!emailProvider()) return;
      const found = await jobById(row.business_id, row.job_id).catch(() => null);
      const mail = callbackRequestEmail({
        assistant,
        customer: found?.customer.name ?? row.first_name ?? "",
        title: found?.job.title ?? "",
        about,
        when,
        link: `${site}/design/deals/${row.job_id}`,
      });
      for (const to of await teamOf(row.business_id).catch(() => [] as string[]))
        await sendEmail({ to, ...mail }).catch(() => console.error("a call back notice couldn't be sent"));
      const own = (await renuablCrm().catch(() => null))?.businessId === row.business_id;
      if (own)
        await textStaff(
          `RENUABL: ${row.first_name || "A customer"} (${row.mobile}) would like a call back${when ? `, ${when}` : ""}. See the deal.`,
        );
    });
    return "Done: the team has been asked to call them back. Tell them someone will be in touch.";
  }

  if (name === VOICE_TOOLS.link) {
    const { brief, token } = await briefFor(row);
    if (!token) return "There's no proposal out for them right now. Offer a call back from the team.";
    const sent = await sendSms(row.mobile, proposalLinkSms({ business: brief.business, link: `${site}/p/${token}` }));
    if (sent !== "sent")
      return "The text couldn't be sent just now. Tell them the link is in the email the proposal came with, and offer a call back.";
    await said(row, "link-sent");
    await event(row, "link", { outcome: "link-sent" });
    await onDeal(row, `${assistant} texted the proposal link on the phone (automated).`);
    return "Sent: the link to their proposal is on its way by text.";
  }

  if (name === VOICE_TOOLS.noMore) {
    const reason = toolWords(args, "reason");
    await said(row, "no-more-calls", { status: "stopped", stop_reason: reason || "not interested" });
    await event(row, "stopped", { outcome: "no-more-calls", summary: reason || undefined });
    await onDeal(row, `${assistant} on the phone (automated): they asked not to be called again${reason ? ` (${reason})` : ""}.`);
    return "Noted. No one will call them again.";
  }
  return "That tool isn't available.";
}

/** A call has ended: keep it on the deal and in the log, then try again, hand it to the team, or close it. */
export async function handleCallEnded(row: VoiceRow, e: VapiEvent): Promise<void> {
  if (e.callId && row.vapi_call_id && e.callId !== row.vapi_call_id) return; // an older attempt
  const outcome = outcomeOf(e.endedReason, row.outcome);
  const assistant = row.lead.assistant || "Sol";
  await event(row, "ended", { outcome, endedReason: e.endedReason, summary: e.summary, transcript: e.transcript });
  await onDeal(row, callRecordLine({ assistant, outcome, summary: e.summary, detail: row.call_label }));
  if (row.status === "booked" || row.status === "stopped") return;

  const s = voiceSettings();
  const own = (await renuablCrm().catch(() => null))?.businessId === row.business_id;
  if (shouldRetry(outcome)) {
    const link = `${siteUrl() ?? publicSiteUrl()}/book-a-call`;
    let texted = Boolean(row.lead.texted);
    // A new lead of RENUABL's own gets the booking page by text (the page is RENUABL's), once.
    const textThem = async () => {
      if (texted || row.mode !== "lead" || !own) return;
      if ((await sendSms(row.mobile, missedCallSms({ business: "RENUABL", link }))) === "sent") {
        texted = true;
        await query(`update voice_calls set lead = lead || '{"texted": true}' where id = $1`, [row.id]).catch(() => undefined);
      }
    };
    if (outcome === "voicemail") await textThem();
    const next = s ? nextAttemptAt(row.attempts, new Date(), row.asked ? MAX_ASKED_ATTEMPTS : MAX_ATTEMPTS) : null;
    if (s && next && (await placeCall(s, row, next))) return;
    await finish(row.id, "done", { outcome });
    await textThem();
    await onDeal(row, `${assistant} couldn't reach them after ${row.attempts} ${row.attempts === 1 ? "call" : "calls"}. Over to the team.`);
    if (own)
      await textStaff(
        `RENUABL: ${assistant} couldn't reach ${row.first_name || "a new lead"} (${row.mobile}) after ${row.attempts} calls. Please call them.`,
      );
    return;
  }
  await finish(row.id, "done", { outcome });
  if (own && outcome === "talked" && row.mode === "lead")
    await textStaff(
      `RENUABL: ${assistant} spoke to ${row.first_name || "a new lead"} (${row.mobile}) but no call was booked. See the deal.`,
    );
}

/**
 * A lead of RENUABL's own booked a call themselves (or staff reached them): no more calls. Cancels a call Vapi is
 * holding for later. VERIFY: that DELETE /call/{id} cancels a scheduled call.
 */
export async function stopVoiceCalls(mobile: string, reason: string): Promise<void> {
  const s = voiceSettings();
  const m = normaliseMobile(mobile);
  if (!s || !m || !dbConfigured()) return;
  try {
    const own = await renuablCrm();
    if (!own) return;
    const rows = await query<VoiceRow>(
      `update voice_calls set status = 'stopped', stop_reason = $3, updated_at = now()
       where business_id = $1 and mobile = $2 and mode = 'lead' and status in ('waiting', 'calling') returning *`,
      [own.businessId, m, reason],
    );
    for (const r of rows)
      if (r.vapi_call_id)
        await fetch(`${VAPI}/call/${encodeURIComponent(r.vapi_call_id)}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${s.key}` },
          signal: AbortSignal.timeout(10_000),
        }).catch(() => undefined);
  } catch (e) {
    console.error("voice calls not stopped", e instanceof Error ? e.message : e);
  }
}

export interface VoiceCallListing extends VoiceRow {
  events: {
    kind: string;
    attempt: number;
    outcome: string | null;
    ended_reason: string | null;
    summary: string | null;
    transcript: string | null;
    at: string;
  }[];
}

/** Staff only (/admin): the latest calls, each with what happened on every one. */
export async function listVoiceCalls(limit = 50): Promise<VoiceCallListing[]> {
  return query<VoiceCallListing>(
    `select c.*, coalesce((select json_agg(json_build_object('kind', e.kind, 'attempt', e.attempt, 'outcome', e.outcome,
        'ended_reason', e.ended_reason, 'summary', e.summary, 'transcript', e.transcript, 'at', e.at) order by e.at)
        from voice_call_events e where e.voice_call_id = c.id), '[]') as events
     from voice_calls c order by c.created_at desc limit $1`,
    [limit],
  );
}
