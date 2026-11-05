import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomToken } from "@/lib/server/db";
import { designAccess } from "@/lib/server/design-context";
import { GMAIL_STATE_COOKIE, gmailAuthUrl, gmailConfig } from "@/lib/server/gmail";

/**
 * GET: off to Google to connect this member's own Gmail, read only, suggested their own address, with a one-off state
 * kept in a short cookie to match on the way back. With ?add=1 (another mailbox, 5 Nov 2026) Google asks which account
 * instead. Never while the owner is viewing as someone else.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (why: string) => NextResponse.redirect(new URL(`/design/inbox?gmail=${why}`, url.origin));
  const access = await designAccess();
  if (access.state !== "ready" || access.member.viewedBy) return back("signed-out");
  const config = gmailConfig(url.origin);
  if (!config) return back("off");
  const state = randomToken(16);
  (await cookies()).set(GMAIL_STATE_COOKIE, state, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/api/auth/gmail",
    maxAge: 600,
  });
  const adding = url.searchParams.get("add") === "1";
  return NextResponse.redirect(gmailAuthUrl(config, state, adding ? null : access.member.email));
}
