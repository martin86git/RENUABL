import { normaliseMobile } from "@/lib/domain/contact";
import { normaliseEmail } from "@/lib/domain/accounts";
import { plainText, quickQuoteEmail } from "@/lib/domain/emails";
import { CONSENT_MISSING, consentRecord, readConsent } from "@/lib/domain/legal";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { cleanQuoteAnswers, quickEstimate, quoteAnswerLines } from "@/lib/domain/quick-quote";
import { newLeadStaffSms, siteUrl } from "@/lib/domain/sms";
import { sendEmail } from "@/lib/server/email";
import { addNote, crmNote, followUpContactId, hubspotToken } from "@/lib/server/hubspot-crm";
import { alertNewLead, textStaff } from "@/lib/server/lead-alert";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST { firstName, mobile, email?, answers, home?, suburb?, source?, entry?, consent } from the /quote landing page:
 * the lead goes to HubSpot (contact + "Quick quote: call now" note with their answers), staff are emailed and texted
 * to call now, and anyone who gave an email gets their estimate and a link back. Succeeds when the lead was saved or
 * staff were told; the figure is rebuilt here from the answers, never taken from the browser.
 */
export async function POST(request: Request) {
  if (!allow(request, "quote-lead", 10)) return Response.json({ ok: false, message: "Please try again later." }, { status: 429 });
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const firstName =
    typeof b.firstName === "string"
      ? b.firstName
          .replace(/[^\p{L}\p{M}' -]/gu, "")
          .trim()
          .slice(0, 40)
      : "";
  if (!firstName) return Response.json({ ok: false, field: "firstName", message: "Enter your first name." }, { status: 422 });
  const mobile = typeof b.mobile === "string" ? normaliseMobile(b.mobile.trim()) : null;
  if (!mobile)
    return Response.json({ ok: false, field: "mobile", message: "Enter an Australian mobile, e.g. 0412 345 678." }, { status: 422 });
  const rawEmail = typeof b.email === "string" ? b.email.trim() : "";
  const email = rawEmail ? normaliseEmail(rawEmail) : null;
  if (rawEmail && !email) return Response.json({ ok: false, field: "email", message: "Enter a valid email address." }, { status: 422 });
  const consent = readConsent(b.consent);
  if (!consent.accepted) return Response.json({ ok: false, consent: true, message: CONSENT_MISSING }, { status: 422 });

  const answers = cleanQuoteAnswers(b.answers);
  const est = quickEstimate(answers);
  const details: Record<string, string | undefined> = {
    Stage: "Quick quote from the ad landing page: call now",
    "First name": firstName,
    ...quoteAnswerLines(answers),
    Home: plainText(b.home, 160) || undefined,
    "Ad source": plainText(b.source, 120) || undefined,
    "Landing page": plainText(b.entry, 60) || "Quick quote (/quote)",
    Consent: consentRecord({ kind: "follow-up", marketing: consent.marketing, at: new Date(), timeZone: LAUNCH_MARKET.timeZone }),
  };

  let saved = false;
  let hubspot = "not connected (no HubSpot token in Vercel)";
  const token = hubspotToken();
  if (token) {
    try {
      const id = await followUpContactId({ email, mobile, firstName }, token);
      await addNote(id, crmNote("Quick quote: call now", details), token);
      saved = true;
      hubspot = "saved";
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      hubspot = `NOT saved: ${reason.slice(0, 200)}`;
      console.error("quick quote not saved to HubSpot", reason);
    }
  }
  if (!saved) console.warn("quick quote lead (not in HubSpot)", JSON.stringify({ email, mobile, ...details }));

  const site = siteUrl();
  let emailed = false;
  if (site && email) {
    const saving = est
      ? `${est.withBattery ? "solar and a battery" : "solar"} could save you about $${est.amount.toLocaleString("en-AU")} a year`
      : null;
    try {
      emailed =
        (await sendEmail({ to: email, ...quickQuoteEmail({ firstName, saving, link: `${site}/`, callLink: `${site}/book-a-call` }) })) ===
        "sent";
    } catch (e) {
      console.error("quick quote email failed", e instanceof Error ? e.message : e);
    }
  }
  await textStaff(newLeadStaffSms({ contact: mobile, suburb: plainText(b.suburb, 40) || undefined, entry: "quick quote" }));
  const alerted = await alertNewLead({
    kind: "quote",
    name: firstName,
    email: email ?? undefined,
    mobile,
    details: { HubSpot: hubspot, ...details },
  });
  if (!saved && !alerted)
    return Response.json({ ok: false, message: "We couldn't save that just now. Please try again." }, { status: 502 });
  return Response.json({ ok: true, emailed });
}
