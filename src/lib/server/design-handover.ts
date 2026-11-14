/**
 * Handing work to Sol from Today (14 Nov 2026, Martin: "Sol's feed is a list of things I'm delegating to him"). What can
 * be handed is in deal-feed.ts (`handable`): his draft email, to go in `HAND_MINUTES`; or, for a signed deal with no
 * install day, booking it: the soonest free day (install-days.ts) and an email offering it, which sets the day on the
 * deal as it goes (sendOutboxItem). Both are items in Sol's outbox with a time a person picked (`notBefore`), so they
 * count down, can be reviewed, changed or stopped like any of his emails, and go only in the business's hours. Take
 * back puts the draft back as it was, or sets the install-day email aside. Each is written on the deal's record.
 */
import type { DealViewer } from "@/lib/domain/design/account";
import { HAND_MINUTES } from "@/lib/domain/design/deal-feed";
import { dayInFull, installDayChoices, installDayEmail } from "@/lib/domain/design/install-days";
import { installDayKey, type PreparedItem } from "@/lib/domain/design/prepared";
import { todayInMarket } from "@/lib/domain/market";
import { addDaysISO } from "@/lib/domain/scheduling";
import { newId, query } from "./db";
import { bookedJobs, loadPrefs } from "./design-after-sale-repo";
import { addActivity, jobById } from "./design-crm-repo";

export type HandResult =
  { ok: true; words: string } | { ok: false; why: "missing" | "nothing" | "no-email" | "no-day" | "reply"; message: string };

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Melbourne" }).replace(/\s/g, " ");

interface Member {
  businessId: string;
  businessName: string;
  email: string;
  firstName?: string | null;
}

/** The days install-day emails handed to Sol will book: taken already, for the days offered elsewhere. */
export async function heldInstallDays(businessId: string): Promise<string[]> {
  const rows = await query<{ day: string | null }>(
    `select item->>'installDay' as day from design_prepared where business_id = $1 and kind = 'install-day' and status = 'ready'`,
    [businessId],
  );
  return rows.map((r) => r.day).filter((d): d is string => Boolean(d));
}

/** The deal's draft of Sol's still waiting to go, newest first, if any. */
async function readyItem(businessId: string, jobId: string) {
  const rows = await query<{ id: string; item: PreparedItem & { notBefore?: string; held?: boolean } }>(
    `select id, item from design_prepared where business_id = $1 and job_id = $2 and status = 'ready' order by created_at desc limit 1`,
    [businessId, jobId],
  );
  return rows[0] ?? null;
}

/** Hands the deal's next piece of work to Sol: it goes in `HAND_MINUTES` unless taken back. */
export async function handToSol(member: Member, viewer: DealViewer, jobId: string, now = new Date()): Promise<HandResult> {
  const found = await jobById(member.businessId, jobId, viewer);
  if (!found) return { ok: false, why: "missing", message: "That deal isn't here." };
  const { job, customer } = found;
  const first = customer.firstName || customer.name.split(/\s+/)[0] || "them";
  const at = new Date(now.getTime() + HAND_MINUTES * 60_000).toISOString();
  const note = (text: string) =>
    addActivity(member.businessId, customer.id, { kind: "note", text, jobId }, member.email).catch(() =>
      console.error("a handover couldn't be written on the deal"),
    );

  const ready = await readyItem(member.businessId, jobId);
  if (ready) {
    await query(`update design_prepared set item = item || $3::jsonb where business_id = $1 and id = $2 and status = 'ready'`, [
      member.businessId,
      ready.id,
      JSON.stringify({ held: false, notBefore: at }),
    ]);
    const words = `Handed to Sol: he emails ${first} at ${time(at)}${ready.item.subject ? ` ("${ready.item.subject}")` : ""}.`;
    await note(words);
    return { ok: true, words };
  }

  if (job.stage !== "won" || job.installDate)
    return { ok: false, why: "nothing", message: "There's nothing on this deal for Sol to take yet." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email ?? ""))
    return { ok: false, why: "no-email", message: `There's no email on ${first}'s record for Sol to send the day to.` };
  const today = todayInMarket(now);
  const [prefs, booked, held] = await Promise.all([
    loadPrefs(member.businessId),
    bookedJobs(member.businessId, today, addDaysISO(today, 80)),
    heldInstallDays(member.businessId),
  ]);
  const day = installDayChoices({ booked: [...booked.map((b) => b.date), ...held], perWeek: prefs.weeklyCapacity, today })[0];
  if (!day) return { ok: false, why: "no-day", message: "There are no free install days in the next ten weeks to offer." };
  const email = installDayEmail({ firstName: first, day, sender: member.firstName ?? "", business: member.businessName });
  const id = newId("prep", 10);
  const createdAt = now.toISOString();
  const item: PreparedItem & { notBefore: string; held: boolean } = {
    id,
    kind: "install-day",
    jobId,
    customerId: customer.id,
    customer: customer.name,
    title: job.title,
    why: "Install day handed to Sol",
    to: customer.email,
    subject: email.subject,
    body: email.body,
    basis: [`The soonest free install day: ${dayInFull(day)}`],
    day: 0,
    by: "plain",
    status: "ready",
    createdAt,
    installDay: day,
    notBefore: at,
    held: false,
  };
  await query(
    `insert into design_prepared (id, business_id, job_id, key, kind, status, item) values ($1, $2, $3, $4, 'install-day', 'ready', $5::jsonb)`,
    [id, member.businessId, jobId, installDayKey(jobId, createdAt), JSON.stringify(item)],
  );
  const words = `Handed to Sol: he books ${dayInFull(day)} and emails ${first} at ${time(at)}.`;
  await note(words);
  return { ok: true, words };
}

/** Takes back what was handed: the draft waits for a person again; an install-day email is set aside. */
export async function takeBackFromSol(member: Member, viewer: DealViewer, jobId: string): Promise<boolean> {
  const found = await jobById(member.businessId, jobId, viewer);
  if (!found) return false;
  const ready = await readyItem(member.businessId, jobId);
  if (!ready) return false;
  if (ready.item.kind === "install-day")
    await query(`update design_prepared set status = 'dismissed', done_at = now(), done_by = $3 where business_id = $1 and id = $2`, [
      member.businessId,
      ready.id,
      member.email.toLowerCase(),
    ]);
  else
    await query(`update design_prepared set item = (item - 'notBefore') || '{"held": true}'::jsonb where business_id = $1 and id = $2`, [
      member.businessId,
      ready.id,
    ]);
  await addActivity(member.businessId, found.customer.id, { kind: "note", text: "Taken back from Sol.", jobId }, member.email).catch(() =>
    console.error("a take-back couldn't be written on the deal"),
  );
  return true;
}
