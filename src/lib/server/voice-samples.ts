/**
 * Server only. A voice's sample clip for the play button in the voice picker (18 Nov 2026, Martin: hear a voice
 * without a call). First choice (21 Nov 2026, Martin: every sample about solar): the voice speaking our own line
 * (`sampleLine`), made by its maker where the site has that maker's key (ELEVENLABS_API_KEY, DEEPGRAM_API_KEY,
 * AZURE_SPEECH_KEY with AZURE_SPEECH_REGION), made once a voice and kept in `voice_clips`. Else the maker's own clip:
 * Deepgram's at a fixed address, ElevenLabs' from its public list of ready-made voices (no key; the list kept an hour),
 * kept in memory for the day. Nothing about the business or the member goes with any request.
 */
import {
  CALLER_VOICES,
  canSpeak,
  isElevenLabsClip,
  SAMPLE_LINE_VERSION,
  sampleLine,
  sampleName,
  voiceSample,
  type CallerVoice,
  type SpeakingProvider,
} from "@/lib/domain/design/caller";
import { query } from "./db";

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

const env = (name: string) => process.env[name]?.trim() || "";
/** The Azure region as Microsoft writes it ("Australia East" typed in Vercel still reads as australiaeast). */
const azureRegion = () =>
  env("AZURE_SPEECH_REGION")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** The makers whose voices the site can have speak our line now: those whose key is set. */
export function speakingProviders(): SpeakingProvider[] {
  const on: SpeakingProvider[] = [];
  if (env("ELEVENLABS_API_KEY")) on.push("11labs");
  if (env("DEEPGRAM_API_KEY")) on.push("deepgram");
  if (env("AZURE_SPEECH_KEY") && /^[a-z0-9]{3,30}$/.test(azureRegion())) on.push("azure");
  return on;
}

const xml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Our line in this voice, asked of its maker. Null on any refusal. */
async function speak(voice: CallerVoice & { provider: SpeakingProvider }): Promise<VoiceClip | null> {
  const text = sampleLine(sampleName(voice));
  const id = encodeURIComponent(voice.voiceId);
  const signal = AbortSignal.timeout(20_000);
  let res: Response;
  if (voice.provider === "11labs") {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": env("ELEVENLABS_API_KEY"), "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
      signal,
    });
  } else if (voice.provider === "deepgram") {
    res = await fetch(`https://api.deepgram.com/v1/speak?model=aura-2-${id}-en&encoding=mp3`, {
      method: "POST",
      headers: { authorization: `Token ${env("DEEPGRAM_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
  } else {
    const lang = /^[a-z]{2}-[A-Z]{2}/.exec(voice.voiceId)?.[0] ?? "en-AU";
    res = await fetch(`https://${azureRegion()}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "ocp-apim-subscription-key": env("AZURE_SPEECH_KEY"),
        "content-type": "application/ssml+xml",
        "x-microsoft-outputformat": "audio-24khz-48kbitrate-mono-mp3",
        "user-agent": "renuabl",
      },
      body: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}"><voice name="${xml(voice.voiceId)}">${xml(text)}</voice></speak>`,
      signal,
    });
  }
  if (!res.ok) {
    const why = (await res.text().catch(() => "")).slice(0, 200);
    console.error("voice sample not spoken", voice.provider, voice.voiceId, res.status, why);
    return null;
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const type = bytes.length > 0 && bytes.length <= MAX_BYTES ? kindOf(bytes) : null;
  return type ? { bytes, type } : null;
}

let table: Promise<unknown> | null = null;
const clipTable = () =>
  (table ??= query(`create table if not exists voice_clips (
  voice text primary key,
  version integer not null,
  type text not null,
  bytes bytea not null,
  made_at timestamptz not null default now()
)`).catch((e) => {
    table = null;
    throw e;
  }));

/** Our line in this voice: kept from before, else made now and kept (one maker's request a voice, not each play). */
async function solarClip(voice: CallerVoice & { provider: SpeakingProvider }): Promise<VoiceClip | null> {
  const key = `${voice.provider}:${voice.voiceId}`;
  try {
    await clipTable();
    const rows = await query<{ type: string; bytes: Buffer }>(`select type, bytes from voice_clips where voice = $1 and version = $2`, [
      key,
      SAMPLE_LINE_VERSION,
    ]);
    if (rows[0]) return { bytes: new Uint8Array(rows[0].bytes), type: rows[0].type === "audio/wav" ? "audio/wav" : "audio/mpeg" };
  } catch {
    // No database: still speak it, just not kept.
  }
  const clip = await speak(voice).catch((err) => {
    console.error("voice sample not spoken", key, err instanceof Error ? err.message : err);
    return null;
  });
  if (clip)
    await query(
      `insert into voice_clips (voice, version, type, bytes) values ($1, $2, $3, $4)
       on conflict (voice) do update set version = $2, type = $3, bytes = $4, made_at = now()`,
      [key, SAMPLE_LINE_VERSION, clip.type, Buffer.from(clip.bytes)],
    ).catch(() => undefined);
  return clip;
}

let warming = false;

/**
 * Makes the solar line ahead of time for every voice on our list whose maker can speak it and whose clip isn't kept
 * yet (21 Nov 2026, Martin: the first press of a Deepgram voice waited while its clip was made). A few at a time,
 * one warm-up at once a server; started when the picker asks which makers speak, after the answer has gone back.
 */
export async function warmClips(max = 12): Promise<void> {
  const on = speakingProviders();
  if (warming || on.length === 0) return;
  warming = true;
  try {
    await clipTable();
    const kept = new Set(
      (await query<{ voice: string }>(`select voice from voice_clips where version = $1`, [SAMPLE_LINE_VERSION])).map((r) => r.voice),
    );
    const todo = CALLER_VOICES.filter((v) => canSpeak(v.provider) && on.includes(v.provider as SpeakingProvider))
      .filter((v) => !kept.has(`${v.provider}:${v.voiceId}`))
      .slice(0, max);
    for (let i = 0; i < todo.length; i += 3)
      await Promise.all(todo.slice(i, i + 3).map((v) => solarClip({ provider: v.provider as SpeakingProvider, voiceId: v.voiceId })));
  } catch (err) {
    console.error("voice samples not warmed", err instanceof Error ? err.message : err);
  } finally {
    warming = false;
  }
}

/** The clip for this voice: our solar line where its maker's key is set, else its maker's own clip, else null. */
export async function voiceClip(voice: CallerVoice): Promise<VoiceClip | null> {
  const { provider } = voice;
  if (canSpeak(provider) && speakingProviders().includes(provider)) {
    const ours = await solarClip({ ...voice, provider });
    if (ours) return ours;
  }
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
