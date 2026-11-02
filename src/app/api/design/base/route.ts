import { cleanJobPlaces } from "@/lib/domain/design/job-map";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadPrefs, savePrefs } from "@/lib/server/design-after-sale-repo";

/**
 * GET → { base }; PUT { base } → { base }: where the business works from, for how far Marketplace listings and
 * equipment are. The same base the Job map marks (a retailer's), here for every kind of business, since an installer or
 * an inspector has no Job map. Changing it is a setting (`prices`).
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const prefs = await loadPrefs(who.member.businessId);
    return Response.json({ ok: true, base: prefs.places.base });
  });
}

export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const prefs = await loadPrefs(who.member.businessId);
    // Cleaned with the rest of the places, so a base is held to the same rules (inside Australia, both figures).
    const places = cleanJobPlaces({ ...prefs.places, base: read.body.base ?? null });
    const saved = await savePrefs(who.member.businessId, { ...prefs, places }, who.member.email);
    return Response.json({ ok: true, base: saved.places.base });
  });
}
