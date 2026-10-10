import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEMO_COOKIE, SESSION_COOKIE } from "@/lib/domain/accounts";
import { endSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";

/** POST (from the sign-out button): ends the session on the server and clears the cookie. ?to=design goes back to the roof designer. */
export async function POST(request: Request) {
  const jar = await cookies();
  if (dbConfigured()) await endSession(jar.get(SESSION_COOKIE)?.value).catch(() => undefined);
  jar.delete(SESSION_COOKIE);
  jar.delete(DEMO_COOKIE);
  const url = new URL(request.url);
  return NextResponse.redirect(new URL(url.searchParams.get("to") === "design" ? "/design" : "/", url.origin), 303);
}
