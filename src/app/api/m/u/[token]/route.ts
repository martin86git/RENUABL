import { dbConfigured } from "@/lib/server/db";
import { unsubscribeByToken } from "@/lib/server/marketing-send";

/**
 * POST unsubscribes the contact behind the link for good: the page's button (a form with from=page) and mail apps'
 * one-click unsubscribe (List-Unsubscribe-Post) alike. Never on a GET, so a link checker can't unsubscribe anyone.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/m/u/[token]">) {
  const { token } = await ctx.params;
  const s = new URL(request.url).searchParams.get("s");
  const form = await request.formData().catch(() => null);
  const ok =
    dbConfigured() && /^[0-9a-f]{40}$/.test(token)
      ? await unsubscribeByToken(token, s && /^[0-9a-f]{40}$/.test(s) ? s : null).catch(() => false)
      : false;
  if (form?.get("from") === "page") return new Response(null, { status: 303, headers: { location: `/m/u/${token}` } });
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
