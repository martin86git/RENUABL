/**
 * Server only. Each business's own phone number for its voice agents and texts (16 Nov 2026, Martin: voice agents are a
 * paid add-on, with the business's own number). One live number a business, in `design_phone_numbers` (business id
 * first): bought on Twilio (an Australian mobile, so it can text), its incoming texts sent to /api/voice/twilio/sms,
 * then imported into Vapi with its Server URL at /api/voice/vapi (our secret in the x-renuabl-voice header), so calls
 * made, calls coming in and texts all go by that number. Released (from Vapi and Twilio) when the add-on ends.
 *
 * RENUABL's own business rings and texts from RENUABL's number (VAPI_PHONE_NUMBER_ID, TWILIO_FROM / TWILIO_CALLER_ID),
 * as before.
 *
 * Buying is off unless PHONE_NUMBERS_ENABLED=true, with TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, the voice settings
 * (voice-calls.ts) and, as Australian numbers need them, TWILIO_AU_BUNDLE_SID (an approved regulatory bundle) and
 * TWILIO_AU_ADDRESS_SID. VERIFY on Twilio's test credentials, then once with Martin, before switching it on: the AU
 * mobile search, the bundle and address on purchase, and Vapi's import (`provider: "twilio"`, `server.url`,
 * `server.headers`). Martin to confirm before any live number is bought.
 */
import { normaliseMobile } from "@/lib/domain/contact";
import { VOICE_SECRET_HEADER } from "@/lib/domain/voice-agent";
import { dbConfigured, newId, query } from "./db";
import { renuablCrm } from "./renuabl-crm";
import { smsFrom } from "./sms";
import { voiceSettings } from "./voice-calls";

const TWILIO = "https://api.twilio.com/2010-04-01";
const VAPI = "https://api.vapi.ai";

export interface BusinessNumber {
  /** The number in +61 form. */
  e164: string;
  /** The number's id in Vapi, for calls made and taken. Null when it isn't in Vapi. */
  vapiId: string | null;
  /** RENUABL's own number (RENUABL's own business only). */
  renuabl: boolean;
}

/** The number a business calls and texts from: its own live one, else RENUABL's for RENUABL's own business, else none. */
export async function numberOf(businessId: string): Promise<BusinessNumber | null> {
  if (!dbConfigured()) return null;
  const rows = await query<{ e164: string; vapi_id: string | null }>(
    `select e164, vapi_id from design_phone_numbers where business_id = $1 and status = 'live' limit 1`,
    [businessId],
  );
  if (rows[0]) return { e164: rows[0].e164, vapiId: rows[0].vapi_id, renuabl: false };
  const own = await renuablCrm().catch(() => null);
  if (own?.businessId !== businessId) return null;
  const e164 = smsFrom() || (process.env.TWILIO_CALLER_ID ?? "").replace(/[\s()-]/g, "");
  return { e164, vapiId: process.env.VAPI_PHONE_NUMBER_ID?.trim() || null, renuabl: true };
}

/** Whose number this is: a business's own by its Vapi id or the number itself, RENUABL's own by RENUABL's. */
export async function businessOfNumber(by: { vapiId?: string | null; e164?: string | null }): Promise<string | null> {
  if (!dbConfigured()) return null;
  const e164 = by.e164 ? (normaliseMobile(by.e164) ?? by.e164.replace(/[\s()-]/g, "")) : null;
  if (by.vapiId || e164) {
    const rows = await query<{ business_id: string }>(
      `select business_id from design_phone_numbers where status = 'live' and (($1::text is not null and vapi_id = $1) or ($2::text is not null and e164 = $2)) limit 1`,
      [by.vapiId ?? null, e164],
    );
    if (rows[0]) return rows[0].business_id;
  }
  const renuablVapi = process.env.VAPI_PHONE_NUMBER_ID?.trim();
  const renuablSms = smsFrom();
  const ours = (by.vapiId && by.vapiId === renuablVapi) || (e164 && renuablSms && e164 === renuablSms);
  if (!ours) return null;
  return (await renuablCrm().catch(() => null))?.businessId ?? null;
}

interface BuySettings {
  sid: string;
  token: string;
  bundle: string;
  address: string;
  site: string;
  vapiKey: string;
  secret: string;
}

function buySettings(env: Record<string, string | undefined> = process.env): BuySettings | null {
  const get = (k: string) => env[k]?.trim() || "";
  const voice = voiceSettings(env);
  if (get("PHONE_NUMBERS_ENABLED") !== "true" || !voice) return null;
  const s = {
    sid: get("TWILIO_ACCOUNT_SID"),
    token: get("TWILIO_AUTH_TOKEN"),
    bundle: get("TWILIO_AU_BUNDLE_SID"),
    address: get("TWILIO_AU_ADDRESS_SID"),
  };
  if (!s.sid || !s.token || !s.bundle || !s.address) return null;
  return { ...s, site: voice.site, vapiKey: voice.key, secret: voice.secret };
}

/** Whether numbers can be bought from the app (for /api/status and the Billing card). */
export const numberBuyingOn = (env: Record<string, string | undefined> = process.env): boolean => Boolean(buySettings(env));

export function numberBuyingStatus(env: Record<string, string | undefined> = process.env) {
  const set = (k: string) => Boolean(env[k]?.trim());
  return {
    enabled: env.PHONE_NUMBERS_ENABLED?.trim() === "true",
    ready: numberBuyingOn(env),
    bundle: set("TWILIO_AU_BUNDLE_SID"),
    address: set("TWILIO_AU_ADDRESS_SID"),
  };
}

export type BuyResult = { result: "bought"; e164: string } | { result: "off" | "already" | "none-available" | "failed" };

/**
 * Buys the business its own number: an Australian mobile that can call and text, its texts sent to us, imported into
 * Vapi. Only once a business (one live number). If Vapi refuses the import, the Twilio number is released again so
 * nothing is left paid for and unused. The caller has checked the voice add-on is on the business's plan.
 */
export async function buyNumber(businessId: string, by: string, label: string): Promise<BuyResult> {
  const s = buySettings();
  if (!s || !dbConfigured()) return { result: "off" };
  const have = await query(`select 1 from design_phone_numbers where business_id = $1 and status = 'live'`, [businessId]);
  if (have.length) return { result: "already" };
  const auth = `Basic ${Buffer.from(`${s.sid}:${s.token}`).toString("base64")}`;
  const account = `${TWILIO}/Accounts/${encodeURIComponent(s.sid)}`;
  try {
    const search = await fetch(`${account}/AvailablePhoneNumbers/AU/Mobile.json?SmsEnabled=true&VoiceEnabled=true&PageSize=1`, {
      headers: { authorization: auth },
      signal: AbortSignal.timeout(10_000),
    });
    const found = (await search.json().catch(() => ({}))) as { available_phone_numbers?: { phone_number?: string }[] };
    const pick = found.available_phone_numbers?.[0]?.phone_number;
    if (!search.ok || !pick) return { result: "none-available" };
    const bought = await fetch(`${account}/IncomingPhoneNumbers.json`, {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        PhoneNumber: pick,
        BundleSid: s.bundle,
        AddressSid: s.address,
        FriendlyName: `RENUABL Business · ${label}`.slice(0, 64),
        SmsUrl: `${s.site}/api/voice/twilio/sms`,
        SmsMethod: "POST",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const number = (await bought.json().catch(() => ({}))) as { sid?: string; phone_number?: string; message?: string };
    if (!bought.ok || !number.sid || !number.phone_number) {
      console.error("number not bought", `Twilio ${bought.status}: ${String(number.message ?? "").slice(0, 200)}`);
      return { result: "failed" };
    }
    const vapi = await fetch(`${VAPI}/phone-number`, {
      method: "POST",
      headers: { authorization: `Bearer ${s.vapiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        provider: "twilio",
        number: number.phone_number,
        twilioAccountSid: s.sid,
        twilioAuthToken: s.token,
        name: label.slice(0, 40),
        server: { url: `${s.site}/api/voice/vapi`, headers: { [VOICE_SECRET_HEADER]: s.secret } },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const imported = (await vapi.json().catch(() => ({}))) as { id?: string; message?: unknown };
    if (!vapi.ok || typeof imported.id !== "string") {
      console.error("number not imported into Vapi", `Vapi ${vapi.status}: ${String(imported.message ?? "").slice(0, 200)}`);
      await releaseTwilio(s, number.sid);
      return { result: "failed" };
    }
    await query(
      `insert into design_phone_numbers (business_id, id, e164, twilio_sid, vapi_id, bought_by) values ($1, $2, $3, $4, $5, $6)`,
      [businessId, newId("pn"), number.phone_number, number.sid, imported.id, by.toLowerCase()],
    );
    return { result: "bought", e164: number.phone_number };
  } catch (e) {
    console.error("number not bought", e instanceof Error ? e.message : e);
    return { result: "failed" };
  }
}

async function releaseTwilio(s: Pick<BuySettings, "sid" | "token">, twilioSid: string): Promise<void> {
  const auth = `Basic ${Buffer.from(`${s.sid}:${s.token}`).toString("base64")}`;
  await fetch(`${TWILIO}/Accounts/${encodeURIComponent(s.sid)}/IncomingPhoneNumbers/${encodeURIComponent(twilioSid)}.json`, {
    method: "DELETE",
    headers: { authorization: auth },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

/**
 * The business's number released: taken out of Vapi and given back to Twilio, and marked released here (kept as a
 * record). Done when the voice add-on ends. A number staff put on by hand (no Twilio id) is only marked released.
 */
export async function releaseNumber(businessId: string): Promise<void> {
  if (!dbConfigured()) return;
  const rows = await query<{ id: string; twilio_sid: string | null; vapi_id: string | null }>(
    `update design_phone_numbers set status = 'released', released_at = now() where business_id = $1 and status = 'live'
     returning id, twilio_sid, vapi_id`,
    [businessId],
  );
  const row = rows[0];
  if (!row) return;
  const voice = voiceSettings();
  if (row.vapi_id && voice)
    await fetch(`${VAPI}/phone-number/${encodeURIComponent(row.vapi_id)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${voice.key}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (row.twilio_sid && sid && token) await releaseTwilio({ sid, token }, row.twilio_sid);
}

/**
 * Staff put on a number they set up themselves (bought in Twilio and imported into Vapi by hand), while buying from the
 * app is off. Replaces any live one (marked released, nothing released at Twilio or Vapi).
 */
export async function attachNumber(
  businessId: string,
  given: { e164: string; vapiId: string | null; by: string },
): Promise<"ok" | "bad-number"> {
  const e164 =
    normaliseMobile(given.e164) ?? (/^\+61\d{9}$/.test(given.e164.replace(/[\s()-]/g, "")) ? given.e164.replace(/[\s()-]/g, "") : null);
  if (!e164) return "bad-number";
  const vapiId = given.vapiId?.trim().slice(0, 80) || null;
  await query(`update design_phone_numbers set status = 'released', released_at = now() where business_id = $1 and status = 'live'`, [
    businessId,
  ]);
  await query(`insert into design_phone_numbers (business_id, id, e164, vapi_id, bought_by) values ($1, $2, $3, $4, $5)`, [
    businessId,
    newId("pn"),
    e164,
    vapiId,
    given.by.toLowerCase(),
  ]);
  return "ok";
}
