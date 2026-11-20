/**
 * What Today's Business and My month read (domain/design/insights.ts): the deals a viewer may see, each with when the
 * business first called or emailed, its first final proposal's sending, opening and signing, and the calls on it.
 * Business id first, as every designer table; only deals of the last year and a half, or still open.
 */
import type { DealViewer } from "@/lib/domain/design/account";
import type { InsightDeal } from "@/lib/domain/design/insights";
import { query } from "./db";
import { listJobs } from "./design-crm-repo";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

interface Facts {
  id: string;
  touch: string | null;
  sent: string | null;
  opened: string | null;
  signed: string | null;
}

export async function insightDeals(businessId: string, viewer: DealViewer): Promise<InsightDeal[]> {
  const jobs = (await listJobs(businessId, viewer)).filter((j) => !j.sample);
  const [facts, calls] = await Promise.all([
    query<Facts>(
      `select j.id,
              (select ${moment("min(a.at)")} from design_activity a
                where a.business_id = j.business_id and a.job_id = j.id and a.kind in ('call', 'email')) as touch,
              ${moment("min(v.published_at)")} as sent,
              ${moment("min(v.opened_at)")} as opened,
              ${moment("min(v.accepted_at)")} as signed
         from design_jobs j
         left join design_proposals p on p.business_id = j.business_id and p.job_id = j.id
         left join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id
              and coalesce(v.view->>'indicative', 'false') <> 'true'
        where j.business_id = $1 and j.updated_at > now() - interval '540 days'
        group by j.id`,
      [businessId],
    ),
    query<{ jobId: string; at: string }>(
      `select job_id as "jobId", ${moment("at")} as at from design_activity
        where business_id = $1 and kind = 'call' and job_id is not null and at > now() - interval '540 days'`,
      [businessId],
    ),
  ]);
  const byId = new Map(facts.map((f) => [f.id, f]));
  const callsOf = new Map<string, string[]>();
  for (const c of calls) callsOf.set(c.jobId, [...(callsOf.get(c.jobId) ?? []), c.at]);
  return jobs
    .filter((j) => byId.has(j.id))
    .map((j) => {
      const f = byId.get(j.id)!;
      return {
        id: j.id,
        customerName: j.customerName,
        stage: j.stage,
        value: j.value,
        kw: j.kw,
        title: j.title,
        details: j.details,
        createdAt: j.createdAt,
        wonAt: j.wonAt,
        installedAt: j.installedAt,
        owner: j.owner,
        installDate: j.installDate,
        firstTouch: f.touch,
        sentAt: f.sent,
        openedAt: f.opened,
        signedAt: f.signed,
        calls: callsOf.get(j.id) ?? [],
      };
    });
}
