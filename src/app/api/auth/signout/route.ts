import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEMO_COOKIE, SESSION_COOKIE } from "@/lib/domain/accounts";
import { STAFF_RETURN_COOKIE } from "@/lib/domain/design/staff-view";
import { VIEW_AS_COOKIE } from "@/lib/domain/design/view-as";
import { endSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";

/**
 * POST (from the sign-out button): ends the session on the server and clears the cookie. ?to=design goes back to the
 * roof designer. A staff member's own session kept aside while looking through a sample business ends too, and an
 * owner's View as is let go (3 Nov 2026, a bug review: either left behind, the next person in the browser could put
 * the staff session back, or find every change refused).
 */
export async function POST(request: Request) {
  const jar = await cookies();
  if (dbConfigured()) {
    await endSession(jar.get(SESSION_COOKIE)?.value).catch(() => undefined);
    await endSession(jar.get(STAFF_RETURN_COOKIE)?.value).catch(() => undefined);
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(STAFF_RETURN_COOKIE);
  jar.delete(VIEW_AS_COOKIE);
  jar.delete(DEMO_COOKIE);
  const url = new URL(request.url);
  return NextResponse.redirect(new URL(url.searchParams.get("to") === "design" ? "/design" : "/", url.origin), 303);
}
