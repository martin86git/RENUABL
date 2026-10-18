import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomToken } from "@/lib/server/db";
import { GOOGLE_STATE_COOKIE, googleAuthUrl, googleConfig } from "@/lib/server/google-sign-in";

/** GET: off to Google to choose an account, with a one-off state kept in a short cookie to match on the way back. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const config = googleConfig(url.origin);
  if (!config) return NextResponse.redirect(new URL("/design/sign-in?error=google-off", url.origin));
  const state = randomToken(16);
  (await cookies()).set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthUrl(config, state));
}
