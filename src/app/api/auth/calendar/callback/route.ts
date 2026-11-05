import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { returnPath } from "@/lib/domain/design/my-calendar";
import { designAccess } from "@/lib/server/design-context";
import { CALENDAR_STATE_COOKIE, calendarConfig, connectCalendar } from "@/lib/server/google-calendar";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** GET ?code&state from Google: checks the state and keeps this member's calendar connection (read only). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const [kept = "", page] = (jar.get(CALENDAR_STATE_COOKIE)?.value ?? "").split("|");
  jar.delete({ name: CALENDAR_STATE_COOKIE, path: "/api/auth/calendar" });
  const home = (why: string) => NextResponse.redirect(new URL(`${returnPath(page)}?calendar=${why}`, url.origin));
  const access = await designAccess();
  const config = calendarConfig(url.origin);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (access.state !== "ready" || access.member.viewedBy) return home("signed-out");
  if (!config || !code || !kept || !same(kept, state)) return home("failed");
  const ok = await connectCalendar(config, code, access.member).catch(() => false);
  return home(ok ? "connected" : "failed");
}
