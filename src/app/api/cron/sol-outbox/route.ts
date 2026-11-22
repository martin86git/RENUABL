import { dbConfigured } from "@/lib/server/db";
import { fireDue, sendingBusinesses } from "@/lib/server/design-sol-agents";
import { lineUpHellos } from "@/lib/server/design-hello";
import { leadInboxBusinesses, syncLeadInbox } from "@/lib/server/design-lead-inbox";
import { routineBusinesses, runCustomRoutines } from "@/lib/server/design-custom-routines";
import { sendDemoReminders } from "@/lib/server/business-leads-repo";

export const maxDuration = 300;

/**
 * Vercel cron (vercel.json): Sol's outbox every ten minutes, so his emails go in business hours even when nobody has
 * RENUABL open (domain/design/sol-agents.ts), and a new lead's hello goes within minutes (first-contact.ts). Only businesses with an agent on; `fireDue` keeps every other rule (inside the
 * hours, held, stage).
 * Vercel sends CRON_SECRET as a bearer token; without it set, the route does nothing.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  if (!dbConfigured()) return Response.json({ ok: false, notConfigured: true });
  let sent = 0;
  for (const business of await sendingBusinesses()) {
    await lineUpHellos(business).catch((e) => console.error("Sol couldn't line up a hello", e instanceof Error ? e.message : e));
    sent += await fireDue(business).catch((e) => {
      console.error("Sol's outbox couldn't send for a business", e instanceof Error ? e.message : e);
      return 0;
    });
  }
  // The lead inbox (lead-inbox.ts): new emailed leads into each business's CRM, before the next run's hellos find them.
  let leads = 0;
  for (const business of await leadInboxBusinesses().catch(() => [] as string[])) {
    const run = await syncLeadInbox(business).catch((e) => {
      console.error("the lead inbox couldn't be checked", e instanceof Error ? e.message : e);
      return null;
    });
    leads += run?.taken ?? 0;
  }
  // Routines a business built itself (custom-routines.ts): new deals started, each run moved on. Their emails go into
  // Sol's outbox with a time, so the next run of this cron sends them inside the hours.
  let routines = 0;
  for (const business of await routineBusinesses().catch(() => [] as { id: string; name: string }[]))
    routines += await runCustomRoutines(business).catch((e) => {
      console.error("a business's routines couldn't run", e instanceof Error ? e.message : e);
      return 0;
    });
  // RENUABL's own booked demos (business-leads.ts): the lead the day before, staff an hour before.
  const demoReminders = await sendDemoReminders().catch((e) => {
    console.error("demo reminders couldn't be sent", e instanceof Error ? e.message : e);
    return 0;
  });
  return Response.json({ ok: true, sent, leads, routines, demoReminders });
}
