/**
 * Server only. The design tool's home (domain/design/design-home.ts) and a deal's proposal timeline
 * (domain/design/timeline.ts), read from what is already kept. Under the designer's tenant rule: the business id first,
 * from the signed-in member only, and only the deals the viewer may see.
 */
import { roofKey, type DealViewer } from "@/lib/domain/design/account";
import { attachRefusal, type FirstSent, type SiteLine, type WaitingInput } from "@/lib/domain/design/design-home";
import { viewForChoice, type ProposalView } from "@/lib/domain/design/proposal";
import { cleanDesignSet, designSummary, type DesignGoal } from "@/lib/domain/design/roof-design";
import type { TimelineActivity, TimelineMessage, TimelineVersion } from "@/lib/domain/design/timeline";
import { query, transaction } from "./db";
import { linkJobsToRoof, record, seen, seenParams } from "./design-crm-repo";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export interface DesignHomeData {
  waiting: WaitingInput[];
  firstSent: FirstSent[];
  sites: SiteLine[];
}

/** Everything the home shows: the deals (for the waiting list), each deal's first proposal, and the roofs drawn. */
export async function designHome(businessId: string, viewer: DealViewer): Promise<DesignHomeData> {
  const p = seenParams(viewer);
  const [waiting, firstSent, projects] = await Promise.all([
    query<WaitingInput>(
      `select j.id, c.name as "customerName", j.title, j.address, j.lat, j.lng, j.stage, j.project_id as "projectId",
              ${moment("j.created_at")} as "createdAt"
         from design_jobs j join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
        where j.business_id = $1 and j.project_id is null and j.stage in ('lead','designed','proposal') and ${seen(viewer, 2)}
        order by j.created_at limit 2000`,
      [businessId, ...p],
    ),
    // A design is done the day its deal's first proposal went out: this week's are all the home needs.
    query<FirstSent>(
      `select j.id as "jobId", c.name as "customerName", ${moment("min(v.published_at)")} as at
         from design_proposals pr
         join design_proposal_versions v on v.business_id = pr.business_id and v.proposal_id = pr.id
         join design_jobs j on j.business_id = pr.business_id and j.id = pr.job_id
         join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
        where pr.business_id = $1 and ${seen(viewer, 2)}
        group by j.id, c.name having min(v.published_at) > now() - interval '9 days'`,
      [businessId, ...p],
    ),
    query<{
      id: string;
      address: string;
      lat: number;
      lng: number;
      design: unknown;
      updatedAt: string;
      jobId: string | null;
      customerName: string | null;
      published: boolean;
      visible: boolean;
    }>(
      `select pj.id, pj.address, pj.lat, pj.lng, pj.design, ${moment("pj.updated_at")} as "updatedAt",
              j.id as "jobId", c.name as "customerName",
              exists (select 1 from design_proposals pr where pr.business_id = pj.business_id and pr.job_id = j.id) as published,
              (j.id is null or ${seen(viewer, 2)}) as visible
         from design_projects pj
         left join lateral (select j.* from design_jobs j where j.business_id = pj.business_id and j.project_id = pj.id
                             order by j.updated_at desc limit 1) j on true
         left join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
        where pj.business_id = $1
        order by pj.updated_at desc limit 60`,
      [businessId, ...p],
    ),
  ]);
  const sites = projects.flatMap((r) => {
    // A roof on a deal this viewer may not see is left out, as the deal is.
    if (!r.visible) return [];
    const set = cleanDesignSet(r.design);
    const sum = set ? designSummary(set.designs[set.primary] ?? set.designs[0]) : { panels: 0, kw: 0 };
    return [
      {
        id: r.id,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        panels: sum.panels,
        kw: sum.kw,
        updatedAt: r.updatedAt,
        jobId: r.jobId,
        customerName: r.customerName,
        published: r.published,
      },
    ];
  });
  return { waiting, firstSent, sites };
}

/**
 * Puts a site drawn with no deal onto a deal that has no design and no place yet: the deal takes the site's address,
 * and so finds its roof (`linkJobsToRoof`, which moves a lead to designed). Written on the deal's record. Refused when
 * the deal already has a design or an address of its own, so nothing on a deal is written over.
 */
export async function attachSite(
  businessId: string,
  viewer: DealViewer,
  input: { projectId: string; jobId: string },
  by: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const who = by.toLowerCase();
  const done = await transaction(async (q) => {
    const site = await q<{ address: string; lat: number; lng: number }>(
      `select address, lat, lng from design_projects where business_id = $1 and id = $2`,
      [businessId, input.projectId],
    );
    const job = await q<{ customerId: string; lat: number | null; lng: number | null; projectId: string | null }>(
      `select j.customer_id as "customerId", j.lat, j.lng, j.project_id as "projectId" from design_jobs j
        where j.business_id = $1 and j.id = $2 and ${seen(viewer, 3)} for update`,
      [businessId, input.jobId, ...seenParams(viewer)],
    );
    if (!site[0] || !job[0]) return { ok: false as const, status: 404, message: "That site or deal isn't there any more." };
    const refused = attachRefusal(job[0]);
    if (refused) return { ok: false as const, status: 409, message: refused };
    const s = site[0];
    await q(
      `update design_jobs set address = $3, lat = $4, lng = $5, roof_key = $6, updated_at = now() where business_id = $1 and id = $2`,
      [businessId, input.jobId, s.address, s.lat, s.lng, roofKey(s)],
    );
    await record(q, businessId, {
      customerId: job[0].customerId,
      jobId: input.jobId,
      kind: "note",
      text: `Design attached from a site drawn in the design tool: ${s.address}`,
      by: who,
    });
    return { ok: true as const, place: s };
  });
  if (!done.ok) return done;
  await linkJobsToRoof(businessId, done.place, who);
  return { ok: true };
}

/** What a deal's proposal timeline is drawn from: each version, its record (proposal and email lines), its chat. */
export async function timelineData(
  businessId: string,
  jobId: string,
): Promise<{ versions: TimelineVersion[]; activity: TimelineActivity[]; messages: TimelineMessage[] }> {
  const [versions, activity, messages] = await Promise.all([
    query<{ version: number; publishedAt: string; by: string; view: ProposalView; option: DesignGoal | null }>(
      `select v.version, ${moment("v.published_at")} as "publishedAt", v.published_by as by, v.view, v.accepted_option as option
         from design_proposals pr join design_proposal_versions v on v.business_id = pr.business_id and v.proposal_id = pr.id
        where pr.business_id = $1 and pr.job_id = $2 order by v.version`,
      [businessId, jobId],
    ),
    query<TimelineActivity>(
      `select kind, text, by_email as by, ${moment("at")} as at from design_activity
        where business_id = $1 and job_id = $2 and kind in ('proposal','email') order by at desc limit 200`,
      [businessId, jobId],
    ),
    query<TimelineMessage>(
      `select from_customer as "fromCustomer", text, ${moment("at")} as at from design_messages
        where business_id = $1 and job_id = $2 order by at desc limit 200`,
      [businessId, jobId],
    ),
  ]);
  return {
    versions: versions.map((v) => ({
      version: v.version,
      publishedAt: v.publishedAt,
      by: v.by,
      options: (v.view.options?.length ? v.view.options.map((o) => o.goal) : [null]).map((goal) => {
        const view = goal ? viewForChoice(v.view, goal) : v.view;
        const name = goal ? (v.view.options?.find((o) => o.goal === goal)?.name ?? "Option") : "The system";
        const { kw, batteryKwh } = view.system;
        return {
          name,
          system: [`${kw.toFixed(2)} kW`, batteryKwh > 0 ? `${batteryKwh} kWh battery` : ""].filter(Boolean).join(" with "),
          youPay: view.price.youPay,
        };
      }),
    })),
    activity,
    messages,
  };
}
