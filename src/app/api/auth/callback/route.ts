import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { HOME_FOR, SESSION_COOKIE, safeNext } from "@/lib/domain/accounts";
import { SESSION_COOKIE_OPTIONS, redeemLoginToken } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";

/** GET ?token=… from the emailed link: starts the session and goes to the account's home. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const session = dbConfigured() ? await redeemLoginToken(token).catch(() => null) : null;
  if (!session) return NextResponse.redirect(new URL("/login?error=expired", url.origin));
  (await cookies()).set(SESSION_COOKIE, session.sessionId, SESSION_COOKIE_OPTIONS);
  const next = safeNext(session.next, session.role);
  return NextResponse.redirect(new URL(next || HOME_FOR[session.role], url.origin));
}
