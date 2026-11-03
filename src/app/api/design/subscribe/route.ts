import { normaliseEmail } from "@/lib/domain/accounts";
import { NO_PLAN_FOR_KIND, billsFor, cleanKind } from "@/lib/domain/design/business-kind";
import { ENTERPRISE_FROM, cleanSeats } from "@/lib/domain/design/plans";
import { dbConfigured } from "@/lib/server/db";
import { memberByEmail } from "@/lib/server/design-repo";
import { subscriptionOf } from "@/lib/server/design-billing-repo";
import { allow } from "@/lib/server/rate-limit";
import { createPlanCheckout, stripeClient } from "@/lib/server/stripe";

/**
 * POST { email, seats, interval }: starts a sign-up. Answers with Stripe's own secure page, where the card is taken
 * for the plan, charged there and then; Stripe then sends them back to /design/welcome. Nothing is kept here: the
 * subscription is recorded when Stripe says it was made (the webhook, or the welcome page). An email already in a
 * business that pays no user fee (an installer or inspector, business-kind.ts) is refused: it has no plan to start.
 */
export async function POST(request: Request) {
  if (!allow(request, "design-subscribe", 20))
    return Response.json({ ok: false, message: "Too many tries in the last hour. Please try again shortly." }, { status: 429 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const email = normaliseEmail(body.email);
  if (!email) return Response.json({ ok: false, message: "Enter your work email address." }, { status: 422 });
  const member = dbConfigured() ? await memberByEmail(email).catch(() => null) : null;
  if (member && !billsFor(cleanKind(member.businessKind), "plan"))
    return Response.json({ ok: false, message: NO_PLAN_FOR_KIND }, { status: 409 });
  // A business with a plan already isn't sold a second one (3 Nov 2026, a bug review: both billed, and the older one
  // couldn't be cancelled from Billing): its users and term are changed in Billing.
  const current = member ? await subscriptionOf(member.businessId).catch(() => null) : null;
  if (current && !["canceled", "incomplete_expired"].includes(current.status))
    return Response.json(
      { ok: false, message: "Your business already has a plan. Sign in and open Settings, Billing to change it." },
      { status: 409 },
    );
  const seats = cleanSeats(body.seats ?? 1);
  if (!seats)
    return Response.json({ ok: false, message: `For ${ENTERPRISE_FROM} users or more, talk to us about Enterprise.` }, { status: 422 });
  // Monthly only: yearly is no longer sold (plans.ts); the 12-month plan is chosen in Billing.
  const stripe = stripeClient();
  if (!stripe)
    return Response.json(
      { ok: false, message: "Sign-up isn't open just yet. Leave your details under Enterprise and we'll be in touch." },
      { status: 503 },
    );
  try {
    const url = await createPlanCheckout(stripe, { email, seats, origin: new URL(request.url).origin });
    return Response.json({ ok: true, url });
  } catch (e) {
    console.error("trial checkout failed", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, message: "We couldn't open the payment page just now. Please try again." }, { status: 502 });
  }
}
