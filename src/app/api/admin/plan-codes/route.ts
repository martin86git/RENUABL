import { cleanCodeLength, cleanPlanCode, PLAN_CODE_LIMITS, PLAN_CODE_WORDS } from "@/lib/domain/design/plan-codes";
import { currentSession } from "@/lib/server/accounts";
import { stripeClient } from "@/lib/server/stripe";
import { makePlanCode, stopPlanCode } from "@/lib/server/stripe-plan-codes";

/**
 * POST (staff) { do: "make", code, length, uses? } → a code for the plan (domain/design/plan-codes.ts) made in Stripe:
 * the plan free for a month, a few months or for good. { do: "stop", id } → no one new can use it.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (session?.role !== "staff") return Response.json({ ok: false }, { status: 401 });
  const stripe = stripeClient();
  if (!stripe) return Response.json({ ok: false, message: "Stripe isn't set up here." }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (body.do === "stop") {
    const id = typeof body.id === "string" && /^promo_[A-Za-z0-9]+$/.test(body.id) ? body.id : null;
    if (!id) return Response.json({ ok: false }, { status: 400 });
    await stopPlanCode(stripe, id);
    return Response.json({ ok: true });
  }
  const code = cleanPlanCode(body.code);
  if (!code) return Response.json({ ok: false, message: PLAN_CODE_WORDS.badCode }, { status: 422 });
  const length = cleanCodeLength(body.length);
  if (!length) return Response.json({ ok: false, message: "Choose how long it's free for." }, { status: 422 });
  const uses = Number(body.uses);
  const limit = Number.isInteger(uses) && uses > 0 && uses <= PLAN_CODE_LIMITS.uses ? uses : null;
  try {
    await makePlanCode(stripe, { code, length, uses: limit, by: session.email });
    return Response.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error && /already exists|in use/i.test(e.message) ? "That code is already in use." : "Stripe didn't make the code.";
    return Response.json({ ok: false, message }, { status: 422 });
  }
}
