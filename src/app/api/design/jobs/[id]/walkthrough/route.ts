import { TIDY_SCHEMA, applyTidy, cleanCues, tidyPrompt, walkthroughPrefix } from "@/lib/domain/design/walkthrough";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { readWithClaude } from "@/lib/server/claude-reader";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import {
  WalkthroughRefusal,
  blobToken,
  keepWalkthrough,
  removeWalkthrough,
  showWalkthrough,
  walkthroughsFor,
} from "@/lib/server/design-walkthroughs";
import { allow } from "@/lib/server/rate-limit";
import { modelFor } from "@/lib/server/sol-credits";

export const maxDuration = 60;

/** GET → { walkthroughs, storage, prefix }: the deal's recorded walkthroughs, newest first, whether they can be kept here, and where a new one goes. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/jobs/[id]/walkthrough">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const found = await jobById(who.member.businessId, id, viewerOf(who.member));
    if (!found) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    return Response.json({
      ok: true,
      walkthroughs: await walkthroughsFor(who.member.businessId, id),
      storage: Boolean(blobToken()),
      prefix: walkthroughPrefix(who.member.businessId, id),
    });
  });
}

/**
 * POST:
 * - `{ do: "tidy", cues, seconds }` → { cues }: Sol tidies the captions just recorded (the quick model; times kept,
 *   nothing added). No Sol credit: it is part of the recording, like the note-taker's live points. Rate limited; on any
 *   failure the captions come back as they were.
 * - `{ do: "keep", path, seconds, cues }` → { walkthrough }: keeps a recording the browser has put in storage.
 * - `{ do: "show", walkthrough, shown }`: shows or hides one on the customer's page.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/walkthrough">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const found = await jobById(who.member.businessId, id, viewerOf(who.member));
    if (!found) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    const read = await readBody(request, 400_000);
    if ("refuse" in read) return read.refuse;
    const body = read.body;

    if (body.do === "tidy") {
      const cues = cleanCues(body.cues, Number(body.seconds) || 0);
      if (!cues.length) return Response.json({ ok: true, cues });
      const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
      if (!apiKey || !allow(request, `design-walkthrough-tidy:${who.member.businessId}`, 60))
        return Response.json({ ok: true, cues, untouched: true });
      try {
        const raw = await readWithClaude<unknown>([], TIDY_SCHEMA, tidyPrompt(who.member.businessName, found.customer.name, cues), apiKey, {
          model: modelFor("quick"),
        });
        return Response.json({ ok: true, cues: applyTidy(cues, raw) });
      } catch (e) {
        console.error("walkthrough tidy failed", redactSecrets(e instanceof Error ? e.message : String(e)));
        return Response.json({ ok: true, cues, untouched: true });
      }
    }

    if (body.do === "keep") {
      try {
        const walkthrough = await keepWalkthrough(who.member.businessId, id, found.customer.id, who.member.email, {
          path: body.path,
          seconds: body.seconds,
          cues: body.cues,
        });
        return Response.json({ ok: true, walkthrough });
      } catch (e) {
        if (e instanceof WalkthroughRefusal) return Response.json({ ok: false, message: e.message }, { status: 422 });
        throw e;
      }
    }

    if (body.do === "show" && typeof body.walkthrough === "string") {
      const done = await showWalkthrough(who.member.businessId, id, body.walkthrough, body.shown !== false);
      return done ? Response.json({ ok: true }) : Response.json({ ok: false, message: "There's no such recording." }, { status: 404 });
    }
    return Response.json({ ok: false, message: "That couldn't be done." }, { status: 400 });
  });
}

/** DELETE ?walkthrough=<id>: deletes a recording and its video. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/walkthrough">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const found = await jobById(who.member.businessId, id, viewerOf(who.member));
    if (!found) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    const wid = new URL(request.url).searchParams.get("walkthrough") ?? "";
    const done = await removeWalkthrough(who.member.businessId, id, wid);
    return done ? Response.json({ ok: true }) : Response.json({ ok: false, message: "There's no such recording." }, { status: 404 });
  });
}
