/**
 * Server only. Sends text messages through Twilio (twilio.com):
 * TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (an Australian number,
 * or an alphanumeric sender such as "RENUABL"). Without them, messages are
 * skipped and logged. Never blocks the action that triggered it.
 */
import { normaliseMobile } from "@/lib/domain/contact";

/**
 * Who texts come from: TWILIO_FROM, else the number calls are made from (TWILIO_CALLER_ID), so a reply or a call back
 * reaches the same number. That number must be one that can send SMS.
 */
export function smsFrom(env: Record<string, string | undefined> = process.env): string {
  return env.TWILIO_FROM?.trim() || (env.TWILIO_CALLER_ID ?? "").replace(/[\s()-]/g, "");
}

export function smsConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim() && smsFrom());
}

export async function sendSms(to: string, body: string): Promise<"sent" | "skipped" | "failed"> {
  const mobile = normaliseMobile(to);
  if (!mobile) return "skipped";
  if (!smsConfigured()) {
    console.warn("sms skipped (SMS not configured)");
    return "skipped";
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN!.trim()}`).toString("base64");
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: mobile, From: smsFrom(), Body: body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`sms failed: Twilio ${res.status}`);
      return "failed";
    }
    return "sent";
  } catch {
    console.error("sms failed: no response");
    return "failed";
  }
}
