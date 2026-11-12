/**
 * Server only. Twilio for calls made from the computer (domain/browser-call.ts): the browser's token, the check that a
 * request really came from Twilio, the recording, and Twilio's transcript of it. No Twilio library: the token is a
 * JWT signed here, the rest is Twilio's REST API.
 *
 * Off unless TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID,
 * a number to ring from (TWILIO_CALLER_ID, else TWILIO_FROM) and SITE_URL are set. TWILIO_INTELLIGENCE_SERVICE_SID
 * (Twilio's Voice Intelligence, English (Australia)) turns on the transcripts Sol writes up; BROWSER_CALL_RECORD=false
 * records nothing.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { TOKEN_SECONDS, cleanSentences, type Sentence } from "@/lib/domain/browser-call";
import { siteUrl } from "@/lib/domain/sms";

export interface BrowserCallSettings {
  accountSid: string;
  authToken: string;
  keySid: string;
  keySecret: string;
  appSid: string;
  callerId: string;
  site: string;
  record: boolean;
  intelligence: string | null;
}

export function browserCallSettings(env: Record<string, string | undefined> = process.env): BrowserCallSettings | null {
  const get = (k: string) => env[k]?.trim() || "";
  const callerId = (get("TWILIO_CALLER_ID") || get("TWILIO_FROM")).replace(/[\s()-]/g, "");
  const site = siteUrl(env);
  const s = {
    accountSid: get("TWILIO_ACCOUNT_SID"),
    authToken: get("TWILIO_AUTH_TOKEN"),
    keySid: get("TWILIO_API_KEY_SID"),
    keySecret: get("TWILIO_API_KEY_SECRET"),
    appSid: get("TWILIO_TWIML_APP_SID"),
  };
  if (!s.accountSid || !s.authToken || !s.keySid || !s.keySecret || !s.appSid || !/^\+\d{8,15}$/.test(callerId) || !site) return null;
  return {
    ...s,
    callerId,
    site,
    record: get("BROWSER_CALL_RECORD") !== "false",
    intelligence: get("TWILIO_INTELLIGENCE_SERVICE_SID") || null,
  };
}

/** For /api/status: what's set, yes/no only. */
export function browserCallStatus(env: Record<string, string | undefined> = process.env) {
  const set = (k: string) => Boolean(env[k]?.trim());
  return {
    ready: Boolean(browserCallSettings(env)),
    apiKey: set("TWILIO_API_KEY_SID") && set("TWILIO_API_KEY_SECRET"),
    twimlApp: set("TWILIO_TWIML_APP_SID"),
    authToken: set("TWILIO_AUTH_TOKEN"),
    callerId: set("TWILIO_CALLER_ID") || set("TWILIO_FROM"),
    transcripts: set("TWILIO_INTELLIGENCE_SERVICE_SID"),
    recording: env.BROWSER_CALL_RECORD?.trim() !== "false",
  };
}

/** Who a member is to Twilio: letters, digits and underscores, the same every time, telling nothing about them. */
export function identityFor(businessId: string, email: string): string {
  return `m_${createHash("sha256").update(`${businessId}:${email.toLowerCase()}`).digest("hex").slice(0, 32)}`;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

/** Twilio's access token for the browser: it may make calls through our TwiML app, and receive none. */
export function accessToken(s: BrowserCallSettings, identity: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const header = { typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" };
  const payload = {
    jti: `${s.keySid}-${iat}`,
    iss: s.keySid,
    sub: s.accountSid,
    iat,
    exp: iat + TOKEN_SECONDS,
    grants: { identity, voice: { incoming: { allow: false }, outgoing: { application_sid: s.appSid } } },
  };
  const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return `${body}.${b64url(createHmac("sha256", s.keySecret).update(body).digest())}`;
}

/**
 * Twilio's signature on a request (X-Twilio-Signature): the full address it called, then each form field's name and
 * value in name order, signed with the auth token (HMAC-SHA1, base64). Compared in constant time.
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}
export function signedByTwilio(authToken: string, url: string, params: Record<string, string>, given: string | null): boolean {
  if (!given) return false;
  const a = Buffer.from(twilioSignature(authToken, url, params));
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * A request from Twilio, checked: its form fields, when its signature matches the address it was sent to. The address
 * is built from SITE_URL (what Twilio was told), not the request's own host.
 */
export async function fromTwilio(request: Request, s: BrowserCallSettings): Promise<Record<string, string> | null> {
  const url = new URL(request.url);
  const called = `${s.site}${url.pathname}${url.search}`;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return null;
  }
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
  return signedByTwilio(s.authToken, called, params, request.headers.get("x-twilio-signature")) ? params : null;
}

const auth = (s: BrowserCallSettings) => `Basic ${Buffer.from(`${s.accountSid}:${s.authToken}`).toString("base64")}`;

/** The recording's sound (mp3), for the deal's own members to play. */
export async function recordingAudio(s: BrowserCallSettings, recordingSid: string): Promise<Response | null> {
  if (!/^RE[0-9a-f]{32}$/.test(recordingSid)) return null;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${s.accountSid}/Recordings/${recordingSid}.mp3`, {
    headers: { authorization: auth(s) },
    signal: AbortSignal.timeout(20_000),
  });
  return res.ok ? res : null;
}

/** Asks Twilio's Voice Intelligence to transcribe a recording; its transcript's id. VERIFY against Twilio's docs. */
export async function startTranscript(s: BrowserCallSettings, recordingSid: string, key: string): Promise<string | null> {
  if (!s.intelligence) return null;
  const body = new URLSearchParams({
    ServiceSid: s.intelligence,
    CustomerKey: key,
    Channel: JSON.stringify({
      media_properties: { source_sid: recordingSid },
      participants: [
        { channel_participant: 1, role: "Agent" },
        { channel_participant: 2, role: "Customer" },
      ],
    }),
  });
  const res = await fetch("https://intelligence.twilio.com/v2/Transcripts", {
    method: "POST",
    headers: { authorization: auth(s), "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: unknown; message?: unknown };
  if (!res.ok || typeof json.sid !== "string") {
    console.error("transcript not started", `Twilio ${res.status}: ${String(json.message ?? "").slice(0, 200)}`);
    return null;
  }
  return json.sid;
}

/** The transcript's sentences once it is done; "waiting" while Twilio is still at it; null when it failed. */
export async function transcriptSentences(s: BrowserCallSettings, transcriptSid: string): Promise<Sentence[] | "waiting" | null> {
  if (!/^GT[0-9a-f]{32}$/.test(transcriptSid)) return null;
  const head = await fetch(`https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}`, {
    headers: { authorization: auth(s) },
    signal: AbortSignal.timeout(10_000),
  });
  const t = (await head.json().catch(() => ({}))) as { status?: unknown };
  if (!head.ok) return null;
  if (t.status === "failed" || t.status === "canceled") return null;
  if (t.status !== "completed") return "waiting";
  const res = await fetch(`https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}/Sentences?PageSize=1000`, {
    headers: { authorization: auth(s) },
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { sentences?: unknown };
  return res.ok ? cleanSentences(json.sentences) : null;
}
