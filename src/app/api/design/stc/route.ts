import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { applyStcPeriod, stcNoticeFor, stcNoticeLater } from "@/lib/server/design-stc-notice";

const PRIVATE = { "cache-control": "private, no-store" };

/**
 * GET → the STC change notice for this person (domain/design/stc-change.ts): only for someone who may change
 * settings, and not while they have put it away. Null when there is nothing to say.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, notice: await stcNoticeFor(who.member) }, { headers: PRIVATE });
  });
}

/**
 * POST { do: "later" } puts the notice away for this person for a while. { do: "apply" } prices the business's new
 * quotes for installs from the coming change (who may change settings); the day comes from the rules, not the browser.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 200);
    if ("refuse" in read) return read.refuse;
    if (read.body.do === "later") {
      await stcNoticeLater(who.member);
      return Response.json({ ok: true, notice: null }, { headers: PRIVATE });
    }
    if (read.body.do === "apply") {
      const stcFrom = await applyStcPeriod(who.member);
      if (!stcFrom) return Response.json({ ok: false, message: "There is no change to price for just now." }, { status: 409 });
      return Response.json({ ok: true, stcFrom, notice: await stcNoticeFor(who.member) }, { headers: PRIVATE });
    }
    return Response.json({ ok: false, message: "Unknown request." }, { status: 400 });
  });
}
