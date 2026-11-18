"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Camera, Check, GraduationCap, MessageCircle, Phone, PhoneCall, Play, RotateCcw, Square, Trash2, VolumeX, X } from "lucide-react";
import {
  CALLER_COPY,
  CALLER_NAME_MAX,
  CALLER_VOICES,
  tintOf,
  callerIntro,
  cleanCallerName,
  cleanVoice,
  NO_SAMPLE,
  VOICE_BAD,
  VOICE_PROVIDERS,
  voiceKey,
  voiceLabel,
  voicesRemoved,
  voicesShown,
  voiceSampleUrl,
  type CallerVoice,
} from "@/lib/domain/design/caller";
import {
  callerPhotoUrl,
  changeHiddenVoices,
  loadHiddenVoices,
  loadCaller,
  removeCallerPhoto,
  ringMeToHear,
  ringMeToTrain,
  saveCallerName,
  saveCallerVoice,
  uploadCallerPhoto,
  type CallerState,
} from "@/lib/services/caller";
import { installFirstMessage, ROLE_WORDS, CALLER_ROLES, type CallerKey, type CallerRole } from "@/lib/domain/install-call";
import { ui } from "./design-shell";
import { COACH_COPY } from "@/lib/domain/design/coaching";
import { openCoach } from "@/lib/services/coaching";

/** The phone assistant's face: its picture, else its initial on graphite. */
export function CallerAvatar({ caller, size = 32, className }: { caller: CallerState; size?: number; className?: string }) {
  const url = callerPhotoUrl(caller);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- the business's own picture, served by our API
    <img
      src={url}
      alt={caller.name}
      width={size}
      height={size}
      className={clsx("shrink-0 rounded-full object-cover ring-1 ring-line", className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className={clsx("grid shrink-0 place-items-center rounded-full bg-primary", className)}
      style={{ width: size, height: size }}
    >
      <SoundWave size={size} tint={tintOf(caller)} />
    </span>
  );
}

/** Bar heights of the stand-in's sound wave, of a 24-unit square: four bars, three where it is drawn small. */
const WAVE = [7, 16, 11, 5];
const WAVE_SMALL = [8, 16, 10];

/**
 * The stand-in picture with no photo (13 Nov 2026, Martin: a sound wave, not an initial; a colour by the name so
 * several callers can be told apart): a voice, not a face, since the assistant says it is automated.
 */
function SoundWave({ size, tint }: { size: number; tint: number }) {
  const bars = size < 24 ? WAVE_SMALL : WAVE;
  const width = size < 24 ? 3 : 2.4;
  const gap = size < 24 ? 2 : 1.8;
  const left = 12 - (bars.length * width + (bars.length - 1) * gap) / 2;
  return (
    <svg viewBox="0 0 24 24" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)}>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={left + i * (width + gap)}
          y={12 - h / 2}
          width={width}
          height={h}
          rx={width / 2}
          fill={`var(--caller-${tint}, var(--sun-line))`}
        />
      ))}
    </svg>
  );
}

/**
 * Settings → Phone assistant (12 Nov 2026, Martin: the call function personified by each business): the name it gives
 * on calls and a picture, with how its opening words will sound.
 */
export function CallerSettings() {
  // Two assistants (13 Nov 2026, Martin: one for sales, one for admin), each with its own name, face and voice.
  const [role, setRole] = useState<CallerRole>("sales");
  useEffect(() => {
    // A link from a deal's Call menu opens on the admin assistant.
    if (new URLSearchParams(window.location.search).get("assistant") === "admin") queueMicrotask(() => setRole("admin"));
  }, []);
  return (
    <div className={clsx(ui.page, "max-w-3xl")}>
      <p className={ui.eyebrow}>Settings · Business</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Phone assistants</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
        Two assistants ring for your business, each under its own name, face and voice: one for sales, one for after the sale.
      </p>
      <div role="tablist" aria-label="Which assistant" className="mt-5 inline-flex gap-0.5 rounded-full bg-surface-2 p-1 ring-1 ring-line">
        {CALLER_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={role === r}
            onClick={() => setRole(r)}
            className={clsx(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              role === r ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:text-ink",
            )}
          >
            {ROLE_WORDS[r].label}
          </button>
        ))}
      </div>
      <AssistantSettings key={role} role={role} />
    </div>
  );
}

/** One assistant's name, picture and voice. */
function AssistantSettings({ role }: { role: CallerRole }) {
  const [caller, setCaller] = useState<CallerState | null>(null);
  const [business, setBusiness] = useState("");
  const [callsOn, setCallsOn] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadCaller().then((res) => {
      if (!res.ok) return setStatus({ ok: false, text: res.message });
      const mine = role === "admin" ? (res.admin ?? { role, name: res.caller.name, photoAt: null, voice: null, named: false }) : res.caller;
      setCaller(mine);
      // An admin assistant not yet set up starts with an empty name, so it isn't given the sales assistant's by a stray Save.
      setName(mine.named || role === "sales" ? mine.name : "");
      setCallsOn(res.callsOn);
      setBusiness(res.business);
    });
  }, [role]);

  const typed = cleanCallerName(name);
  const changed = caller !== null && name.trim() !== "" && (name.trim() !== caller.name || !caller.named);

  const save = async () => {
    if (!typed.ok) return setStatus({ ok: false, text: typed.message });
    setBusy(true);
    const res = await saveCallerName(typed.value, role);
    setBusy(false);
    if (!res.ok) return setStatus({ ok: false, text: res.message });
    setCaller(res.caller);
    setName(res.caller.name);
    setStatus({
      ok: true,
      text:
        role === "admin"
          ? `Saved. ${res.caller.name} can now ring to book installations.`
          : `Saved. Your next calls will be from ${res.caller.name}.`,
    });
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    const res = await uploadCallerPhoto(f, role);
    setBusy(false);
    if (file.current) file.current.value = "";
    if (!res.ok) return setStatus({ ok: false, text: res.message });
    setCaller(res.caller);
    setStatus({ ok: true, text: "Picture saved." });
  };

  const remove = async () => {
    setBusy(true);
    const res = await removeCallerPhoto(role);
    setBusy(false);
    if (!res.ok) return setStatus({ ok: false, text: res.message });
    setCaller(res.caller);
    setStatus({ ok: true, text: "Picture taken away." });
  };

  return (
    <div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-2">{ROLE_WORDS[role].does}</p>
      {caller && role === "admin" && !caller.named && (
        <p className="mt-2 max-w-2xl text-sm text-ink-2">It isn{"'"}t set up yet. Give it a name to switch it on.</p>
      )}

      {caller && (
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-3">
            <CallerAvatar caller={caller} size={112} />
            <div className="flex gap-2">
              <button type="button" className={ui.quiet} disabled={busy} onClick={() => file.current?.click()}>
                <Camera className="size-4" aria-hidden />
                {caller.photoAt ? "Change" : "Add a picture"}
              </button>
              {caller.photoAt && (
                <button type="button" className={ui.quiet} disabled={busy} onClick={() => void remove()} aria-label="Take the picture away">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </div>
            <input
              ref={file}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
            <p className="max-w-52 text-center text-xs text-muted">{CALLER_COPY.photo}</p>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <label className="block">
              <span className={ui.label}>Its name</span>
              <span className="mt-1.5 flex items-center gap-2">
                <input
                  className={clsx(ui.input, "max-w-64")}
                  value={name}
                  maxLength={CALLER_NAME_MAX + 5}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && changed) void save();
                  }}
                />
                <button type="button" className={ui.primary} disabled={!changed || busy} onClick={() => void save()}>
                  Save
                </button>
              </span>
            </label>

            <div className={clsx(ui.card, "p-4")}>
              <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                <Phone className="size-4 text-muted" aria-hidden /> How a call opens
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                {role === "admin"
                  ? `"${installFirstMessage({ assistant: typed.ok ? typed.value : caller.name, business, firstName: "Sam" })}"`
                  : callerIntro(typed.ok ? typed.value : caller.name, business)}
              </p>
              <p className="mt-2 text-xs text-muted">{CALLER_COPY.automated}</p>
            </div>

            <VoicePicker caller={caller} callsOn={callsOn} onSaved={(c) => setCaller(c)} onStatus={setStatus} role={role} />

            {/* Coaching it (12 Nov 2026, Martin): talk to it in plain words; what it keeps is used on every call. */}
            {role === "sales" && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-4">
                <MessageCircle className="size-5 shrink-0 text-ink-2" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{COACH_COPY.title(caller.name)}</p>
                  <p className="text-xs text-muted">{COACH_COPY.intro(caller.name)}</p>
                </div>
                <button type="button" className={ui.primary} onClick={() => openCoach(null)}>
                  {COACH_COPY.title(caller.name)}
                </button>
              </div>
            )}

            <p className="text-xs text-muted">
              {callsOn
                ? "Calls are switched on for your business."
                : "Calls aren't switched on for your business yet. Your name and picture are kept for when they are."}
            </p>
            {status && <p className={clsx("text-sm", status.ok ? "text-ink-2" : "text-danger")}>{status.text}</p>}
          </div>
        </div>
      )}
      {!caller && status && <p className="mt-6 text-sm text-danger">{status.text}</p>}
    </div>
  );
}

const same = (a: CallerVoice | null, b: CallerVoice | null) => a?.provider === b?.provider && a?.voiceId === b?.voiceId;

/**
 * The voice it speaks in (12 Nov 2026, Martin: so the voice can suit the name): Vapi's own voices and an Australian
 * one, or any voice by its ID; saved on a press, and heard on a short call to the member's own mobile. `compact` is the
 * same picker in one column with no card, for the assistant's own chat (13 Nov 2026, Martin).
 */
/** The one sample clip playing, wherever the picker is shown: starting another stops it. */
let sampleNow: HTMLAudioElement | null = null;
function stopSample() {
  sampleNow?.pause();
  sampleNow = null;
}
function startSample(url: string, over: () => void, failed: () => void) {
  const clip = new Audio(url);
  sampleNow = clip;
  clip.onended = over;
  clip.onerror = failed;
  void clip.play().catch(over);
}

export function VoicePicker({
  caller,
  callsOn,
  onSaved,
  onStatus,
  compact = false,
  role = "sales",
}: {
  /** Which assistant's voice it is (the admin assistant's from its own Settings tab). */
  role?: CallerKey;
  caller: CallerState;
  callsOn: boolean;
  onSaved: (c: CallerState) => void;
  onStatus: (s: { ok: boolean; text: string }) => void;
  compact?: boolean;
}) {
  const ours = CALLER_VOICES.some((v) => same(v, caller.voice));
  const [own, setOwn] = useState(Boolean(caller.voice && !ours));
  const [provider, setProvider] = useState<CallerVoice["provider"]>(caller.voice?.provider ?? "11labs");
  const [typedId, setTypedId] = useState(caller.voice && !ours ? caller.voice.voiceId : "");
  const [busy, setBusy] = useState(false);
  // The voices the business has taken off its list (18 Nov 2026, Martin: "remove the voices i dont like").
  const [hidden, setHidden] = useState<string[]>([]);
  const [removedOpen, setRemovedOpen] = useState(false);
  useEffect(() => {
    let live = true;
    void loadHiddenVoices().then((h) => live && setHidden(h));
    return () => {
      live = false;
    };
  }, []);
  const changeHidden = async (change: Parameters<typeof changeHiddenVoices>[0]) => {
    const res = await changeHiddenVoices(change);
    if (!res.ok) return onStatus({ ok: false, text: res.message });
    setHidden(res.hiddenVoices);
    if (res.hiddenVoices.length === 0) setRemovedOpen(false);
  };
  const removed = voicesRemoved(hidden, caller.voice);
  // The sample playing now, by its voice ("11labs:…"): one at a time, stopped when the picker goes.
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => stopSample, []);

  const play = (v: CallerVoice) => {
    const key = `${v.provider}:${v.voiceId}`;
    stopSample();
    if (playing === key) return setPlaying(null);
    const url = voiceSampleUrl(v);
    if (!url) return onStatus({ ok: false, text: NO_SAMPLE });
    setPlaying(key);
    const over = () => setPlaying((now) => (now === key ? null : now));
    startSample(url, over, () => {
      over();
      onStatus({ ok: false, text: NO_SAMPLE });
    });
  };

  /** The round beside a voice: its maker's sample, played here with no call. */
  const sampleButton = (v: CallerVoice, label: string) => {
    const key = `${v.provider}:${v.voiceId}`;
    const on = playing === key;
    if (!voiceSampleUrl(v))
      return (
        <span className="grid size-9 shrink-0 place-items-center text-muted" title={NO_SAMPLE}>
          <VolumeX className="size-4" aria-hidden />
          <span className="sr-only">{NO_SAMPLE}</span>
        </span>
      );
    return (
      <button
        type="button"
        onClick={() => play(v)}
        aria-label={on ? `Stop ${label}'s sample` : `Hear ${label}`}
        title={on ? "Stop" : `Hear ${label}: a sample of the voice, no call`}
        className={clsx(
          "grid size-9 shrink-0 place-items-center rounded-full ring-1",
          on ? "bg-primary text-primary-ink ring-primary" : "text-ink ring-line hover:ring-ink-2",
        )}
      >
        {on ? <Square className="size-3.5" aria-hidden /> : <Play className="size-3.5 translate-x-px" aria-hidden />}
      </button>
    );
  };

  const choose = async (voice: CallerVoice | null) => {
    setBusy(true);
    const res = await saveCallerVoice(voice, role);
    setBusy(false);
    if (!res.ok) return onStatus({ ok: false, text: res.message });
    onSaved(res.caller);
    onStatus({ ok: true, text: `Voice saved: ${voiceLabel(res.caller.voice)}. Test call rings you in it.` });
  };

  const saveOwn = () => {
    const v = cleanVoice({ provider, voiceId: typedId });
    if (v === "bad" || !v) return onStatus({ ok: false, text: VOICE_BAD });
    void choose(v);
  };

  const ring = async (training = false) => {
    setBusy(true);
    const res = await (training ? ringMeToTrain : ringMeToHear)(role);
    setBusy(false);
    onStatus(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.message });
  };

  const row = (label: string, words: string, picked: boolean, onPick: () => void, key: string, voice?: CallerVoice) => (
    <div key={key} className="flex min-w-0 items-center gap-1.5">
      {pickButton(label, words, picked, onPick)}
      {voice && sampleButton(voice, label)}
      {voice && !picked && (
        <button
          type="button"
          onClick={() => void changeHidden({ hide: voiceKey(voice) })}
          aria-label={`Remove ${label} from the list`}
          title="Remove from the list"
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );

  const pickButton = (label: string, words: string, picked: boolean, onPick: () => void) => (
    <button
      type="button"
      disabled={busy}
      onClick={onPick}
      className={clsx(
        "flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-left text-sm ring-1",
        picked ? "bg-surface-2 ring-ink" : "ring-line hover:ring-ink-2",
      )}
      aria-pressed={picked}
    >
      <span
        className={clsx("grid size-4 shrink-0 place-items-center rounded-full ring-1", picked ? "bg-primary ring-primary" : "ring-line")}
      >
        {picked && <Check className="size-3 text-primary-ink" aria-hidden />}
      </span>
      <span className="font-medium text-ink">{label}</span>
      <span className="truncate text-ink-2">{words}</span>
    </button>
  );

  return (
    <div className={compact ? "" : clsx(ui.card, "p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!compact && <p className="text-[13px] font-medium text-ink">Its voice</p>}
        <span className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={ui.quiet}
            disabled={busy || !callsOn}
            onClick={() => void ring(true)}
            title={callsOn ? "It rings you and you talk as its trainer" : "Once calls are on"}
          >
            <GraduationCap className="size-4" aria-hidden /> Train
          </button>
          <button
            type="button"
            className={ui.quiet}
            disabled={busy || !callsOn}
            onClick={() => void ring()}
            title={callsOn ? "It rings you as it would a new lead" : "Once calls are on"}
          >
            <PhoneCall className="size-4" aria-hidden /> Test call
          </button>
        </span>
      </div>
      <p className={clsx("mt-1 text-xs text-muted", compact && "hidden")}>
        Pick one that suits the name, and press play to hear a voice&apos;s sample. Train and Test call both ring the mobile on your
        account, in the voice saved here.
      </p>
      {(["female", "male"] as const).map((sex) => (
        <div key={sex} className="mt-3">
          <p className={ui.eyebrow}>{sex === "female" ? "Female voices" : "Male voices"}</p>
          <div className={clsx("mt-1.5 grid gap-1.5", !compact && "sm:grid-cols-2")}>
            {voicesShown(hidden, caller.voice)
              .filter((v) => v.sex === sex)
              .map((v) =>
                row(
                  v.label,
                  v.words,
                  !own && same(v, caller.voice),
                  () => {
                    setOwn(false);
                    void choose({ provider: v.provider, voiceId: v.voiceId });
                  },
                  `${v.provider}:${v.voiceId}`,
                  { provider: v.provider, voiceId: v.voiceId },
                ),
              )}
          </div>
        </div>
      ))}
      <div className={clsx("mt-3 grid gap-1.5", !compact && "sm:grid-cols-2")}>
        {row(
          "Default",
          "The site's usual voice",
          !own && !caller.voice,
          () => {
            setOwn(false);
            void choose(null);
          },
          "default",
        )}
        {row("Another voice", "By its ID from Vapi or ElevenLabs", own, () => setOwn(true), "own")}
      </div>
      {removed.length > 0 && (
        <div className="mt-3 rounded-md bg-canvas px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <button
              type="button"
              className="font-medium text-ink underline-offset-2 hover:underline"
              onClick={() => setRemovedOpen((o) => !o)}
            >
              {removed.length} voice{removed.length === 1 ? "" : "s"} removed
            </button>
            <button type="button" className="text-ink-2 hover:text-ink" onClick={() => void changeHidden({ all: true })}>
              Bring them all back
            </button>
          </div>
          {removedOpen && (
            <ul className="mt-2 space-y-1">
              {removed.map((v) => (
                <li key={voiceKey(v)} className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-ink">{v.label}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{v.words}</span>
                  <button
                    type="button"
                    onClick={() => void changeHidden({ show: voiceKey(v) })}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium text-ink ring-1 ring-line hover:bg-surface"
                  >
                    <RotateCcw className="size-3" aria-hidden /> Bring back
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {own && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className={clsx(ui.input, "w-auto")}
            value={provider}
            onChange={(e) => setProvider(e.target.value as CallerVoice["provider"])}
          >
            {VOICE_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            className={clsx(ui.input, "max-w-64")}
            placeholder="Voice ID"
            value={typedId}
            onChange={(e) => setTypedId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveOwn();
            }}
          />
          {typedId.trim() &&
            cleanVoice({ provider, voiceId: typedId }) !== "bad" &&
            sampleButton({ provider, voiceId: typedId.trim() }, "this voice")}
          <button type="button" className={ui.primary} disabled={busy || !typedId.trim()} onClick={saveOwn}>
            Use this voice
          </button>
        </div>
      )}
    </div>
  );
}
