import { answer, requireMember } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";
import { cleanCallerKey } from "@/lib/domain/install-call";
import { practicePlacedWords } from "@/lib/domain/design/practice-call";
import { startPracticeCall } from "@/lib/server/design-practice-call";

const WORDS = {
  off: "Calls aren't switched on for your business yet, so there's nothing to ring you with.",
  "no-number": "Add your mobile under Your account first: that's the number we ring.",
  failed: "The call couldn't be placed just now. Try again in a moment.",
} as const;

/**
 * POST → { ok, message }: a practice call (domain/design/practice-call.ts). The assistant rings the member's own mobile
 * (from their profile, never one sent here) and talks to them as a customer; nothing reaches a deal.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-caller-test", 6))
      return Response.json({ ok: false, message: "That's a few practice calls: try again in a little while." }, { status: 429 });
    const out = await startPracticeCall(who.member, cleanCallerKey(new URL(request.url).searchParams.get("role")));
    if (out.result === "placed") return Response.json({ ok: true, message: practicePlacedWords(out.assistant) });
    return Response.json({ ok: false, message: WORDS[out.result] }, { status: out.result === "failed" ? 502 : 409 });
  });
}
