import { rangeFor } from "@/lib/domain/design/my-calendar";
import { answer, requireMember } from "@/lib/server/design-context";
import { CalendarOff, calendarEvents, connectedCalendar, disconnectCalendar } from "@/lib/server/my-calendar";

const json = (body: object, status = 200) => Response.json(body, { status });
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET ?from=YYYY-MM-DD&to=YYYY-MM-DD: this member's own calendar (Google or Outlook) between those days
 * (domain/design/my-calendar.ts), read only: { connected, provider, address, events }, { connected: false } when none
 * is connected, or { broken } when the provider stopped answering. Never while the owner is viewing as someone else.
 * DELETE: disconnects it.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { member } = who;
    if (member.viewedBy) return json({ ok: true, connected: false, viewing: true, events: [] });
    const url = new URL(request.url);
    const mine = await connectedCalendar(member);
    if (!mine) return json({ ok: true, connected: false, events: [] });
    const { provider, address } = mine;
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!DAY.test(from) || !DAY.test(to) || to < from || Date.parse(to) - Date.parse(from) > 45 * 86_400_000)
      return json({ ok: false, message: "Those days couldn't be read." }, 400);
    const { timeMin, timeMax } = rangeFor(from, to);
    try {
      return json({ ok: true, connected: true, provider, address, events: await calendarEvents(member, timeMin, timeMax) });
    } catch (e) {
      if (e instanceof CalendarOff) return json({ ok: true, connected: true, provider, address, broken: e.message, events: [] });
      throw e;
    }
  });
}

export async function DELETE() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (who.member.viewedBy) return json({ ok: false, message: "Not while viewing as someone else." }, 403);
    await disconnectCalendar(who.member);
    return json({ ok: true });
  });
}
