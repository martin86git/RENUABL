/**
 * Server only. How many people a business has, for Sol (domain/design/contact-counts.ts). Business id first, as every
 * designer table. Reads design_imports only when it exists (it is made by the first import).
 */
import { query } from "./db";
import { INSTALLED_STAGES } from "@/lib/domain/design/crm";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import type { ContactCounts, ImportRun } from "@/lib/domain/design/contact-counts";

const TZ = LAUNCH_MARKET.timeZone;

export async function contactCounts(businessId: string, since: string | null): Promise<ContactCounts> {
  const installed = [...INSTALLED_STAGES];
  const people = await query<{ people: string; customers: string }>(
    `select count(*) as people,
            count(*) filter (where exists (select 1 from design_jobs j where j.business_id = c.business_id and j.customer_id = c.id and j.stage = any($2))) as customers
       from design_customers c where c.business_id = $1 and not c.sample`,
    [businessId, installed],
  );
  const bySource = await query<{ source: string; people: string }>(
    `select source, count(*) as people from design_customers where business_id = $1 and not sample group by source order by count(*) desc limit 12`,
    [businessId],
  );
  let imports: ImportRun[] = [];
  const sinceImport: { source: string; after: string; people: number }[] = [];
  const has = await query<{ t: string | null }>(`select to_regclass('design_imports')::text as t`);
  if (has[0]?.t) {
    const runs = await query<{ source: string; brought: string; first: string; last: string; last_at: string }>(
      `select source, count(*) as brought,
              to_char(min(at at time zone $2), 'YYYY-MM-DD') as first,
              to_char(max(at at time zone $2), 'YYYY-MM-DD') as last,
              max(at)::text as last_at
         from design_imports where business_id = $1 group by source order by min(at)`,
      [businessId, TZ],
    );
    imports = runs.map((r) => ({ source: r.source, brought: Number(r.brought), first: r.first, last: r.last }));
    for (const r of runs) {
      // Not brought in by any import: made after this one's last record and not on the imports' own list.
      const after = await query<{ n: string }>(
        `select count(*) as n from design_customers c
          where c.business_id = $1 and not c.sample and c.created_at > $2::timestamptz
            and not exists (select 1 from design_imports i join design_jobs j on j.business_id = i.business_id and j.id = i.job_id
                             where i.business_id = c.business_id and j.customer_id = c.id)`,
        [businessId, r.last_at],
      );
      sinceImport.push({ source: r.source, after: r.last, people: Number(after[0]?.n ?? 0) });
    }
  }
  let sinceCount: ContactCounts["since"] = null;
  if (since) {
    const s = await query<{ people: string; customers: string }>(
      `select count(*) as people,
              count(*) filter (where exists (select 1 from design_jobs j where j.business_id = c.business_id and j.customer_id = c.id and j.stage = any($4))) as customers
         from design_customers c
        where c.business_id = $1 and not c.sample and (c.created_at at time zone $3)::date >= $2::date`,
      [businessId, since, TZ, installed],
    );
    sinceCount = { day: since, people: Number(s[0]?.people ?? 0), customers: Number(s[0]?.customers ?? 0) };
  }
  return {
    people: Number(people[0]?.people ?? 0),
    customers: Number(people[0]?.customers ?? 0),
    bySource: bySource.map((r) => ({ source: r.source, people: Number(r.people) })),
    imports,
    sinceImport,
    since: sinceCount,
  };
}
