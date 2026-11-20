import {
  PYLON_BATCH,
  PYLON_CSV_BATCH,
  PYLON_STAGES,
  PYLON_WON_WEEKS,
  PYLON_WORDS,
  cleanCsvRow,
  cleanPylonId,
  cleanPylonKey,
  type PylonCsvRow,
  type PylonStage,
} from "@/lib/domain/design/pylon-import";
import { todayInMarket } from "@/lib/domain/market";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { PylonProblem, alreadyBroughtIn, bringInCsvRows, bringInProjects, listSoldProjects } from "@/lib/server/pylon-import";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 120;

/**
 * Bringing sold jobs across from Pylon (Settings → CRM → Bring in from Pylon), for a member who may change settings.
 * POST { do: "check", key }: the key checked and every sold project listed, with those already brought in.
 * POST { do: "bring", key, ids, stage }: up to a few of them brought in as customers and deals.
 * The key comes with each call and is never kept.
 * POST { do: "csv-check", ids }: which of the export's sold projects are already brought in.
 * POST { do: "csv", rows, wonWeeks }: a batch of the export's sold rows brought in (read in the browser, read again here).
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-pylon", 900))
      return Response.json({ ok: false, message: "Too many calls for now. Try again in an hour." }, { status: 429 });
    const read = await readBody(request, 200_000);
    if ("refuse" in read) return read.refuse;
    const { businessId: biz, email: by } = who.member;
    if (read.body.do === "csv-check") {
      const ids = (Array.isArray(read.body.ids) ? read.body.ids : []).map(cleanPylonId).filter((id): id is string => Boolean(id));
      return Response.json({ ok: true, already: await alreadyBroughtIn(biz, ids) });
    }
    if (read.body.do === "csv") {
      const rows = (Array.isArray(read.body.rows) ? read.body.rows : [])
        .map(cleanCsvRow)
        .filter((r): r is PylonCsvRow => Boolean(r))
        .slice(0, PYLON_CSV_BATCH);
      if (!rows.length) return Response.json({ ok: false, message: "Nothing to bring in." }, { status: 400 });
      const weeks = Number(read.body.wonWeeks);
      const wonWeeks = Number.isInteger(weeks) && weeks >= 0 && weeks <= 520 ? weeks : PYLON_WON_WEEKS;
      return Response.json({ ok: true, results: await bringInCsvRows(biz, rows, todayInMarket(), wonWeeks, by) });
    }
    const key = cleanPylonKey(read.body.key);
    if (!key) return Response.json({ ok: false, message: PYLON_WORDS.badKey }, { status: 400 });
    const { businessId, email } = who.member;
    try {
      if (read.body.do === "check") {
        const found = await listSoldProjects(businessId, key);
        return Response.json({ ok: true, ...found });
      }
      if (read.body.do === "bring") {
        const ids = (Array.isArray(read.body.ids) ? read.body.ids : [])
          .map(cleanPylonId)
          .filter((id): id is string => Boolean(id))
          .slice(0, PYLON_BATCH);
        if (!ids.length) return Response.json({ ok: false, message: "Nothing to bring in." }, { status: 400 });
        const stage: PylonStage = PYLON_STAGES.includes(read.body.stage as PylonStage) ? (read.body.stage as PylonStage) : "won";
        const results = await bringInProjects(businessId, key, ids, stage, email);
        return Response.json({ ok: true, results });
      }
      return Response.json({ ok: false, message: "Say what to do." }, { status: 400 });
    } catch (e) {
      if (e instanceof PylonProblem) return Response.json({ ok: false, message: e.message }, { status: 502 });
      throw e;
    }
  });
}
