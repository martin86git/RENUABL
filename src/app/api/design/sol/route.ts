import { cleanSolInput, WHEN_LABELS, type WhenChoice, withPin } from "@/lib/domain/design/sol";
import { parseApiKey } from "@/lib/server/bill-reader";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { askSol, chooseReminderTime } from "@/lib/server/design-sol";
import { clearSol, markSolSeen, solState, withSol } from "@/lib/server/design-sol-repo";
import { allow } from "@/lib/server/rate-limit";

/**
 * Sol, the member's own conversation (domain/design/sol.ts). GET → { state }, saying any reminder now due first (the
 * rail asks every minute for its count). POST { do } → { state }: "chat" { text, files } asks Sol; "seen" marks the
 * conversation seen; "clear" clears it (preferences and reminders stay); "remind" { id, when } sets a reminder's time
 * from the card; "forget-reminder" { id } and "forget-pref" { id } take one off. Each member reads and changes only
 * their own.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, state: await solState(who.member.businessId, who.member.email) });
  });
}

export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 6_000_000);
    if ("refuse" in read) return read.refuse;
    const { businessId, email } = who.member;
    const body = read.body;
    const id = typeof body.id === "string" ? body.id.slice(0, 40) : "";
    const ok = (state: unknown) => Response.json({ ok: true, state });
    switch (body.do) {
      case "chat": {
        const said = cleanSolInput(body);
        if (!said) return Response.json({ ok: false, message: "Say something to Sol, or attach a smaller file." }, { status: 422 });
        if (!allow(request, "design-sol", 120))
          return Response.json({ ok: false, message: "That's a lot of questions this hour: try again shortly." }, { status: 429 });
        return ok(await askSol(who.member, said, parseApiKey(process.env.ANTHROPIC_API_KEY)));
      }
      case "seen":
        return ok(await markSolSeen(businessId, email));
      case "clear":
        return ok(await clearSol(businessId, email));
      case "remind": {
        const when = body.when as WhenChoice;
        if (!(when in WHEN_LABELS)) return Response.json({ ok: false, message: "Choose a time." }, { status: 422 });
        const state = await chooseReminderTime(who.member, id, when);
        return state
          ? ok(state)
          : Response.json({ ok: false, message: "That reminder has gone, or that time has passed." }, { status: 404 });
      }
      case "forget-reminder":
        return ok(await withSol(businessId, email, (row) => ({ ...row, reminders: row.reminders.filter((r) => r.id !== id) })));
      case "pin": {
        // A message pinned or unpinned, found by when it was said and by whom.
        const at = typeof body.at === "string" ? body.at.slice(0, 40) : "";
        const role = body.role === "you" ? "you" : "sol";
        return ok(await withSol(businessId, email, (row) => ({ ...row, turns: withPin(row.turns, at, role, body.pinned !== false) })));
      }
      case "forget-pref":
        return ok(await withSol(businessId, email, (row) => ({ ...row, prefs: row.prefs.filter((p) => p.id !== id) })));
      default:
        return Response.json({ ok: false, message: "Unknown request." }, { status: 400 });
    }
  });
}
