/**
 * Server only. RENUABL Business's own sales pipeline, for staff on /admin (domain/design/business-leads.ts): the sales
 * leads in `design_leads` that are a sale (demo requests, Enterprise enquiries, demo sign-ups), each with its stage, who
 * moved it and staff's note. Staff only: this reads across every lead, so nothing here is reached by a business.
 */
import {
  PIPELINE_KINDS,
  demoInvite,
  leadReminderEmail,
  remindersDue,
  staffReminderEmail,
  stageOf,
  type BookedDemo,
  type BusinessLead,
  type BusinessLeadStage,
  type PipelineKind,
} from "@/lib/domain/design/business-leads";
import { leadAlertRecipients } from "@/lib/domain/emails";
import { query } from "./db";
import { sendEmail } from "./email";

interface Row {
  id: string;
  kind: string;
  email: string;
  name: string | null;
  business: string | null;
  mobile: string | null;
  users: number | null;
  note: string | null;
  stage: string | null;
  staff_note: string | null;
  at: Date;
  stage_at: Date | null;
  moved_by: string | null;
  demo_at: Date | null;
  demo_link: string | null;
  demo_remind_lead: boolean;
  demo_by: string | null;
  demo_staff_reminded_at: Date | null;
  demo_lead_reminded_at: Date | null;
}

const COLUMNS = `id, kind, email, name, business, mobile, users, note, stage, staff_note, at, stage_at, moved_by,
  demo_at, demo_link, demo_remind_lead, demo_by, demo_staff_reminded_at, demo_lead_reminded_at`;

function demoOf(r: Row): BookedDemo | null {
  if (!r.demo_at) return null;
  return {
    at: new Date(r.demo_at).toISOString(),
    link: r.demo_link,
    remindLead: r.demo_remind_lead,
    by: r.demo_by,
    staffReminded: !!r.demo_staff_reminded_at,
    leadReminded: !!r.demo_lead_reminded_at,
  };
}

function leadOf(r: Row): BusinessLead {
  return {
    id: r.id,
    kind: r.kind as PipelineKind,
    email: r.email,
    name: r.name,
    business: r.business,
    mobile: r.mobile,
    users: r.users,
    note: r.note,
    stage: stageOf(r.stage),
    staffNote: r.staff_note,
    at: new Date(r.at).toISOString(),
    stageAt: r.stage_at ? new Date(r.stage_at).toISOString() : null,
    movedBy: r.moved_by,
    demo: demoOf(r),
  };
}

/** Every lead in the pipeline, newest first (up to 300: won and lost ones from long ago stay in the table). */
export async function listBusinessLeads(): Promise<BusinessLead[]> {
  const rows = await query<Row>(`select ${COLUMNS} from design_leads where kind = any($1) order by coalesce(stage_at, at) desc limit 300`, [
    PIPELINE_KINDS,
  ]);
  return rows.map(leadOf);
}

/** Moves a lead to a stage; false when there is no such lead in the pipeline. */
export async function moveBusinessLead(id: string, stage: BusinessLeadStage, by: string): Promise<boolean> {
  const rows = await query(
    `update design_leads set stage = $2, stage_at = now(), moved_by = lower($3) where id = $1 and kind = any($4) returning id`,
    [id, stage, by, PIPELINE_KINDS],
  );
  return rows.length > 0;
}

/** Keeps staff's note on a lead ("" clears it); false when there is no such lead in the pipeline. */
export async function noteBusinessLead(id: string, note: string): Promise<boolean> {
  const rows = await query(`update design_leads set staff_note = nullif($2, '') where id = $1 and kind = any($3) returning id`, [
    id,
    note,
    PIPELINE_KINDS,
  ]);
  return rows.length > 0;
}

/**
 * Books a lead's demo: moves it to Demo booked and keeps the time, link and whether the lead is reminded. Booking again
 * (a new time) starts the reminders afresh. False when there is no such lead in the pipeline.
 */
export async function bookDemo(id: string, demo: { at: string; link: string | null; remindLead: boolean }, by: string): Promise<boolean> {
  const rows = await query(
    `update design_leads set stage = 'booked', stage_at = now(), moved_by = lower($5), demo_at = $2, demo_link = $3,
       demo_remind_lead = $4, demo_by = lower($5), demo_staff_reminded_at = null, demo_lead_reminded_at = null
     where id = $1 and kind = any($6) returning id`,
    [id, demo.at, demo.link, demo.remindLead, by, PIPELINE_KINDS],
  );
  return rows.length > 0;
}

/**
 * From the ten-minute cron: every reminder due on a booked demo (business-leads.ts `remindersDue`). Each is marked sent
 * before it goes, so two runs never send it twice; a failed send isn't tried again (staff still see the time on /admin).
 */
export async function sendDemoReminders(now: Date = new Date()): Promise<number> {
  const rows = await query<Row>(
    `select ${COLUMNS} from design_leads where kind = any($1) and stage = 'booked' and demo_at > now()
       and demo_at < now() + interval '25 hours'`,
    [PIPELINE_KINDS],
  );
  let sent = 0;
  for (const lead of rows.map(leadOf)) {
    const due = remindersDue(lead.stage, lead.demo, now);
    if (!lead.demo) continue;
    if (due.lead) {
      const claimed = await query(
        `update design_leads set demo_lead_reminded_at = now() where id = $1 and demo_lead_reminded_at is null returning id`,
        [lead.id],
      );
      if (claimed.length) {
        const mail = leadReminderEmail(lead, lead.demo, now);
        const ok = await sendEmail({
          to: lead.email,
          subject: mail.subject,
          text: mail.text,
          html: htmlOf(mail.text),
          attachments: [demoInvite(lead, lead.demo, "lead", now)],
          ...(lead.demo.by ? { replyTo: lead.demo.by } : {}),
        }).catch((e) => {
          console.error("demo reminder to the lead failed", e instanceof Error ? e.message : e);
          return "skipped" as const;
        });
        if (ok === "sent") sent++;
        lead.demo.leadReminded = true;
      }
    }
    if (due.staff) {
      const claimed = await query(
        `update design_leads set demo_staff_reminded_at = now() where id = $1 and demo_staff_reminded_at is null returning id`,
        [lead.id],
      );
      if (!claimed.length) continue;
      const mail = staffReminderEmail(lead, lead.demo, now);
      const to = new Set(leadAlertRecipients(process.env.LEAD_ALERT_EMAILS || process.env.ALERT_EMAILS));
      if (lead.demo.by) to.add(lead.demo.by);
      for (const address of to) {
        const ok = await sendEmail({
          to: address,
          subject: mail.subject,
          text: mail.text,
          html: htmlOf(mail.text),
          attachments: [demoInvite(lead, lead.demo, "staff", now)],
        }).catch((e) => {
          console.error("demo reminder to staff failed", e instanceof Error ? e.message : e);
          return "skipped" as const;
        });
        if (ok === "sent") sent++;
      }
    }
  }
  return sent;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const htmlOf = (text: string) => `<p style="font-family:sans-serif;white-space:pre-wrap">${escape(text)}</p>`;
