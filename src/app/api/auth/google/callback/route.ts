import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/domain/accounts";
import { openSession, SESSION_COOKIE_OPTIONS } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { GOOGLE_STATE_COOKIE, googleConfig, googleEmail } from "@/lib/server/google-sign-in";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** GET ?code&state from Google: checks the state, asks Google for the email, and signs in to the roof designer. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const failed = NextResponse.redirect(new URL("/design/sign-in?error=google", url.origin));
  const jar = await cookies();
  const kept = jar.get(GOOGLE_STATE_COOKIE)?.value ?? "";
  jar.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
  const config = googleConfig(url.origin);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!config || !dbConfigured() || !code || !kept || !same(kept, state)) return failed;
  const email = await googleEmail(config, code).catch(() => null);
  if (!email) return failed;
  jar.set(SESSION_COOKIE, await openSession(email, "business"), SESSION_COOKIE_OPTIONS);
  return NextResponse.redirect(new URL("/design", url.origin));
}
