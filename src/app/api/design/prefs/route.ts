import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadPrefs, savePrefs } from "@/lib/server/design-after-sale-repo";

/** GET: the business's after-sale settings (suppliers' order addresses, the invoice tolerance, the automations). */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, prefs: await loadPrefs(who.member.businessId) });
  });
}

/** PUT { prefs }: kept whole, cleaned on the server; for a member who may change prices and settings. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    return Response.json({ ok: true, prefs: await savePrefs(who.member.businessId, read.body.prefs, who.member.email) });
  });
}
