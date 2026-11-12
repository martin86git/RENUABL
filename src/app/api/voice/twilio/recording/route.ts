import { after } from "next/server";
import { callRecorded, writeUp } from "@/lib/server/browser-calls";
import { browserCallSettings, fromTwilio } from "@/lib/server/twilio-voice";

// Twilio's transcript of the recording can take a few minutes: the write-up waits for it after the answer.
export const maxDuration = 300;

/** POST: Twilio saying a call's recording is ready: kept, then the call is transcribed and written up on the deal. */
export async function POST(request: Request) {
  const s = browserCallSettings();
  if (!s) return new Response("Not set up", { status: 404 });
  const p = await fromTwilio(request, s);
  if (!p) return new Response("Forbidden", { status: 403 });
  if ((p.RecordingStatus ?? "completed") !== "completed" || !p.RecordingSid) return new Response(null, { status: 204 });
  const id = new URL(request.url).searchParams.get("call") ?? "";
  const row = await callRecorded(id, p.RecordingSid, Number(p.RecordingDuration ?? 0) || 0);
  if (row) after(() => writeUp(row).catch((e) => console.error("browser call write-up failed", e instanceof Error ? e.message : e)));
  return new Response(null, { status: 204 });
}
