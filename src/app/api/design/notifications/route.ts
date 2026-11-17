import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { listNotifications, markNotificationsRead, unreadNotifications } from "@/lib/server/design-notifications-repo";
import { feedNotes, readFeedNotes, unreadFeedNotes } from "@/lib/server/design-feed-social-repo";

/**
 * GET: the member's own notifications, newest first, and how many are unread; ?count=1 for the count alone. Since 17 Nov
 * 2026 the count and the list carry the industry feed's notifications too (`feed`: likes, comments, votes, Sol's answers).
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { businessId, email } = who.member;
    if (new URL(request.url).searchParams.get("count") === "1")
      return Response.json({
        ok: true,
        unread: (await unreadNotifications(businessId, email)) + (await unreadFeedNotes(email).catch(() => 0)),
      });
    const [notifications, unread, feed, feedUnread] = await Promise.all([
      listNotifications(businessId, email),
      unreadNotifications(businessId, email),
      feedNotes(email).catch(() => []),
      unreadFeedNotes(email).catch(() => 0),
    ]);
    return Response.json({ ok: true, notifications, unread: unread + feedUnread, feed });
  });
}

/** PUT { ids } | { jobId } | { all: true }: marks the member's own notifications read. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 10_000);
    if ("refuse" in read) return read.refuse;
    const ids = Array.isArray(read.body.ids)
      ? read.body.ids.filter((i): i is string => typeof i === "string" && /^ntf_[a-f0-9]{8,64}$/.test(i)).slice(0, 200)
      : [];
    const jobId = typeof read.body.jobId === "string" && /^job_[a-f0-9]{8,64}$/.test(read.body.jobId) ? read.body.jobId : undefined;
    await markNotificationsRead(who.member.businessId, who.member.email, { ids, jobId, all: read.body.all === true });
    const feedIds = Array.isArray(read.body.ids)
      ? read.body.ids.filter((i): i is string => typeof i === "string" && /^fnt_[a-f0-9]{16}$/.test(i)).slice(0, 100)
      : [];
    if (read.body.all === true || feedIds.length) await readFeedNotes(who.member.email, { ids: feedIds, all: read.body.all === true });
    return Response.json({ ok: true });
  });
}
