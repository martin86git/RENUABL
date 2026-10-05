/**
 * Server only. Keeps HubSpot in step with each guided brief: a contact and a
 * "Brief sent" note as soon as staff make the link, and one "Brief not
 * finished" note (with what they've answered so far) when a lead stops partway
 * without booking. The booking itself adds its own note (`/api/brief/[key]/book`).
 * Never throws: HubSpot being down never blocks a brief.
 */
import { BRIEF_UNFINISHED_HOURS, SCORE_LABELS, briefAnswerLines, cleanBriefAnswers, scoreBrief } from "@/lib/domain/brief";
import { addNote, crmNote, followUpContactId } from "./hubspot-crm";
import { alertNewLead } from "./lead-alert";
import { markUnfinishedNoted, setBriefHubspot, staleBriefs, type BriefRow } from "./briefs-repo";

const token = () => process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim() || null;

async function contactFor(b: Pick<BriefRow, "key" | "first_name" | "mobile" | "email" | "hubspot_id">, t: string) {
  if (b.hubspot_id) return b.hubspot_id;
  const id = await followUpContactId({ email: b.email, mobile: b.mobile, firstName: b.first_name }, t);
  await setBriefHubspot(b.key, id);
  return id;
}

/** When staff make the link: the lead is in HubSpot from the start. */
export async function noteBriefSent(b: Pick<BriefRow, "key" | "first_name" | "mobile" | "email">, o: { link: string; sentBy: string }) {
  const t = token();
  if (!t || (!b.mobile && !b.email)) return false;
  try {
    const id = await contactFor({ ...b, hubspot_id: null }, t);
    await addNote(
      id,
      crmNote("RENUABL brief sent", {
        Stage: "Brief sent: waiting for them to fill it in",
        "Sent by": o.sentBy,
        "Their private link": o.link,
      }),
      t,
    );
    return true;
  } catch (e) {
    console.error("brief sent note failed", e instanceof Error ? e.message : e);
    return false;
  }
}

let lastRun = 0;

/**
 * Briefs started and then left for `BRIEF_UNFINISHED_HOURS` without booking: one note each in HubSpot,
 * with their answers so far and the staff-only score, and a staff email so someone follows up.
 * Runs from the daily cron and (at most once a minute) when /admin is opened.
 */
export async function noteUnfinishedBriefs(): Promise<number> {
  if (Date.now() - lastRun < 60_000) return 0;
  lastRun = Date.now();
  let done = 0;
  try {
    for (const b of await staleBriefs(BRIEF_UNFINISHED_HOURS)) {
      const answers = cleanBriefAnswers(b.answers);
      const { score, flags } = scoreBrief({ answers, billRead: Boolean(b.summary?.billRead), booked: false });
      const details: Record<string, string | undefined> = {
        Stage: "Brief not finished: stopped before booking a call. Worth a follow-up.",
        "Score (staff only)": `${SCORE_LABELS[score]}${flags.length ? `. ${flags.join(". ")}` : ""}`,
        Home: b.summary?.home,
        Usage: b.summary?.usage,
        "System shown": b.summary?.system,
        "Price shown": b.summary?.price,
        "Held install date": b.summary?.installDate,
        "Answers so far": briefAnswerLines(answers).join(" · ") || "None yet",
      };
      const t = token();
      if (t && (b.mobile || b.email)) {
        try {
          await addNote(await contactFor(b, t), crmNote("RENUABL brief not finished", details), t);
        } catch (e) {
          console.error("brief unfinished note failed", e instanceof Error ? e.message : e);
        }
      }
      await alertNewLead({
        kind: "brief-unfinished",
        name: b.first_name,
        email: b.email ?? undefined,
        mobile: b.mobile ?? undefined,
        details,
      });
      await markUnfinishedNoted(b.key);
      done++;
    }
  } catch (e) {
    console.error("unfinished briefs failed", e instanceof Error ? e.message : e);
  }
  return done;
}
