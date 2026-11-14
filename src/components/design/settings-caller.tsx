"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Camera, Check, MessageCircle, Phone, PhoneCall, Trash2 } from "lucide-react";
import {
  CALLER_COPY,
  CALLER_NAME_MAX,
  CALLER_VOICES,
  callerTint,
  callerIntro,
  cleanCallerName,
  cleanVoice,
  VOICE_BAD,
  VOICE_PROVIDERS,
  voiceLabel,
  type CallerVoice,
} from "@/lib/domain/design/caller";
import {
  callerPhotoUrl,
  loadCaller,
  removeCallerPhoto,
  ringMeToHear,
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
      <SoundWave size={size} tint={callerTint(caller.name)} />
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

  const choose = async (voice: CallerVoice | null) => {
    setBusy(true);
    const res = await saveCallerVoice(voice, role);
    setBusy(false);
    if (!res.ok) return onStatus({ ok: false, text: res.message });
    onSaved(res.caller);
    onStatus({ ok: true, text: `Voice saved: ${voiceLabel(res.caller.voice)}. Ring yourself to hear it.` });
  };

  const saveOwn = () => {
    const v = cleanVoice({ provider, voiceId: typedId });
    if (v === "bad" || !v) return onStatus({ ok: false, text: VOICE_BAD });
    void choose(v);
  };

  const ring = async () => {
    setBusy(true);
    const res = await ringMeToHear(role);
    setBusy(false);
    onStatus(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.message });
  };

  const row = (label: string, words: string, picked: boolean, onPick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      disabled={busy}
      onClick={onPick}
      className={clsx(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ring-1",
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
        <button
          type="button"
          className={ui.quiet}
          disabled={busy || !callsOn}
          onClick={() => void ring()}
          title={callsOn ? "" : "Once calls are on"}
        >
          <PhoneCall className="size-4" aria-hidden /> Practice a call
        </button>
      </div>
      <p className={clsx("mt-1 text-xs text-muted", compact && "hidden")}>
        Pick one that suits the name. The test call rings the mobile on your account, in the voice saved here.
      </p>
      {(["female", "male"] as const).map((sex) => (
        <div key={sex} className="mt-3">
          <p className={ui.eyebrow}>{sex === "female" ? "Female voices" : "Male voices"}</p>
          <div className={clsx("mt-1.5 grid gap-1.5", !compact && "sm:grid-cols-2")}>
            {CALLER_VOICES.filter((v) => v.sex === sex).map((v) =>
              row(
                v.label,
                v.words,
                !own && same(v, caller.voice),
                () => {
                  setOwn(false);
                  void choose({ provider: v.provider, voiceId: v.voiceId });
                },
                `${v.provider}:${v.voiceId}`,
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
          <button type="button" className={ui.primary} disabled={busy || !typedId.trim()} onClick={saveOwn}>
            Use this voice
          </button>
        </div>
      )}
    </div>
  );
}
