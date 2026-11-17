import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { feedNotes, readFeedNotes, unreadFeedNotes } from "@/lib/server/design-feed-social-repo";

/** GET → { notes, unread }: the member's own notifications from the industry feed (feed-social.ts); ?count=1 the count alone. */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const email = who.member.email;
    if (new URL(request.url).searchParams.get("count") === "1") return Response.json({ ok: true, unread: await unreadFeedNotes(email) });
    const [notes, unread] = await Promise.all([feedNotes(email), unreadFeedNotes(email)]);
    return Response.json({ ok: true, notes, unread });
  });
}

/** PUT { ids } | { all: true }: marks the member's own feed notifications read. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (who.member.viewedBy) return Response.json({ ok: true });
    const read = await readBody(request, 10_000);
    if ("refuse" in read) return read.refuse;
    const ids = Array.isArray(read.body.ids)
      ? read.body.ids.filter((i): i is string => typeof i === "string" && /^fnt_[a-f0-9]{16}$/.test(i)).slice(0, 100)
      : [];
    await readFeedNotes(who.member.email, { ids, all: read.body.all === true });
    return Response.json({ ok: true });
  });
}
