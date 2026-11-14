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
 *
 * Calls coming in on the number (someone ringing back) are answered too (`answerInbound`): Vapi asks the webhook for
 * an assistant, the caller is found on the business's deals by their number (else made a new lead), and the same
 * assistant answers. It speaks under the name the business gave it (design_caller, Settings → Phone assistant).
 */
import { buildIcs, consultEvent, staffCallEvent } from "@/lib/domain/calendar";
import { normaliseMobile } from "@/lib/domain/contact";
import {
  MAX_LINES,
  NEVER_PLACED_MS,
  livePhase,
  teamCommand,
  END_CALL_COMMAND,
  mayCallNow,
  mayEndCall,
  vapiCallOver,
  type LiveCallView,
  type LiveEvent,
  type LiveLine,
} from "@/lib/domain/live-call";
import { customerFacts } from "@/lib/domain/design/sol-customer";
import { callbackRequestEmail, consultBookedEmail, installPencilledEmail } from "@/lib/domain/emails";
import { todayInMarket } from "@/lib/domain/market";
import { publicSiteUrl } from "@/lib/domain/site";
import { siteUrl } from "@/lib/domain/sms";
import {
  assistantConfig,
  bookedLine,
  CALL_HEADLINES,
  callRecordLine,
  closedAssistant,
  type CallBrief,
  type CallMode,
  type CallOutcome,
  MAX_ASKED_ATTEMPTS,
  MAX_ATTEMPTS,
  NO_AUDIO,
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
  transcriberFor,
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
import { testCallWords } from "@/lib/domain/design/caller";
import { callerOf, coachingOf } from "./design-caller-repo";
import { pencilledLine, PENCILLED_WORDS, readInstallDay, cleanCallerKey, roleOfMode, type CallerKey } from "@/lib/domain/install-call";
import { installDaysFor, pencilInstall } from "./design-install-call";
import { addHomeLead, findCustomerByMobile, type HomeLead, renuablCrm } from "./renuabl-crm";
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
  lead: { about?: string[]; source?: string; texted?: boolean; assistant?: string; inbound?: boolean; teamAsk?: string; agent?: string };
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
  /** What is written on the deal for a call they asked for (else the proposal page's Call me). */
  askedNote?: string;
  /** A call back the team asked for: the one thing to ask or confirm (`cleanTeamAsk`), and who asked. */
  teamAsk?: { text: string; by: string };
  /** Which sales agent it was handed to (its key), when not the first. */
  agent?: CallerKey;
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
    const about = [
      job.title && `${o.mode === "install" ? "Their job" : "Looking for"}: ${job.title}`,
      suburb && `Suburb: ${suburb}`,
      o.source && `Came from: ${o.source}`,
    ].filter((l): l is string => Boolean(l));
    const insert = () =>
      query<VoiceRow>(
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
          JSON.stringify({
            about,
            source: o.source,
            ...(o.teamAsk ? { teamAsk: o.teamAsk.text } : {}),
            ...(o.agent && o.agent !== "sales" && o.mode !== "install" ? { agent: o.agent } : {}),
          }),
        ],
      );
    let rows = await insert();
    // A call still held open on this deal may be one Vapi finished long ago: closed, a new one goes ahead.
    if (!rows[0] && (await clearDeadCall(s, o.businessId, o.jobId).catch(() => false))) rows = await insert();
    if (!rows[0]) return { result: "already" };
    if (o.asked)
      await onDeal(
        { ...rows[0], lead: { ...rows[0].lead, assistant: (await callMeFor(o.businessId))?.assistant } },
        o.askedNote ?? "They asked for a call about their proposal (Call me on the proposal page).",
      );
    if (o.teamAsk)
      await onDeal(
        { ...rows[0], lead: { ...rows[0].lead, assistant: (await callerOf(o.businessId, keyOfCall(rows[0]))).name } },
        `${o.teamAsk.by} asked for a call back to ask: ${o.teamAsk.text}`,
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

/** The voice agent a call is made by: the post-sale one for a booking call, else the sales agent it was handed to. */
const keyOfCall = (row: Pick<VoiceRow, "mode" | "lead">): CallerKey =>
  roleOfMode(row.mode) === "admin" ? "admin" : cleanCallerKey(row.lead?.agent);

/** For the customer's proposal page: whether "Call me" is offered, and who would call. Null when it isn't. */
export async function callMeFor(businessId: string): Promise<{ assistant: string } | null> {
  if (!(await voiceOnFor(businessId).catch(() => false))) return null;
  return { assistant: (await callerOf(businessId)).name };
}

/** What the assistant is told for this call, read fresh each time (the proposal as it stands now). */
async function briefFor(
  row: VoiceRow,
): Promise<{ brief: CallBrief; token: string | null; voice: { provider: string; voiceId: string } | null }> {
  const biz = await query<{ name: string }>(`select name from businesses where id = $1`, [row.business_id]);
  const brand = await loadBrand(row.business_id, biz[0]?.name ?? "");
  const own = (await renuablCrm().catch(() => null))?.businessId === row.business_id;
  // The admin assistant makes the booking calls, the sales assistant every other (install-call.ts).
  const role = keyOfCall(row);
  const caller = await callerOf(row.business_id, role);
  // How the business has coached its assistant, read fresh for every call.
  const coaching = (await coachingOf(row.business_id, role).catch(() => null))?.notes.map((n) => n.text) ?? [];
  if (row.mode === "install")
    return {
      token: null,
      voice: caller.voice,
      brief: {
        mode: "install",
        assistant: caller.name,
        business: brand.name || biz[0]?.name || "",
        firstName: row.first_name,
        about: row.lead.about ?? [],
        asked: false,
        canBook: false,
        canSendLink: false,
        hasEmail: Boolean(row.email),
        installDays: await installDaysFor(row.business_id).catch(() => []),
        coaching,
      },
    };
  // Someone ringing in may be ringing about their proposal: theirs is read whenever one is out.
  const token = row.mode === "proposal" || row.lead.inbound ? await tokenForJob(row.business_id, row.job_id) : null;
  const view = token ? (await publicProposal(token, todayInMarket()))?.view : null;
  return {
    token: view ? token : null,
    // The voice the business chose for its assistant, else the site's own (VAPI_VOICE_ID), else Vapi's default.
    voice: caller.voice,
    brief: {
      mode: view ? "proposal" : "lead",
      assistant: caller.name,
      business: brand.name || biz[0]?.name || "",
      firstName: row.first_name,
      about: row.lead.about ?? [],
      proposal: view ? customerFacts(view) : null,
      asked: row.asked,
      teamAsk: row.lead.teamAsk ?? null,
      canBook: own && !view,
      canSendLink: Boolean(view) && smsConfigured(),
      hasEmail: Boolean(row.email),
      inbound: Boolean(row.lead.inbound),
      coaching,
    },
  };
}

/** Asks Vapi to call now, or at the window's start. True when Vapi took it. */
async function placeCall(s: VoiceSettings, row: VoiceRow, window: { from: Date; until: Date } | null): Promise<boolean> {
  if (!window) {
    await finish(row.id, "stopped", { stop_reason: "no calling hours in the next fortnight" });
    return false;
  }
  const { brief, voice } = await briefFor(row);
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
      voice: voice ?? s.voice,
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
      `update voice_calls set status = 'calling', attempts = attempts + 1, vapi_call_id = $2, due_at = $4,
         lead = lead || jsonb_build_object('assistant', $3::text), updated_at = now() where id = $1`,
      [row.id, json.id, brief.assistant, window.from],
    );
    return true;
  } catch (e) {
    console.error("voice call not placed", e instanceof Error ? e.message : e);
    await finish(row.id, "stopped", { stop_reason: "Vapi didn't answer" });
    return false;
  }
}

/**
 * The call held open on this deal, checked with Vapi: closed when Vapi says it has ended (or doesn't know it), or when it
 * was never placed at all. True when the deal is free for a new call. A call still lined up or under way is left be.
 */
async function clearDeadCall(s: VoiceSettings, businessId: string, jobId: string): Promise<boolean> {
  const open = await query<VoiceRow>(
    `select * from voice_calls where business_id = $1 and job_id = $2 and status in ('waiting', 'calling') limit 1`,
    [businessId, jobId],
  );
  const r = open[0];
  if (!r) return true;
  if (!r.vapi_call_id) {
    if (Date.now() - new Date(r.updated_at).getTime() < NEVER_PLACED_MS) return false;
    await finish(r.id, "stopped", { stop_reason: "The call was never placed" });
    return true;
  }
  const res = await fetch(`${VAPI}/call/${encodeURIComponent(r.vapi_call_id)}`, {
    headers: { authorization: `Bearer ${s.key}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) {
    await finish(r.id, "stopped", { stop_reason: "Vapi has no record of the call" });
    return true;
  }
  if (!res.ok) return false;
  const json = (await res.json().catch(() => ({}))) as { status?: unknown; endedReason?: unknown };
  if (!vapiCallOver(json.status)) return false;
  const why = typeof json.endedReason === "string" ? `: ${json.endedReason.slice(0, 120)}` : "";
  await finish(r.id, "stopped", { stop_reason: `Vapi's call ended without telling us${why}` });
  await query(`update voice_calls set live_status = 'ended', live_ended_at = coalesce(live_ended_at, now()) where id = $1`, [r.id]);
  return true;
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
    await onDeal(row, bookedLine(slot.label));
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

  if (name === VOICE_TOOLS.pencil) {
    if (row.mode !== "install") return "That tool isn't available on this call.";
    const offered = await installDaysFor(row.business_id);
    const day = readInstallDay(args, offered);
    if (!day)
      return offered.length
        ? `That day can't be offered. Days you can offer: ${offered.map((d) => `${d.label} (date ${d.date})`).join("; ")}.`
        : "There are no days to offer right now. Say the team will call them to find a day, and use request_callback.";
    await pencilInstall({ businessId: row.business_id, jobId: row.job_id, day, assistant });
    await said(row, "pencilled", { status: "booked", call_label: day.label });
    await event(row, "booked", { outcome: "pencilled", summary: day.label });
    await onDeal(row, pencilledLine(day.label));
    later(async () => {
      if (!emailProvider()) return;
      const found = await jobById(row.business_id, row.job_id).catch(() => null);
      const mail = installPencilledEmail({
        assistant,
        customer: found?.customer.name ?? row.first_name ?? "",
        title: found?.job.title ?? "",
        day: day.label,
        link: `${site}/design/deals/${row.job_id}`,
      });
      for (const to of await teamOf(row.business_id).catch(() => [] as string[]))
        await sendEmail({ to, ...mail }).catch(() => console.error("an install pencilled notice couldn't be sent"));
    });
    return `Done: ${day.label} is ${PENCILLED_WORDS}. Tell them exactly that, and that it isn't final until the team confirms.`;
  }

  if (name === VOICE_TOOLS.callback) {
    const about = toolWords(args, "about");
    const when = toolWords(args, "when", 120);
    await said(row, "callback");
    await event(row, "callback", { outcome: "callback", summary: [about, when && `when: ${when}`].filter(Boolean).join("; ") });
    await onDeal(row, `${CALL_HEADLINES.callback}${when ? ` · ${when}` : ""}\nAbout: ${about || "not said"}.`);
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
    await onDeal(row, `${CALL_HEADLINES["link-sent"]}\nTexted to them during the call.`);
    return "Sent: the link to their proposal is on its way by text.";
  }

  if (name === VOICE_TOOLS.noMore) {
    const reason = toolWords(args, "reason");
    await said(row, "no-more-calls", { status: "stopped", stop_reason: reason || "not interested" });
    await event(row, "stopped", { outcome: "no-more-calls", summary: reason || undefined });
    await onDeal(row, `${CALL_HEADLINES["no-more-calls"]}${reason ? `\n${reason}` : ""}`);
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
  await onDeal(row, callRecordLine({ outcome, summary: e.summary, detail: row.call_label, inbound: row.lead.inbound }));
  if (row.status === "booked" || row.status === "stopped") return;

  const s = voiceSettings();
  const own = (await renuablCrm().catch(() => null))?.businessId === row.business_id;
  // They rang us: nothing to try again. The team hears when they spoke and nothing was booked.
  if (row.lead.inbound) {
    await finish(row.id, "done", { outcome });
    if (own && outcome === "talked")
      await textStaff(
        `RENUABL: ${row.first_name || "Someone"} (${row.mobile}) rang and spoke to ${assistant}, but no call was booked. See the deal.`,
      );
    return;
  }
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
        `RENUABL: ${assistant} couldn't reach ${row.first_name || (row.mode === "lead" ? "a new lead" : "a customer")} (${row.mobile}) after ${row.attempts} calls. Please call them.`,
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

/** Vapi's answer to a call coming in: the assistant to put on it. */
export type InboundAnswer = { assistant: unknown };

/**
 * Someone rang the number (Vapi's "assistant-request"): find who they are on RENUABL's own deals by their number (the
 * open run of calls on it, else their latest deal still going, else a new lead made from the number), keep the call
 * on that deal and answer with the business's assistant, told they rang in. When calling is off, the number isn't
 * ours, it's withheld, or anything fails, a short message says we can't take the call. Only RENUABL's own number for
 * now: each business's own number comes later.
 */
export async function answerInbound(e: VapiEvent): Promise<InboundAnswer> {
  const s = voiceSettings();
  const crm = await renuablCrm().catch(() => null);
  const closed = (): InboundAnswer => ({ assistant: closedAssistant({ business: crm?.name ?? "", model: s?.model ?? "claude-sonnet-5" }) });
  if (!s || !crm || !dbConfigured()) return closed();
  if (e.phoneNumberId && e.phoneNumberId !== s.phoneNumberId) return closed();
  const mobile = normaliseMobile(e.number ?? "");
  if (!mobile || !e.callId) return closed();
  try {
    const row = await inboundRow(s, crm.businessId, mobile, e.callId);
    if (!row) return closed();
    const { brief, voice } = await briefFor(row);
    const today = todayInMarket();
    return {
      assistant: assistantConfig({
        brief,
        slots: brief.canBook ? voiceSlots(today) : [],
        serverUrl: `${s.site}/api/voice/vapi?ref=${encodeURIComponent(row.id)}`,
        secret: s.secret,
        model: s.model,
        voice: voice ?? s.voice,
        transferNumber: s.transferNumber,
      }),
    };
  } catch (err) {
    console.error("call coming in not answered", err instanceof Error ? err.message : err);
    return closed();
  }
}

/** The run of calls a call coming in belongs to: the one open on this number (a call we'd lined up is cancelled), else a new one. */
async function inboundRow(s: VoiceSettings, businessId: string, mobile: string, callId: string): Promise<VoiceRow | null> {
  const caller = await callerOf(businessId);
  const open = await query<VoiceRow>(
    `select * from voice_calls where business_id = $1 and mobile = $2 and status in ('waiting', 'calling')
      order by updated_at desc limit 1`,
    [businessId, mobile],
  );
  if (open[0]) {
    // They're ringing us: the call we were going to make them is no longer needed.
    if (open[0].vapi_call_id && open[0].vapi_call_id !== callId)
      await fetch(`${VAPI}/call/${encodeURIComponent(open[0].vapi_call_id)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${s.key}` },
        signal: AbortSignal.timeout(5_000),
      }).catch(() => undefined);
    const rows = await query<VoiceRow>(
      `update voice_calls set status = 'calling', vapi_call_id = $2, attempts = attempts + 1,
         lead = lead || jsonb_build_object('inbound', true, 'assistant', $3::text), updated_at = now()
       where id = $1 returning *`,
      [open[0].id, callId, caller.name],
    );
    return rows[0] ?? null;
  }
  // Their latest deal still going, else a new lead made from the number they rang from.
  const customer = await findCustomerByMobile(businessId, mobile);
  let jobId: string | null = null;
  let customerId = customer;
  if (customer) {
    const jobs = await query<{ id: string }>(
      `select id from design_jobs where business_id = $1 and customer_id = $2 and stage <> 'lost' order by created_at desc limit 1`,
      [businessId, customer],
    );
    jobId = jobs[0]?.id ?? null;
  }
  if (!jobId) {
    const deal = await addHomeLead({
      mobile,
      source: "Rang our number",
      details: { "How they came": `They rang ${mobile.replace(/^\+61/, "0")} into our number and ${caller.name} answered.` },
    });
    if (!deal) return null;
    jobId = deal.jobId;
    customerId = deal.customerId;
  }
  const found = await jobById(businessId, jobId!);
  if (!found || !customerId) return null;
  const rows = await query<VoiceRow>(
    `insert into voice_calls (id, business_id, job_id, customer_id, mode, asked, first_name, mobile, email, lead, status, attempts, vapi_call_id)
     values ($1, $2, $3, $4, 'lead', true, $5, $6, $7, $8, 'calling', 1, $9)
     on conflict (business_id, job_id) where status in ('waiting', 'calling') do nothing
     returning *`,
    [
      newId("vc"),
      businessId,
      jobId,
      customerId,
      speakableName(found.customer.firstName || found.customer.name.split(" ")[0]) || null,
      mobile,
      found.customer.email || null,
      JSON.stringify({
        inbound: true,
        assistant: caller.name,
        source: "Rang our number",
        about: [found.job.title && `Looking for: ${found.job.title}`].filter(Boolean),
      }),
      callId,
    ],
  );
  return rows[0] ?? null;
}

/**
 * Settings → Phone assistant's "Ring me to hear it": a short call to the member's own mobile in the business's chosen
 * voice, saying its opening words and ending. Only where calls are on for the business; never tied to a deal, nothing
 * kept but Vapi's own log.
 */
export async function ringToHearVoice(
  businessId: string,
  mobile: string | null,
  role: CallerKey = "sales",
): Promise<"placed" | "off" | "no-number" | "failed"> {
  const s = voiceSettings();
  if (!s || !(await voiceOnFor(businessId).catch(() => false))) return "off";
  const m = normaliseMobile(mobile ?? "");
  if (!m) return "no-number";
  try {
    const caller = await callerOf(businessId, role);
    const biz = await query<{ name: string }>(`select name from businesses where id = $1`, [businessId]);
    const brand = await loadBrand(businessId, biz[0]?.name ?? "");
    const voice = caller.voice ?? s.voice;
    const res = await fetch(`${VAPI}/call`, {
      method: "POST",
      headers: { authorization: `Bearer ${s.key}`, "content-type": "application/json" },
      body: JSON.stringify({
        phoneNumberId: s.phoneNumberId,
        customer: { number: m },
        name: "Voice test",
        assistant: {
          name: caller.name,
          firstMessage: testCallWords(caller.name, brand.name || biz[0]?.name || ""),
          firstMessageMode: "assistant-speaks-first",
          model: {
            provider: "anthropic",
            model: s.model,
            messages: [{ role: "system", content: "You have just said a short test message. Say nothing more and end the call at once." }],
            tools: [{ type: "endCall" }],
          },
          ...(voice ? { voice } : {}),
          transcriber: transcriberFor([caller.name]),
          artifactPlan: NO_AUDIO,
          maxDurationSeconds: 40,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return "placed";
    const json = (await res.json().catch(() => ({}))) as { message?: unknown };
    console.error("voice test not placed", `Vapi ${res.status}: ${String(json.message ?? "").slice(0, 200)}`);
    return "failed";
  } catch (e) {
    console.error("voice test not placed", e instanceof Error ? e.message : e);
    return "failed";
  }
}

// --- The call as it happens, for the team's live view (domain/live-call.ts) ---------------------------------------

/**
 * Keeps what Vapi says while a call is on: its status for the attempt now on (a new attempt starts afresh), and each
 * thing said (a line said in full is kept; one still being said is held as the partial). Never throws.
 */
export async function keepLive(row: VoiceRow, e: LiveEvent): Promise<void> {
  try {
    const callId = e.callId ?? row.vapi_call_id;
    if (e.kind === "status") {
      await query(
        `update voice_calls set
           live_started_at = case when live_vapi_id is distinct from $2 then null else live_started_at end,
           live_ended_at = case when live_vapi_id is distinct from $2 then null else live_ended_at end,
           live_partial = case when live_vapi_id is distinct from $2 then null else live_partial end,
           live_control_url = coalesce($4, case when live_vapi_id is distinct from $2 then null else live_control_url end),
           live_vapi_id = $2, live_status = $3
         where id = $1`,
        [row.id, callId, e.status, e.controlUrl],
      );
      if (e.status === "in-progress")
        await query(`update voice_calls set live_started_at = coalesce(live_started_at, now()) where id = $1`, [row.id]);
      if (e.status === "ended")
        await query(`update voice_calls set live_ended_at = coalesce(live_ended_at, now()), live_partial = null where id = $1`, [row.id]);
      return;
    }
    if (!e.final) {
      await query(`update voice_calls set live_partial = $2 where id = $1`, [row.id, JSON.stringify({ role: e.role, text: e.text })]);
      return;
    }
    await query(
      `insert into voice_call_lines (voice_call_id, vapi_call_id, role, text)
       select $1, $2, $3, $4 where (select count(*) from voice_call_lines where voice_call_id = $1) < $5`,
      [row.id, callId, e.role, e.text, MAX_LINES],
    );
    await query(`update voice_calls set live_partial = null where id = $1 and live_partial->>'role' = $2`, [row.id, e.role]);
  } catch (err) {
    console.error("live call not kept", err instanceof Error ? err.message : err);
  }
}

/**
 * The assistant's latest call on this deal, for the team's live view: one still lined up or on, else one from the last
 * six hours. Business id first, as everywhere; the caller has checked the member may see the deal.
 */
export async function liveCallFor(businessId: string, jobId: string): Promise<LiveCallView | null> {
  const rows = await query<
    VoiceRow & {
      live_vapi_id: string | null;
      live_status: string | null;
      live_started_at: Date | null;
      live_ended_at: Date | null;
      live_partial: LiveLine | null;
      live_control_url: string | null;
      now: Date;
    }
  >(
    `select *, now() as now from voice_calls
      where business_id = $1 and job_id = $2
        and (status in ('waiting', 'calling') or updated_at > now() - interval '6 hours')
      order by created_at desc limit 1`,
    [businessId, jobId],
  );
  const r = rows[0];
  if (!r) return null;
  const lines = r.live_vapi_id
    ? await query<LiveLine>(`select role, text from voice_call_lines where voice_call_id = $1 and vapi_call_id = $2 order by id`, [
        r.id,
        r.live_vapi_id,
      ])
    : [];
  // The same id the deal's transcripts go by (call-transcripts.ts), so the window can hand this call to the coach chat.
  const written = r.live_vapi_id
    ? await query<{ id: string }>(
        `select id from voice_call_events where voice_call_id = $1 and vapi_call_id = $2 and kind = 'ended' order by at desc limit 1`,
        [r.id, r.live_vapi_id],
      )
    : [];
  const now = new Date(r.now).getTime();
  const started = r.live_started_at ? new Date(r.live_started_at).getTime() : null;
  const ended = r.live_ended_at ? new Date(r.live_ended_at).getTime() : null;
  return {
    phase: livePhase({ status: r.status, liveStatus: r.live_status }),
    customer: r.first_name ?? "",
    outcome: r.outcome,
    booked: r.outcome === "booked" || r.outcome === "pencilled" ? r.call_label : null,
    role: keyOfCall(r),
    attempts: r.attempts,
    startedAgo: started === null ? null : now - started,
    ranFor: started !== null && ended !== null ? ended - started : null,
    lines,
    partial: r.live_partial && (r.live_partial.role === "assistant" || r.live_partial.role === "customer") ? r.live_partial : null,
    canSteer: Boolean(r.live_control_url) && r.live_status === "in-progress",
    canEnd: mayEndCall({ controlUrl: r.live_control_url, liveStatus: r.live_status }),
    canCallNow: mayCallNow({ status: r.status, liveStatus: r.live_status }),
    outOfHours: outOfCallingHours(new Date(r.now)),
    transcriptId: written[0]?.id ?? null,
  };
}

/** Whether calls wouldn't start by themselves at this moment: the next calling window opens later, or never. */
function outOfCallingHours(now: Date): boolean {
  const window = nextCallWindow(now);
  return !window || window.from.getTime() > now.getTime() + 60_000;
}

/**
 * The team rings a waiting call now (14 Nov 2026, Martin: "I need to be able to force the call"): the call lined up for
 * later, or waiting to try again, is placed at once, whatever the calling hours, and the one Vapi was holding is
 * cancelled. The new call is placed first, so the held one's end is read as an older attempt and never as a reason to
 * try again; if it can't be placed, the held one stands. Written on the deal by the member, saying so when it was
 * outside calling hours. Business id first; the caller has checked the member may see the deal.
 */
export async function callNowInstead(
  businessId: string,
  jobId: string,
  by: { email: string; name: string },
): Promise<"ringing" | "not-waiting" | "off" | "failed"> {
  const s = voiceSettings();
  if (!s || !(await voiceOnFor(businessId))) return "off";
  const rows = await query<VoiceRow & { live_status: string | null }>(
    `select * from voice_calls where business_id = $1 and job_id = $2 and status in ('waiting', 'calling')
      order by created_at desc limit 1`,
    [businessId, jobId],
  );
  const r = rows[0];
  if (!r || !mayCallNow({ status: r.status, liveStatus: r.live_status })) return "not-waiting";
  const held = r.vapi_call_id;
  const was = { status: r.status, attempts: r.attempts };
  const now = new Date();
  const outside = outOfCallingHours(now);
  const placed = await placeCall(s, r, { from: now, until: new Date(now.getTime() + 15 * 60_000) });
  if (!placed) {
    // The call Vapi was holding still stands: put ours back as it was.
    await query(`update voice_calls set status = $2, stop_reason = null where id = $1 and status = 'stopped'`, [r.id, was.status]).catch(
      () => undefined,
    );
    return "failed";
  }
  // It took the place of the attempt that was waiting: one attempt, not two.
  await query(`update voice_calls set attempts = $2, live_status = null where id = $1`, [r.id, Math.max(1, was.attempts)]).catch(
    () => undefined,
  );
  if (held)
    await fetch(`${VAPI}/call/${encodeURIComponent(held)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${s.key}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
  await transaction((q) =>
    record(q, businessId, {
      customerId: r.customer_id,
      jobId,
      kind: "note",
      text: `${by.name} had ${r.lead.assistant || "the assistant"} ring now instead of waiting${outside ? ", outside calling hours" : ""}.`,
      by: by.email,
    }),
  ).catch((e) => console.error("call now not written on the deal", e instanceof Error ? e.message : e));
  return "ringing";
}

/**
 * The team types to the assistant while it is on the call on this deal: something to work in (an answer, a thing to
 * mention), or words to say as typed. Sent to the call's control address (never the browser's), and kept on the call
 * as the team's line. Business id first; the caller has checked the member may see the deal.
 */
export async function steerCall(
  businessId: string,
  jobId: string,
  o: { text: string; say: boolean },
): Promise<"sent" | "not-on" | "failed"> {
  const rows = await query<{ id: string; live_vapi_id: string | null; live_control_url: string | null }>(
    `select id, live_vapi_id, live_control_url from voice_calls
      where business_id = $1 and job_id = $2 and live_status = 'in-progress' and live_control_url is not null
      order by created_at desc limit 1`,
    [businessId, jobId],
  );
  const r = rows[0];
  if (!r?.live_control_url) return "not-on";
  try {
    const biz = await query<{ name: string }>(`select name from businesses where id = $1`, [businessId]);
    const brand = await loadBrand(businessId, biz[0]?.name ?? "").catch(() => null);
    const res = await fetch(r.live_control_url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(teamCommand({ ...o, business: brand?.name || biz[0]?.name || "" })),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("call note not sent", `Vapi ${res.status}`);
      return res.status === 400 ? "not-on" : "failed";
    }
    await query(
      `insert into voice_call_lines (voice_call_id, vapi_call_id, role, text)
       select $1, $2, $3, $4 where (select count(*) from voice_call_lines where voice_call_id = $1) < $5`,
      [r.id, r.live_vapi_id, o.say ? "team-say" : "team", o.text, MAX_LINES],
    );
    return "sent";
  } catch (e) {
    console.error("call note not sent", e instanceof Error ? e.message : e);
    return "failed";
  }
}

/**
 * The team hangs up on the assistant's call on this deal (13 Nov 2026, Martin: in case it says something I don't agree
 * with). Closed on our side first, so the call's end isn't taken as a reason to try again, then Vapi is told to end it
 * through the call's control address; if Vapi can't be reached the call is put back as it was. Written on the deal by
 * the member. Business id first; the caller has checked the member may see the deal.
 */
export async function endAssistantCall(
  businessId: string,
  jobId: string,
  by: { email: string; name: string },
): Promise<"ended" | "not-on" | "failed"> {
  const rows = await query<VoiceRow & { live_vapi_id: string | null; live_control_url: string | null; live_status: string | null }>(
    `select * from voice_calls
      where business_id = $1 and job_id = $2 and status in ('waiting', 'calling') and live_control_url is not null
      order by created_at desc limit 1`,
    [businessId, jobId],
  );
  const r = rows[0];
  if (!r || !mayEndCall({ controlUrl: r.live_control_url, liveStatus: r.live_status })) return "not-on";
  const was = r.status;
  await finish(r.id, "stopped", { stop_reason: `Ended by ${by.email}` });
  try {
    const res = await fetch(r.live_control_url!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(END_CALL_COMMAND),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Vapi ${res.status}`);
  } catch (e) {
    console.error("call not ended", e instanceof Error ? e.message : e);
    await query(`update voice_calls set status = $2, stop_reason = null where id = $1 and status = 'stopped'`, [r.id, was]).catch(
      () => undefined,
    );
    return "failed";
  }
  await query(
    `insert into voice_call_lines (voice_call_id, vapi_call_id, role, text)
     select $1, $2, 'team-end', $3 where (select count(*) from voice_call_lines where voice_call_id = $1) < $4`,
    [r.id, r.live_vapi_id, "Ended the call", MAX_LINES],
  ).catch(() => undefined);
  await transaction((q) =>
    record(q, businessId, {
      customerId: r.customer_id,
      jobId,
      kind: "note",
      text: `${by.name} ended ${r.lead.assistant || "the assistant"}'s call partway. No more calls will be made on this run.`,
      by: by.email,
    }),
  ).catch((e) => console.error("ended call not written on the deal", e instanceof Error ? e.message : e));
  return "ended";
}
