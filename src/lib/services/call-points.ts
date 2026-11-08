import type { HeardLine } from "@/lib/domain/design/call-notes";

/** What the live points ask came back with: points, or why there are none (and whether asking again is worth it). */
export type PointsAnswer = { ok: true; points: string[] } | { ok: false; message: string; again: boolean };

/**
 * The call note-taker's live points (`/api/design/jobs/[id]/call-notes/points`): what has been heard so far, summed up
 * by Sol into a few short points. `again` is false when Claude isn't set up here, so the bar stops asking for the call.
 */
export async function callPoints(jobId: string, lines: HeardLine[], previous: string[]): Promise<PointsAnswer> {
  try {
    const res = await fetch(`/api/design/jobs/${encodeURIComponent(jobId)}/call-notes/points`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines, previous }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; points?: unknown; message?: string } | null;
    if (res.ok && json?.ok && Array.isArray(json.points))
      return { ok: true, points: json.points.filter((p): p is string => typeof p === "string") };
    return {
      ok: false,
      message: json?.message ?? "Live points couldn't be had just now: showing the words as heard.",
      again: res.status !== 503 && res.status !== 401 && res.status !== 403 && res.status !== 404,
    };
  } catch {
    return { ok: false, message: "Live points couldn't be had just now: showing the words as heard.", again: true };
  }
}
