import { after } from "next/server";
import { cleanAgentSettings } from "@/lib/domain/design/sol-agents";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { closePrepared, draftPending, preparedById } from "@/lib/server/design-prepared";
import { agentSettings, changeOutboxItem, fireDue, outbox, saveAgentSettings, sendOutboxItem } from "@/lib/server/design-sol-agents";
import { emailProvider } from "@/lib/server/email";
import { allow } from "@/lib/server/rate-limit";

const validId = (id: unknown): id is string => typeof id === "string" && /^prep_[a-f0-9]{8,40}$/.test(id);
const fail = (message: string, status: number) => Response.json({ ok: false, message }, { status });

/**
 * GET: Sol's sales agents (domain/design/sol-agents.ts), the outbox on the deals this member may see: each email with
 * its stage and when it goes, the conversations waiting on a person, what Sol sent this week, and the settings. Reading
 * it is also when Sol sends what is due (after the answer has gone back), so emails go while the team has RENUABL open.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const readOnly = Boolean(who.member.viewedBy);
    const { outbox: box, pending } = await outbox(who.member, viewerOf(who.member), readOnly);
    const business = { id: who.member.businessId, name: who.member.businessName };
    after(async () => {
      if (pending.length) await draftPending(business.id, pending, allow(request, "design-prepared-draft", 30));
      if (!readOnly) await fireDue(business).catch((e) => console.error("Sol's outbox couldn't send", e instanceof Error ? e.message : e));
    });
    return Response.json({ ok: true, ...box, owner: who.member.role === "owner" });
  });
}

/**
 * PUT { settings }: the send windows and pauses (anyone who may publish), and whether Sol sends on his own (the owner
 * only: it decides what goes to customers in the business's name).
 */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const asked = cleanAgentSettings(read.body.settings);
    const now = await agentSettings(who.member.businessId);
    if (asked.sending !== now.sending && who.member.role !== "owner")
      return fail("Only the business's owner can let Sol send on his own.", 403);
    const settings = await saveAgentSettings(who.member.businessId, asked, who.member.email);
    return Response.json({ ok: true, settings });
  });
}

/**
 * POST { id, do }: one email in the outbox. "send" sends it now as written (the member's press, replies to them);
 * "hold" keeps Sol from sending it, "release" lets him again; "edit" with { subject, body } changes its words; "skip"
 * takes it off. Only the business's own, still waiting.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    const { id, do: act, subject, body } = read.body;
    if (!validId(id)) return fail("That couldn't be done. Try again.", 422);
    const businessId = who.member.businessId;
    const item = await preparedById(businessId, id);
    if (!item) return fail("It's no longer waiting.", 404);
    if (act === "send") {
      if (!emailProvider()) return fail("Email isn't set up on this site yet, so it can't be sent from here.", 503);
      if (!allow(request, "design-deal-email", 30)) return fail("That's a lot of emails at once. Try again in a minute.", 429);
      const done = await sendOutboxItem({ id: businessId, name: who.member.businessName }, id, who.member.email, who.member.email);
      if (done === "sent") return Response.json({ ok: true, message: `Sent to ${item.to}.` });
      if (done === "no-email") return fail("There's no email for this customer. Add one on their record.", 422);
      if (done === "gone") return fail("It's still being written. Try again in a moment.", 409);
      return fail("It couldn't be sent just now. It's held for you to try again.", 503);
    }
    if (act === "hold" || act === "release") {
      await changeOutboxItem(businessId, id, { held: act === "hold" });
      return Response.json({ ok: true });
    }
    if (act === "edit") {
      const s =
        typeof subject === "string"
          ? subject
              .replace(/[\r\n]+/g, " ")
              .trim()
              .slice(0, 200)
          : "";
      const b = typeof body === "string" ? body.trim().slice(0, 10_000) : "";
      if (!s || !b) return fail("Add a subject and some words.", 422);
      await changeOutboxItem(businessId, id, { subject: s, body: b });
      return Response.json({ ok: true });
    }
    if (act === "skip") {
      await closePrepared(businessId, id, "dismissed", who.member.email);
      return Response.json({ ok: true });
    }
    return fail("That couldn't be done. Try again.", 422);
  });
}
