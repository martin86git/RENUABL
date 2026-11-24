import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { can } from "@/lib/domain/design/account";
import { randomToken } from "@/lib/server/db";
import { designAccess } from "@/lib/server/design-context";
import { XERO_STATE_COOKIE, xeroAuthUrl, xeroConfig } from "@/lib/server/xero";
import { xeroDone } from "./done";

/**
 * GET ?popup=1: off to Xero to connect the business's own organisation, with a one-off state kept in a short cookie.
 * Only someone who may change the business's settings, never while viewing as someone else, never from a demo.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const popup = url.searchParams.get("popup") === "1";
  const done = (why: string) => xeroDone(why, { popup, origin: url.origin });
  const access = await designAccess();
  if (access.state !== "ready" || access.member.viewedBy) return done("signed-out");
  if (!can(access.member.role, "prices", access.member.permissions) || access.member.email.endsWith(".example")) return done("failed");
  const config = xeroConfig(url.origin);
  if (!config) return done("off");
  const state = randomToken(16);
  (await cookies()).set(XERO_STATE_COOKIE, [state, popup ? "1" : "0"].join("|"), {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/api/auth/xero",
    maxAge: 600,
  });
  return NextResponse.redirect(xeroAuthUrl(config, state));
}
