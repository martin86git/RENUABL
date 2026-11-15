/**
 * Server only. Bounces and spam complaints reported back by the email service, for RENUABL's marketing
 * (marketing-send.ts recordDeliveryProblem). Every request is checked against the service's own signature
 * first; nothing unsigned is believed, and without the secret set the route does nothing.
 *
 * - SendGrid's signed Event Webhook: SENDGRID_WEBHOOK_PUBLIC_KEY (the verification key it shows, base64).
 * - Resend (Svix): RESEND_WEBHOOK_SECRET ("whsec_…").
 */
import { createHmac, createPublicKey, timingSafeEqual, verify } from "node:crypto";

const FIVE_MINUTES = 300;

export function verifySendGrid(body: string, signature: string | null, timestamp: string | null, publicKey: string): boolean {
  if (!signature || !timestamp) return false;
  try {
    const key = createPublicKey({ key: Buffer.from(publicKey.trim(), "base64"), format: "der", type: "spki" });
    return verify("sha256", Buffer.from(timestamp + body), key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

export function verifySvix(
  body: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > FIVE_MINUTES) return false;
  const key = Buffer.from(secret.trim().replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export interface DeliveryProblem {
  kind: "bounce" | "complaint";
  token: string | null;
  email: string | null;
  note: string;
}

const str = (v: unknown) => (typeof v === "string" ? v : null);

/** SendGrid sends an array of events; only hard failures and complaints matter here. */
export function sendGridProblems(raw: unknown): DeliveryProblem[] {
  if (!Array.isArray(raw)) return [];
  const out: DeliveryProblem[] = [];
  for (const e of raw.slice(0, 1000)) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    const token = str(r.renuabl_m);
    const email = str(r.email);
    // A "blocked" bounce is often temporary (a spam filter, a full box); only a real bounce or a drop marks the address.
    if ((r.event === "bounce" && r.type !== "blocked") || r.event === "dropped")
      out.push({ kind: "bounce", token, email, note: `${String(r.event)}: ${String(r.reason ?? "").slice(0, 200)}` });
    else if (r.event === "spamreport") out.push({ kind: "complaint", token, email, note: "Marked as spam" });
  }
  return out;
}

/** Resend sends one event a request. */
export function resendProblem(raw: unknown): DeliveryProblem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { type?: unknown; data?: Record<string, unknown> };
  const data = r.data ?? {};
  const tags = data.tags;
  const token = Array.isArray(tags)
    ? str((tags.find((t) => (t as Record<string, unknown>)?.name === "renuabl_m") as Record<string, unknown> | undefined)?.value)
    : tags && typeof tags === "object"
      ? str((tags as Record<string, unknown>).renuabl_m)
      : null;
  const to = Array.isArray(data.to) ? str(data.to[0]) : str(data.to);
  const bounce = data.bounce as Record<string, unknown> | undefined;
  if (r.type === "email.bounced") {
    // A soft (transient) bounce is left alone.
    if (bounce && String(bounce.type ?? "").toLowerCase() === "transient") return null;
    return { kind: "bounce", token, email: to, note: `bounced: ${String(bounce?.message ?? "").slice(0, 200)}` };
  }
  if (r.type === "email.complained") return { kind: "complaint", token, email: to, note: "Marked as spam" };
  return null;
}
