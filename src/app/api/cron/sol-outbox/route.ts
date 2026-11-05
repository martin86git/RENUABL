import { dbConfigured } from "@/lib/server/db";
import { fireDue, sendingBusinesses } from "@/lib/server/design-sol-agents";

export const maxDuration = 300;

/**
 * Vercel cron (vercel.json): Sol's outbox every hour, so his emails go in business hours even when nobody has RENUABL
 * open (domain/design/sol-agents.ts). Only businesses with an agent on; `fireDue` keeps every other rule (inside the
 * hours, held, stage).
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
