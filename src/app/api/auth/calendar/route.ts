import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { returnPath } from "@/lib/domain/design/my-calendar";
import { randomToken } from "@/lib/server/db";
import { designAccess } from "@/lib/server/design-context";
import { CALENDAR_STATE_COOKIE, calendarAuthUrl, calendarConfig } from "@/lib/server/google-calendar";

/**
 * GET ?back=<designer page>: off to Google to connect this member's own Google Calendar, read only, suggested their own
 * address, with a one-off state (and the page to come back to) kept in a short cookie. Never while the owner is viewing
 * as someone else.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = returnPath(url.searchParams.get("back"));
  const home = (why: string) => NextResponse.redirect(new URL(`${back}?calendar=${why}`, url.origin));
  const access = await designAccess();
  if (access.state !== "ready" || access.member.viewedBy) return home("signed-out");
  const config = calendarConfig(url.origin);
  if (!config) return home("off");
  const state = randomToken(16);
  (await cookies()).set(CALENDAR_STATE_COOKIE, `${state}|${back}`, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/api/auth/calendar",
    maxAge: 600,
  });
  return NextResponse.redirect(calendarAuthUrl(config, state, access.member.email));
}
