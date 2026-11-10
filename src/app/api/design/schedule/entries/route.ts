import { cleanEntryInput } from "@/lib/domain/design/calendar-entries";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { addEntry, listEntries } from "@/lib/server/design-calendar-entries-repo";
import { allow } from "@/lib/server/rate-limit";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET ?from&to: the entries put on the install calendar by hand, touching those days. The whole team's. */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!DATE.test(from) || !DATE.test(to) || from > to)
      return Response.json({ ok: false, message: "Choose the days to show." }, { status: 422 });
    return Response.json({ ok: true, entries: await listEntries(who.member.businessId, from, to) });
  });
}

/** POST an entry: a tentative install, a day off or a note. Anyone in the business may. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-calendar-entries", 240))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 4_000);
    if ("refuse" in read) return read.refuse;
    const entry = cleanEntryInput(read.body);
    if (!entry.ok) return Response.json(entry, { status: 422 });
    return Response.json({ ok: true, entry: await addEntry(who.member.businessId, who.member.email, entry.entry) });
  });
}
