import { answer, requireMember } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";
import { endPractice, practiceLive, steerPractice } from "@/lib/server/design-practice-call";

/** GET → { ok, call }: the member's own latest practice call, for the live call window. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, call: await practiceLive(who.member.businessId, who.member.email) });
  });
}

/** POST { text, say } → { ok }: the member types to the assistant on their practice call. */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-practice-steer", 60))
      return Response.json({ ok: false, message: "That's a lot of notes at once. Try again in a minute." }, { status: 429 });
    const body = (await request.json().catch(() => null)) as { text?: unknown; say?: unknown } | null;
    const sent = await steerPractice(who.member.businessId, who.member.email, { text: body?.text, say: body?.say === true });
    if (sent === "sent") return Response.json({ ok: true });
    const message =
      sent === "empty"
        ? "Type what to tell them first."
        : sent === "not-on"
          ? "The call isn't on right now."
          : "That didn't reach the call.";
    return Response.json({ ok: false, message }, { status: sent === "failed" ? 502 : 409 });
  });
}

/** DELETE → { ok }: hangs up the member's practice call. */
export async function DELETE(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-practice-end", 30)) return Response.json({ ok: false, message: "Try again in a minute." }, { status: 429 });
    const out = await endPractice(who.member.businessId, who.member.email);
    if (out === "ended") return Response.json({ ok: true });
    return Response.json(
      { ok: false, message: out === "not-on" ? "The call has already ended." : "The call couldn't be ended from here. Try again." },
      { status: out === "failed" ? 502 : 409 },
    );
  });
}
