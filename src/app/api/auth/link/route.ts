import { LOGIN_LINK_MINUTES, normaliseEmail, safeNext, type AccountRole } from "@/lib/domain/accounts";
import { applicationPendingEmail, loginLinkEmail } from "@/lib/domain/emails";
import { siteUrl } from "@/lib/domain/sms";
import { createLoginToken, isStaff } from "@/lib/server/accounts";
import { dbConfigured, query } from "@/lib/server/db";
import { emailProvider, sendEmail } from "@/lib/server/email";
import { jobsForCustomer } from "@/lib/server/jobs-repo";
import { partnerByEmail } from "@/lib/server/partners-repo";

const SENT = "If there's an account for that email, we've sent a sign-in link. It expires in 30 minutes.";

/**
 * POST { email, as: "customer" | "partner", next? }: emails a one-time sign-in
 * link. The answer is the same whether or not there's an account, so the form
 * can't be used to find out who has one.
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
  const site = siteUrl();
  if (!site || !emailProvider()) {
    console.error("sign-in link not sent: email or SITE_URL isn't set up");
    return Response.json({ ok: false, message: "We can't send sign-in emails just now. Please try again later." }, { status: 503 });
  }

  // A few links per email per 15 minutes is plenty.
  const recent = await query<{ n: string }>(
    `select count(*) as n from login_tokens where email = $1 and expires_at > now() + interval '15 minutes'`,
    [email],
  );
  if (Number(recent[0]?.n ?? 0) >= 5) return Response.json({ ok: true, message: SENT });

  let role: AccountRole | null = null;
  if (isStaff(email)) role = "staff";
  else if (body.as === "partner") {
    const partner = await partnerByEmail(email);
    if (partner?.status === "approved") role = "partner";
    else if (partner?.status === "pending") {
      await sendEmail({ to: email, ...applicationPendingEmail() }).catch(() => undefined);
    }
  } else if ((await jobsForCustomer(email)).length > 0) role = "customer";

  if (role) {
    const token = await createLoginToken(email, role, safeNext(body.next, role));
    try {
      await sendEmail({
        to: email,
        ...loginLinkEmail({
          link: `${site}/api/auth/callback?token=${token}`,
          minutes: LOGIN_LINK_MINUTES,
          forPartner: role === "partner",
        }),
      });
    } catch (e) {
      console.error("sign-in email failed", e instanceof Error ? e.message : e);
      return Response.json({ ok: false, message: "We couldn't send the email just now. Please try again." }, { status: 502 });
    }
  }
  return Response.json({ ok: true, message: SENT });
}
