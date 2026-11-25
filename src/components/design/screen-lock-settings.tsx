"use client";

import { useEffect, useState } from "react";
import { LOCK_MINUTES, PIN_MAX, PIN_MIN, faceIdOn } from "@/lib/domain/design/screen-lock";
import { deviceHere } from "./screen-lock";
import {
  addPasskey,
  lockNow,
  lockSetup,
  passkeysWork,
  removeLockPin,
  removePasskey,
  setLockPin,
  signOutDevices,
  type LockSetup,
} from "@/lib/services/screen-lock";

const card = "rounded-xl border border-line bg-surface p-5";
const primary = "rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-white disabled:bg-muted";
const quiet = "rounded-md border border-line bg-surface px-3.5 py-2 text-sm text-ink hover:border-ink disabled:text-muted";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

/**
 * Your account → Screen lock (23 Nov 2026, Martin): Face ID (a passkey on each device), a PIN to fall back on, Lock
 * now, and signing out every other device.
 */
export function ScreenLockSection() {
  const [setup, setSetup] = useState<LockSetup | null>(null);
  const [canFace, setCanFace] = useState(false);
  const [onComputer, setOnComputer] = useState(false);
  const [pin, setPin] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void lockSetup().then(setSetup);
    // Face ID is set up and used on a phone only (24 Nov 2026, Martin); a computer unlocks with the PIN.
    if (faceIdOn(deviceHere())) void passkeysWork().then(setCanFace);
    else void Promise.resolve().then(() => setOnComputer(true));
  }, []);

  const run = async (work: () => Promise<{ ok: true; setup: LockSetup } | { ok: false; message: string }>, done: string) => {
    setBusy(true);
    setNote(null);
    const r = await work();
    setBusy(false);
    if (!r.ok) return setNote({ ok: false, text: r.message });
    setSetup(r.setup);
    setNote({ ok: true, text: done });
  };

  const signOut = async (all: boolean) => {
    if (all && !window.confirm("Sign out of RENUABL everywhere, this device too?")) return;
    setBusy(true);
    const r = await signOutDevices(all);
    setBusy(false);
    if (!r.ok) return setNote({ ok: false, text: r.message ?? "That didn't work." });
    if (all) return window.location.replace(`${window.location.origin}/design`);
    setSetup((s) => (s ? { ...s, others: 0 } : s));
    setNote({
      ok: true,
      text: r.ended ? `Signed out of ${r.ended} other ${r.ended === 1 ? "session" : "sessions"}.` : "You weren't signed in anywhere else.",
    });
  };

  return (
    <section id="screen-lock" className={card} aria-labelledby="screen-lock-title">
      <h2 id="screen-lock-title" className="text-[19px] tracking-tight text-ink">
        Screen lock
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        You stay signed in, but RENUABL locks after {LOCK_MINUTES.computer} minutes unused on a computer and {LOCK_MINUTES.phone / 60} hours
        on a phone. Unlock it with Face ID on your phone, or your PIN on a computer, instead of signing in again.
      </p>

      <h3 className="mt-5 text-[14px] font-medium text-ink">Face ID on your phone</h3>
      {setup?.passkeys.length ? (
        <ul className="mt-2 divide-y divide-line rounded-md border border-line">
          {setup.passkeys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block text-ink">{k.name}</span>
                <span className="block text-[12px] text-muted">
                  Added {day(k.createdAt)}
                  {k.lastUsedAt ? ` · last used ${day(k.lastUsedAt)}` : ""}
                </span>
              </span>
              <button
                type="button"
                className="text-[13px] text-ink-2 underline underline-offset-4"
                disabled={busy}
                onClick={() => run(() => removePasskey(k.id), "Removed.")}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] text-muted">None set up yet.</p>
      )}
      {canFace ? (
        <button
          type="button"
          className={`${primary} mt-3`}
          disabled={busy}
          onClick={() => run(addPasskey, "This device can now unlock with Face ID.")}
        >
          Set up this device
        </button>
      ) : onComputer ? (
        <p className="mt-2 text-[13px] text-muted">
          Set up Face ID from your phone, in Your account there. On this computer, unlock with your PIN.
        </p>
      ) : (
        <p className="mt-2 text-[13px] text-muted">This browser can&apos;t use Face ID or a passkey. Use a PIN here.</p>
      )}

      <h3 className="mt-6 text-[14px] font-medium text-ink">PIN</h3>
      <p className="mt-1 text-[13px] text-ink-2">
        {setup?.pin ? "You have a PIN. Type a new one to change it." : `${PIN_MIN} to ${PIN_MAX} digits, for when Face ID isn't to hand.`}{" "}
        Five wrong tries signs that device out.
      </p>
      <form
        className="mt-2 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => setLockPin(pin), "PIN saved.").then(() => setPin(""));
        }}
      >
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="new-password"
          maxLength={PIN_MAX}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX))}
          aria-label={setup?.pin ? "New PIN" : "PIN"}
          placeholder={setup?.pin ? "New PIN" : "PIN"}
          className="h-10 w-36 rounded-md border border-line bg-surface px-3 text-center tracking-[0.3em] text-ink outline-none focus:border-ink"
        />
        <button type="submit" className={primary} disabled={busy || pin.length < PIN_MIN}>
          {setup?.pin ? "Change PIN" : "Set PIN"}
        </button>
        {setup?.pin && (
          <button type="button" className={quiet} disabled={busy} onClick={() => run(removeLockPin, "PIN removed.")}>
            Remove PIN
          </button>
        )}
      </form>

      <h3 className="mt-6 text-[14px] font-medium text-ink">Your devices</h3>
      <p className="mt-1 text-[13px] text-ink-2">
        {setup == null
          ? " "
          : setup.others
            ? `You're also signed in on ${setup.others} other ${setup.others === 1 ? "device or browser" : "devices or browsers"}.`
            : "You're not signed in anywhere else."}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={quiet} disabled={busy} onClick={() => void lockNow()}>
          Lock now
        </button>
        <button type="button" className={quiet} disabled={busy || !setup?.others} onClick={() => signOut(false)}>
          Sign out my other devices
        </button>
        <button type="button" className={quiet} disabled={busy} onClick={() => signOut(true)}>
          Sign out everywhere
        </button>
      </div>

      {note && (
        <p className={note.ok ? "mt-3 text-sm text-positive" : "mt-3 text-sm text-danger"} role="status">
          {note.text}
        </p>
      )}
    </section>
  );
}
