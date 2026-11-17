/**
 * Server only. A voice's sample clip, fetched from its maker for the play button in the voice picker (18 Nov 2026,
 * Martin: hear a voice without a call). Deepgram's is at a fixed address; ElevenLabs' is found in its public list of
 * ready-made voices (no key needed; the list is kept an hour). The clip is the maker's own recording, kept in memory
 * for the day so each is fetched once. Nothing about the business or the member goes with the request.
 */
import { isElevenLabsClip, voiceSample, type CallerVoice } from "@/lib/domain/design/caller";

export interface VoiceClip {
  bytes: Uint8Array<ArrayBuffer>;
  type: "audio/mpeg" | "audio/wav";
}

const MAX_BYTES = 3_000_000;
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const clips = new Map<string, { clip: VoiceClip; at: number }>();
let list: { byId: Map<string, string>; at: number } | null = null;

async function elevenLabsClips(): Promise<Map<string, string>> {
  if (list && Date.now() - list.at < HOUR) return list.byId;
  const res = await fetch("https://api.elevenlabs.io/v1/voices", { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  const json = (await res.json()) as { voices?: { voice_id?: unknown; preview_url?: unknown }[] };
  const byId = new Map<string, string>();
  for (const v of json.voices ?? [])
    if (typeof v.voice_id === "string" && isElevenLabsClip(v.preview_url)) byId.set(v.voice_id, v.preview_url);
  list = { byId, at: Date.now() };
  return byId;
}

/** MP3 or WAV by its own bytes; anything else isn't played. */
function kindOf(b: Uint8Array): VoiceClip["type"] | null {
  const text = (from: number, n: number) => String.fromCharCode(...b.subarray(from, from + n));
  if (text(0, 4) === "RIFF" && text(8, 4) === "WAVE") return "audio/wav";
  if (text(0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  return null;
}

/** The clip for this voice, or null when its maker has none we can fetch. */
export async function voiceClip(voice: CallerVoice): Promise<VoiceClip | null> {
  const sample = voiceSample(voice);
  if (!sample) return null;
  const key = `${voice.provider}:${voice.voiceId}`;
  const kept = clips.get(key);
  if (kept && Date.now() - kept.at < DAY) return kept.clip;
  try {
    const url = sample.from === "deepgram" ? sample.url : (await elevenLabsClips()).get(sample.voiceId);
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok || Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const type = bytes.length <= MAX_BYTES ? kindOf(bytes) : null;
    if (!type) return null;
    const clip = { bytes, type };
    if (clips.size > 60) clips.clear();
    clips.set(key, { clip, at: Date.now() });
    return clip;
  } catch (err) {
    console.error("voice sample not fetched", key, err instanceof Error ? err.message : err);
    return null;
  }
}
