import { readLiveEvent } from "@/lib/domain/browser-call";
import { keepLiveEvent } from "@/lib/server/browser-calls";
import { browserCallSettings, fromTwilio } from "@/lib/server/twilio-voice";

/**
 * POST: Twilio's real-time transcription of a call from the computer (the note-taker switched on from the call's bar,
 * 26 Nov 2026): each stretch of words, partial or final, on the member's side or the customer's, kept on the call for
 * the note-taker to show (server/browser-calls.ts `keepLiveEvent`). Checked by Twilio's signature.
 */
export async function POST(request: Request) {
  const s = browserCallSettings();
  if (!s) return new Response("Not set up", { status: 404 });
  const p = await fromTwilio(request, s);
  if (!p) return new Response("Forbidden", { status: 403 });
  const id = new URL(request.url).searchParams.get("call") ?? "";
  await keepLiveEvent(id, p.TranscriptionSid ?? "", readLiveEvent(p)).catch((e) =>
    console.error("live words not kept", e instanceof Error ? e.message : e),
  );
  return new Response(null, { status: 204 });
}
