import { NextResponse } from "next/server";
import { XERO_MESSAGE, XERO_RESULTS, type XeroResult } from "@/lib/domain/design/xero";

/**
 * How connecting Xero ends. In the small window over the page: a page that tells the page that opened it how it went
 * (`postMessage` to our own site only) and closes itself. Without one: back to Settings → Xero with `?xero=`.
 */
export function xeroDone(why: string, at: { popup: boolean; origin: string }): Response {
  const result: XeroResult = (XERO_RESULTS as readonly string[]).includes(why) ? (why as XeroResult) : "failed";
  if (!at.popup) return NextResponse.redirect(new URL(`/design/settings/xero?xero=${result}`, at.origin));
  const message = JSON.stringify({ type: XERO_MESSAGE, result });
  const html = `<!doctype html><meta charset="utf-8"><title>RENUABL</title>
<body style="font:15px system-ui,sans-serif;color:#1a1a1a;display:grid;place-items:center;height:100vh;margin:0">
<p>${result === "connected" ? "Xero is connected. You can close this window." : "You can close this window."}</p>
<script>try{window.opener&&window.opener.postMessage(${message},${JSON.stringify(at.origin)})}catch(e){}window.close()</script>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}
