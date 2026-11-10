import { cleanEntryInput } from "@/lib/domain/design/calendar-entries";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { removeEntry, updateEntry } from "@/lib/server/design-calendar-entries-repo";
import { allow } from "@/lib/server/rate-limit";

type Params = { params: Promise<{ id: string }> };
const gone = () => Response.json({ ok: false, message: "That entry isn't there any more." }, { status: 404 });

/** PUT the entry's new days and words. */
export async function PUT(request: Request, { params }: Params) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-calendar-entries", 240))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const { id } = await params;
    const read = await readBody(request, 4_000);
    if ("refuse" in read) return read.refuse;
    const entry = cleanEntryInput(read.body);
    if (!entry.ok) return Response.json(entry, { status: 422 });
    const saved = await updateEntry(who.member.businessId, id.slice(0, 40), entry.entry);
    return saved ? Response.json({ ok: true, entry: saved }) : gone();
  });
}

/** DELETE the entry. */
export async function DELETE(_request: Request, { params }: Params) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await params;
    return (await removeEntry(who.member.businessId, id.slice(0, 40))) ? Response.json({ ok: true }) : gone();
  });
}
