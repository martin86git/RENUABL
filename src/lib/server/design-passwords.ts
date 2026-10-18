/**
 * Server only. Passwords for the roof designer's accounts, kept as scrypt
 * hashes with their own salt (never the password), compared in constant
 * time. A password is set only by someone already signed in, so it can only
 * ever open an email its owner has proven.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { query } from "./db";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY, PARAMS);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const [kind, salt, key] = stored.split("$");
  if (kind !== "scrypt" || !salt || !key) return false;
  const want = Buffer.from(key, "hex");
  const got = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "hex"), want.length, PARAMS);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** "ok", "wrong" or "none" (this email has no password: it signs in by link or Google). */
export async function checkPassword(email: string, password: string): Promise<"ok" | "wrong" | "none"> {
  const rows = await query<{ hash: string }>(`select hash from design_passwords where email = $1`, [email.toLowerCase()]);
  if (!rows[0]) {
    // The same work as a real check, so how long the answer takes doesn't say whether the email has a password.
    await hashPassword(password);
    return "none";
  }
  return (await passwordMatches(password, rows[0].hash)) ? "ok" : "wrong";
}

export async function setPassword(email: string, password: string): Promise<void> {
  await query(
    `insert into design_passwords (email, hash) values ($1, $2)
     on conflict (email) do update set hash = excluded.hash, updated_at = now()`,
    [email.toLowerCase(), await hashPassword(password)],
  );
}

export async function hasPassword(email: string): Promise<boolean> {
  const rows = await query(`select 1 from design_passwords where email = $1`, [email.toLowerCase()]);
  return rows.length > 0;
}
