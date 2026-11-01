import { marketClosed, marketplaceOpen } from "@/lib/domain/design/marketplace-launch";
import { ITEM_STATES, cleanItemInput, cleanMessage, type ItemState } from "@/lib/domain/design/trade";
import { can } from "@/lib/domain/design/account";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { itemDetail, markThreadRead, sendMessage, updateItem } from "@/lib/server/design-trade-repo";
import { allow } from "@/lib/server/rate-limit";

const missing = () => Response.json({ ok: false, message: "That item isn't there any more." }, { status: 404 });

/** GET → { item, conversations }: the item as this business may see it; `?read=<thread>` marks that conversation read. */
export async function GET(request: Request, ctx: RouteContext<"/api/design/trade/[id]">) {
  if (!marketplaceOpen()) return marketClosed();
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const read = new URL(request.url).searchParams.get("read");
    if (read) await markThreadRead(who.member.businessId, read.slice(0, 80));
    const detail = await itemDetail(who.member.businessId, id.slice(0, 80));
    return detail ? Response.json({ ok: true, ...detail }) : missing();
  });
}

/** PUT { item } | { status }: the seller changes its own item, or marks it pending, sold or taken down. */
export async function PUT(request: Request, ctx: RouteContext<"/api/design/trade/[id]">) {
  if (!marketplaceOpen()) return marketClosed();
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const read = await readBody(request, 8_000);
    if ("refuse" in read) return read.refuse;
    const status = ITEM_STATES.find((s) => s === read.body.status) as ItemState | undefined;
    const item = read.body.item ? cleanItemInput(read.body.item) : null;
    if (item && !item.ok) return Response.json(item, { status: 422 });
    if (!status && !item) return Response.json({ ok: false, message: "Nothing to change." }, { status: 400 });
    if (!(await updateItem(who.member.businessId, id.slice(0, 80), { status, item: item?.ok ? item.value : undefined })))
      return Response.json({ ok: false, message: "That item isn't yours." }, { status: 404 });
    const detail = await itemDetail(who.member.businessId, id.slice(0, 80));
    return detail ? Response.json({ ok: true, ...detail }) : missing();
  });
}

/** POST { text, thread? }: a message about the item, to the seller (from a buyer) or to one buyer (from the seller). */
export async function POST(request: Request, ctx: RouteContext<"/api/design/trade/[id]">) {
  if (!marketplaceOpen()) return marketClosed();
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    if (!allow(request, "trade-message", 240))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 6_000);
    if ("refuse" in read) return read.refuse;
    const text = cleanMessage(read.body.text);
    if (!text) return Response.json({ ok: false, message: "Write a message first." }, { status: 422 });
    // Asking about stock is anyone's; replying as the seller speaks for the business, so it needs the publish permission.
    const thread = typeof read.body.thread === "string" ? read.body.thread.slice(0, 80) : null;
    if (thread && !can(who.member.role, "publish", who.member.permissions))
      return Response.json({ ok: false, message: "You don't have access to reply for the business." }, { status: 403 });
    const sent = await sendMessage(who.member, id.slice(0, 80), text, thread);
    if (!sent.ok) return Response.json({ ok: false, message: sent.message }, { status: sent.status });
    const detail = await itemDetail(who.member.businessId, id.slice(0, 80));
    return detail ? Response.json({ ok: true, ...detail }) : missing();
  });
}
