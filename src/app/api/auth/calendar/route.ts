import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isProvider, returnPath } from "@/lib/domain/design/my-calendar";
import { randomToken } from "@/lib/server/db";
import { designAccess } from "@/lib/server/design-context";
import { CALENDAR_STATE_COOKIE, calendarAuthUrl, calendarConfig } from "@/lib/server/my-calendar";
import { calendarDone } from "./done";

/**
 * GET ?provider=google|outlook&popup=1&back=<designer page>: off to Google or Microsoft to connect this member's own
 * calendar, read only, suggested their own address, with a one-off state kept in a short cookie. Opened in a small
 * window over the page (`popup`), which the callback closes; without one it comes back to `back`. Never while the owner
 * is viewing as someone else.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") ?? "google";
  const popup = url.searchParams.get("popup") === "1";
  const back = returnPath(url.searchParams.get("back"));
  const done = (why: string) => calendarDone(why, { popup, back, origin: url.origin });
  if (!isProvider(provider)) return done("failed");
  const access = await designAccess();
  if (access.state !== "ready" || access.member.viewedBy) return done("signed-out");
  const config = calendarConfig(provider, url.origin);
  if (!config) return done(`off-${provider}`);
  const state = randomToken(16);
  (await cookies()).set(CALENDAR_STATE_COOKIE, [state, provider, popup ? "1" : "0", back].join("|"), {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/api/auth/calendar",
    maxAge: 600,
  });
  return NextResponse.redirect(calendarAuthUrl(config, state, access.member.email));
}
