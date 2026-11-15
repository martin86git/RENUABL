import { cleanConsentNote, cleanListName, isConsentKind } from "@/lib/domain/marketing/contacts";
import { answer } from "@/lib/server/design-context";
import { marketingMember, readJson, refuse } from "@/lib/server/marketing-guard";
import {
  addToList,
  contactCounts,
  deleteList,
  listContacts,
  listLists,
  listNamed,
  removeFromList,
  renameList,
  setConsent,
  unsubscribeContact,
} from "@/lib/server/marketing-repo";

/** GET ?q=&list=&offset=: a page of the business's contacts, the counts and its lists. */
export async function GET(request: Request) {
  return answer(async () => {
    const gate = await marketingMember("design");
    if ("refuse" in gate) return gate.refuse;
    const b = gate.member.businessId;
    const url = new URL(request.url);
    const [page, counts, lists] = await Promise.all([
      listContacts(b, {
        search: url.searchParams.get("q")?.slice(0, 120) ?? "",
        listId: url.searchParams.get("list") || null,
        offset: Number(url.searchParams.get("offset")) || 0,
        limit: 50,
      }),
      contactCounts(b),
      listLists(b),
    ]);
    return Response.json({ ok: true, ...page, counts, lists });
  });
}

const ids = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^mc_[0-9a-f]+$/.test(x)).slice(0, 1000) : [];
const listId = (v: unknown) => (typeof v === "string" && /^ml_[0-9a-f]+$/.test(v) ? v : null);

/**
 * POST { do, ... } (members who may publish): "new-list" {name}, "rename-list" {list, name}, "delete-list" {list},
 * "add" / "remove" {list, ids}, "consent" {ids, consent, note}, "unsubscribe" {id}.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const gate = await marketingMember("publish");
    if ("refuse" in gate) return gate.refuse;
    const { businessId: biz, email } = gate.member;
    const b = await readJson(request);
    if (!b) return refuse("Bad request.", 400);
    switch (b.do) {
      case "new-list": {
        const name = cleanListName(b.name);
        if (!name) return refuse("Give the list a name.");
        return Response.json({ ok: true, id: await listNamed(biz, name, email) });
      }
      case "rename-list": {
        const id = listId(b.list);
        const name = cleanListName(b.name);
        if (!id || !name) return refuse("Give the list a name.");
        return Response.json({ ok: await renameList(biz, id, name).catch(() => false) });
      }
      case "delete-list": {
        const id = listId(b.list);
        return Response.json({ ok: id ? await deleteList(biz, id) : false });
      }
      case "add":
      case "remove": {
        const id = listId(b.list);
        const which = ids(b.ids);
        if (!id || !which.length) return refuse("Choose a list and some contacts.");
        const n = b.do === "add" ? await addToList(biz, id, which) : await removeFromList(biz, id, which);
        return Response.json({ ok: true, changed: n });
      }
      case "consent": {
        const which = ids(b.ids);
        if (!which.length || !isConsentKind(b.consent)) return refuse("Choose contacts and a kind of consent.");
        const note = cleanConsentNote(b.note);
        if ((b.consent === "express" || b.consent === "inferred") && !note) return refuse("Note how they consented.");
        return Response.json({ ok: true, changed: await setConsent(biz, which, b.consent, note, email) });
      }
      case "unsubscribe": {
        const [id] = ids([b.id]);
        return Response.json({ ok: id ? await unsubscribeContact(biz, id) : false });
      }
      default:
        return refuse("Bad request.", 400);
    }
  });
}
