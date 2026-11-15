import { dbConfigured } from "@/lib/server/db";
import { runMarketing } from "@/lib/server/marketing-send";

export const maxDuration = 300;

/**
 * Vercel cron (vercel.json), hourly: RENUABL's marketing email. Campaigns whose time has come are queued, sequences
 * let in and move on, and the next batch goes, only inside the sending hours and under the day's cap
 * (domain/marketing/sequences.ts). Vercel sends CRON_SECRET as a bearer token; without it set, nothing runs.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  if (!dbConfigured()) return Response.json({ ok: false, notConfigured: true });
  return Response.json({ ok: true, ...(await runMarketing()) });
}
