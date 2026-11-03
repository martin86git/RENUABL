import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { readVapiEvent, VOICE_SECRET_HEADER } from "@/lib/domain/voice-agent";
import { handleCallEnded, handleToolCall, voiceCallByRef, voiceSettings } from "@/lib/server/voice-calls";

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST ?ref=<voice call id>: Vapi's server messages for a call Revo placed (server/voice-calls.ts). Checked by the
 * shared secret in the header we gave Vapi with the call. "tool-calls" answers Revo's tools (book the 15-minute call,
 * don't call again); "end-of-call-report" keeps the call on the lead's record and tries again or hands over. Always 200
 * once checked: Vapi ignores other statuses and tells the caller it got no answer.
 */
export async function POST(request: Request) {
  const s = voiceSettings();
  if (!s || !sameSecret(request.headers.get(VOICE_SECRET_HEADER), s.secret)) return new Response("Unauthorized", { status: 401 });
  const ref = new URL(request.url).searchParams.get("ref") ?? "";
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({}, { status: 400 });
  }
  const event = readVapiEvent(body);
  const row = await voiceCallByRef(ref).catch(() => null);

  if (event.type === "tool-calls") {
    const results = [];
    for (const t of event.toolCalls) {
      if (!row) {
        results.push({ toolCallId: t.id, error: "This call isn't on file." });
        continue;
      }
      try {
        const result = await handleToolCall(row, t.name, t.args, (fn) => after(fn));
        results.push({ toolCallId: t.id, result });
      } catch (e) {
        console.error("voice tool failed", e instanceof Error ? e.message : e);
        results.push({ toolCallId: t.id, error: "That didn't work. Tell them the team will call them back." });
      }
    }
    return Response.json({ results });
  }

  if (event.type === "end-of-call-report" && row) {
    after(() => handleCallEnded(row, event).catch((e) => console.error("voice call end not handled", e instanceof Error ? e.message : e)));
  }
  return Response.json({});
}
