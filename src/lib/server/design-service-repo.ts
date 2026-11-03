/**
 * Server only. The service pipeline (domain/design/service.ts): a business's cases to put right after the sale. Under
 * the designer's tenant rule: every function takes the business id first and filters by it, and that id only ever
 * comes from the signed-in member. Every change is written on the deal's record (activity kind `service`); nothing is
 * sent to the customer.
 */
import {
  ALREADY_OPEN,
  ISSUE_MISSING,
  MAX_ISSUE,
  applyUpdate,
  cleanText,
  recordLine,
  type ServiceCase,
  type ServiceState,
  type ServiceUpdate,
} from "@/lib/domain/design/service";
import type { JobStage } from "@/lib/domain/design/crm";
import { record } from "./design-crm-repo";
import { newId, query, transaction } from "./db";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const CASE = `c.id, c.job_id as "jobId", c.customer_id as "customerId", c.issue, c.state, ${moment("c.raised_at")} as "raisedAt",
  c.raised_by as "raisedBy", ${moment("c.resolved_at")} as "resolvedAt", c.updates`;

/** A case as the planner shows it: with its customer and deal as they are now. */
export interface ServiceLine extends ServiceCase {
  customer: string;
  phone: string;
  email: string;
  address: string;
  title: string;
  stage: JobStage;
  installDate: string | null;
  installer: string | null;
}

/** Every case the business has, with its customer and deal. */
export async function listCases(businessId: string): Promise<ServiceLine[]> {
  return query<ServiceLine>(
    `select ${CASE}, cu.name as customer, cu.phone, cu.email, coalesce(nullif(j.address, ''), cu.address) as address,
            j.title, j.stage, to_char(j.install_date, 'YYYY-MM-DD') as "installDate", j.details->>'installer' as installer
       from design_service_cases c
       join design_jobs j on j.business_id = c.business_id and j.id = c.job_id
       join design_customers cu on cu.business_id = j.business_id and cu.id = j.customer_id
      where c.business_id = $1`,
    [businessId],
  );
}

/** Every case on one deal, oldest first: what Sol reads with the deal. */
export async function casesForJob(businessId: string, jobId: string): Promise<ServiceCase[]> {
  return query<ServiceCase>(`select ${CASE} from design_service_cases c where c.business_id = $1 and c.job_id = $2 order by c.raised_at`, [
    businessId,
    jobId,
  ]);
}

/** How many cases are still to put right, for the nav. */
export async function casesToResolve(businessId: string): Promise<number> {
  const rows = await query<{ n: string }>(`select count(*) as n from design_service_cases where business_id = $1 and state <> 'resolved'`, [
    businessId,
  ]);
  return Number(rows[0]?.n ?? 0);
}

/** Raises a case on a deal. "missing" for a deal the business hasn't; a message when it is refused. */
export async function raiseCase(
  businessId: string,
  jobId: string,
  rawIssue: unknown,
  by: string,
): Promise<ServiceCase | "missing" | { refused: string }> {
  const issue = cleanText(rawIssue, MAX_ISSUE);
  if (!issue) return { refused: ISSUE_MISSING };
  return transaction(async (q) => {
    // The job's row is locked, so two people raising at once can't both open a case.
    const jobs = await q<{ customerId: string }>(
      `select customer_id as "customerId" from design_jobs where business_id = $1 and id = $2 for update`,
      [businessId, jobId],
    );
    if (!jobs[0]) return "missing";
    const open = await q(`select 1 from design_service_cases where business_id = $1 and job_id = $2 and state <> 'resolved'`, [
      businessId,
      jobId,
    ]);
    if (open.length) return { refused: ALREADY_OPEN };
    const rows = await q<ServiceCase>(
      `insert into design_service_cases as c (id, business_id, job_id, customer_id, issue, raised_by)
       values ($2, $1, $3, $4, $5, $6) returning ${CASE}`,
      [businessId, newId("svc"), jobId, jobs[0].customerId, issue, by.toLowerCase()],
    );
    await record(q, businessId, {
      customerId: jobs[0].customerId,
      jobId,
      kind: "service",
      text: `Flagged for service\nIssue: ${issue}`,
      by,
    });
    return rows[0];
  });
}

/** A move, a note or both on a case. "missing" for a case the business hasn't; a message when it is refused. */
export async function updateCase(
  businessId: string,
  id: string,
  change: { state?: unknown; text?: unknown },
  by: string,
): Promise<ServiceCase | "missing" | { refused: string }> {
  return transaction(async (q) => {
    const found = await q<ServiceCase>(`select ${CASE} from design_service_cases c where c.business_id = $1 and c.id = $2 for update`, [
      businessId,
      id,
    ]);
    const current = found[0];
    if (!current) return "missing";
    // The deal's other cases, for the one-open-at-a-time rule when opening again; the job's row locked as when raising.
    await q(`select 1 from design_jobs where business_id = $1 and id = $2 for update`, [businessId, current.jobId]);
    const others = await q<ServiceCase>(`select ${CASE} from design_service_cases c where c.business_id = $1 and c.job_id = $2`, [
      businessId,
      current.jobId,
    ]);
    const next = applyUpdate(current, change, by.toLowerCase(), new Date().toISOString(), others);
    if (!next.ok) return { refused: next.message };
    const c = next.case;
    const rows = await q<ServiceCase>(
      `update design_service_cases c set state = $3, resolved_at = $4, updates = $5 where c.business_id = $1 and c.id = $2 returning ${CASE}`,
      [businessId, id, c.state satisfies ServiceState, c.resolvedAt, JSON.stringify(c.updates)],
    );
    const update = c.updates[c.updates.length - 1] as ServiceUpdate;
    await record(q, businessId, { customerId: c.customerId, jobId: c.jobId, kind: "service", text: recordLine(c.issue, update), by });
    return rows[0];
  });
}
