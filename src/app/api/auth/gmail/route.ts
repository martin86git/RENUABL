import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomToken } from "@/lib/server/db";
import { designAccess } from "@/lib/server/design-context";
import { GMAIL_STATE_COOKIE, gmailAuthUrl, gmailConfig } from "@/lib/server/gmail";

/**
 * GET: off to Google to connect this member's own Gmail, read only, suggested their own address, with a one-off state
 * kept in a short cookie to match on the way back. With ?add=1 (another mailbox, 5 Nov 2026) Google asks which account
 * instead. With ?popup=1 (5 Nov 2026, Martin: connect it then and there, never leave the page) it runs in a small window
 * the inbox opened, and the way back closes it and tells the inbox (the state carries ".p"). Never while the owner is
 * viewing as someone else.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const popup = url.searchParams.get("popup") === "1";
  const back = (why: string) =>
    NextResponse.redirect(new URL(popup ? `/api/auth/gmail/callback?done=${why}&popup=1` : `/design/inbox?gmail=${why}`, url.origin));
  const access = await designAccess();
  if (access.state !== "ready" || access.member.viewedBy) return back("signed-out");
  const config = gmailConfig(url.origin);
  if (!config) return back("off");
  const state = `${randomToken(16)}${popup ? ".p" : ""}`;
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
