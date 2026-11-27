import {
  HUBSPOT_BATCH,
  HUBSPOT_CHECK_BATCH,
  HUBSPOT_WORDS,
  cleanHubSpotId,
  cleanHubSpotKey,
  cleanHubSpotMap,
  fieldTargets,
} from "@/lib/domain/design/hubspot-import";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadPrefs } from "@/lib/server/design-after-sale-repo";
import { HubSpotProblem, bringInHubSpotDeals, checkHubSpotDeals, lookAtHubSpot } from "@/lib/server/hubspot-import";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 120;

/**
 * Bringing deals across from HubSpot (Settings → CRM → Bring in from HubSpot), for a member who may change settings.
 * POST { do: "look", key }: the token checked; the pipelines, deal properties, our fields, our guesses and every deal listed.
 * POST { do: "bring", key, ids, map }: up to a few deals brought in by the business's match of stages and fields.
 * POST { do: "check", key, ids, map }: what bringing those deals in would do (join a deal here, a second deal, a new
 * customer), with nothing written.
 * The token comes with each call and is never kept.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-hubspot", 900))
      return Response.json({ ok: false, message: "Too many calls for now. Try again in an hour." }, { status: 429 });
    const read = await readBody(request, 200_000);
    if ("refuse" in read) return read.refuse;
    const key = cleanHubSpotKey(read.body.key);
    if (!key) return Response.json({ ok: false, message: HUBSPOT_WORDS.badKey }, { status: 400 });
    const { businessId, email } = who.member;
    try {
      if (read.body.do === "look") return Response.json({ ok: true, ...(await lookAtHubSpot(businessId, key)) });
      if (read.body.do === "check") {
        const ids = (Array.isArray(read.body.ids) ? read.body.ids : [])
          .map(cleanHubSpotId)
          .filter((id): id is string => Boolean(id))
          .slice(0, HUBSPOT_CHECK_BATCH);
        if (!ids.length) return Response.json({ ok: false, message: "Nothing to check." }, { status: 400 });
        const map = cleanHubSpotMap(read.body.map, fieldTargets((await loadPrefs(businessId)).dealFields));
        return Response.json({ ok: true, checks: await checkHubSpotDeals(businessId, key, ids, map) });
      }
      if (read.body.do === "bring") {
        const ids = (Array.isArray(read.body.ids) ? read.body.ids : [])
          .map(cleanHubSpotId)
          .filter((id): id is string => Boolean(id))
          .slice(0, HUBSPOT_BATCH);
        if (!ids.length) return Response.json({ ok: false, message: "Nothing to bring in." }, { status: 400 });
        const map = cleanHubSpotMap(read.body.map, fieldTargets((await loadPrefs(businessId)).dealFields));
        return Response.json({ ok: true, ...(await bringInHubSpotDeals(businessId, key, ids, map, email)) });
      }
      return Response.json({ ok: false, message: "Say what to do." }, { status: 400 });
    } catch (e) {
      if (e instanceof HubSpotProblem) return Response.json({ ok: false, message: e.message }, { status: 502 });
      throw e;
    }
  });
}
