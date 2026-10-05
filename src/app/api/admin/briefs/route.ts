import { briefSms } from "@/lib/domain/brief";
import { normaliseMobile } from "@/lib/domain/contact";
import { normaliseEmail } from "@/lib/domain/accounts";
import { publicSiteUrl } from "@/lib/domain/site";
import { siteUrl } from "@/lib/domain/sms";
import { currentSession } from "@/lib/server/accounts";
import { noteBriefSent } from "@/lib/server/brief-hubspot";
import { createBrief } from "@/lib/server/briefs-repo";
import { dbConfigured } from "@/lib/server/db";

/**
 * POST { firstName, mobile?, email?, from? } (staff): a private brief link for a lead,
 * and the text to send them from a phone. The link is built from SITE_URL, never the request.
 */
export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ ok: false, message: "Connect the database first." }, { status: 404 });
  const session = await currentSession();
  if (session?.role !== "staff") return Response.json({ ok: false }, { status: 401 });
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
  if (!firstName) return Response.json({ ok: false, message: "Enter their first name." }, { status: 422 });
  const rawMobile = typeof b.mobile === "string" ? b.mobile.trim() : "";
  const mobile = rawMobile ? normaliseMobile(rawMobile) : null;
  if (rawMobile && !mobile) return Response.json({ ok: false, message: "Enter an Australian mobile, e.g. 0412 345 678." }, { status: 422 });
  const rawEmail = typeof b.email === "string" ? b.email.trim() : "";
  const email = rawEmail ? normaliseEmail(rawEmail) : null;
  if (rawEmail && !email) return Response.json({ ok: false, message: "Enter a valid email address." }, { status: 422 });
  const from =
    typeof b.from === "string"
      ? b.from
          .replace(/[^\p{L}\p{M}' -]/gu, "")
          .trim()
          .slice(0, 30)
      : "";

  const key = await createBrief({ firstName, mobile, email, createdBy: session.email });
  const link = `${siteUrl() ?? publicSiteUrl()}/brief/${key}`;
  // The lead is in HubSpot from the start (a contact and a "Brief sent" note); never blocks the link.
  const inHubspot = await noteBriefSent({ key, first_name: firstName, mobile, email }, { link, sentBy: session.email });
  return Response.json({ ok: true, key, link, mobile, inHubspot, sms: briefSms({ firstName, link, from }) });
}
