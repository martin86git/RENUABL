import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadPrefs, savePrefs } from "@/lib/server/design-after-sale-repo";
import { sendingMailboxes } from "@/lib/server/gmail";
import { cleanMailboxChoice } from "@/lib/domain/design/prefs";

const same = (a: { owner: string; address: string } | null, b: { owner: string; address: string } | null) =>
  Boolean(a && b && a.owner === b.owner && a.address === b.address);

/** GET: the business's after-sale settings (suppliers' order addresses, the invoice tolerance, the automations). */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const [prefs, mailboxes] = await Promise.all([loadPrefs(who.member.businessId), sendingMailboxes(who.member.businessId)]);
    // The mailboxes an automated email can go from: their addresses and whose they are (no tokens).
    return Response.json({ ok: true, prefs, mailboxes });
  });
}

/** PUT { prefs }: kept whole, cleaned on the server; for a member who may change prices and settings. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    const body = (read.body.prefs ?? {}) as Record<string, unknown>;
    // The reminder's mailbox must be one of the business's own connected mailboxes; one already chosen is kept even if
    // it has since been disconnected (the reminder then goes from RENUABL's sender until it is connected again).
    const wanted = cleanMailboxChoice(body.reminderFrom);
    if (wanted) {
      const before = (await loadPrefs(who.member.businessId)).reminderFrom;
      const boxes = await sendingMailboxes(who.member.businessId);
      const known = boxes.some((b) => b.owner === wanted.owner && b.address === wanted.address);
      if (!known && !same(before, wanted)) body.reminderFrom = null;
    }
    return Response.json({ ok: true, prefs: await savePrefs(who.member.businessId, body, who.member.email) });
  });
}
