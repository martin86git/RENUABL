import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { listNotifications, markNotificationsRead, unreadNotifications } from "@/lib/server/design-notifications-repo";

/** GET: the member's own notifications, newest first, and how many are unread; ?count=1 for the count alone. */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { businessId, email } = who.member;
    if (new URL(request.url).searchParams.get("count") === "1")
      return Response.json({ ok: true, unread: await unreadNotifications(businessId, email) });
    const [notifications, unread] = await Promise.all([listNotifications(businessId, email), unreadNotifications(businessId, email)]);
    return Response.json({ ok: true, notifications, unread });
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
    return Response.json({ ok: true });
  });
}
