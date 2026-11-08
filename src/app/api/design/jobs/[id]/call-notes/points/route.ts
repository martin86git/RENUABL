import { CALL_POINTS_SCHEMA, callPointsPrompt, cleanPoints, cleanPointsInput, transcriptOf, wordsIn } from "@/lib/domain/design/call-notes";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { readWithClaude } from "@/lib/server/claude-reader";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { allow } from "@/lib/server/rate-limit";
import { modelFor } from "@/lib/server/sol-credits";

export const maxDuration = 60;

/** Live points a member an hour, at most (a call summed up every 20 seconds is 180 an hour). */
const POINTS_PER_HOUR = 240;

/**
 * POST { lines, previous } → { points }: the call note-taker's live points (8 Nov 2026, Martin: "it shouldnt dictate
 * word for word, it should summarise the salient points"). While the member is on a call, the bar sends what has been
 * heard of their side so far (and the points it shows, so they stay steady) every so often (`pointsDue`); the quick
 * model gives back up to `MAX_POINTS` short points. Nothing heard is kept here.
 *
 * No Sol credit is taken for these: they are a working view of the call, asked many times in one, and the write-up at
 * the end (../route.ts) is the answer that takes its credit. Rate limited per member instead.
 *
 * `{ ok: false, fallback: true }` (503/429/502) tells the bar to show the words as heard instead, and say why.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/call-notes/points">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const found = await jobById(who.member.businessId, id, viewerOf(who.member));
    if (!found) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    const read = await readBody(request, 400_000);
    if ("refuse" in read) return read.refuse;
    const { lines, previous } = cleanPointsInput(read.body);
    // Nothing worth summing up yet: no call to Claude.
    if (wordsIn(lines) < 5) return Response.json({ ok: true, points: previous });
    const fallback = (message: string, status: number) => Response.json({ ok: false, fallback: true, message }, { status });
    if (!allow(request, `design-call-points:${who.member.businessId}:${who.member.email}`, POINTS_PER_HOUR))
      return fallback("Live points have paused for now (too many this hour): showing the words as heard.", 429);
    const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
    if (!apiKey) return fallback("Live points need Claude, which isn't set up here: showing the words as heard.", 503);
    try {
      const raw = await readWithClaude<unknown>(
        [],
        CALL_POINTS_SCHEMA,
        callPointsPrompt(who.member.businessName, found.customer.name, transcriptOf(lines), previous),
        apiKey,
        { model: modelFor("quick") },
      );
      return Response.json({ ok: true, points: cleanPoints(raw) });
    } catch (e) {
      console.error("call points failed", redactSecrets(e instanceof Error ? e.message : String(e)));
      return fallback("Live points couldn't be had just now: showing the words as heard. They'll try again.", 502);
    }
  });
}
