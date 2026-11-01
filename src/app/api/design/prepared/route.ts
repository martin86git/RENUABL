import { after } from "next/server";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { closePrepared, draftPending, preparedById, readyFor } from "@/lib/server/design-prepared";
import { allow } from "@/lib/server/rate-limit";

const validId = (id: unknown): id is string => typeof id === "string" && /^prep_[a-f0-9]{8,40}$/.test(id);

/**
 * GET: Ready for you (domain/design/prepared.ts), the work Sol prepared on the deals this member may see. Follow-ups
 * that have fallen due since it was last read are started here and written by Sol after the answer has gone back
 * (`preparing` until then; the tray asks again). Past `allow`'s limit they are kept in their plain words.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { items, pending } = await readyFor(who.member, viewerOf(who.member));
    if (pending.length) {
      const sol = allow(request, "design-prepared-draft", 30);
      after(() => draftPending(who.member.businessId, pending, sol));
    }
    return Response.json({ ok: true, items });
  });
}

/**
 * POST { id, do: "sent" | "dismiss" }: an item leaves the tray, sent by the member (the email itself goes from the
 * deal's own email, by their press) or put aside. Only the business's own, still waiting.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const { id, do: act } = read.body;
    if (!validId(id) || (act !== "sent" && act !== "dismiss"))
      return Response.json({ ok: false, message: "That couldn't be done. Try again." }, { status: 422 });
    const item = await preparedById(who.member.businessId, id);
    if (!item) return Response.json({ ok: false, message: "It's no longer waiting." }, { status: 404 });
    await closePrepared(who.member.businessId, id, act === "sent" ? "sent" : "dismissed", who.member.email);
    return Response.json({ ok: true });
  });
}
