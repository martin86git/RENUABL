import { cleanTicket, cleanTicketWords } from "@/lib/domain/design/support";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { listTickets, markTicketSeen, raiseTicket, replyToTicket, setTicketResolved, unreadTickets } from "@/lib/server/design-support";
import { allow } from "@/lib/server/rate-limit";

/** GET → { tickets }: the business's support tickets with RENUABL; `?count=1` → { unread } for the menu's count. */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (new URL(request.url).searchParams.get("count"))
      return Response.json({ ok: true, unread: await unreadTickets(who.member.businessId) });
    return Response.json({ ok: true, tickets: await listTickets(who.member.businessId) });
  });
}

/**
 * POST { do: "raise", subject, area, urgent, text } | { do: "reply", id, text } | { do: "resolve" | "reopen", id } |
 * { do: "seen", id }. Anyone in the business raises, replies and resolves; RENUABL's staff are emailed a new ticket
 * and every reply.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 12_000);
    if ("refuse" in read) return read.refuse;
    const b = read.body;
    const { businessId, email } = who.member;
    const id = typeof b.id === "string" ? b.id.slice(0, 40) : "";
    const missing = () => Response.json({ ok: false, message: "That ticket isn't there any more." }, { status: 404 });
    const writes = b.do === "raise" || b.do === "reply";
    if (writes && !allow(request, "design-support", 20))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    let raised: string | undefined;
    if (b.do === "raise") {
      const ticket = cleanTicket(b);
      if (!ticket.ok) return Response.json(ticket, { status: 422 });
      const made = await raiseTicket(businessId, email, ticket);
      if (made === "full")
        return Response.json(
          { ok: false, message: "Your business has a lot of tickets open. Add to one of them, or mark some resolved first." },
          { status: 409 },
        );
      raised = made.id;
    } else if (b.do === "reply") {
      const text = cleanTicketWords(b.text);
      if (!text) return Response.json({ ok: false, message: "Write your reply first." }, { status: 422 });
      if (!(await replyToTicket(businessId, id, email, text))) return missing();
    } else if (b.do === "resolve" || b.do === "reopen") {
      if (!(await setTicketResolved(businessId, id, b.do === "resolve"))) return missing();
    } else if (b.do === "seen") {
      await markTicketSeen(businessId, id);
    } else return Response.json({ ok: false, message: "That couldn't be read." }, { status: 400 });
    return Response.json({ ok: true, tickets: await listTickets(businessId), ...(raised ? { raised } : {}) });
  });
}
