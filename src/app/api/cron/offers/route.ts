import { dbConfigured } from "@/lib/server/db";
import { sendHealthReminders } from "@/lib/server/health-reminders";
import { processOffers } from "@/lib/server/offers-engine";

/**
 * Vercel cron (vercel.json): moves lapsed offers on to the next partner and
 * retries jobs nobody could take, and sends the Home Health reminder two days
 * after reserving. Vercel sends CRON_SECRET as a bearer token;
 * without it set, the route does nothing.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  if (!dbConfigured()) return Response.json({ ok: false, notConfigured: true });
  const offers = await processOffers();
  const healthReminders = await sendHealthReminders().catch((e) => {
    console.error("health reminders failed", e instanceof Error ? e.message : e);
    return 0;
  });
  return Response.json({ ok: true, ...offers, healthReminders });
}
