import { after } from "next/server";
import { MAX_LIST_BYTES, cleanSupplierList } from "@/lib/domain/design/account";
import { FIND_AT_ONCE, missingSheets } from "@/lib/domain/design/datasheets";
import { findDatasheets } from "@/lib/server/datasheet-finder";
import { businessDatasheets } from "@/lib/server/design-datasheets-repo";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadLists, removeList, saveList } from "@/lib/server/design-repo";

/** Finding a datasheet online (a search, a download, a read) can take a couple of minutes, after the answer too. */
export const maxDuration = 300;

/**
 * PUT { list }: keeps one supplier price list for the business, checked row
 * by row first. One of the same name is replaced; past the limit the oldest
 * goes. Answers with the names now kept, newest first.
 */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, MAX_LIST_BYTES);
    if ("refuse" in read) return read.refuse;
    const list = cleanSupplierList(read.body.list);
    if (!list) return Response.json({ ok: false, message: "That price list has no priced rows to keep." }, { status: 422 });
    await saveList(who.member.businessId, list, who.member.email);
    // Its panels and inverters with no figures anywhere: their datasheets are looked for online once the answer has gone
    // (datasheet-finder.ts), a few at a time, and kept unchecked until a person confirms them.
    const businessId = who.member.businessId;
    const missing = missingSheets(list, await businessDatasheets(businessId)).slice(0, FIND_AT_ONCE);
    const finding = process.env.ANTHROPIC_API_KEY ? missing.length : 0;
    if (finding) after(() => findDatasheets(businessId, missing).catch(() => undefined));
    return Response.json({ ok: true, names: (await loadLists(businessId)).map((l) => l.name), finding });
  });
}

/** DELETE ?name=: removes one of the business's price lists. */
export async function DELETE(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const name = new URL(request.url).searchParams.get("name");
    if (!name) return Response.json({ ok: false }, { status: 400 });
    await removeList(who.member.businessId, name.slice(0, 120));
    return Response.json({ ok: true });
  });
}
