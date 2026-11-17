/**
 * The meeting cards Sol puts up (domain/design/sol-meeting.ts), as the screens ask for them: read one, book it, leave
 * it, or set a reminder before it.
 */
import type { MeetingView } from "@/lib/domain/design/sol-meeting";

type Answer = { ok: true; meeting: MeetingView; mine: boolean } | { ok: false; message: string };
const UNREACHABLE = "We couldn't reach the server just now. Try again in a moment.";

async function ask(id: string, body?: unknown): Promise<Answer> {
  try {
    const res = await fetch(`/api/design/meetings/${encodeURIComponent(id)}`, {
      method: body === undefined ? "GET" : "POST",
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as (Record<string, unknown> & { ok?: boolean; message?: string }) | null;
    if (res.ok && json?.ok) return json as Answer;
    return { ok: false, message: json?.message ?? UNREACHABLE };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

export const loadMeeting = (id: string) => ask(id);
export const bookMeetingAt = (id: string, day: string, time: string) => ask(id, { do: "book", day, time });
export const leaveMeeting = (id: string) => ask(id, { do: "drop" });
export const remindMeBefore = (id: string, minutes: number) => ask(id, { do: "remind", minutes });
