import { isMeetingId, MEETING_REMINDERS } from "@/lib/domain/design/sol-meeting";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { bookProposed, dropMeeting, meetingFor, remindBefore } from "@/lib/server/design-meetings";
import { allow } from "@/lib/server/rate-limit";

const gone = () => Response.json({ ok: false, message: "That meeting isn't here." }, { status: 404 });

/**
 * A meeting Sol put to a member as a card (sol-meeting.ts). GET → the card. POST { do: "book", day, time, minutes? }
 * books it in the member's own Google Calendar; { do: "drop" } leaves it unbooked; { do: "remind", minutes } sets a
 * reminder that many minutes before. Only the member whose calendar it goes in may change it; never while viewing as
 * someone else.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/meetings/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!isMeetingId(id)) return gone();
    const meeting = await meetingFor(who.member.businessId, id, viewerOf(who.member));
    return meeting ? Response.json({ ok: true, meeting, mine: meeting.forEmail === who.member.email.toLowerCase() }) : gone();
  });
}

export async function POST(request: Request, ctx: RouteContext<"/api/design/meetings/[id]">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!isMeetingId(id)) return gone();
    const m = who.member;
    if (m.viewedBy) return Response.json({ ok: false, message: "Not while viewing as someone else." }, { status: 403 });
    if (!allow(request, "design-meetings", 30))
      return Response.json({ ok: false, message: "That's a lot of meetings for one hour. Try again later." }, { status: 429 });
    if (!(await meetingFor(m.businessId, id, viewerOf(m)))) return gone();
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const body = read.body;
    const me = { businessId: m.businessId, email: m.email };
    const got =
      body?.do === "book"
        ? await bookProposed(me, id, {
            day: typeof body.day === "string" ? body.day : "",
            time: typeof body.time === "string" ? body.time : "",
            minutes: typeof body.minutes === "number" ? body.minutes : undefined,
          })
        : body?.do === "drop"
          ? await dropMeeting(me, id)
          : body?.do === "remind" && MEETING_REMINDERS.some((x) => x === body.minutes)
            ? await remindBefore(me, id, body.minutes as number)
            : ({ ok: false, message: "Say what to do.", status: 400 } as const);
    return got.ok
      ? Response.json({ ok: true, meeting: got.meeting, mine: true })
      : Response.json({ ok: false, message: got.message }, { status: got.status });
  });
}
