import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isProvider, returnPath } from "@/lib/domain/design/my-calendar";
import { designAccess } from "@/lib/server/design-context";
import { CALENDAR_STATE_COOKIE, calendarConfig, connectCalendar } from "@/lib/server/my-calendar";
import { calendarDone } from "../done";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** GET ?code&state from Google or Microsoft: checks the state and keeps this member's calendar connection (read only). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const [kept = "", provider = "", popup = "0", back] = (jar.get(CALENDAR_STATE_COOKIE)?.value ?? "").split("|");
  jar.delete({ name: CALENDAR_STATE_COOKIE, path: "/api/auth/calendar" });
  const done = (why: string) => calendarDone(why, { popup: popup === "1", back: returnPath(back), origin: url.origin });
  const access = await designAccess();
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (access.state !== "ready" || access.member.viewedBy) return done("signed-out");
  if (!isProvider(provider) || !code || !kept || !same(kept, state)) return done("failed");
  const config = calendarConfig(provider, url.origin);
  if (!config) return done(`off-${provider}`);
  const ok = await connectCalendar(config, code, access.member).catch(() => false);
  return done(ok ? "connected" : "failed");
}
