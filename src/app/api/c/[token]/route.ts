import { isConsentToken, readConsentAnswer } from "@/lib/domain/design/call-consent";
import { answerConsent } from "@/lib/server/design-call-consent";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST from the customer's Yes / No page (`/c/<token>`, a form, so it works without script): keeps their answer once,
 * then shows the page again. A Yes lines up the business's phone assistant's call (design-call-consent.ts).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/c/[token]">) {
  const { token } = await ctx.params;
  const form = await request.formData().catch(() => null);
  const answer = readConsentAnswer(form?.get("answer"));
  if (isConsentToken(token) && answer && allow(request, "call-consent", 20)) await answerConsent(token, answer).catch(() => null);
  return Response.redirect(new URL(`/c/${token}`, request.url), 303);
}
