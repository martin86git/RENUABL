/**
 * The configurator's server side (19 Nov 2026, Martin: the proposal as Tesla would sell it). What the page can't work
 * out for itself: the weeks the business could install in (from its calendar and weekly capacity), and the order.
 * Ordering a final proposal is going ahead with it (the same acceptance as the proposal page, on the mix chosen);
 * ordering an indicative one is asking for that mix and week, to confirm at the site visit, and agrees nothing. Either
 * way the week is pencilled in on the business's install calendar for the deal and the deal's record says what was
 * chosen.
 */
import { holdMessage, holdNote, isConfigKey, type ConfigKey, variantOf } from "@/lib/domain/design/configurator";
import { ACCEPT_TICK_MISSING, FROM_CUSTOMER, INDICATIVE_NOT_ACCEPTABLE, cleanAcceptance } from "@/lib/domain/design/proposal";
import { INSTALL_CALL_LEAD_DAYS } from "@/lib/domain/install-call";
import { addDaysISO, isInstallDay } from "@/lib/domain/scheduling";
import { todayInMarket } from "@/lib/domain/market";
import type { ISODate } from "@/lib/domain/types";
import { query, transaction } from "./db";
import { loadPrefs, afterSigning } from "./design-after-sale-repo";
import { customerSays } from "./design-chat";
import { addEntry } from "./design-calendar-entries-repo";
import { record } from "./design-crm-repo";
import { tellAccepted } from "./design-notify";
import { acceptProposal, proposalJob, publicProposal } from "./design-proposal-repo";

/** Who a customer's week is written by on the calendar, so a second order replaces the first. */
const HELD_BY = "customer";
/** How many weeks a customer chooses between. */
export const WEEKS_OFFERED = 4;
/** How far ahead the weeks are looked for. */
const WEEKS_LOOKED = 16;

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

/**
 * The first weeks the business has room in, `WEEKS_OFFERED` of them: from the lead time the booking assistant uses,
 * weeks with an installation day left (weekdays, not public holidays) and fewer installs booked or pencilled in than
 * its weekly capacity.
 */
export async function installWeeksFor(businessId: string, count = WEEKS_OFFERED): Promise<InstallWeek[]> {
  const today = todayInMarket();
  const [booked, pencilled, prefs] = await Promise.all([
    query<{ day: string }>(
      `select to_char(install_date, 'YYYY-MM-DD') as day from design_jobs where business_id = $1 and install_date >= $2 and stage <> 'lost'`,
      [businessId, today],
    ),
    query<{ day: string }>(
      `select to_char(day_from, 'YYYY-MM-DD') as day from design_calendar_entries where business_id = $1 and kind = 'tentative' and day_from >= $2`,
      [businessId, today],
    ),
    loadPrefs(businessId),
  ]);
  const taken = new Map<ISODate, number>();
  for (const r of [...booked, ...pencilled]) taken.set(mondayOf(r.day), (taken.get(mondayOf(r.day)) ?? 0) + 1);
  const from = addDaysISO(today, INSTALL_CALL_LEAD_DAYS);
  const out: InstallWeek[] = [];
  for (let w = 0; w < WEEKS_LOOKED && out.length < count; w++) {
    const monday = addDaysISO(mondayOf(from), w * 7);
    const days = [0, 1, 2, 3, 4].map((d) => addDaysISO(monday, d)).filter((d) => d >= from && isInstallDay(d));
    if (!days.length || (taken.get(monday) ?? 0) >= prefs.weeklyCapacity) continue;
    out.push({ monday, label: weekLabel(monday) });
  }
  return out;
}

/** The first week the business could install in (the proposal page's line). */
export async function installWeekFor(businessId: string): Promise<InstallWeek | null> {
  return (await installWeeksFor(businessId, 1).catch(() => []))[0] ?? null;
}

/** The week a customer has asked for on this deal, if they have. */
export async function heldWeekFor(businessId: string, jobId: string): Promise<InstallWeek | null> {
  const rows = await query<{ day: string }>(
    `select to_char(day_from, 'YYYY-MM-DD') as day from design_calendar_entries
      where business_id = $1 and job_id = $2 and kind = 'tentative' and by_email = $3 and day_from >= $4
      order by day_from limit 1`,
    [businessId, jobId, HELD_BY, todayInMarket()],
  );
  return rows[0] ? { monday: rows[0].day, label: weekLabel(rows[0].day) } : null;
}

/** Pencils the week in for the deal (Monday to Friday), replacing the customer's last. */
async function pencilWeek(businessId: string, jobId: string, week: InstallWeek, note: string): Promise<void> {
  await query(`delete from design_calendar_entries where business_id = $1 and job_id = $2 and kind = 'tentative' and by_email = $3`, [
    businessId,
    jobId,
    HELD_BY,
  ]);
  await addEntry(businessId, HELD_BY, {
    kind: "tentative",
    from: week.monday,
    to: addDaysISO(week.monday, 4),
    title: "",
    note,
    who: "",
    jobId,
  });
}

export type OrderResult =
  { ok: true; kind: "ordered" | "requested"; week: InstallWeek | null } | { ok: false; status: number; message: string } | null;

/**
 * The customer's order from the configurator: only a mix the proposal was published with, and only a week the
 * calendar offers now (never one taken on trust from the browser). On a final proposal it is going ahead, kept as the
 * proposal page keeps it (name, tick, the server's time), and the business is told; on an indicative one it asks for
 * the mix and the week through the customer's own chat, to confirm at the site visit.
 */
export async function orderMix(
  token: string,
  body: { option?: unknown; week?: unknown; name?: unknown; agree?: unknown },
  later: (work: () => Promise<void>) => void,
): Promise<OrderResult> {
  const today = todayInMarket();
  const [found, job] = await Promise.all([publicProposal(token, today), proposalJob(token)]);
  if (!found || !job) return null;
  if (!found.view || found.state !== "live") return { ok: false, status: 409, message: "This proposal can't be ordered now." };
  const cfg = found.view.configurator;
  const key = (isConfigKey(body.option) ? body.option : cfg?.start) as ConfigKey | undefined;
  const mix = variantOf(cfg, key);
  if (!mix || !cfg) return { ok: false, status: 422, message: "Choose your system first." };
  const weeks = await installWeeksFor(job.businessId);
  // A week the calendar offers now; with none free, the order goes in and the week is arranged with them.
  const week = weeks.find((w) => w.monday === body.week) ?? null;
  if (!week && weeks.length) return { ok: false, status: 422, message: "Choose the week you'd like it installed." };
  const label = week?.label ?? "in a week to be arranged";

  if (found.view.indicative) {
    if (week) await pencilWeek(job.businessId, job.jobId, week, holdNote(cfg, mix.goal, label));
    // Said as the customer's own line in their chat: written on the deal, the business emailed, unread counted.
    const said = await customerSays(token, holdMessage(cfg, mix.goal, label), later);
    if (said && "problem" in said) return { ok: false, status: said.status, message: said.problem };
    return { ok: true, kind: "requested", week };
  }

  const accepted = cleanAcceptance({ name: body.name, agree: body.agree });
  if (!accepted.ok) return { ok: false, status: 422, message: accepted.message || ACCEPT_TICK_MISSING };
  const result = await acceptProposal(token, accepted.value.name, today, mix.goal);
  if (!result) return null;
  if (result === "indicative") return { ok: false, status: 409, message: INDICATIVE_NOT_ACCEPTABLE };
  if (result !== "accepted-now") return { ok: false, status: 409, message: "This proposal has already been ordered, or has lapsed." };
  if (week) await pencilWeek(job.businessId, job.jobId, week, holdNote(cfg, mix.goal, label));
  if (week)
    await transaction((q) =>
      record(q, job.businessId, {
        customerId: job.customerId,
        jobId: job.jobId,
        kind: "proposal",
        text: `Asked for installation ${week.label} (pencilled in on the install calendar).`,
        by: FROM_CUSTOMER,
      }),
    );
  // Told once, and not waited for: the order opens in the Ordering Station and the allowance is kept.
  later(async () => {
    await tellAccepted(token);
    await afterSigning(job.businessId, job.jobId);
  });
  return { ok: true, kind: "ordered", week };
}
