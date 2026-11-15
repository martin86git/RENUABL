import { cleanConsentNote, cleanListName, isConsentKind } from "@/lib/domain/marketing/contacts";
import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
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

const fail = (message: string, status = 422) => Response.json({ ok: false, message }, { status });

async function staff() {
  if (!dbConfigured()) return null;
  const session = await currentSession();
  return session?.role === "staff" ? session : null;
}

/** GET (staff) ?q=&list=&offset=: a page of contacts, the counts and the lists. */
export async function GET(request: Request) {
  if (!(await staff())) return Response.json({ ok: false }, { status: 401 });
  const url = new URL(request.url);
  const [page, counts, lists] = await Promise.all([
    listContacts({
      search: url.searchParams.get("q")?.slice(0, 120) ?? "",
      listId: url.searchParams.get("list") || null,
      offset: Number(url.searchParams.get("offset")) || 0,
      limit: 50,
    }),
    contactCounts(),
    listLists(),
  ]);
  return Response.json({ ok: true, ...page, counts, lists });
}

const ids = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^mc_[0-9a-f]+$/.test(x)).slice(0, 1000) : [];
const listId = (v: unknown) => (typeof v === "string" && /^ml_[0-9a-f]+$/.test(v) ? v : null);

/**
 * POST (staff) { do, ... }: "new-list" {name}, "rename-list" {list, name}, "delete-list" {list},
 * "add" / "remove" {list, ids}, "consent" {ids, consent, note}, "unsubscribe" {id}.
 */
export async function POST(request: Request) {
  const session = await staff();
  if (!session) return Response.json({ ok: false }, { status: 401 });
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return fail("Bad request.", 400);
  }
  switch (b.do) {
    case "new-list": {
      const name = cleanListName(b.name);
      if (!name) return fail("Give the list a name.");
      return Response.json({ ok: true, id: await listNamed(name, session.email) });
    }
    case "rename-list": {
      const id = listId(b.list);
      const name = cleanListName(b.name);
      if (!id || !name) return fail("Give the list a name.");
      return Response.json({ ok: await renameList(id, name).catch(() => false) });
    }
    case "delete-list": {
      const id = listId(b.list);
      return Response.json({ ok: id ? await deleteList(id) : false });
    }
    case "add":
    case "remove": {
      const id = listId(b.list);
      const which = ids(b.ids);
      if (!id || !which.length) return fail("Choose a list and some contacts.");
      const n = b.do === "add" ? await addToList(id, which) : await removeFromList(id, which);
      return Response.json({ ok: true, changed: n });
    }
    case "consent": {
      const which = ids(b.ids);
      if (!which.length || !isConsentKind(b.consent)) return fail("Choose contacts and a kind of consent.");
      const note = cleanConsentNote(b.note);
      if ((b.consent === "express" || b.consent === "inferred") && !note) return fail("Note how they consented.");
      return Response.json({ ok: true, changed: await setConsent(which, b.consent, note, session.email) });
    }
    case "unsubscribe": {
      const [id] = ids([b.id]);
      return Response.json({ ok: id ? await unsubscribeContact(id) : false });
    }
    default:
      return fail("Bad request.", 400);
  }
}
