import { can, cleanRoofPlace } from "@/lib/domain/design/account";
import { MAX_DRAFT_BYTES, cleanDraft, draftStillFits } from "@/lib/domain/design/draft";
import { withoutCostEdits } from "@/lib/domain/design/permissions";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { draftOf, dropDraft, keepDraft } from "@/lib/server/design-draft-repo";
import { projectAt } from "@/lib/server/design-repo";

/** Which save a draft of this roof would be drawn over now: the saved roof's version, or "new" before its first save. */
async function baseNow(businessId: string, roof: { lat: number; lng: number }): Promise<string> {
  const project = await projectAt(businessId, roof);
  return project ? `v${project.version}` : "new";
}

const placeOf = (request: Request) => {
  const params = new URL(request.url).searchParams;
  return cleanRoofPlace({ lat: Number(params.get("lat")), lng: Number(params.get("lng")) });
};

/**
 * The signed-in person's draft of a roof (domain/design/draft.ts): their unsaved work, kept as it goes. GET ?lat=&lng=
 * answers it only while nothing has been saved on the roof since it was taken (`draftStillFits`); otherwise `draft:
 * null`. PUT { lat, lng, address, base, design, extras } keeps it; DELETE ?lat=&lng= throws it away. Never the saved
 * roof: nobody else sees a draft, and Publish is what saves.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const roof = placeOf(request);
    if (!roof) return Response.json({ ok: false }, { status: 400 });
    const [draft, base] = await Promise.all([draftOf(who.member.businessId, who.member.email, roof), baseNow(who.member.businessId, roof)]);
    if (!draft || !draftStillFits(draft, base)) return Response.json({ ok: true, draft: null });
    const seesCosts = can(who.member.role, "costs", who.member.permissions);
    return Response.json({
      ok: true,
      draft: { design: draft.design, extras: seesCosts ? draft.extras : withoutCostEdits(draft.extras), at: draft.at, base: draft.base },
    });
  });
}

export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, MAX_DRAFT_BYTES);
    if ("refuse" in read) return read.refuse;
    const roof = cleanRoofPlace(read.body);
    const draft = roof && cleanDraft(roof, { ...read.body, at: new Date().toISOString() });
    if (!roof || !draft) return Response.json({ ok: false, message: "That draft couldn't be read." }, { status: 422 });
    // Someone who can't see costs has none to keep: a cost typed over a quote line isn't taken from them.
    if (!can(who.member.role, "costs", who.member.permissions)) draft.extras = withoutCostEdits(draft.extras);
    await keepDraft(who.member.businessId, who.member.email, roof, draft);
    return Response.json({ ok: true, at: draft.at });
  });
}

export async function DELETE(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const roof = placeOf(request);
    if (!roof) return Response.json({ ok: false }, { status: 400 });
    await dropDraft(who.member.businessId, who.member.email, roof);
    return Response.json({ ok: true });
  });
}
