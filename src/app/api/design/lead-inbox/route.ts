import { cleanLeadInboxInput } from "@/lib/domain/design/lead-inbox";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { businessMailboxes, leadInboxOf, recentLeadEmails, saveLeadInbox, syncLeadInbox } from "@/lib/server/design-lead-inbox";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 120;

/**
 * The lead inbox (Settings → CRM → Lead inbox, domain/design/lead-inbox.ts), for a member who may change settings.
 * GET: { settings, mailboxes (every connected one in the business, with whose), recent, lastRunAt, lastRun }.
 * POST { do: "save", on, owner, address, label }: keeps the setting.
 * POST { do: "check" }: checks the mailbox now, as the ten-minute cron does.
 * Never from a demo (demo.ts) or while viewing as someone.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const id = who.member.businessId;
    const [state, mailboxes, recent] = await Promise.all([leadInboxOf(id), businessMailboxes(id), recentLeadEmails(id)]);
    return Response.json({ ok: true, ...state, mailboxes, recent });
  });
}

export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const { member } = who;
    if (member.viewedBy)
      return Response.json({ ok: false, message: "You're viewing as someone else: nothing is changed." }, { status: 403 });
    const read = await readBody(request, 4_000);
    if ("refuse" in read) return read.refuse;
    if (read.body.do === "save") {
      if (!allow(request, "lead-inbox-save", 120))
        return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
      const saved = await saveLeadInbox(member.businessId, cleanLeadInboxInput(read.body), member.email);
      if (!saved.ok) return Response.json(saved, { status: 422 });
      return Response.json({ ok: true, ...(await leadInboxOf(member.businessId)) });
    }
    if (read.body.do === "check") {
      if (!allow(request, "lead-inbox-check", 30))
        return Response.json({ ok: false, message: "Checked a lot just now. Try again shortly." }, { status: 429 });
      const run = await syncLeadInbox(member.businessId);
      return Response.json({ ok: true, run, recent: await recentLeadEmails(member.businessId) });
    }
    return Response.json({ ok: false, message: "Say what to do." }, { status: 400 });
  });
}
