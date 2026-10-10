import { cleanWorkspaceSettings } from "@/lib/domain/design/account";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadLists, loadSettings, saveSettings } from "@/lib/server/design-repo";

/**
 * GET: the business's settings and its supplier price lists. `settings` is
 * null until the business has saved some (the designer then starts from its
 * placeholder figures).
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const [settings, lists] = await Promise.all([loadSettings(who.member.businessId), loadLists(who.member.businessId)]);
    return Response.json({ ok: true, settings, lists });
  });
}

/**
 * PUT { settings: { components, install, settings } }: the parts, rates,
 * margin and bill figures, without the price lists (those are sent one at a
 * time to /api/design/workspace/lists, since each can be thousands of rows
 * and this is saved with every figure typed). Checked here before it is kept.
 */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 100_000);
    if ("refuse" in read) return read.refuse;
    await saveSettings(who.member.businessId, cleanWorkspaceSettings(read.body.settings), who.member.email);
    return Response.json({ ok: true });
  });
}
