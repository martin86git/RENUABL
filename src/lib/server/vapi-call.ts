/**
 * Server only. Places a call at Vapi. The assistant carries settings that make it answer quickly (how the end of the
 * customer's turn is read, ElevenLabs' quick model: delivery.ts, voice-agent.ts); if Vapi turns the call away as badly
 * formed, it is tried once more without them, so a setting Vapi stops accepting slows the calls instead of stopping them.
 */
import { outOfCallCredit } from "@/lib/domain/call-credit";
import { withoutSpeedSettings } from "@/lib/domain/voice-agent";

const VAPI = "https://api.vapi.ai";

export interface VapiAnswer {
  ok: boolean;
  status: number;
  json: { id?: unknown; message?: unknown; monitor?: { controlUrl?: unknown } };
}

type CallBody = { assistant: Record<string, unknown> } & Record<string, unknown>;

async function post(key: string, body: unknown): Promise<VapiAnswer> {
  const res = await fetch(`${VAPI}/call`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as VapiAnswer["json"];
  return { ok: res.ok, status: res.status, json };
}

const said = (m: unknown): string => (Array.isArray(m) ? m.join("; ") : String(m ?? "")).slice(0, 300);

export async function placeVapiCall(key: string, body: CallBody): Promise<VapiAnswer> {
  const first = await post(key, body);
  if (first.status !== 400 || outOfCallCredit(said(first.json.message))) return first;
  console.error("voice call refused with its speed settings, trying without", said(first.json.message));
  return post(key, { ...body, assistant: withoutSpeedSettings(body.assistant) });
}
