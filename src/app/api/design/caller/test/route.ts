import { query } from "@/lib/server/db";
import { answer, requireMember } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";
import { cleanCallerRole } from "@/lib/domain/install-call";
import { ringToHearVoice } from "@/lib/server/voice-calls";

const WORDS = {
  off: "Calls aren't switched on for your business yet, so there's nothing to ring you with.",
  "no-number": "Add your mobile under Your account first: that's the number we ring.",
  failed: "The call couldn't be placed just now. Try again in a moment.",
} as const;

/** POST: rings the member's own mobile (from their profile, never one sent here) so they hear the assistant's voice. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-caller-test", 6))
      return Response.json({ ok: false, message: "That's a few test calls: try again in a little while." }, { status: 429 });
    const rows = await query<{ mobile: string | null }>(
      `select mobile from business_members where business_id = $1 and lower(email) = lower($2)`,
      [who.member.businessId, who.member.email],
    );
    const result = await ringToHearVoice(
      who.member.businessId,
      rows[0]?.mobile ?? null,
      cleanCallerRole(new URL(request.url).searchParams.get("role")),
    );
    if (result === "placed") return Response.json({ ok: true });
    return Response.json({ ok: false, message: WORDS[result] }, { status: result === "failed" ? 502 : 409 });
  });
}
