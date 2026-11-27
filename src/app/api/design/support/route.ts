import { cleanTicket, cleanTicketWords, SUPPORT_LIMITS, ticketPicturesProblem } from "@/lib/domain/design/support";
import { answer, requireMember } from "@/lib/server/design-context";
import { safeImage } from "@/lib/server/design-images";
import {
  listTickets,
  markTicketSeen,
  raiseTicket,
  replyToTicket,
  setTicketResolved,
  unreadTickets,
  type TicketPicture,
} from "@/lib/server/design-support";
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

const bad = (message: string, status = 400) => Response.json({ ok: false, message }, { status });

/** What was sent, as JSON or as a form carrying pictures (`file`, up to `SUPPORT_LIMITS.pictures`). */
async function readSent(request: Request): Promise<{ body: Record<string, unknown>; files: File[] } | Response> {
  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return bad("That couldn't be read.");
    const body: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) if (typeof v === "string") body[k] = k === "urgent" ? v === "1" : v;
    const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    return { body, files };
  }
  const text = await request.text().catch(() => "");
  if (text.length > 12_000) return bad("That is too large to save.", 413);
  try {
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    return { body: body as Record<string, unknown>, files: [] };
  } catch {
    return bad("That couldn't be read.");
  }
}

/** Each picture checked by its own bytes and drawn again (nothing but the picture is kept), or why not. */
async function safePictures(files: File[]): Promise<TicketPicture[] | Response> {
  const problem = ticketPicturesProblem(files);
  if (problem) return bad(problem, 422);
  const kept: TicketPicture[] = [];
  for (const f of files.slice(0, SUPPORT_LIMITS.pictures)) {
    const safe = await safeImage(new Uint8Array(await f.arrayBuffer()), "photo");
    if ("problem" in safe) return bad(safe.problem, 422);
    kept.push({ bytes: safe.bytes, contentType: safe.contentType });
  }
  return kept;
}

/**
 * POST { do: "raise", subject, area, urgent, text } | { do: "reply", id, text } | { do: "resolve" | "reopen", id } |
 * { do: "seen", id }, as JSON, or as a form when a raise or reply carries pictures. Anyone in the business raises,
 * replies and resolves; RENUABL's staff are emailed a new ticket and every reply.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const sent = await readSent(request);
    if (sent instanceof Response) return sent;
    const b = sent.body;
    const { businessId, email } = who.member;
    const id = typeof b.id === "string" ? b.id.slice(0, 40) : "";
    const missing = () => bad("That ticket isn't there any more.", 404);
    const writes = b.do === "raise" || b.do === "reply";
    if (writes && !allow(request, "design-support", 20)) return bad("Try again in a little while.", 429);
    let raised: string | undefined;
    if (b.do === "raise") {
      const ticket = cleanTicket(b);
      if (!ticket.ok) return Response.json(ticket, { status: 422 });
      const pictures = await safePictures(sent.files);
      if (pictures instanceof Response) return pictures;
      const made = await raiseTicket(businessId, email, ticket, pictures);
      if (made === "full") return bad("Your business has a lot of tickets open. Add to one of them, or mark some resolved first.", 409);
      raised = made.id;
    } else if (b.do === "reply") {
      const pictures = await safePictures(sent.files);
      if (pictures instanceof Response) return pictures;
      // A picture alone is a reply too.
      const text = cleanTicketWords(b.text) || (pictures.length ? "(See the picture.)" : "");
      if (!text) return bad("Write your reply first.", 422);
      if (!(await replyToTicket(businessId, id, email, text, pictures))) return missing();
    } else if (b.do === "resolve" || b.do === "reopen") {
      if (!(await setTicketResolved(businessId, id, b.do === "resolve"))) return missing();
    } else if (b.do === "seen") {
      await markTicketSeen(businessId, id);
    } else return bad("That couldn't be read.");
    return Response.json({ ok: true, tickets: await listTickets(businessId), ...(raised ? { raised } : {}) });
  });
}
