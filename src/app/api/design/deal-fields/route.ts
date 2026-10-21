import { cleanDealFields, defaultDealFields } from "@/lib/domain/design/deal-sections";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadPrefs, savePrefs } from "@/lib/server/design-after-sale-repo";

/** GET: the business's arrangement of a deal's fields (Settings → Deal fields), or ours when it has none. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const prefs = await loadPrefs(who.member.businessId);
    return Response.json({ ok: true, fields: prefs.dealFields ?? defaultDealFields(), own: Boolean(prefs.dealFields) });
  });
}

/**
 * PUT { fields }: the arrangement, cleaned on the server and kept with the business's other settings; { fields: null }
 * goes back to ours. For a member who may change settings. Values already typed on deals are kept as they are.
 */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 60_000);
    if ("refuse" in read) return read.refuse;
    const prefs = await loadPrefs(who.member.businessId);
    const fields = read.body.fields === null ? null : cleanDealFields(read.body.fields);
    const saved = await savePrefs(who.member.businessId, { ...prefs, dealFields: fields }, who.member.email);
    return Response.json({ ok: true, fields: saved.dealFields ?? defaultDealFields(), own: Boolean(saved.dealFields) });
  });
}
