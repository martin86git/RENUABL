import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { setQuoteStatus } from "@/lib/server/home-health-repo";

/** POST { id, status: "contacted" | "quoted" } (staff): tracks follow-up on a healthy home quote request. */
export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ ok: false }, { status: 404 });
  const session = await currentSession();
  if (session?.role !== "staff") return Response.json({ ok: false }, { status: 401 });
  let body: { id?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (typeof body.id !== "string" || (body.status !== "contacted" && body.status !== "quoted")) {
    return Response.json({ ok: false }, { status: 400 });
  }
  return Response.json({ ok: await setQuoteStatus(body.id, body.status) });
}
