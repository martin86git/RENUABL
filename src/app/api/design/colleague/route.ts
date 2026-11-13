import { cleanCallerName, cleanVoice, VOICE_BAD } from "@/lib/domain/design/caller";
import { can } from "@/lib/domain/design/account";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { colleagueVoice, isAssistantName, isCustomerVoice, NAME_TAKEN, VOICE_TAKEN } from "@/lib/domain/design/colleague";
import { colleagueOf, colleagueReady, customerSide, hasPin, myColleagueCalls, setColleague } from "@/lib/server/design-colleague";
import { colleagueChatOn } from "@/lib/server/design-colleague-chat";
import { query } from "@/lib/server/db";

/**
 * GET → the team's own assistant (its chief of staff, domain/design/colleague.ts) as this member sees it: its name and
 * voice, whether calls are on, the team line's number, whether they have a PIN and a mobile on their profile, and their
 * own calls with it. Any member.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { businessId, email, role, permissions } = who.member;
    const [settings, side, ready, chatOn, pin, calls, mobile] = await Promise.all([
      colleagueOf(businessId),
      customerSide(businessId),
      colleagueReady(businessId),
      colleagueChatOn(businessId).catch(() => false),
      hasPin(businessId, email),
      myColleagueCalls(businessId, email),
      query<{ mobile: string | null }>(`select mobile from business_members where business_id = $1 and email = $2`, [
        businessId,
        email.toLowerCase(),
      ]),
    ]);
    return Response.json(
      {
        ok: true,
        name: isAssistantName(settings.name, side.names) ? null : settings.name,
        // The voice it speaks in (never one customers hear), and the voices and names it may not take.
        voice: colleagueVoice(settings.voice, side.voices),
        takenVoices: side.voices,
        takenNames: side.names,
        ready,
        // Whether it can be chatted to in writing, and who is asking, for its hello.
        chatOn,
        firstName: who.member.firstName ?? null,
        pinSet: pin,
        hasMobile: Boolean(mobile[0]?.mobile),
        calls,
        mayChange: can(role, "prices", permissions),
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}

/** PUT { name, voice } → its name (said out loud, so letters only; empty for "your chief of staff") and voice. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 4_000);
    if ("refuse" in read) return read.refuse;
    const rawName = typeof read.body.name === "string" ? read.body.name.trim() : "";
    let name: string | null = null;
    if (rawName) {
      const n = cleanCallerName(rawName);
      if (!n.ok) return Response.json({ ok: false, message: n.message }, { status: 400 });
      name = n.value;
    }
    const voice = cleanVoice(read.body.voice);
    if (voice === "bad") return Response.json({ ok: false, message: VOICE_BAD }, { status: 400 });
    const side = await customerSide(who.member.businessId);
    if (isAssistantName(name, side.names)) return Response.json({ ok: false, message: NAME_TAKEN }, { status: 400 });
    if (voice && isCustomerVoice(voice, side.voices)) return Response.json({ ok: false, message: VOICE_TAKEN }, { status: 400 });
    const saved = await setColleague(who.member.businessId, { name, voice }, who.member.email);
    return Response.json({ ok: true, name: saved.name, voice: colleagueVoice(saved.voice, side.voices) });
  });
}
