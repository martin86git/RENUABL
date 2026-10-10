import { LOGIN_LINK_MINUTES, normaliseEmail, safeNext, signInDelivery, type AccountRole } from "@/lib/domain/accounts";
import { applicationPendingEmail, designSignInEmail, loginLinkEmail } from "@/lib/domain/emails";
import { siteUrl } from "@/lib/domain/sms";
import { PREVIEW_MODE } from "@/lib/config";
import { createLoginToken, isStaff } from "@/lib/server/accounts";
import { dbConfigured, query } from "@/lib/server/db";
import { emailProvider, sendEmail } from "@/lib/server/email";
import { jobsForCustomer } from "@/lib/server/jobs-repo";
import { partnerByEmail } from "@/lib/server/partners-repo";
import { allow } from "@/lib/server/rate-limit";

/** Sign-in links one visitor may ask for in an hour for the roof designer, where any address gets one. */
const BUSINESS_LINKS_PER_HOUR = 10;
/** The roof designer's answer: every valid address gets a link there, so there is no "if". */
const SENT_BUSINESS = "We've sent a sign-in link to that email. It expires in 30 minutes.";
const SENT = "If there's an account for that email, we've sent a sign-in link. It expires in 30 minutes.";

/**
 * POST { email, as: "customer" | "partner" | "business", next? }: emails a
 * one-time sign-in link. The answer is the same whether or not there's an
 * account, so the form can't be used to find out who has one.
 *
 * "business" is the roof designer (/design): anyone may sign in, and a new
 * email names its business after signing in, so every valid address gets a
 * link. That makes this an open door for sending email, hence its own limit
 * per visitor on top of the limit per address.
 *
 * On a developer's own computer with no email service, the link is printed in
 * the terminal running the site instead (`signInDelivery`).
 */
export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ ok: false, message: "Sign-in isn't available yet." }, { status: 503 });
  let body: { email?: unknown; as?: unknown; next?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const email = normaliseEmail(body.email);
  if (!email) return Response.json({ ok: false, message: "Enter a valid email address." }, { status: 422 });
  const delivery = signInDelivery({
    emailReady: Boolean(emailProvider()),
    site: siteUrl(),
    nodeEnv: process.env.NODE_ENV,
    hosted: Boolean(process.env.VERCEL),
    origin: new URL(request.url).origin,
  });
  if (delivery.by === "none") {
    console.error("sign-in link not sent: email or SITE_URL isn't set up");
    return Response.json({ ok: false, message: "We can't send sign-in emails just now. Please try again later." }, { status: 503 });
  }

  // A few links per email per 15 minutes is plenty.
  const recent = await query<{ n: string }>(
    `select count(*) as n from login_tokens where email = $1 and expires_at > now() + interval '15 minutes'`,
    [email],
  );
  if (Number(recent[0]?.n ?? 0) >= 5) return Response.json({ ok: true, message: body.as === "business" ? SENT_BUSINESS : SENT });

  const forBusiness = body.as === "business";
  if (forBusiness && !allow(request, "design-sign-in", BUSINESS_LINKS_PER_HOUR)) return Response.json({ ok: true, message: SENT_BUSINESS });

  let role: AccountRole | null = null;
  // The roof designer is its own sign-in, for staff addresses too: staff reach /admin by signing in the usual way.
  if (forBusiness) role = "business";
  else if (isStaff(email)) role = "staff";
  else if (body.as === "partner") {
    const partner = await partnerByEmail(email);
    if (partner?.status === "approved") role = "partner";
    else if (partner?.status === "pending") {
      await sendEmail({ to: email, ...applicationPendingEmail() }).catch(() => undefined);
    }
  } else if ((await jobsForCustomer(email)).length > 0) role = "customer";

  // For diagnosing "I didn't get my link" in the Vercel logs. Never the email address itself.
  console.info(
    role
      ? `sign-in link: sending (${role}, chose ${forBusiness ? "business" : body.as === "partner" ? "partner" : "customer"})`
      : `sign-in link: none sent, no ${body.as === "partner" ? "approved partner" : "customer reservation"} or staff entry for that email`,
  );

  if (role) {
    const token = await createLoginToken(email, role, safeNext(body.next, role));
    const link = `${delivery.site}/api/auth/callback?token=${token}${role === "business" ? "&for=design" : ""}`;
    if (delivery.by === "terminal") {
      // Development only: there is no email service on this computer, so the link is shown to the developer here.
      console.info(`\nSign-in link for ${email} (${role}), printed because no email service is set up on this computer:\n  ${link}\n`);
      return Response.json({
        ok: true,
        message: `${role === "business" ? SENT_BUSINESS : SENT} (Development: the link is printed in the terminal running the site.)`,
      });
    }
    try {
      await sendEmail({
        to: email,
        ...(role === "business"
          ? designSignInEmail({ link, minutes: LOGIN_LINK_MINUTES })
          : loginLinkEmail({ link, minutes: LOGIN_LINK_MINUTES, forPartner: role === "partner" })),
      });
      console.info(`sign-in link: handed to the email service (${role})`);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("sign-in email failed", detail);
      // In preview, say why (the email service's own reply; no keys in it), so it can be fixed without digging through logs.
      const message = "We couldn't send the email just now. Please try again.";
      return Response.json(
        { ok: false, message: PREVIEW_MODE ? `${message} (Preview detail: ${detail.slice(0, 200)})` : message },
        { status: 502 },
      );
    }
  }
  return Response.json({ ok: true, message: role === "business" ? SENT_BUSINESS : SENT });
}
