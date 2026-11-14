import { normaliseMobile } from "@/lib/domain/contact";
import { TEXT_WORDS, cleanText, textRecord } from "@/lib/domain/design/contact-reach";
import {
  TEXT_WORDS_MAX,
  TIDY_SCHEMA,
  WATCH_PATH,
  applyTidy,
  cleanCues,
  textWithLink,
  tidyPrompt,
  walkthroughPrefix,
} from "@/lib/domain/design/walkthrough";
import { siteUrl } from "@/lib/domain/sms";
import { textsOnFor } from "@/lib/server/design-texts";
import { sendSms } from "@/lib/server/sms";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { readWithClaude } from "@/lib/server/claude-reader";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { addActivity, jobById } from "@/lib/server/design-crm-repo";
import {
  WalkthroughRefusal,
  blobToken,
  keepWalkthrough,
  removeWalkthrough,
  showWalkthrough,
  walkthroughsFor,
  watchToken,
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
      texts: await textsOnFor(who.member.businessId),
      business: who.member.businessName,
      mobile: Boolean(normaliseMobile(found.customer.phone)),
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
 * - `{ do: "text", walkthrough, words }`: texts the customer, on the mobile on their record, the member's words with
 *   the walkthrough's own private link after them (built here from SITE_URL, never from the browser). Only where texts
 *   are on for the business; written on the deal's record.
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

    if (body.do === "text" && typeof body.walkthrough === "string") {
      if (!allow(request, "design-text", 30))
        return Response.json({ ok: false, message: "That's a lot of texts at once. Try again later." }, { status: 429 });
      const words = typeof body.words === "string" ? body.words.slice(0, TEXT_WORDS_MAX + 1) : "";
      if (words.trim().length > TEXT_WORDS_MAX) return Response.json({ ok: false, message: TEXT_WORDS.long }, { status: 422 });
      const site = siteUrl();
      if (!site) return Response.json({ ok: false, message: "Texts with a link need SITE_URL set up." }, { status: 503 });
      if (!(await textsOnFor(who.member.businessId))) return Response.json({ ok: false, message: TEXT_WORDS.off }, { status: 409 });
      const mobile = normaliseMobile(found.customer.phone);
      if (!mobile) return Response.json({ ok: false, message: TEXT_WORDS.noMobile }, { status: 422 });
      const token = await watchToken(who.member.businessId, id, body.walkthrough);
      if (!token) return Response.json({ ok: false, message: "There's no such recording." }, { status: 404 });
      const link = `${site.replace(/\/$/, "")}${WATCH_PATH}${token}`;
      const clean = cleanText(words.trim() ? textWithLink(words, link) : link);
      if (!clean.ok) return Response.json({ ok: false, message: clean.message }, { status: 422 });
      if ((await sendSms(mobile, clean.text)) !== "sent") return Response.json({ ok: false, message: TEXT_WORDS.failed }, { status: 502 });
      await addActivity(
        who.member.businessId,
        found.customer.id,
        { kind: "note", text: textRecord(mobile, clean.text).slice(0, 2000), jobId: id },
        who.member.email,
      ).catch(() => console.error("a walkthrough text couldn't be written on its deal"));
      return Response.json({ ok: true, message: `Texted to ${found.customer.firstName || found.customer.name}.` });
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
