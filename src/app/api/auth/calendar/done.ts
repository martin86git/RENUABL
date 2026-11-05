import { NextResponse } from "next/server";
import { CALENDAR_MESSAGE, CONNECT_RESULTS } from "@/lib/domain/design/my-calendar";

/**
 * How connecting a calendar ends. In the small window over the page: a page that tells the page that opened it how it
 * went (`postMessage` to our own site only) and closes itself, so nobody leaves what they were doing. Without one
 * (the browser blocked it): back to the page they came from, with `?calendar=` saying how it went.
 */
export function calendarDone(why: string, at: { popup: boolean; back: string; origin: string }): Response {
  const result = why in CONNECT_RESULTS ? why : "failed";
  if (!at.popup) return NextResponse.redirect(new URL(`${at.back}?calendar=${result}`, at.origin));
  const message = JSON.stringify({ type: CALENDAR_MESSAGE, result });
  const html = `<!doctype html><meta charset="utf-8"><title>RENUABL</title>
<body style="font:15px system-ui,sans-serif;color:#1a1a1a;display:grid;place-items:center;height:100vh;margin:0">
<p>${result === "connected" ? "Your calendar is connected. You can close this window." : "You can close this window."}</p>
<script>try{window.opener&&window.opener.postMessage(${message},${JSON.stringify(at.origin)})}catch(e){}window.close()</script>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}
