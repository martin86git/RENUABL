/**
 * Server only. What the news is set against, product by product (domain/design/product-watch.ts): the systems on a
 * business's sold and installed deals, read as the member may see them, and the price moves kept when a price list is
 * saved. Under the designer's tenant rule: the business id first, from the signed-in member only.
 */
import { WON_STAGES, INSTALLED_STAGES } from "@/lib/domain/design/crm";
import type { DealViewer } from "@/lib/domain/design/account";
import type { AsBuiltInput } from "@/lib/domain/design/as-built";
import { cleanDesignSet, type RoofDesign } from "@/lib/domain/design/roof-design";
import { priceMoves, type JobKit, type PriceMoves, type PriceMovesNote } from "@/lib/domain/design/product-watch";
import { newId, query } from "./db";
import { listJobs } from "./design-crm-repo";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/** The typed system lines that name a product. */
const PRODUCT_DETAILS = ["panel", "inverter", "additionalInverter", "battery", "evCharger"] as const;

const designProducts = (d: RoofDesign | null): string[] =>
  d
    ? ([d.panel, ...(d.inverters ?? []), d.battery, d.charger] as ({ sku: string; name: string } | undefined)[])
        .filter((p): p is { sku: string; name: string } => Boolean(p && (p.sku || p.name)))
        .map((p) => `${p.name} ${p.sku}`.trim())
    : [];

const builtProducts = (b: AsBuiltInput): string[] =>
  [b.panels?.model, ...(b.inverters ?? []).map((i) => i.model), b.battery?.model].filter((m): m is string => Boolean(m?.trim()));

/**
 * Every sold and installed deal the viewer may see, with the products in its system: what was recorded as built when
 * there is an as-built (and the design's EV charger, which the as-built doesn't hold), else the design the customer
 * signed for (else the roof's primary) and the product lines typed on the deal.
 */
export async function dealKits(businessId: string, viewer: DealViewer): Promise<JobKit[]> {
  const jobs = (await listJobs(businessId, viewer)).filter((j) => WON_STAGES.includes(j.stage));
  if (!jobs.length) return [];
  const ids = jobs.map((j) => j.id);
  const projectIds = [...new Set(jobs.map((j) => j.projectId).filter((p): p is string => Boolean(p)))];
  const [projects, built, chosen] = await Promise.all([
    projectIds.length
      ? query<{ id: string; design: unknown }>(`select id, design from design_projects where business_id = $1 and id = any($2)`, [
          businessId,
          projectIds,
        ])
      : Promise.resolve([]),
    query<{ jobId: string; data: AsBuiltInput }>(
      `select job_id as "jobId", data from design_as_built where business_id = $1 and job_id = any($2)`,
      [businessId, ids],
    ),
    query<{ jobId: string; option: string | null }>(
      `select distinct on (p.job_id) p.job_id as "jobId", v.accepted_option as option
         from design_proposals p join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id
        where p.business_id = $1 and p.job_id = any($2) and v.accepted_at is not null
        order by p.job_id, v.version desc`,
      [businessId, ids],
    ),
  ]);
  const sets = new Map(projects.map((p) => [p.id, cleanDesignSet(p.design)]));
  const asBuilt = new Map(built.map((b) => [b.jobId, b.data]));
  const option = new Map(chosen.map((c) => [c.jobId, c.option]));
  return jobs.map((j) => {
    const set = j.projectId ? sets.get(j.projectId) : null;
    const goal = option.get(j.id);
    const design = set ? (goal && set.designs.find((d) => d.goal === goal)) || set.designs[set.primary] || set.designs[0] || null : null;
    const b = asBuilt.get(j.id);
    const typed = PRODUCT_DETAILS.map((k) => j.details?.[k]).filter((v): v is string => Boolean(v?.trim()));
    const charger = design?.charger ? [`${design.charger.name} ${design.charger.sku}`.trim()] : [];
    const products = b ? [...builtProducts(b), ...charger] : [...designProducts(design), ...typed];
    return { jobId: j.id, customer: j.customerName, installed: INSTALLED_STAGES.includes(j.stage), products };
  });
}

/**
 * Keeps what moved when a price list was saved, against the business's prices before (`before`: its lists as they
 * were, newest first). Nothing is kept for a first list or when nothing moved.
 */
export async function keepPriceMoves(
  businessId: string,
  list: { name: string; items: readonly { sku: string; name: string; cost: number }[] },
  before: readonly { items: readonly { sku: string; cost: number }[] }[],
  by: string,
): Promise<PriceMoves | null> {
  const moves = priceMoves(list, before);
  if (!moves) return null;
  await query(`insert into design_price_moves (id, business_id, moves, by_email) values ($1, $2, $3, $4)`, [
    newId("moves", 8),
    businessId,
    JSON.stringify(moves),
    by.toLowerCase(),
  ]);
  return moves;
}

/** The business's price moves over the last `days`, newest first. Costs: only for members who see them. */
export async function recentPriceMoves(businessId: string, days: number): Promise<PriceMovesNote[]> {
  return query<PriceMovesNote>(
    `select id, ${moment("created_at")} as at, moves from design_price_moves
      where business_id = $1 and created_at > now() - make_interval(days => $2) order by created_at desc limit 20`,
    [businessId, days],
  );
}
