import { readFollowUpContact } from "@/lib/domain/contact";
import { finishLaterEmail, plainText } from "@/lib/domain/emails";
import { CONSENT_MISSING, consentRecord, readConsent } from "@/lib/domain/legal";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { newLeadStaffSms, siteUrl, startedPlanSms } from "@/lib/domain/sms";
import { sendEmail } from "@/lib/server/email";
import { addNote, crmNote, followUpContactId } from "@/lib/server/hubspot-crm";
import { alertNewLead, textStaff } from "@/lib/server/lead-alert";
import { allow } from "@/lib/server/rate-limit";
import { sendSms } from "@/lib/server/sms";

/**
 * POST { email?, mobile?, home?, suburb?, source?, entry?, stage?, consent: { terms: true, marketing? } }.
 *
 * stage "no-bill" (default): a visitor without their bill handy leaves their email, mobile or both (at least one) so
 * we can follow up; anyone who gave an email is emailed a link back. They still can't continue without a bill.
 *
 * stage "started": a mobile left at the top of "About your home", before the bill (speed to lead). They're texted
 * straight away that we'll call (with a link to book a set time), and staff are texted (LEAD_ALERT_MOBILES) and
 * emailed to call now.
 *
 * Either way it becomes a HubSpot contact with a note (home, ad source, landing page, plain text).
 */
export async function POST(request: Request) {
  if (!allow(request, "follow-up", 10)) return Response.json({ ok: false, message: "Please try again later." }, { status: 429 });
  let body: {
    email?: unknown;
    mobile?: unknown;
    home?: unknown;
    suburb?: unknown;
    source?: unknown;
    entry?: unknown;
    stage?: unknown;
    consent?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const who = readFollowUpContact(body);
  if ("error" in who) return Response.json({ ok: false, message: who.error }, { status: 422 });
  const { email, mobile } = who;
  const started = body.stage === "started";
  if (started && !mobile) return Response.json({ ok: false, message: "Enter an Australian mobile, e.g. 0412 345 678." }, { status: 422 });
  const consent = readConsent(body.consent);
  if (!consent.accepted) return Response.json({ ok: false, consent: true, message: CONSENT_MISSING }, { status: 422 });
  const details = {
    Stage: started ? "Started their plan: left a mobile before their bill. Call now" : "Didn't have their bill handy: follow up",
    Home: plainText(body.home, 160) || undefined,
    "Ad source": plainText(body.source, 120) || undefined,
    "Landing page": plainText(body.entry, 60) || undefined,
    Consent: consentRecord({ kind: "follow-up", marketing: consent.marketing, at: new Date(), timeZone: LAUNCH_MARKET.timeZone }),
  };

  let saved = false;
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  if (token) {
    try {
      const id = await followUpContactId(who, token);
      await addNote(id, crmNote(started ? "Started their plan: call now" : "Finish later: no bill yet", details), token);
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
  let texted = false;
  if (started && site && mobile) texted = (await sendSms(mobile, startedPlanSms({ link: `${site}/book-a-call` }))) === "sent";
  if (started && mobile)
    await textStaff(
      newLeadStaffSms({ mobile, suburb: plainText(body.suburb, 40) || undefined, entry: plainText(body.entry, 40) || undefined }),
    );
  if (!started && site && email) {
    try {
      emailed = (await sendEmail({ to: email, ...finishLaterEmail({ link: `${site}/`, callLink: `${site}/book-a-call` }) })) === "sent";
    } catch (e) {
      console.error("follow-up email failed", e instanceof Error ? e.message : e);
    }
  }
  const alerted = await alertNewLead({
    kind: started ? "started" : "no-bill",
    email: email ?? undefined,
    mobile: mobile ?? undefined,
    details: started ? { ...details, "Texted them": texted ? "yes" : "no (SMS not set up or failed)" } : details,
  });
  if (!saved && !emailed && !alerted)
    return Response.json({ ok: false, message: "We couldn't save that just now. Please try again." }, { status: 502 });
  return Response.json({ ok: true, emailed, texted });
}
