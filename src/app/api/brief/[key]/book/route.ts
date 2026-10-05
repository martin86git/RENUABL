import { formatCallTime, isBookableCallSlot } from "@/lib/domain/booking";
import { SCORE_LABELS, briefAnswerLines, cleanBriefAnswers, isBriefKey, scoreBrief, solarVicLook } from "@/lib/domain/brief";
import { buildIcs, consultEvent, staffCallEvent } from "@/lib/domain/calendar";
import { normaliseMobile } from "@/lib/domain/contact";
import { normaliseEmail } from "@/lib/domain/accounts";
import { consultBookedEmail } from "@/lib/domain/emails";
import { formatDate } from "@/lib/domain/format";
import { CONSENT_MISSING, consentRecord, readConsent } from "@/lib/domain/legal";
import { LAUNCH_MARKET, todayInMarket } from "@/lib/domain/market";
import { publicSiteUrl } from "@/lib/domain/site";
import { siteUrl } from "@/lib/domain/sms";
import { cleanSummary, getBrief, markBriefBooked, saveBriefProgress } from "@/lib/server/briefs-repo";
import { dbConfigured } from "@/lib/server/db";
import { sendEmail } from "@/lib/server/email";
import { addNote, crmNote, followUpContactId } from "@/lib/server/hubspot-crm";
import { alertNewLead } from "@/lib/server/lead-alert";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST { date, time, phone, email?, answers, summary, consent, unfinished? }: the lead books
 * their 15-minute call from the brief. The slot is checked and the label built here. Saved on
 * the brief, one HubSpot note with every answer and the staff-only score, a staff email, and
 * the lead's own invite when they gave an email.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/brief/[key]/book">) {
  const { key } = await ctx.params;
  if (!isBriefKey(key) || !dbConfigured()) return Response.json({ ok: false }, { status: 404 });
  if (!allow(request, "brief-book", 20)) return Response.json({ ok: false, message: "Please try again later." }, { status: 429 });
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const brief = await getBrief(key);
  if (!brief) return Response.json({ ok: false }, { status: 404 });

  const date = typeof b.date === "string" ? b.date : "";
  const time = typeof b.time === "string" ? b.time : "";
  if (!isBookableCallSlot(todayInMarket(), date, time))
    return Response.json({ ok: false, message: "That time isn't available any more. Please choose another." }, { status: 422 });
  const phone = normaliseMobile(typeof b.phone === "string" ? b.phone : "") ?? brief.mobile;
  if (!phone) return Response.json({ ok: false, message: "Enter the best mobile to call you on." }, { status: 422 });
  const rawEmail = typeof b.email === "string" ? b.email.trim() : "";
  const email = rawEmail ? normaliseEmail(rawEmail) : brief.email;
  if (rawEmail && !email) return Response.json({ ok: false, message: "Enter a valid email address." }, { status: 422 });
  const consent = readConsent(b.consent);
  if (!consent.accepted) return Response.json({ ok: false, consent: true, message: CONSENT_MISSING }, { status: 422 });

  const answers = cleanBriefAnswers(b.answers);
  const summary = cleanSummary(b.summary);
  await saveBriefProgress(key, answers, summary);
  const label = `${formatDate(date, { weekday: "long", day: "numeric", month: "long" })} at ${formatCallTime(time)} (${LAUNCH_MARKET.capital} time)`;
  await markBriefBooked(key, label, `${date}T${time}`);

  const { score, flags } = scoreBrief({ answers, billRead: Boolean(summary?.billRead), booked: true });
  const sv = answers.sv_income ? solarVicLook(answers) : null;
  const details: Record<string, string | undefined> = {
    Stage: b.unfinished === true ? "Brief not finished: booked a call from the shortcut" : "Brief finished: booked a call",
    Call: label,
    "Best number": phone,
    "Score (staff only)": `${SCORE_LABELS[score]}${flags.length ? `. ${flags.join(". ")}` : ""}`,
    Home: summary?.home,
    Usage: summary?.usage,
    "System shown": summary?.system,
    "Price shown": summary?.price,
    Rebates: summary?.rebates,
    "Held install date": summary?.installDate,
    "Solar Victoria":
      sv === "likely"
        ? "Looks eligible (Solar Victoria decides)"
        : sv === "unlikely"
          ? "Looks unlikely"
          : sv
            ? "Check on the call"
            : undefined,
    Answers: briefAnswerLines(answers).join(" · ") || undefined,
    Consent: consentRecord({ kind: "follow-up", marketing: consent.marketing, at: new Date(), timeZone: LAUNCH_MARKET.timeZone }),
  };

  let saved = false;
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  if (token) {
    try {
      const id = await followUpContactId({ email, mobile: phone }, token);
      await addNote(id, crmNote(`RENUABL brief: 15-minute call ${label}`, details), token);
      saved = true;
    } catch (e) {
      console.error("brief booking not saved to HubSpot", e instanceof Error ? e.message : e);
    }
  }
  const staffIcs = buildIcs([
    staffCallEvent({
      id: `brief-${key.slice(0, 8)}`,
      date,
      time,
      name: brief.first_name,
      phone,
      note: summary?.home ? `Home: ${summary.home}.` : undefined,
    }),
  ]);
  await alertNewLead({ kind: "call", name: brief.first_name, email: email ?? undefined, mobile: phone, details }, [
    { filename: "renuabl-call.ics", content: staffIcs, contentType: "text/calendar" },
  ]);
  if (!saved) console.warn("brief booking (not in HubSpot)", key.slice(0, 6));

  let emailed = false;
  if (email) {
    try {
      const ics = buildIcs([consultEvent({ id: `brief-${key.slice(0, 8)}`, date, time })]);
      emailed =
        (await sendEmail({
          to: email,
          ...consultBookedEmail({
            firstName: brief.first_name.split(/\s+/)[0],
            call: label,
            link: `${siteUrl() ?? publicSiteUrl()}/brief/${key}`,
          }),
          attachments: [{ filename: "renuabl-call.ics", content: ics, contentType: "text/calendar" }],
        })) === "sent";
    } catch (e) {
      console.error("brief booking email failed", e instanceof Error ? e.message : e);
    }
  }
  return Response.json({ ok: true, call: label, date, time, emailed }, { headers: { "cache-control": "no-store" } });
}
