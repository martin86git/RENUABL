import { answer, requireMember } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";
import { OUT_OF_CALL_CREDIT } from "@/lib/domain/call-credit";
import { cleanCallerKey } from "@/lib/domain/install-call";
import { practicePlacedWords } from "@/lib/domain/design/practice-call";
import { cleanCallKind, trainingPlacedWords } from "@/lib/domain/design/training-call";
import { startPracticeCall } from "@/lib/server/design-practice-call";

const WORDS = {
  off: "Calls aren't switched on for RENUABL Business right now, so there's nothing to ring you with. We're on it.",
  addOn:
    "Calls & Texts isn't on your plan yet, so there's nothing to ring you with. Your business's owner adds it in Your agents (the plus on the bar at the right) or Settings → Billing.",
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
    const at = new URL(request.url).searchParams;
    // ?kind=training: the member is the agent's trainer on the call, not a customer (domain/design/training-call.ts).
    const kind = cleanCallKind(at.get("kind"));
    const out = await startPracticeCall(who.member, cleanCallerKey(at.get("role")), kind);
    if (out.result === "placed")
      return Response.json({ ok: true, message: (kind === "training" ? trainingPlacedWords : practicePlacedWords)(out.assistant) });
    if (out.result === "failed" && out.credit) return Response.json({ ok: false, message: OUT_OF_CALL_CREDIT }, { status: 502 });
    const message = out.result === "off" && out.why === "add-on" ? WORDS.addOn : WORDS[out.result];
    return Response.json({ ok: false, message }, { status: out.result === "failed" ? 502 : 409 });
  });
}
