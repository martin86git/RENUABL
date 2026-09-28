import { dbConfigured } from "@/lib/server/db";
import { processOffers } from "@/lib/server/offers-engine";

/**
 * Vercel cron (vercel.json): moves lapsed offers on to the next partner and
 * retries jobs nobody could take. Vercel sends CRON_SECRET as a bearer token;
 * without it set, the route does nothing.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  if (!dbConfigured()) return Response.json({ ok: false, notConfigured: true });
  return Response.json({ ok: true, ...(await processOffers()) });
}
