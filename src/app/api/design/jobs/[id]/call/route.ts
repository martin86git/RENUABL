import { gateOf } from "@/lib/domain/design/approvals";
import { PRE_INSTALL_STAGES } from "@/lib/domain/design/crm";
import { INSTALL_REFUSAL_WORDS, cleanCallerKey, installCallRefusal, roleOfKey } from "@/lib/domain/install-call";
import { answer, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { query } from "@/lib/server/db";
import { callerOf } from "@/lib/server/design-caller-repo";
import { cleanTeamAsk } from "@/lib/domain/voice-agent";
import { queueCall } from "@/lib/server/voice-calls";
import { saidNoToCalls } from "@/lib/server/design-call-consent";
import { allow } from "@/lib/server/rate-limit";

const validId = (id: string) => /^job_[a-f0-9]{8,64}$/.test(id);

/** What to tell the member, in the assistant's own name. */
const words = (name: string): Record<string, string> => ({
  off: "Calls from your phone assistant aren't switched on for your business yet. Call them yourself for now.",
  missing: "That deal isn't here.",
  "no-number": `There's no mobile on this customer's record for ${name} to call.`,
  already: `${name} already has a call lined up for this deal.`,
  failed: `${name} couldn't line up the call just now. Try again in a moment.`,
});

/**
 * POST → { message }: one of the business's phone assistants rings the deal's customer (voice-calls.ts), chosen from
 * Call on the deal or a card on Today. The number is always the one on the customer's record; calls start only in
 * calling hours, and only where calling is on for the business.
 *
 * `{ book: true }` hands it to the **admin** assistant to book the installation (domain/install-call.ts): only for a
 * deal that is sold, through its approvals and has no install date, and only once the admin assistant is set up. The
 * day the customer picks is pencilled in on the install calendar; the deal's install date is the team's to set.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/call">) {
  return answer(async () => {
    const { id } = await ctx.params;
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-feed-call", 20))
      return Response.json({ ok: false, message: "That's a lot of calls at once. Try again later." }, { status: 429 });
    const body = (await request.json().catch(() => null)) as { book?: unknown; ask?: unknown; agent?: unknown } | null;
    const book = body?.book === true;
    // A call back to ask or confirm one thing (the finished call's window): the words go to the assistant as data.
    const ask = book ? null : cleanTeamAsk(body?.ask);
    if (body?.ask !== undefined && !book && !ask)
      return Response.json({ ok: false, message: "Say what to ask or confirm on the call back." }, { status: 400 });
    const found = validId(id) ? await jobById(who.member.businessId, id, viewerOf(who.member)) : null;
    // `{ agent }`: which sales agent it is handed to (its key), when the business has more than one.
    const asked = cleanCallerKey(body?.agent);
    const agent = !book && roleOfKey(asked) === "sales" ? asked : "sales";
    const caller = await callerOf(who.member.businessId, book ? "admin" : agent);
    const WORDS = words(caller.name);
    if (!found) return Response.json({ ok: false, message: WORDS.missing }, { status: 404 });

    if (!book && agent !== "sales" && !caller.named)
      return Response.json({ ok: false, message: "That agent isn't here any more." }, { status: 404 });
    if (book) {
      if (!caller.named)
        return Response.json(
          { ok: false, message: "Your post-sale assistant isn't set up yet. Give it a name in Settings, under Phone assistants." },
          { status: 409 },
        );
      const refusal = installCallRefusal({
        sold: PRE_INSTALL_STAGES.includes(found.job.stage),
        installDate: found.job.installDate ?? null,
        gate: gateOf(found.job),
      });
      if (refusal) return Response.json({ ok: false, message: INSTALL_REFUSAL_WORDS[refusal] }, { status: 422 });
    }

    // They said no by email to a call from the assistant (domain/design/call-consent.ts): it doesn't ring them.
    if (!book && (await saidNoToCalls(who.member.businessId, id).catch(() => false)))
      return Response.json(
        { ok: false, message: `They said no to a call from ${caller.name}. Call them yourself or follow up another way.` },
        { status: 409 },
      );

    const out = book
      ? []
      : await query<{ n: number }>(
          `select count(*)::int as n from design_proposals where business_id = $1 and job_id = $2 and withdrawn_at is null`,
          [who.member.businessId, id],
        );
    const placed = await queueCall({
      businessId: who.member.businessId,
      jobId: id,
      mode: book ? "install" : out[0]?.n ? "proposal" : "lead",
      asked: false,
      source: book ? undefined : "Asked for by the team",
      ...(book ? {} : { agent }),
      ...(ask ? { teamAsk: { text: ask, by: who.member.email.split("@")[0] } } : {}),
    });
    if (placed.result === "placed")
      return Response.json({
        ok: true,
        message: book
          ? `${caller.name} will call ${placed.when} to book the installation.`
          : ask
            ? `${caller.name} will call back ${placed.when} to ask.`
            : `${caller.name} will call ${placed.when}.`,
      });
    // A call already lined up: the window opens on it rather than failing.
    if (placed.result === "already") return Response.json({ ok: true, already: true, message: WORDS.already });
    return Response.json({ ok: false, message: WORDS[placed.result] }, { status: placed.result === "off" ? 409 : 422 });
  });
}
