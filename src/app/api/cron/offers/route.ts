import { dbConfigured } from "@/lib/server/db";
import { noteUnfinishedBriefs } from "@/lib/server/brief-hubspot";
import { sendHealthReminders } from "@/lib/server/health-reminders";
import { processOffers } from "@/lib/server/offers-engine";
import { sendInstallReminders } from "@/lib/server/design-reminders";
import { remindWatchers } from "@/lib/server/design-market-watch-repo";

/**
 * Vercel cron (vercel.json): moves lapsed offers on to the next partner and
 * retries jobs nobody could take, and sends the Home Health reminder two days
 * after reserving, and the "brief not finished" notes, and the roof designer businesses' installation reminders. Vercel sends CRON_SECRET as a bearer token;
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
  const unfinishedBriefs = await noteUnfinishedBriefs();
  // The roof designer's businesses: installation reminders to their customers, for those that have switched them on.
  const installReminders = await sendInstallReminders().catch((e) => {
    console.error("installation reminders failed", e instanceof Error ? e.message : e);
    return 0;
  });
  // The Marketplace: a watched job closing tomorrow that the watcher's business hasn't bid on.
  const watchReminders = await remindWatchers().catch((e) => {
    console.error("watch reminders failed", e instanceof Error ? e.message : e);
    return 0;
  });
  return Response.json({ ok: true, ...offers, healthReminders, unfinishedBriefs, installReminders, watchReminders });
}
