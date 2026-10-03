import { readFollowUpContact } from "@/lib/domain/contact";
import { finishLaterEmail, plainText } from "@/lib/domain/emails";
import { CONSENT_MISSING, consentRecord, readConsent } from "@/lib/domain/legal";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { siteUrl } from "@/lib/domain/sms";
import { sendEmail } from "@/lib/server/email";
import { addNote, crmNote, followUpContactId } from "@/lib/server/hubspot-crm";
import { alertNewLead } from "@/lib/server/lead-alert";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST { email?, mobile?, home?, source?, consent: { terms: true, marketing? } }: a visitor without their bill handy
 * leaves their email, mobile or both (at least one) so we can follow up. It becomes a HubSpot contact with a note
 * (home and ad source, plain text), staff are emailed, and anyone who gave an email is emailed a link back. They
 * still can't continue without a bill.
 */
export async function POST(request: Request) {
  if (!allow(request, "follow-up", 10)) return Response.json({ ok: false, message: "Please try again later." }, { status: 429 });
  let body: { email?: unknown; mobile?: unknown; home?: unknown; source?: unknown; consent?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const who = readFollowUpContact(body);
  if ("error" in who) return Response.json({ ok: false, message: who.error }, { status: 422 });
  const { email, mobile } = who;
  const consent = readConsent(body.consent);
  if (!consent.accepted) return Response.json({ ok: false, consent: true, message: CONSENT_MISSING }, { status: 422 });
  const details = {
    Stage: "Didn't have their bill handy: follow up",
    Home: plainText(body.home, 160) || undefined,
    "Ad source": plainText(body.source, 120) || undefined,
    Consent: consentRecord({ kind: "follow-up", marketing: consent.marketing, at: new Date(), timeZone: LAUNCH_MARKET.timeZone }),
  };

  let saved = false;
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  if (token) {
    try {
      const id = await followUpContactId(who, token);
      await addNote(id, crmNote("Finish later: no bill yet", details), token);
      saved = true;
    } catch (e) {
      console.error("follow-up not saved to HubSpot", e instanceof Error ? e.message : e);
    }
  }
  if (!saved) {
    // Keep the lead in the logs rather than lose it.
    console.warn("follow-up lead (not in HubSpot)", JSON.stringify({ email, mobile, ...details }));
  }

  const site = siteUrl();
  let emailed = false;
  if (site && email) {
    try {
      emailed = (await sendEmail({ to: email, ...finishLaterEmail({ link: `${site}/`, callLink: `${site}/book-a-call` }) })) === "sent";
    } catch (e) {
      console.error("follow-up email failed", e instanceof Error ? e.message : e);
    }
  }
  const alerted = await alertNewLead({ kind: "no-bill", email: email ?? undefined, mobile: mobile ?? undefined, details });
  if (!saved && !emailed && !alerted)
    return Response.json({ ok: false, message: "We couldn't save that just now. Please try again." }, { status: 502 });
  return Response.json({ ok: true, emailed });
}
