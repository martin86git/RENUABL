"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Camera, Phone, Trash2 } from "lucide-react";
import { CALLER_COPY, CALLER_NAME_MAX, callerInitial, callerIntro, cleanCallerName } from "@/lib/domain/design/caller";
import { callerPhotoUrl, loadCaller, removeCallerPhoto, saveCallerName, uploadCallerPhoto, type CallerState } from "@/lib/services/caller";
import { ui } from "./design-shell";

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
      className={clsx("grid shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-ink", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {callerInitial(caller.name)}
    </span>
  );
}

/**
 * Settings → Phone assistant (12 Nov 2026, Martin: the call function personified by each business): the name it gives
 * on calls and a picture, with how its opening words will sound.
 */
export function CallerSettings() {
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
      setCaller(res.caller);
      setName(res.caller.name);
      setCallsOn(res.callsOn);
      setBusiness(res.business);
    });
  }, []);

  const typed = cleanCallerName(name);
  const changed = caller !== null && name.trim() !== caller.name;

  const save = async () => {
    if (!typed.ok) return setStatus({ ok: false, text: typed.message });
    setBusy(true);
    const res = await saveCallerName(typed.value);
    setBusy(false);
    if (!res.ok) return setStatus({ ok: false, text: res.message });
    setCaller(res.caller);
    setName(res.caller.name);
    setStatus({ ok: true, text: `Saved. Your next calls will be from ${res.caller.name}.` });
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    const res = await uploadCallerPhoto(f);
    setBusy(false);
    if (file.current) file.current.value = "";
    if (!res.ok) return setStatus({ ok: false, text: res.message });
    setCaller(res.caller);
    setStatus({ ok: true, text: "Picture saved." });
  };

  const remove = async () => {
    setBusy(true);
    const res = await removeCallerPhoto();
    setBusy(false);
    if (!res.ok) return setStatus({ ok: false, text: res.message });
    setCaller(res.caller);
    setStatus({ ok: true, text: "Picture taken away." });
  };

  return (
    <div className={clsx(ui.page, "max-w-3xl")}>
      <p className={ui.eyebrow}>Settings · Business</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">{CALLER_COPY.title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{CALLER_COPY.intro}</p>

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
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{callerIntro(typed.ok ? typed.value : caller.name, business)}</p>
              <p className="mt-2 text-xs text-muted">{CALLER_COPY.automated}</p>
            </div>

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
