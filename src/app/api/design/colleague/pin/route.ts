import { cleanNewPin } from "@/lib/domain/design/colleague";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { clearPin, setPin } from "@/lib/server/design-colleague";
import { allow } from "@/lib/server/rate-limit";

/** PUT { pin } → sets the member's own PIN for the team line (kept scrambled). Only ever their own. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-colleague-pin", 10))
      return Response.json({ ok: false, message: "Try again in a minute." }, { status: 429 });
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const pin = cleanNewPin(read.body.pin);
    if (!pin.ok) return Response.json({ ok: false, message: pin.message }, { status: 400 });
    await setPin(who.member.businessId, who.member.email, pin.pin);
    return Response.json({ ok: true });
  });
}

/** DELETE → takes the member's PIN away: the team line won't answer them until they set one again. */
export async function DELETE() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    await clearPin(who.member.businessId, who.member.email);
    return Response.json({ ok: true });
  });
}
