/**
 * Server only. The private demo link for pitching to installers: with the site
 * live, the sample partner portal opens only through
 * /demo/<PARTNER_DEMO_KEY>. The key is a long random secret in Vercel; the
 * cookie holds a hash of it, so changing the key closes every open demo.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const MIN_DEMO_KEY_LENGTH = 20;
/** How long a demo stays open on a device. */
export const DEMO_HOURS = 12;

type Env = Record<string, string | undefined>;

export function demoKey(env: Env = process.env): string | null {
  const key = env.PARTNER_DEMO_KEY?.trim();
  return key && key.length >= MIN_DEMO_KEY_LENGTH ? key : null;
}

export function demoCookieValue(key: string): string {
  return `k.${createHash("sha256").update(`renuabl-demo:${key}`).digest("hex")}`;
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Whether a /demo/<key> link carries the real key. */
export function demoKeyMatches(given: string | undefined, env: Env = process.env): boolean {
  const key = demoKey(env);
  return Boolean(key && given && same(given, key));
}

/** Whether the demo cookie opens the sample portal: "1" in preview, or the current key's hash. */
export function demoCookieValid(value: string | undefined, o: { preview: boolean; env?: Env }): boolean {
  if (!value) return false;
  if (o.preview && value === "1") return true;
  const key = demoKey(o.env ?? process.env);
  return Boolean(key && same(value, demoCookieValue(key)));
}
