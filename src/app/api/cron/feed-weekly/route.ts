import { dbConfigured } from "@/lib/server/db";
import { postSolPoll, postSolResults, sendDigests } from "@/lib/server/design-feed-social-repo";

export const maxDuration = 300;

/**
 * Vercel cron (vercel.json), early Monday in Melbourne (17 Nov 2026, feed-social.ts): Sol posts last week's poll's
 * results (when enough voted) and this week's poll in the industry feed, then the Monday digest goes to every member
 * who hasn't turned it off. Each step runs once a week whatever happens to the others. Vercel sends CRON_SECRET as a
 * bearer token; without it set, the route does nothing.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  if (!dbConfigured()) return Response.json({ ok: false, notConfigured: true });
  const results = await postSolResults().catch((e) => (console.error("sol poll results", e instanceof Error ? e.message : e), false));
  const poll = await postSolPoll().catch((e) => (console.error("sol poll", e instanceof Error ? e.message : e), false));
  const digests = await sendDigests().catch((e) => (console.error("feed digest", e instanceof Error ? e.message : e), 0));
  return Response.json({ ok: true, results, poll, digests });
}
