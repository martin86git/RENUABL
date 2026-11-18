/**
 * Server only. The business's published proposals as price points for Sol's price check (domain/design/price-check.ts):
 * for each proposal, the version the customer signed, else its newest; from the last year. Business id first, from the
 * signed-in member only. Costs are in it, so only a member who sees costs is given it (the route checks).
 */
import { HISTORY_DAYS, pointOf, type PricePoint } from "@/lib/domain/design/price-check";
import type { ProposalInternal, ProposalView } from "@/lib/domain/design/proposal";
import { query } from "./db";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export async function pricePoints(businessId: string, now = new Date()): Promise<PricePoint[]> {
  const rows = await query<{
    job_id: string;
    view: ProposalView;
    internal: ProposalInternal;
    published_at: string;
    accepted_at: string | null;
    accepted_option: string | null;
    lost: boolean;
  }>(
    `select distinct on (p.id) p.job_id, v.view, v.internal, ${moment("v.published_at")} as published_at,
            ${moment("v.accepted_at")} as accepted_at, v.accepted_option, (j.stage = 'lost') as lost
       from design_proposals p
       join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id
       join design_jobs j on j.business_id = p.business_id and j.id = p.job_id
      where p.business_id = $1 and p.withdrawn_at is null
        and v.published_at > now() - make_interval(days => $2)
      order by p.id, (v.accepted_at is not null) desc, v.version desc`,
    [businessId, HISTORY_DAYS],
  );
  return rows.flatMap((r) => {
    const point = pointOf({
      jobId: r.job_id,
      view: r.view,
      internal: r.internal,
      publishedAt: r.published_at,
      acceptedAt: r.accepted_at,
      acceptedOption: r.accepted_option,
      lost: r.lost,
      now,
    });
    return point ? [point] : [];
  });
}
