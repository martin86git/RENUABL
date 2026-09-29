import { normaliseEmail } from "@/lib/domain/accounts";
import { finishLaterEmail, plainText } from "@/lib/domain/emails";
import { siteUrl } from "@/lib/domain/sms";
import { sendEmail } from "@/lib/server/email";
import { addNote, contactIdByEmail, crmNote } from "@/lib/server/hubspot-crm";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST { email, home?, source? }: a visitor without their bill handy leaves
 * their email so we can follow up. It becomes a HubSpot contact with a note
 * (home and ad source, plain text), and they're emailed a link back. They
 * still can't continue without a bill.
 */
export async function POST(request: Request) {
  if (!allow(request, "follow-up", 10)) return Response.json({ ok: false, message: "Please try again later." }, { status: 429 });
  let body: { email?: unknown; home?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const email = normaliseEmail(body.email);
  if (!email) return Response.json({ ok: false, message: "Enter a valid email address." }, { status: 422 });
  const details = {
    Stage: "Didn't have their bill handy: follow up",
    Home: plainText(body.home, 160) || undefined,
    "Ad source": plainText(body.source, 120) || undefined,
  };

  let saved = false;
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  if (token) {
    try {
      const id = await contactIdByEmail(email, token);
      await addNote(id, crmNote("Finish later: no bill yet", details), token);
      saved = true;
    } catch (e) {
      console.error("follow-up not saved to HubSpot", e instanceof Error ? e.message : e);
    }
  }
  if (!saved) {
    // Keep the lead in the logs rather than lose it.
    console.warn("follow-up lead (not in HubSpot)", JSON.stringify({ email, ...details }));
  }

  const site = siteUrl();
  let emailed = false;
  if (site) {
    try {
      emailed = (await sendEmail({ to: email, ...finishLaterEmail({ link: `${site}/` }) })) === "sent";
    } catch (e) {
      console.error("follow-up email failed", e instanceof Error ? e.message : e);
    }
  }
  if (!saved && !emailed)
    return Response.json({ ok: false, message: "We couldn't save that just now. Please try again." }, { status: 502 });
  return Response.json({ ok: true, emailed });
}
