import { cleanVoice } from "@/lib/domain/design/caller";
import { answer, requireMember } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";
import { voiceClip } from "@/lib/server/voice-samples";

/**
 * GET ?provider=&id= → the voice's sample clip (its maker's own recording), for the play button in the voice picker.
 * Signed-in members only; 404 when the maker has no clip we can fetch.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-voice-sample", 240)) return new Response("Try again in a little while.", { status: 429 });
    const at = new URL(request.url).searchParams;
    const voice = cleanVoice({ provider: at.get("provider"), voiceId: at.get("id") });
    const clip = voice && voice !== "bad" ? await voiceClip(voice) : null;
    if (!clip) return new Response("No sample", { status: 404 });
    return new Response(clip.bytes, {
      headers: {
        "content-type": clip.type,
        "content-length": String(clip.bytes.length),
        "cache-control": "private, max-age=86400",
        "x-content-type-options": "nosniff",
      },
    });
  });
}
