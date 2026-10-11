import { can, cleanWorkspaceSettings } from "@/lib/domain/design/account";
import { withoutCosts } from "@/lib/domain/design/permissions";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadLists, loadSettings, saveSettings } from "@/lib/server/design-repo";

/**
 * GET: the business's settings and its supplier price lists. `settings` is
 * null until the business has saved some (the designer then starts from its
 * placeholder figures). Every member needs the products to design with; one
 * who may not see costs is sent them with every cost taken out here, on the
 * server (`withoutCosts`), and `costsHidden` so the screens show no quote.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const [settings, lists] = await Promise.all([loadSettings(who.member.businessId), loadLists(who.member.businessId)]);
    if (!can(who.member.role, "costs", who.member.permissions))
      return Response.json({ ok: true, ...withoutCosts(settings, lists), costsHidden: true });
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
