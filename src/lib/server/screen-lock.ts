/**
 * Server only. The screen lock's state on each session, the person's lock PIN and passkeys, and signing out
 * everywhere (domain/design/screen-lock.ts). Sessions are found by their hash, as in accounts.ts.
 */
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE } from "@/lib/domain/accounts";
import { DEVICE_COOKIE, UNLOCK_TRIES, lockDeviceOf, type LockDevice } from "@/lib/domain/design/screen-lock";
import { query } from "./db";
import { hashPassword, passwordMatches } from "./design-passwords";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

/** This request's session id hash, or null when there's no session cookie. */
export async function sessionHash(): Promise<string | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  return id && /^[a-f0-9]{64}$/.test(id) ? hash(id) : null;
}

/** This request's device for the lock: its user agent, Chrome's mobile hint and the page's own touch-screen cookie. */
export async function requestDevice(): Promise<LockDevice> {
  const [h, c] = await Promise.all([headers(), cookies()]);
  return lockDeviceOf(h.get("user-agent"), { mobile: h.get("sec-ch-ua-mobile"), cookie: c.get(DEVICE_COOKIE)?.value });
}

export interface LockRow {
  email: string;
  activeAt: Date | null;
  tries: number;
}

export async function lockRow(idHash: string): Promise<LockRow | null> {
  const rows = await query<{ email: string; active_at: Date | null; unlock_tries: number }>(
    `select email, active_at, unlock_tries from sessions where id_hash = $1 and expires_at > now()`,
    [idHash],
  );
  const r = rows[0];
  return r ? { email: r.email, activeAt: r.active_at ? new Date(r.active_at) : null, tries: r.unlock_tries } : null;
}

/** Real use: pushes the lock back, but never unlocks a session already past its time (only an unlock does that). */
export async function markActive(idHash: string, minutes: number): Promise<boolean> {
  const rows = await query<{ id_hash: string }>(
    `update sessions set active_at = now() where id_hash = $1 and expires_at > now()
       and (active_at is null or active_at > now() - ($2 || ' minutes')::interval) returning id_hash`,
    [idHash, String(minutes)],
  );
  return rows.length > 0;
}

/** Locks it now (the Lock now button). */
export async function lockNow(idHash: string) {
  await query(`update sessions set active_at = 'epoch' where id_hash = $1`, [idHash]);
}

export async function unlock(idHash: string) {
  await query(`update sessions set active_at = now(), unlock_tries = 0, lock_challenge = null where id_hash = $1`, [idHash]);
}

/** A wrong try. Past UNLOCK_TRIES the session is ended and a full sign-in is needed: answers true then. */
export async function failedTry(idHash: string): Promise<boolean> {
  const rows = await query<{ unlock_tries: number }>(
    `update sessions set unlock_tries = unlock_tries + 1 where id_hash = $1 returning unlock_tries`,
    [idHash],
  );
  if ((rows[0]?.unlock_tries ?? UNLOCK_TRIES) >= UNLOCK_TRIES) {
    await query(`delete from sessions where id_hash = $1`, [idHash]);
    return true;
  }
  return false;
}

export async function setChallenge(idHash: string, challenge: string) {
  await query(`update sessions set lock_challenge = $2 where id_hash = $1`, [idHash, challenge]);
}

/** The challenge in flight, used once. */
export async function takeChallenge(idHash: string): Promise<string | null> {
  const rows = await query<{ lock_challenge: string | null }>(
    `update sessions s set lock_challenge = null from (select lock_challenge from sessions where id_hash = $1) old
       where s.id_hash = $1 returning old.lock_challenge`,
    [idHash],
  );
  return rows[0]?.lock_challenge ?? null;
}

/** Ends every other session of this email (Sign out my other devices), or every one with `all`. Answers how many. */
export async function endSessionsOf(email: string, keepHash: string | null, all = false): Promise<number> {
  const rows = await query<{ id_hash: string }>(
    all || !keepHash
      ? `delete from sessions where email = $1 returning id_hash`
      : `delete from sessions where email = $1 and id_hash <> $2 returning id_hash`,
    all || !keepHash ? [email.toLowerCase()] : [email.toLowerCase(), keepHash],
  );
  return rows.length;
}

/** Signed in elsewhere: how many other live sessions this email has. */
export async function otherSessions(email: string, keepHash: string | null): Promise<number> {
  const rows = await query<{ n: string }>(
    `select count(*) as n from sessions where email = $1 and expires_at > now() and id_hash is distinct from $2`,
    [email.toLowerCase(), keepHash],
  );
  return Number(rows[0]?.n ?? 0);
}

// The lock PIN.

export async function hasLockPin(businessId: string, email: string): Promise<boolean> {
  const rows = await query(`select 1 from design_lock_pins where business_id = $1 and email = $2`, [businessId, email.toLowerCase()]);
  return rows.length > 0;
}

export async function setLockPin(businessId: string, email: string, pin: string) {
  await query(
    `insert into design_lock_pins (business_id, email, hash) values ($1,$2,$3)
       on conflict (business_id, email) do update set hash = excluded.hash, created_at = now()`,
    [businessId, email.toLowerCase(), await hashPassword(pin)],
  );
}

export async function removeLockPin(businessId: string, email: string) {
  await query(`delete from design_lock_pins where business_id = $1 and email = $2`, [businessId, email.toLowerCase()]);
}

export async function lockPinMatches(businessId: string, email: string, pin: string): Promise<boolean> {
  const rows = await query<{ hash: string }>(`select hash from design_lock_pins where business_id = $1 and email = $2`, [
    businessId,
    email.toLowerCase(),
  ]);
  if (!rows[0]) {
    await hashPassword(pin);
    return false;
  }
  return passwordMatches(pin, rows[0].hash);
}

// Passkeys.

export interface Passkey {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports: string[];
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function passkeysOf(businessId: string, email: string): Promise<Passkey[]> {
  const rows = await query<{
    id: string;
    public_key: Buffer;
    counter: string;
    transports: string[];
    name: string;
    created_at: Date;
    last_used_at: Date | null;
  }>(
    `select id, public_key, counter, transports, name, created_at, last_used_at from design_passkeys
       where business_id = $1 and email = $2 order by created_at`,
    [businessId, email.toLowerCase()],
  );
  return rows.map((r) => ({
    id: r.id,
    publicKey: new Uint8Array(r.public_key),
    counter: Number(r.counter),
    transports: r.transports ?? [],
    name: r.name,
    createdAt: new Date(r.created_at).toISOString(),
    lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
  }));
}

export async function addPasskey(
  businessId: string,
  email: string,
  key: { id: string; publicKey: Uint8Array; counter: number; transports: string[]; name: string },
) {
  await query(
    `insert into design_passkeys (id, business_id, email, public_key, counter, transports, name) values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (id) do nothing`,
    [key.id, businessId, email.toLowerCase(), Buffer.from(key.publicKey), key.counter, key.transports, key.name.slice(0, 60)],
  );
}

export async function usedPasskey(businessId: string, id: string, counter: number) {
  await query(`update design_passkeys set counter = $3, last_used_at = now() where business_id = $1 and id = $2`, [
    businessId,
    id,
    counter,
  ]);
}

export async function removePasskey(businessId: string, email: string, id: string): Promise<boolean> {
  const rows = await query(`delete from design_passkeys where business_id = $1 and email = $2 and id = $3 returning id`, [
    businessId,
    email.toLowerCase(),
    id,
  ]);
  return rows.length > 0;
}
