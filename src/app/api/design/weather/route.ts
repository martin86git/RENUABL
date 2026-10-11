import { LAUNCH_MARKET } from "@/lib/domain/market";
import { answer, requireMember } from "@/lib/server/design-context";
import { currentTemperature } from "@/lib/server/google-weather";

/**
 * GET: the temperature now, for the corner of a business's screens. A
 * business has no place of its own yet, so it is the market's capital, and
 * the answer says where. `degrees` is null when it can't be had.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { lat, lng } = LAUNCH_MARKET.capitalPlace;
    return Response.json({ ok: true, place: LAUNCH_MARKET.capital, degrees: await currentTemperature(lat, lng) });
  });
}
