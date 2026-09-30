import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PREVIEW_MODE } from "@/lib/config";
import { DEMO_COOKIE } from "@/lib/domain/accounts";
import { DEMO_HOURS, demoCookieValue, demoKey, demoKeyMatches } from "@/lib/server/demo-access";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET /demo/<key>: the private link for showing installers the sample partner
 * portal. A wrong key goes to the home page without saying why.
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const origin = new URL(request.url).origin;
  const home = NextResponse.redirect(new URL("/", origin));
  if (!allow(request, "demo-link", 20)) return home;
  const { key } = await params;
  const valid = demoKeyMatches(key);
  if (!valid && !PREVIEW_MODE) return home;
  const secret = demoKey();
  (await cookies()).set(DEMO_COOKIE, valid && secret ? demoCookieValue(secret) : "1", {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge: DEMO_HOURS * 3600,
  });
  const res = NextResponse.redirect(new URL("/installer", origin));
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
