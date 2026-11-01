import { LOGIN_LINK_MINUTES, signInDelivery } from "@/lib/domain/accounts";
import { designSignInEmail } from "@/lib/domain/emails";
import { siteUrl } from "@/lib/domain/sms";
import { createLoginToken } from "@/lib/server/accounts";
import { recordSubscription } from "@/lib/server/design-billing-repo";
import { dbConfigured, query } from "@/lib/server/db";
import { emailProvider, sendEmail } from "@/lib/server/email";
import { allow } from "@/lib/server/rate-limit";
import { stripeClient, subscriptionFacts } from "@/lib/server/stripe";

/**
 * POST { sessionId }: back from Stripe after signing up. Checks with Stripe that the sign-up went through, keeps the
 * subscription (the webhook may not have arrived yet; keeping it twice changes nothing), and emails the sign-in link to
 * the address the plan is for, so the email is proven before the business is named. A few links an address at most.
 */
export async function POST(request: Request) {
  if (!allow(request, "design-welcome", 30)) return Response.json({ ok: false, message: "Please try again shortly." }, { status: 429 });
  const stripe = stripeClient();
  if (!stripe || !dbConfigured()) return Response.json({ ok: false, message: "Sign-up isn't open just yet." }, { status: 503 });
  let sessionId: unknown;
  try {
    sessionId = ((await request.json()) as { sessionId?: unknown }).sessionId;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) return Response.json({ ok: false }, { status: 400 });

  let email: string | null = null;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    if (session.metadata?.kind !== "design-plan" || session.status !== "complete")
      return Response.json({ ok: false, message: "That sign-up didn't go through. Start again from the pricing." }, { status: 404 });
    email = (session.customer_details?.email ?? session.metadata?.email ?? "").toLowerCase() || null;
    const sub = session.subscription && typeof session.subscription !== "string" ? session.subscription : null;
    if (email && sub) await recordSubscription({ ...subscriptionFacts(sub), email, checkoutSession: session.id });
  } catch (e) {
    console.error("welcome: checkout not read", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, message: "We couldn't check your sign-up just now. Refresh to try again." }, { status: 502 });
  }
  if (!email) return Response.json({ ok: false, message: "Stripe didn't give us an email for this sign-up." }, { status: 422 });

  const delivery = signInDelivery({
    emailReady: Boolean(emailProvider()),
    site: siteUrl(),
    nodeEnv: process.env.NODE_ENV,
    hosted: Boolean(process.env.VERCEL),
    origin: new URL(request.url).origin,
  });
  const recent = await query<{ n: string }>(
    `select count(*) as n from login_tokens where email = $1 and expires_at > now() + interval '15 minutes'`,
    [email],
  );
  if (delivery.by !== "none" && Number(recent[0]?.n ?? 0) < 3) {
    const token = await createLoginToken(email, "business", "/design");
    const link = `${delivery.site}/api/auth/callback?token=${token}&for=design`;
    if (delivery.by === "terminal")
      console.info(`\nSign-in link for ${email} (new plan), printed because no email service is set up:\n  ${link}\n`);
    else await sendEmail({ to: email, ...designSignInEmail({ link, minutes: LOGIN_LINK_MINUTES }) }).catch(() => undefined);
  }
  return Response.json({ ok: true, email });
}
