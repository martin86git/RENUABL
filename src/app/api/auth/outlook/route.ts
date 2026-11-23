import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomToken } from "@/lib/server/db";
import { designAccess } from "@/lib/server/design-context";
import { OUTLOOK_STATE_COOKIE, outlookAuthUrl, outlookMailConfig } from "@/lib/server/outlook-mail";

/**
 * GET: off to Microsoft to connect one of this member's own Outlook mailboxes (20 Nov 2026), with a one-off state kept
 * in a short cookie to match on the way back. Microsoft always asks which account. With ?popup=1 it runs in a small
 * window the page opened, and the way back closes it and tells the page (the state carries ".p"). Never while the owner
 * is viewing as someone else.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const popup = url.searchParams.get("popup") === "1";
  const back = (why: string) =>
    NextResponse.redirect(new URL(popup ? `/api/auth/outlook/callback?done=${why}&popup=1` : `/design/inbox?gmail=${why}`, url.origin));
  const access = await designAccess();
  if (access.state !== "ready" || access.member.viewedBy || access.locked) return back("signed-out");
  const config = outlookMailConfig(url.origin);
  if (!config) return back("outlook-off");
  const state = `${randomToken(16)}${popup ? ".p" : ""}`;
  (await cookies()).set(OUTLOOK_STATE_COOKIE, state, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/api/auth/outlook",
    maxAge: 600,
  });
  const adding = url.searchParams.get("add") === "1";
  return NextResponse.redirect(outlookAuthUrl(config, state, adding ? null : access.member.email));
}
