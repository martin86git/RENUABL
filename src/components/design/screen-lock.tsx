"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui/primitives";
import { ACTIVE_PING_MS, LOCK_WORDS, LOCKED_STATUS, PIN_MAX, PIN_MIN, faceIdOn, lockDeviceOf } from "@/lib/domain/design/screen-lock";
import {
  LOCK_EVENT,
  lockNow,
  lockState,
  passkeysWork,
  tellActive,
  unlockWithPasskey,
  unlockWithPin,
  type LockState,
} from "@/lib/services/screen-lock";
import { SignOut } from "./design-account";
import { SignInForm } from "./sign-in-form";

/** Shared across tabs, so using RENUABL in one tab keeps the others unlocked. */
const LAST_USE = "renuabl.design.last-use";
const NUDGE_SEEN = "renuabl.design.lock-nudge";
const USE_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

const readLastUse = () => {
  try {
    return Number(localStorage.getItem(LAST_USE)) || 0;
  } catch {
    return 0;
  }
};
const writeLastUse = (t: number) => {
  try {
    localStorage.setItem(LAST_USE, String(t));
  } catch {
    // Private window: this tab still counts its own use.
  }
};

/**
 * The screen lock (23 Nov 2026, Martin), mounted once in DesignShell. Real use (a press, a key, a scroll) keeps it
 * open and is told to the server every couple of minutes; unused for the device's time (30 minutes on a computer, 4
 * hours on a phone) the page covers itself, and the server refuses the business's data (423) until it's unlocked with
 * Face ID, the PIN, or by signing in again.
 */
export function ScreenLock() {
  const [state, setState] = useState<LockState | null>(null);
  const lastUse = useRef(0);
  const lastPing = useRef(0);
  const lockedRef = useRef(false);
  const minutesRef = useRef(30);
  const exemptRef = useRef(false);
  const inFrame = typeof window !== "undefined" && window.self !== window.top;

  const check = useCallback(async () => {
    const s = await lockState();
    if (!s) return;
    lockedRef.current = Boolean(s.locked);
    if (s.minutes) minutesRef.current = s.minutes;
    exemptRef.current = Boolean(s.exempt);
    setState(s);
  }, []);

  // Inside the designer's pop-up (a frame of the same site) use there counts too: told to the page around it through
  // the shared last-use time, and to the server. The lock itself is drawn only by the page around it.
  useEffect(() => {
    if (!inFrame) return;
    const used = () => {
      const now = Date.now();
      writeLastUse(now);
      if (now - lastPing.current > ACTIVE_PING_MS) {
        lastPing.current = now;
        void tellActive();
      }
    };
    for (const e of USE_EVENTS) window.addEventListener(e, used, { passive: true, capture: true });
    return () => {
      for (const e of USE_EVENTS) window.removeEventListener(e, used, { capture: true });
    };
  }, [inFrame]);

  useEffect(() => {
    if (inFrame) return;
    const first = window.setTimeout(() => void check(), 0);
    lastUse.current = Date.now();
    writeLastUse(lastUse.current);
    // Any request that comes back locked shows the lock at once.
    const original = window.fetch;
    const watched: typeof fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === LOCKED_STATUS && !lockedRef.current) window.dispatchEvent(new CustomEvent(LOCK_EVENT));
      return res;
    };
    window.fetch = watched;
    const onLock = () => void check();
    const used = () => {
      if (lockedRef.current) return;
      const now = Date.now();
      lastUse.current = now;
      writeLastUse(now);
      if (now - lastPing.current > ACTIVE_PING_MS) {
        lastPing.current = now;
        void tellActive().then((locked) => locked && void check());
      }
    };
    const onShow = () => {
      if (document.visibilityState === "visible") void check();
    };
    // Unused for the device's time, here and in every other tab: lock now, so the server agrees to the minute.
    const tick = window.setInterval(() => {
      if (lockedRef.current || exemptRef.current) return;
      const last = Math.max(lastUse.current, readLastUse());
      if (Date.now() - last >= minutesRef.current * 60_000) void lockNow();
    }, 20_000);
    const poll = window.setInterval(() => void check(), 60_000);
    window.addEventListener(LOCK_EVENT, onLock);
    document.addEventListener("visibilitychange", onShow);
    for (const e of USE_EVENTS) window.addEventListener(e, used, { passive: true, capture: true });
    return () => {
      window.clearTimeout(first);
      if (window.fetch === watched) window.fetch = original;
      window.clearInterval(tick);
      window.clearInterval(poll);
      window.removeEventListener(LOCK_EVENT, onLock);
      document.removeEventListener("visibilitychange", onShow);
      for (const e of USE_EVENTS) window.removeEventListener(e, used, { capture: true });
    };
  }, [check, inFrame]);

  if (inFrame || !state?.signedIn) return null;
  if (state.locked)
    return (
      <LockScreen
        state={state}
        onUnlocked={() => {
          const now = Date.now();
          lastUse.current = now;
          lastPing.current = now;
          writeLastUse(now);
          lockedRef.current = false;
          setState({ ...state, locked: false });
          // Pages read again what they were refused while it was locked.
          window.dispatchEvent(new Event("focus"));
          window.dispatchEvent(new Event("visibilitychange"));
        }}
      />
    );
  // A computer unlocks only with the PIN, so a passkey on the phone doesn't count there.
  const quick = state.pin || (onPhone() && Boolean(state.passkeys));
  if (!state.exempt && !quick) return <SetUpNudge />;
  return null;
}

/** A phone or tablet, by its browser (as the server reads it for the lock's time). */
const onPhone = () => typeof navigator !== "undefined" && faceIdOn(lockDeviceOf(navigator.userAgent));

function LockScreen({ state, onUnlocked }: { state: LockState; onUnlocked: () => void }) {
  const [faceId, setFaceId] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [another, setAnother] = useState(false);
  const phone = onPhone();
  // A computer always offers the PIN (the server says when none is set); Face ID only on a phone.
  const noMethod = phone && !state.passkeys && !state.pin;
  const pinShown = state.pin || !phone;

  useEffect(() => {
    if (phone && state.passkeys) void passkeysWork().then(setFaceId);
  }, [phone, state.passkeys]);

  const result = (r: Awaited<ReturnType<typeof unlockWithPin>>) => {
    setBusy(false);
    if (r.ok) return onUnlocked();
    setProblem(r.message);
    if (r.ended) setEnded(true);
    setPin("");
  };

  const byPin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (pin.length < PIN_MIN || busy) return;
    setBusy(true);
    setProblem(null);
    result(await unlockWithPin(pin));
  };

  const byFace = async () => {
    setBusy(true);
    setProblem(null);
    result(await unlockWithPasskey());
  };

  const showSignIn = ended || noMethod || another;

  return (
    <div
      className="theme-studio fixed inset-0 z-[2000] overflow-y-auto bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-title"
    >
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <Wordmark />
        <span className="grid size-16 place-items-center rounded-full bg-primary text-white shadow-lg" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            className="size-7"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <div>
          <h1 id="lock-title" className="text-[22px] tracking-tight text-ink">
            {LOCK_WORDS.title}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-2">{LOCK_WORDS.why(state.minutes ?? 30)}</p>
          {state.email && <p className="mt-1 text-[13px] text-muted">{state.email}</p>}
        </div>

        {!ended && !another && phone && faceId && Boolean(state.passkeys) && (
          <div className="w-full">
            <button
              type="button"
              onClick={byFace}
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-medium text-white disabled:bg-muted"
            >
              <FaceMark /> {LOCK_WORDS.passkey}
            </button>
            <p className="mt-1.5 text-[12px] text-muted">{LOCK_WORDS.passkeyHint}</p>
          </div>
        )}

        {!ended && !another && pinShown && (
          <form onSubmit={byPin} className="w-full space-y-2">
            <label htmlFor="lock-pin" className="block text-[13px] font-medium text-ink-2">
              {LOCK_WORDS.pin}
            </label>
            {!phone && state.passkeys ? <p className="text-[12px] text-muted">{LOCK_WORDS.pinHere}</p> : null}
            <input
              id="lock-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]*"
              maxLength={PIN_MAX}
              autoFocus={!faceId}
              value={pin}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, PIN_MAX);
                setPin(next);
              }}
              className="h-12 w-full rounded-xl border border-line bg-surface text-center text-[22px] tracking-[0.5em] text-ink outline-none focus:border-ink"
              aria-label="PIN"
            />
            <button
              type="submit"
              disabled={pin.length < PIN_MIN || busy}
              className="h-11 w-full rounded-xl border border-line bg-surface text-[14px] font-medium text-ink disabled:text-muted"
            >
              Unlock
            </button>
          </form>
        )}

        {problem && (
          <p className="text-[13px] text-danger" role="alert">
            {problem}
          </p>
        )}

        {showSignIn ? (
          <div className="w-full text-left">
            <p className="mb-3 text-center text-[13px] text-ink-2">{ended ? LOCK_WORDS.tooMany : noMethod ? LOCK_WORDS.noMethod : null}</p>
            <SignInForm next={typeof window !== "undefined" ? window.location.pathname + window.location.search : "/design"} />
            {another && !ended && (
              <button
                type="button"
                className="mt-3 w-full text-center text-[13px] text-ink-2 underline underline-offset-4"
                onClick={() => setAnother(false)}
              >
                Back
              </button>
            )}
          </div>
        ) : (
          <button type="button" className="text-[13px] text-ink-2 underline underline-offset-4" onClick={() => setAnother(true)}>
            {LOCK_WORDS.another}
          </button>
        )}
        <SignOut className="text-[13px] text-muted underline underline-offset-4" />
      </div>
    </div>
  );
}

/** Once, until put away: nobody has set a quick way to unlock yet, so the lock would mean a full sign-in. */
function SetUpNudge() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        setShown(!localStorage.getItem(NUDGE_SEEN));
      } catch {
        setShown(false);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  if (!shown) return null;
  const away = () => {
    try {
      localStorage.setItem(NUDGE_SEEN, "1");
    } catch {
      // Private window.
    }
    setShown(false);
  };
  return (
    <div className="theme-studio fixed bottom-24 left-4 z-[70] max-w-[19rem] rounded-2xl border border-line bg-surface p-4 shadow-xl lg:bottom-6">
      <p className="text-[13.5px] text-ink">{LOCK_WORDS.nudge}</p>
      <div className="mt-3 flex items-center gap-3">
        <Link
          href="/design/settings/users#screen-lock"
          onClick={away}
          className="rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-white"
        >
          Set it up
        </Link>
        <button type="button" onClick={away} className="text-[13px] text-ink-2">
          Not now
        </button>
      </div>
    </div>
  );
}

function FaceMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M9 9v1M15 9v1M12 9v4h-1M9.5 16a4 4 0 0 0 5 0" />
    </svg>
  );
}
