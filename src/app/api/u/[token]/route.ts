import { isUnsubToken } from "@/lib/domain/design/customers";
import { unsubscribe } from "@/lib/server/design-people-repo";

/** POST from the unsubscribe page's button: stops group emails for the person whose link it is, then shows the page again. */
export async function POST(request: Request, ctx: RouteContext<"/api/u/[token]">) {
  const { token } = await ctx.params;
  if (isUnsubToken(token)) await unsubscribe(token).catch(() => false);
  return Response.redirect(new URL(`/u/${token}`, request.url), 303);
}
