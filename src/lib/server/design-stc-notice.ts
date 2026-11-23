/**
 * Server only. The STC change notice (domain/design/stc-change.ts) for one person: read from today's rebate rules,
 * the business's installation period for new quotes and its proposals out and not yet signed. "Later" is each
 * person's own (`design_stc_notice`, business id first, one row a person).
 */
import { can, cleanWorkspaceSettings } from "@/lib/domain/design/account";
import { DEFAULT_WORKSPACE } from "@/lib/domain/design/pricing";
import { laterUntil, putAway, stcNotice, type StcNotice } from "@/lib/domain/design/stc-change";
import { todayInMarket } from "@/lib/domain/market";
import type { ISODate } from "@/lib/domain/types";
import { query } from "./db";
import { loadSettings, saveSettings, type Member } from "./design-repo";
import { getRebateRates } from "./rebate-rates";

let ready: Promise<unknown> | null = null;
const table = () =>
  (ready ??= query(`create table if not exists design_stc_notice (
  business_id text not null references businesses(id) on delete cascade,
  email text not null,
  notice_key text not null,
  later_until date not null,
  updated_at timestamptz not null default now(),
  primary key (business_id, email)
)`).catch((e) => {
    ready = null;
    throw e;
  }));

/**
 * The install day each proposal out and not yet signed was priced for: the newest version of every proposal not
 * taken back, on a deal still being sold, whose price still stands. A version kept before the day was recorded was
 * priced for the day it was published.
 */
export async function unsignedPricedFor(businessId: string, today: ISODate): Promise<ISODate[]> {
  const rows = await query<{ stcDate: string | null; publishedAt: Date; validUntil: string | null; accepted: boolean }>(
    `select distinct on (p.id) v.internal->>'stcDate' as "stcDate", v.published_at as "publishedAt",
            v.view->>'validUntil' as "validUntil", v.accepted_at is not null as accepted
       from design_proposals p
       join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id
       join design_jobs j on j.business_id = p.business_id and j.id = p.job_id
      where p.business_id = $1 and p.withdrawn_at is null and j.stage in ('lead', 'designed', 'proposal')
      order by p.id, v.version desc`,
    [businessId],
  ).catch(() => []);
  return rows
    .filter((r) => !r.accepted && (!r.validUntil || r.validUntil >= today))
    .map((r) => (r.stcDate && /^\d{4}-\d{2}-\d{2}$/.test(r.stcDate) ? r.stcDate : todayInMarket(new Date(r.publishedAt))));
}

async function work(member: Member): Promise<{ notice: StcNotice | null; today: ISODate }> {
  const today = todayInMarket();
  const [{ rates }, saved, unsigned] = await Promise.all([
    getRebateRates(),
    loadSettings(member.businessId),
    unsignedPricedFor(member.businessId, today),
  ]);
  const settings = saved ? cleanWorkspaceSettings(saved).settings : DEFAULT_WORKSPACE.settings;
  return { notice: stcNotice({ today, rates, stcFrom: settings.stcFrom, stcPrice: settings.stcPrice, unsigned }), today };
}

/** The notice for someone who may change settings, unless they put it away for now. Null for everyone else. */
export async function stcNoticeFor(member: Member): Promise<StcNotice | null> {
  if (!can(member.role, "prices", member.permissions)) return null;
  const { notice, today } = await work(member);
  if (!notice) return null;
  await table();
  const rows = await query<{ key: string; until: string }>(
    `select notice_key as key, to_char(later_until, 'YYYY-MM-DD') as until from design_stc_notice
      where business_id = $1 and lower(email) = lower($2)`,
    [member.businessId, member.email],
  );
  return putAway(notice.key, rows[0] ?? null, today) ? null : notice;
}

/** "Later": this notice put away for this person, for a week or until the change, whichever is sooner. */
export async function stcNoticeLater(member: Member): Promise<void> {
  const { notice, today } = await work(member);
  if (!notice) return;
  await table();
  await query(
    `insert into design_stc_notice (business_id, email, notice_key, later_until) values ($1, lower($2), $3, $4)
     on conflict (business_id, email) do update set notice_key = excluded.notice_key, later_until = excluded.later_until, updated_at = now()`,
    [member.businessId, member.email, notice.key, laterUntil(notice, today)],
  );
}

/**
 * Prices new quotes for installs from the coming change, as the notice offers. The day is the rules' own, never the
 * browser's. Answers with the day set, or null when there was nothing to apply.
 */
export async function applyStcPeriod(member: Member): Promise<ISODate | null> {
  const { notice } = await work(member);
  if (!notice?.apply) return null;
  const saved = await loadSettings(member.businessId);
  const now = cleanWorkspaceSettings(saved ?? DEFAULT_WORKSPACE);
  await saveSettings(member.businessId, { ...now, settings: { ...now.settings, stcFrom: notice.apply.stcFrom } }, member.email);
  return notice.apply.stcFrom;
}
