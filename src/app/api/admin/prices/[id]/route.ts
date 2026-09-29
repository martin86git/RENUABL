import { currentSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { decidePriceUpload } from "@/lib/server/prices-repo";

/** POST { action: "apply" | "discard" } (staff): applies a pending price upload, or throws it away. */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/prices/[id]">) {
  const { id } = await ctx.params;
  if (!dbConfigured() || !/^pu_[a-f0-9]{24}$/.test(id)) return Response.json({ ok: false }, { status: 404 });
  const session = await currentSession();
  if (session?.role !== "staff") return Response.json({ ok: false }, { status: 401 });
  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (body.action !== "apply" && body.action !== "discard") return Response.json({ ok: false }, { status: 400 });
  const upload = await decidePriceUpload(id, body.action === "apply", session.email);
  if (!upload) return Response.json({ ok: false, message: "That upload has already been dealt with." }, { status: 409 });
  return Response.json({ ok: true, upload });
}
