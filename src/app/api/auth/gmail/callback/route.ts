import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { designAccess } from "@/lib/server/design-context";
import { GMAIL_STATE_COOKIE, connectGmail, gmailConfig } from "@/lib/server/gmail";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const OUTCOMES = new Set(["connected", "failed", "full", "off", "signed-out", "read-only"]);

/**
 * The small window's last page: tells the inbox that opened it how it went (same site only) and closes itself; if it
 * was opened some other way, it goes to the inbox instead. Fixed words only, nothing from the request but the outcome.
 */
function closeWindow(why: string, origin: string): Response {
  const outcome = OUTCOMES.has(why) ? why : "failed";
  const html = `<!doctype html><meta charset="utf-8"><title>RENUABL</title>
<p style="font:15px system-ui;margin:2rem;color:#333">${outcome === "connected" ? "Gmail is connected. You can close this window." : "You can close this window."}</p>
<script>
(function () {
  var msg = { source: "renuabl-gmail", outcome: ${JSON.stringify(outcome)} };
  if (window.opener) { window.opener.postMessage(msg, ${JSON.stringify(origin)}); window.close(); }
  else location.replace("/design/inbox?gmail=" + msg.outcome);
})();
</script>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}

/** GET ?code&state from Google: checks the state and keeps this member's Gmail connection. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // A small window sent straight here (nothing to connect: not set up, signed out) only needs closing.
  const done = url.searchParams.get("done");
  if (done && url.searchParams.get("popup") === "1") return closeWindow(done, url.origin);
  const jar = await cookies();
  const kept = jar.get(GMAIL_STATE_COOKIE)?.value ?? "";
  jar.delete({ name: GMAIL_STATE_COOKIE, path: "/api/auth/gmail" });
  const popup = kept.endsWith(".p");
  const back = (why: string) =>
    popup ? closeWindow(why, url.origin) : NextResponse.redirect(new URL(`/design/inbox?gmail=${why}`, url.origin));
  const access = await designAccess();
  const config = gmailConfig(url.origin);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (access.state !== "ready" || access.member.viewedBy) return back("signed-out");
  if (!config || !code || !kept || !same(kept, state)) return back("failed");
  const ok = await connectGmail(config, code, access.member).catch(() => false);
  return back(ok === "full" || ok === "read-only" ? ok : ok ? "connected" : "failed");
}
