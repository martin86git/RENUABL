import { dbConfigured } from "@/lib/server/db";
import { fireDue, sendingBusinesses } from "@/lib/server/design-sol-agents";

export const maxDuration = 300;

/**
 * Vercel cron (vercel.json): Sol's outbox at the default send windows, so his emails go even when nobody has RENUABL
 * open (domain/design/sol-agents.ts). Vercel's crons run in UTC, so "0 0" is 11 am in summer and 10 am in winter in
 * Melbourne, and "0 4" is 3 pm and 2 pm: each inside `SEND_GRACE_MINUTES` of the 10 am and 2 pm windows all year.
 * Only businesses whose owner switched sending on; `fireDue` keeps every other rule (held, paused, stage, grace).
 * Vercel sends CRON_SECRET as a bearer token; without it set, the route does nothing.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  if (!dbConfigured()) return Response.json({ ok: false, notConfigured: true });
  let sent = 0;
  for (const business of await sendingBusinesses()) {
    sent += await fireDue(business).catch((e) => {
      console.error("Sol's outbox couldn't send for a business", e instanceof Error ? e.message : e);
      return 0;
    });
  }
  return Response.json({ ok: true, sent });
}
