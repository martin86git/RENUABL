import { isBriefKey } from "@/lib/domain/brief";
import { getBrief, saveBriefProgress } from "@/lib/server/briefs-repo";
import { dbConfigured } from "@/lib/server/db";
import { allow } from "@/lib/server/rate-limit";

const noStore = { "cache-control": "no-store" };

/** POST { answers, summary? }: saves the lead's progress on their private brief (the key is the secret). */
export async function POST(request: Request, ctx: RouteContext<"/api/brief/[key]">) {
  const { key } = await ctx.params;
  if (!isBriefKey(key) || !dbConfigured()) return Response.json({ ok: false }, { status: 404 });
  if (!allow(request, "brief-save", 600)) return Response.json({ ok: false }, { status: 429 });
  let b: { answers?: unknown; summary?: unknown };
  try {
    b = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const saved = await saveBriefProgress(key, b.answers, b.summary);
  return Response.json({ ok: saved }, { status: saved ? 200 : 404, headers: noStore });
}

/** GET: the brief's saved answers (for picking up where they left off). */
export async function GET(request: Request, ctx: RouteContext<"/api/brief/[key]">) {
  const { key } = await ctx.params;
  if (!isBriefKey(key) || !dbConfigured()) return Response.json({ ok: false }, { status: 404 });
  if (!allow(request, "brief-read", 300)) return Response.json({ ok: false }, { status: 429 });
  const brief = await getBrief(key);
  if (!brief) return Response.json({ ok: false }, { status: 404 });
  return Response.json({ ok: true, firstName: brief.first_name, answers: brief.answers, status: brief.status }, { headers: noStore });
}
