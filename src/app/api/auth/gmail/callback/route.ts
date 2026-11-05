import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { designAccess } from "@/lib/server/design-context";
import { GMAIL_STATE_COOKIE, connectGmail, gmailConfig } from "@/lib/server/gmail";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** GET ?code&state from Google: checks the state and keeps this member's Gmail connection (read only). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (why: string) => NextResponse.redirect(new URL(`/design/inbox?gmail=${why}`, url.origin));
  const jar = await cookies();
  const kept = jar.get(GMAIL_STATE_COOKIE)?.value ?? "";
  jar.delete({ name: GMAIL_STATE_COOKIE, path: "/api/auth/gmail" });
  const access = await designAccess();
  const config = gmailConfig(url.origin);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (access.state !== "ready" || access.member.viewedBy) return back("signed-out");
  if (!config || !code || !kept || !same(kept, state)) return back("failed");
  const ok = await connectGmail(config, code, access.member).catch(() => false);
  return back(ok === "full" ? "full" : ok ? "connected" : "failed");
}
