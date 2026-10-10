import { MAX_LIST_BYTES, cleanImportRoofs, cleanWorkspaceSettings } from "@/lib/domain/design/account";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { importRoofs, importSettings } from "@/lib/server/design-repo";

/**
 * POST { settings?, roofs? }: brings work kept on a device into the business,
 * after the first sign-in on that device. Everything is checked like any
 * other save, and nothing already in the account is overwritten: a roof is
 * kept only where the business has none at that place, and settings only
 * when the business has saved none. The answer names what was brought across
 * (`roofs`: their keys; `settings`), so the device lets go of exactly that.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, MAX_LIST_BYTES);
    if ("refuse" in read) return read.refuse;
    const { businessId, email } = who.member;
    const settings = read.body.settings ? await importSettings(businessId, cleanWorkspaceSettings(read.body.settings), email) : false;
    const roofs = await importRoofs(businessId, cleanImportRoofs(read.body.roofs), email);
    return Response.json({ ok: true, settings, roofs });
  });
}
