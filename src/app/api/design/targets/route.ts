import { cleanTargets } from "@/lib/domain/design/sales-rings";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadPrefs, savePrefs } from "@/lib/server/design-after-sale-repo";

/** GET: the business's monthly sales targets, which the overview's rings close at (null each: its own average). */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, targets: (await loadPrefs(who.member.businessId)).targets });
  });
}

/** PUT { targets }: kept with the business's other settings, cleaned here; for a member who may change settings. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const prefs = await loadPrefs(who.member.businessId);
    const saved = await savePrefs(who.member.businessId, { ...prefs, targets: cleanTargets(read.body.targets) }, who.member.email);
    return Response.json({ ok: true, targets: saved.targets });
  });
}
