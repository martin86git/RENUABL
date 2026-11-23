/**
 * The screen lock in the browser (domain/design/screen-lock.ts): its state, real use told to the server, unlocking
 * with Face ID (a passkey) or the PIN, and setting both up. The passkey library is loaded only when it's used.
 */

export interface LockState {
  signedIn: boolean;
  locked?: boolean;
  email?: string;
  minutes?: number;
  exempt?: boolean;
  passkeys?: number;
  pin?: boolean;
}

export interface LockSetup {
  passkeys: { id: string; name: string; createdAt: string; lastUsedAt: string | null }[];
  pin: boolean;
  others: number;
}

/** Told when any request comes back locked, or the lock changes. */
export const LOCK_EVENT = "renuabl:lock";

const post = async (url: string, body: object) => {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, data };
};

export async function lockState(): Promise<LockState | null> {
  try {
    const res = await fetch("/api/design/lock", { cache: "no-store" });
    return res.ok ? ((await res.json()) as LockState) : null;
  } catch {
    return null;
  }
}

/** Real use; answers whether the session is locked. */
export async function tellActive(): Promise<boolean> {
  try {
    const { data } = await post("/api/design/lock", { do: "active" });
    return data.locked === true;
  } catch {
    return false;
  }
}

export async function lockNow() {
  await post("/api/design/lock", { do: "lock" }).catch(() => undefined);
  window.dispatchEvent(new CustomEvent(LOCK_EVENT));
}

export type UnlockResult = { ok: true } | { ok: false; message: string; ended?: boolean };

export async function unlockWithPin(pin: string): Promise<UnlockResult> {
  const { res, data } = await post("/api/design/lock", { do: "pin", pin });
  return res.ok ? { ok: true } : { ok: false, message: String(data.message ?? "That didn't work."), ended: data.ended === true };
}

export async function passkeysWork(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  const { browserSupportsWebAuthn } = await import("@simplewebauthn/browser");
  return browserSupportsWebAuthn();
}

export async function unlockWithPasskey(): Promise<UnlockResult> {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const first = await post("/api/design/lock", { do: "passkey-options" });
  if (!first.res.ok) return { ok: false, message: String(first.data.message ?? "That didn't work.") };
  let response;
  try {
    response = await startAuthentication({ optionsJSON: first.data.options as never });
  } catch {
    return { ok: false, message: "Face ID was cancelled. Try again, or use your PIN." };
  }
  const { res, data } = await post("/api/design/lock", { do: "passkey", response });
  return res.ok ? { ok: true } : { ok: false, message: String(data.message ?? "That didn't work."), ended: data.ended === true };
}

export async function signOutDevices(all: boolean): Promise<{ ok: boolean; ended?: number; message?: string }> {
  const { res, data } = await post("/api/design/lock", { do: all ? "signout-all" : "signout-others" });
  return res.ok ? { ok: true, ended: Number(data.ended ?? 0) } : { ok: false, message: String(data.message ?? "That didn't work.") };
}

export async function lockSetup(): Promise<LockSetup | null> {
  try {
    const res = await fetch("/api/design/lock/setup", { cache: "no-store" });
    return res.ok ? ((await res.json()) as LockSetup) : null;
  } catch {
    return null;
  }
}

type SetupAnswer = { ok: true; setup: LockSetup } | { ok: false; message: string };

async function setup(body: object): Promise<SetupAnswer> {
  const { res, data } = await post("/api/design/lock/setup", body);
  return res.ok ? { ok: true, setup: data as unknown as LockSetup } : { ok: false, message: String(data.message ?? "That didn't work.") };
}

export const setLockPin = (pin: string) => setup({ do: "pin-set", pin });
export const removeLockPin = () => setup({ do: "pin-remove" });
export const removePasskey = (id: string) => setup({ do: "passkey-remove", id });

export async function addPasskey(): Promise<SetupAnswer> {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const first = await post("/api/design/lock/setup", { do: "passkey-options" });
  if (!first.res.ok) return { ok: false, message: String(first.data.message ?? "That didn't work.") };
  let response;
  try {
    response = await startRegistration({ optionsJSON: first.data.options as never });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    return {
      ok: false,
      message: name === "InvalidStateError" ? "This device is already set up." : "Face ID setup was cancelled.",
    };
  }
  return setup({ do: "passkey-add", response });
}
