import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { setWhoopStatus } from "@/lib/server/whoop-repo";

/** POST { reference, status: "shipped" | "delivered" | "released" } (staff): moves a WHOOP claim along, or releases an unshipped one. */
export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ ok: false }, { status: 404 });
  const session = await currentSession();
  if (session?.role !== "staff") return Response.json({ ok: false }, { status: 401 });
  let body: { reference?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const status = body.status;
  if (typeof body.reference !== "string" || (status !== "shipped" && status !== "delivered" && status !== "released")) {
    return Response.json({ ok: false }, { status: 400 });
  }
  const ok = await setWhoopStatus(body.reference, status);
  return ok ? Response.json({ ok: true }) : Response.json({ ok: false, message: "That change isn't possible." }, { status: 409 });
}
