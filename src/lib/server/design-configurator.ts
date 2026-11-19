/**
 * The configurator's server side (19 Nov 2026, Martin: the proposal as Tesla would sell it). Two things the page
 * can't work out for itself: the first week the business could install (from its calendar and weekly capacity, as
 * the booking assistant offers days), and holding that week for a customer on an indicative proposal. Holding
 * charges nothing and agrees nothing: it pencils the week in on the business's install calendar for the deal, writes
 * on the deal what they chose, and tells the business through the customer's own chat (as if they had written it).
 */
import { variantOf, holdMessage, holdNote, isConfigKey, type ConfigKey } from "@/lib/domain/design/configurator";
import { addDaysISO } from "@/lib/domain/scheduling";
import { todayInMarket } from "@/lib/domain/market";
import type { ISODate } from "@/lib/domain/types";
import { query } from "./db";
import { customerSays } from "./design-chat";
import { addEntry } from "./design-calendar-entries-repo";
import { installDaysFor } from "./design-install-call";
import { proposalJob, publicProposal } from "./design-proposal-repo";

/** Who a hold is written by on the calendar, so a second hold replaces the first. */
const HELD_BY = "customer";

export interface InstallWeek {
  /** The Monday of the week. */
  monday: ISODate;
  /** "the week of 8 December". */
  label: string;
}

const mondayOf = (day: ISODate): ISODate => {
  const d = new Date(`${day}T00:00:00Z`);
  return addDaysISO(day, -((d.getUTCDay() + 6) % 7));
};

export const weekLabel = (monday: ISODate) =>
  `the week of ${new Date(`${monday}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "UTC" })}`;

/** The first week the business has an installation day free, as the booking assistant would offer it. Null with none. */
export async function installWeekFor(businessId: string): Promise<InstallWeek | null> {
  const days = await installDaysFor(businessId).catch(() => []);
  if (!days.length) return null;
  const monday = mondayOf(days[0].date);
  return { monday, label: weekLabel(monday) };
}

/** The week a customer has held on this deal, if they have. */
export async function heldWeekFor(businessId: string, jobId: string): Promise<InstallWeek | null> {
  const rows = await query<{ day: string }>(
    `select to_char(day_from, 'YYYY-MM-DD') as day from design_calendar_entries
      where business_id = $1 and job_id = $2 and kind = 'tentative' and by_email = $3 and day_from >= $4
      order by day_from limit 1`,
    [businessId, jobId, HELD_BY, todayInMarket()],
  );
  return rows[0] ? { monday: rows[0].day, label: weekLabel(rows[0].day) } : null;
}

export type HoldResult = { ok: true; week: InstallWeek } | { ok: false; status: number; message: string } | null;

/**
 * Holds the first free week for the mix the customer chose, on an indicative proposal that is still live. Only a mix
 * the proposal was published with, and only the week the calendar offers now (never one sent from the browser).
 */
export async function holdWeek(token: string, option: unknown, later: (work: () => Promise<void>) => void): Promise<HoldResult> {
  const today = todayInMarket();
  const [found, job] = await Promise.all([publicProposal(token, today), proposalJob(token)]);
  if (!found || !job) return null;
  if (!found.view || found.state !== "live") return { ok: false, status: 409, message: "This proposal can't be changed now." };
  if (!found.view.indicative) return { ok: false, status: 409, message: "This is your final proposal: go ahead from it instead." };
  const key = isConfigKey(option) ? (option as ConfigKey) : found.view.configurator?.start;
  const mix = variantOf(found.view.configurator, key);
  if (!mix || !found.view.configurator) return { ok: false, status: 422, message: "Choose your system first." };
  const week = await installWeekFor(job.businessId);
  if (!week) return { ok: false, status: 409, message: "There's no week free on the calendar just now. Send us a message instead." };
  // One hold a deal: a second press (another mix, or the week moved on) replaces the first.
  await query(`delete from design_calendar_entries where business_id = $1 and job_id = $2 and kind = 'tentative' and by_email = $3`, [
    job.businessId,
    job.jobId,
    HELD_BY,
  ]);
  await addEntry(job.businessId, HELD_BY, {
    kind: "tentative",
    from: week.monday,
    to: addDaysISO(week.monday, 4),
    title: "",
    note: holdNote(found.view.configurator, mix.goal, week.label),
    who: "",
    jobId: job.jobId,
  });
  // Told as the customer's own line in their chat: it is written on the deal, the business is emailed, unread counted.
  const said = await customerSays(token, holdMessage(found.view.configurator, mix.goal, week.label), later);
  if (said && "problem" in said) return { ok: false, status: said.status, message: said.problem };
  return { ok: true, week };
}
