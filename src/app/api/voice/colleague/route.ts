import { timingSafeEqual } from "node:crypto";
import { readVapiEvent, VOICE_SECRET_HEADER } from "@/lib/domain/voice-agent";
import { answerTeamLine, colleagueCallByRef, colleagueCallEnded, colleagueTool } from "@/lib/server/design-colleague";
import { voiceSettings } from "@/lib/server/voice-calls";

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST: Vapi's server messages for the team's own assistant, its chief of staff (domain/design/colleague.ts), checked by
 * the shared secret. "assistant-request" is someone ringing the team line (its Server URL in Vapi is this address, with
 * the same header as the customer number); with ?ref=<the call's one-off reference>, "tool-calls" answers its
 * read-only tools for the member the call is for, and "end-of-call-report" keeps what was said for them. Never the
 * customer number's webhook: customers never reach this.
 */
export async function POST(request: Request) {
  const s = voiceSettings();
  if (!s || !sameSecret(request.headers.get(VOICE_SECRET_HEADER), s.secret)) return new Response("Unauthorized", { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({}, { status: 400 });
  }
  const event = readVapiEvent(body);
  if (event.type === "assistant-request") return Response.json(await answerTeamLine(event));

  const ref = new URL(request.url).searchParams.get("ref") ?? "";
  const row = await colleagueCallByRef(ref).catch(() => null);

  if (event.type === "tool-calls") {
    const results = [];
    for (const t of event.toolCalls) {
      if (!row) {
        results.push({ toolCallId: t.id, error: "This call isn't on file. Say goodbye and end the call." });
        continue;
      }
      try {
        // Read the row afresh for each tool: the PIN may have just let them through.
        const now = (await colleagueCallByRef(ref)) ?? row;
        results.push({ toolCallId: t.id, result: await colleagueTool(now, t.name, t.args) });
      } catch (e) {
        console.error("colleague tool failed", e instanceof Error ? e.message : e);
        results.push({ toolCallId: t.id, error: "That didn't work just now. Say so and offer to try again." });
      }
    }
    return Response.json({ results });
  }

  if (event.type === "end-of-call-report" && row) await colleagueCallEnded(row, event).catch(() => undefined);
  return Response.json({});
}
