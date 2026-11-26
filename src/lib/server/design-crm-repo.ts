/**
 * Server only. What the database keeps for the roof designer's CRM: a
 * business's customers, their jobs, and the record of what happened.
 *
 * The same rule as `design-repo.ts`: every function takes the business's id
 * first, every statement carries `business_id = $1`, and the id only ever
 * comes from the signed-in member (`design-context.ts`). A customer, job or
 * activity that belongs to another business reads as not there at all.
 */
import { isCustomer, jobHas, together, type CustomerHas } from "@/lib/domain/design/customers";
import { leadOwnerFor } from "@/lib/domain/design/deal-feed";
import { marketDateTime, todayInMarket } from "@/lib/domain/market";
import { roofKey, type DealViewer } from "@/lib/domain/design/account";
import { homeFor } from "@/lib/domain/design/same-home";
import { DESIGN_SAVED, DESIGN_SAVED_HOURS, designSavedLine } from "@/lib/domain/design/design-record";
import { cleanDesignSet } from "@/lib/domain/design/roof-design";
import {
  INSTALLED_STAGES,
  JOB_STAGES,
  MAX_CUSTOMERS,
  MAX_JOBS_PER_CUSTOMER,
  MAX_PIPELINES,
  OPEN_STAGES,
  SAMPLE_AUTHOR,
  SAMPLE_CUSTOMERS,
  WON_STAGES,
  customerStage,
  splitName,
  stageMoveText,
  type Activity,
  type Cleaned,
  type ActivityInput,
  type ActivityKind,
  type Customer,
  type CustomerInput,
  type Job,
  type JobInput,
  type JobStage,
} from "@/lib/domain/design/crm";
import { newId, query, transaction } from "./db";
import {
  MAX_OWN_STAGES,
  MAX_PIPELINE_STAGES,
  OWN_STAGES_FULL,
  PIPELINE_TOO_LONG,
  STAGE_NAME_MISSING,
  STAGE_NAME_TAKEN,
  cleanOwnStageInput,
  cleanStageName,
  cleanStageNames,
  dealStageName,
  renameBuiltin,
  insertStage,
  moveText,
  nameTaken,
  pipelinesFor,
  type KeptPipeline,
  type OwnStage,
  type StageNames,
} from "@/lib/domain/design/pipeline-stages";

export type Q = Parameters<Parameters<typeof transaction>[0]>[0];

/** A moment as the text the browser gets: "2026-10-10T03:15:00.000Z". */
const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/** Stages as a list for SQL. They are our own constants, never anything sent. */
const inList = (stages: readonly JobStage[]) => stages.map((s) => `'${s}'`).join(",");

const CUSTOMER = `c.id, c.name,
  case when c.first_name = '' and c.last_name = '' then split_part(c.name, ' ', 1) else c.first_name end as "firstName",
  case when c.first_name = '' and c.last_name = '' then btrim(substr(c.name, length(split_part(c.name, ' ', 1)) + 1)) else c.last_name end as "lastName",
  c.phone, c.email, c.address, c.lat, c.lng, c.source, c.notes, c.sample,
  ${moment("c.created_at")} as "createdAt", ${moment("c.updated_at")} as "updatedAt"`;
const JOB = `j.id, j.customer_id as "customerId", j.title, j.address, j.lat, j.lng, j.stage, j.sub_stage as "subStage", j.project_id as "projectId",
  j.value::float8 as value, to_char(j.install_date, 'YYYY-MM-DD') as "installDate", j.details,
  j.kw::float8 as kw, j.owner_email as owner,
  ${moment(`coalesce(j.won_at, case when j.stage in (${inList(WON_STAGES)}) then j.updated_at end)`)} as "wonAt",
  ${moment(`coalesce(j.installed_at, case when j.stage in (${inList(INSTALLED_STAGES)}) then j.updated_at end)`)} as "installedAt",
  ${moment("j.created_at")} as "createdAt", ${moment("j.updated_at")} as "updatedAt"`;
const ACTIVITY = `a.id, a.customer_id as "customerId", a.job_id as "jobId", a.kind, a.text, a.by_email as by, ${moment("a.at")} as at`;

/** Where a job's roof is, as the designer tells roofs apart. Null for a job with no place on the map. */
const keyOf = (at: { lat: number | null; lng: number | null }) =>
  at.lat === null || at.lng === null ? null : roofKey({ lat: at.lat, lng: at.lng });

/** Writes one line on a customer's record, inside the transaction it is given. Shared with the proposals. */
export async function record(
  q: Q,
  businessId: string,
  o: { customerId: string; jobId: string | null; kind: ActivityKind; text: string; by: string; minutesAgo?: number },
): Promise<Activity> {
  const rows = await q<Activity>(
    `insert into design_activity as a (id, business_id, customer_id, job_id, kind, text, by_email, at)
     values ($2,$1,$3,$4,$5,$6,$7, now() - ($8 || ' minutes')::interval) returning ${ACTIVITY}`,
    [businessId, newId("act"), o.customerId, o.jobId, o.kind, o.text, o.by, String(o.minutesAgo ?? 0)],
  );
  return rows[0];
}

// ---------------------------------------------------------------------------
// Designs and jobs find each other by the roof they share
// ---------------------------------------------------------------------------

/**
 * Joins jobs to the roof design at the same place: every one of the
 * business's jobs there that has no design yet gets it, and a job still at
 * "lead" moves to "designed", which is written down like any other move.
 * Narrowed to one job or one roof. Doing it again changes nothing.
 */
async function link(q: Q, businessId: string, only: { jobId?: string; roof?: { lat: number; lng: number } }, by: string): Promise<void> {
  const names = { got: null as Awaited<ReturnType<typeof stageNamesIn>> | null };
  const stageNames = async () => (names.got ??= await stageNamesIn(q, businessId));
  const join = async (job: { id: string; customer_id: string; stage: JobStage }, project: string, moveTo?: ProjectSpot) => {
    const designed = job.stage === "lead";
    await q(
      moveTo
        ? `update design_jobs set project_id = $3, stage = $4, lat = $5, lng = $6, roof_key = $7, updated_at = now() where business_id = $1 and id = $2`
        : `update design_jobs set project_id = $3, stage = $4, updated_at = now() where business_id = $1 and id = $2`,
      [businessId, job.id, project, designed ? "designed" : job.stage, ...(moveTo ? [moveTo.lat, moveTo.lng, roofKey(moveTo)] : [])],
    );
    if (moveTo)
      await record(q, businessId, {
        customerId: job.customer_id,
        jobId: job.id,
        kind: "note",
        text: `Joined to the roof design drawn at ${moveTo.address || "this address"}`,
        by,
      });
    if (designed)
      await record(q, businessId, {
        customerId: job.customer_id,
        jobId: job.id,
        kind: "stage",
        text: stageMoveText("designed", await stageNames()),
        by,
      });
  };

  const key = only.roof ? roofKey(only.roof) : null;
  const exact = await q<{ id: string; customer_id: string; stage: JobStage; project: string }>(
    `select j.id, j.customer_id, j.stage, p.id as project
       from design_jobs j join design_projects p on p.business_id = j.business_id and p.roof_key = j.roof_key
      where j.business_id = $1 and j.project_id is null
        and ($2::text is null or j.id = $2) and ($3::text is null or j.roof_key = $3)
        for update of j`,
    [businessId, only.jobId ?? null, key],
  );
  for (const job of exact) await join(job, job.project);

  // Then the same home a few metres apart (22 Nov 2026): a deal placed by one map and a design drawn on another.
  const box = (at: { lat: number; lng: number }) => [at.lat - NEAR_DEG, at.lat + NEAR_DEG, at.lng - NEAR_DEG, at.lng + NEAR_DEG];
  const loose = await q<{ id: string; customer_id: string; stage: JobStage; address: string; lat: number; lng: number }>(
    `select j.id, j.customer_id, j.stage, j.address, j.lat, j.lng from design_jobs j
      where j.business_id = $1 and j.project_id is null and j.lat is not null and j.lng is not null
        and ($2::text is null or j.id = $2)
        and ($3::float8 is null or (j.lat between $3 and $4 and j.lng between $5 and $6))
        for update of j`,
    [businessId, only.jobId ?? null, ...(only.roof ? box(only.roof) : [null, null, null, null])],
  );
  for (const job of loose) {
    const near = await q<ProjectSpot & { id: string }>(
      `select id, address, lat, lng from design_projects
        where business_id = $1 and lat between $2 and $3 and lng between $4 and $5`,
      [businessId, ...box(job)],
    );
    const home = homeFor(job, near);
    if (home) await join(job, home.id, home);
  }
}

type ProjectSpot = { address: string; lat: number; lng: number };
/** How far round a deal to look for a design of the same home: a little over `SAME_HOME_M` in degrees. */
const NEAR_DEG = 0.0005;

/**
 * A deal with no design yet joined to one of the same home drawn a few metres off (an imported deal's place and
 * the designer's), so its proposal and designer find it. Never a failure for the reader: logged and left.
 */
export async function joinNearbyDesign(businessId: string, jobId: string, by: string): Promise<void> {
  try {
    await transaction((q) => link(q, businessId, { jobId }, by.toLowerCase()));
  } catch (e) {
    console.error("joining a deal to a nearby design failed", e instanceof Error ? e.message : e);
  }
}

/**
 * Called when a roof design is first kept or saved again (`design-repo.ts`):
 * the business's jobs at that roof are joined to it. A failure here is logged
 * and never stops the design being saved: the next save tries again.
 */
export async function linkJobsToRoof(businessId: string, roof: { lat: number; lng: number }, by: string): Promise<void> {
  try {
    await transaction((q) => link(q, businessId, { roof }, by.toLowerCase()));
  } catch (e) {
    console.error("joining jobs to a roof design failed", e instanceof Error ? e.message : e);
  }
}

/**
 * Writes "Roof design saved · …" on the timeline of every deal joined to a roof design (25 Nov 2026, Martin: the deal's
 * timeline shows a design being done). A save within `DESIGN_SAVED_HOURS` of the last such line replaces it, so a run
 * of saves is one entry. Never stops a save.
 */
export async function noteDesignSaved(businessId: string, projectId: string, design: unknown, by: string): Promise<void> {
  try {
    const set = cleanDesignSet(design);
    if (!set) return;
    const text = designSavedLine(set);
    const who = by.toLowerCase();
    await transaction(async (q) => {
      const jobs = await q<{ id: string; customer_id: string }>(
        `select id, customer_id from design_jobs where business_id = $1 and project_id = $2`,
        [businessId, projectId],
      );
      for (const job of jobs) {
        const recent = await q<{ id: string }>(
          `select id from design_activity where business_id = $1 and job_id = $2 and kind = 'note'
             and text like $3 and at > now() - ($4 || ' hours')::interval order by at desc limit 1`,
          [businessId, job.id, `${DESIGN_SAVED}%`, String(DESIGN_SAVED_HOURS)],
        );
        if (recent[0]) {
          await q(`update design_activity set text = $3, by_email = $4, at = now() where business_id = $1 and id = $2`, [
            businessId,
            recent[0].id,
            text,
            who,
          ]);
        } else {
          await record(q, businessId, { customerId: job.customer_id, jobId: job.id, kind: "note", text, by: who });
        }
      }
    });
  } catch (e) {
    console.error("noting a saved design failed", e instanceof Error ? e.message : e);
  }
}

// ---------------------------------------------------------------------------
// The customers a new business starts with
// ---------------------------------------------------------------------------

/**
 * Adds the made-up customers, once for each business, the first time its
 * customers, jobs or overview are read. The business is marked as it happens,
 * so two requests at once add them once, and deleting them later doesn't
 * bring them back.
 */
export async function ensureSamples(businessId: string): Promise<void> {
  await transaction(async (q) => {
    const first = await q(`update businesses set samples_added_at = now() where id = $1 and samples_added_at is null returning id`, [
      businessId,
    ]);
    if (!first.length) return;
    // Spaced a few minutes apart, the first the most recent, so they list in the order they are written in.
    for (const [i, sample] of SAMPLE_CUSTOMERS.entries()) {
      const customerId = newId("cus");
      const jobId = newId("job");
      await q(
        `insert into design_customers (id, business_id, name, phone, email, address, source, notes, sample, created_by, created_at, updated_at)
         values ($2,$1,$3,$4,$5,$6,$7,$8,true,$9, now() - ($10 || ' minutes')::interval, now() - ($10 || ' minutes')::interval)`,
        [
          businessId,
          customerId,
          sample.name,
          sample.phone,
          sample.email,
          sample.address,
          sample.source,
          sample.notes,
          SAMPLE_AUTHOR,
          String(i * 5),
        ],
      );
      await q(
        `insert into design_jobs (id, business_id, customer_id, title, address, stage, value, created_by, created_at, updated_at)
         values ($2,$1,$3,$4,$5,$6,$7,$8, now() - ($9 || ' minutes')::interval, now() - ($9 || ' minutes')::interval)`,
        [businessId, jobId, customerId, sample.job.title, sample.address, sample.job.stage, sample.job.value, SAMPLE_AUTHOR, String(i * 5)],
      );
      await record(q, businessId, { customerId, jobId, ...sample.activity, by: SAMPLE_AUTHOR, minutesAgo: i * 5 });
    }
  });
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export type CustomerLine = Customer & {
  /** How many jobs they have. */
  jobs: number;
  /** The one stage shown beside them (`customerStage`), null with no jobs. */
  stage: JobStage | null;
  /** A customer (a job installed), not only a contact (`isCustomer`). */
  installed: boolean;
  /** What their jobs put in (`jobHas`). */
  has: CustomerHas;
  /** They asked for no more group emails. */
  unsubscribed: boolean;
};

/** The business's customers, whoever something last happened with first. */
export async function listCustomers(businessId: string): Promise<CustomerLine[]> {
  await ensureSamples(businessId);
  const rows = await query<
    Customer & { stages: JobStage[]; parts: { kw: number | null; title: string; details: Record<string, string> }[]; unsubscribed: boolean }
  >(
    `select ${CUSTOMER}, coalesce(j.stages, '{}') as stages, coalesce(j.parts, '[]'::json) as parts, c.unsubscribed_at is not null as unsubscribed
       from design_customers c
       left join lateral (select array_agg(stage order by created_at, id) as stages,
                                 json_agg(json_build_object('kw', kw, 'title', title, 'details', details)) filter (where stage <> 'lost') as parts
                            from design_jobs where business_id = $1 and customer_id = c.id) j on true
       left join lateral (select max(at) as last from design_activity where business_id = $1 and customer_id = c.id) a on true
      where c.business_id = $1
      order by greatest(c.updated_at, coalesce(a.last, c.updated_at)) desc, c.id
      limit $2`,
    [businessId, MAX_CUSTOMERS],
  );
  return rows.map(({ stages, parts, ...customer }) => ({
    ...customer,
    jobs: stages.length,
    stage: customerStage(stages),
    installed: isCustomer(stages),
    has: together(parts.map((p) => jobHas({ kw: p.kw === null ? null : Number(p.kw), title: p.title ?? "", details: p.details ?? {} }))),
  }));
}

async function customerRow(q: Q | typeof query, businessId: string, id: string): Promise<Customer | null> {
  const rows = await q<Customer>(`select ${CUSTOMER} from design_customers c where c.business_id = $1 and c.id = $2`, [businessId, id]);
  return rows[0] ?? null;
}

/** Who a new lead belongs to (deal-feed.ts `leadOwnerFor`): the business's members, its rule and who was given one last. */
async function newLeadOwner(q: Q, businessId: string, by: string): Promise<string> {
  const [members, prefs, given] = await Promise.all([
    q<{ email: string; role: string }>(`select email, role from business_members where business_id = $1`, [businessId]),
    q<{ prefs: { leadRule?: unknown } | null }>(`select prefs from design_prefs where business_id = $1`, [businessId]),
    q<{ owner: string; at: string }>(
      `select owner_email as owner, max(created_at)::text as at from design_jobs
        where business_id = $1 and owner_email is not null group by owner_email`,
      [businessId],
    ),
  ]);
  const rule = prefs[0]?.prefs?.leadRule === "turns" ? "turns" : "adder";
  return leadOwnerFor(by, members, rule, Object.fromEntries(given.map((g) => [g.owner.toLowerCase(), g.at])));
}

/** A member of the business by email, as kept, or null: who a new deal is assigned to must be one of its own people. */
async function memberEmail(q: Q, businessId: string, email: string | null | undefined): Promise<string | null> {
  const want = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!want) return null;
  const rows = await q<{ email: string }>(`select email from business_members where business_id = $1 and lower(email) = $2`, [
    businessId,
    want,
  ]);
  return rows[0] ? rows[0].email.toLowerCase() : null;
}

async function insertJob(q: Q, businessId: string, customerId: string, job: JobInput, by: string, assign?: string | null): Promise<Job> {
  const id = newId("job");
  // Assigned in the new deal's form (18 Nov 2026, Martin: "Assign to:" with who to give the lead to), when it names one
  // of the business's people; else as below.
  const chosen = await memberEmail(q, businessId, assign);
  // A lead the owner adds goes to the business's one salesperson when there is exactly one (deal-feed.ts, 10 Nov 2026).
  // Once there are more salespeople, the business's rule decides (Today → New in): kept by whoever adds them, or in turns.
  const owner = chosen ?? (job.stage === "lead" ? await newLeadOwner(q, businessId, by) : by);
  await q(
    `insert into design_jobs (id, business_id, customer_id, title, address, lat, lng, roof_key, stage, value, install_date, created_by, details, owner_email)
     values ($2,$1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)`,
    [
      businessId,
      id,
      customerId,
      job.title,
      job.address,
      job.lat,
      job.lng,
      keyOf(job),
      job.stage,
      job.value,
      job.installDate,
      by,
      JSON.stringify(job.details ?? {}),
      owner,
    ],
  );
  // If the business has already drawn this roof, the new job is for that design.
  await link(q, businessId, { jobId: id }, by);
  const rows = await q<Job>(`select ${JOB} from design_jobs j where j.business_id = $1 and j.id = $2`, [businessId, id]);
  return rows[0];
}

/**
 * A new customer. When they come with an address, their first job is made
 * for it too (a lead called "Solar"); otherwise `job` is null. "full" at the limit.
 */
export async function createCustomer(
  businessId: string,
  input: CustomerInput,
  firstJob: JobInput | null,
  by: string,
  assign?: string | null,
): Promise<{ customer: Customer; job: Job | null } | "full"> {
  const who = by.toLowerCase();
  return transaction(async (q) => {
    const count = await q<{ n: string }>(`select count(*) as n from design_customers where business_id = $1`, [businessId]);
    if (Number(count[0]?.n ?? 0) >= MAX_CUSTOMERS) return "full";
    const id = newId("cus");
    await q(
      `insert into design_customers (id, business_id, name, phone, email, address, lat, lng, source, notes, created_by, first_name, last_name)
       values ($2,$1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        businessId,
        id,
        input.name,
        input.phone,
        input.email,
        input.address,
        input.lat,
        input.lng,
        input.source,
        input.notes,
        who,
        input.firstName ?? splitName(input.name).firstName,
        input.lastName ?? splitName(input.name).lastName,
      ],
    );
    const job = firstJob ? await insertJob(q, businessId, id, firstJob, who, assign) : null;
    const customer = await customerRow(q, businessId, id);
    if (!customer) throw new Error("the customer couldn't be kept");
    return { customer, job };
  });
}

export async function customerById(businessId: string, id: string): Promise<Customer | null> {
  return customerRow(query, businessId, id);
}

/** A customer with their jobs (newest first) and what has happened (newest first, the latest 200). */
export async function customerDetail(
  businessId: string,
  id: string,
  viewer?: DealViewer,
): Promise<{ customer: Customer; jobs: Job[]; activity: Activity[] } | null> {
  const customer = await customerRow(query, businessId, id);
  if (!customer) return null;
  const [jobs, activity] = await Promise.all([
    query<Job>(
      `select ${JOB} from design_jobs j where j.business_id = $1 and j.customer_id = $2 and ${seen(viewer, 3)} order by j.created_at desc, j.id`,
      [businessId, id, ...seenParams(viewer)],
    ),
    query<Activity>(
      `select ${ACTIVITY} from design_activity a where a.business_id = $1 and a.customer_id = $2 order by a.at desc, a.id limit 200`,
      [businessId, id],
    ),
  ]);
  return { customer, jobs, activity };
}

export async function updateCustomer(businessId: string, id: string, input: CustomerInput): Promise<Customer | null> {
  const rows = await query(
    // The two parts of the name: as sent; else left as they are while the whole name is unchanged; else the new name split.
    `update design_customers set
        first_name = case when $11::text is not null then $11 when name = $3 then first_name else $13 end,
        last_name = case when $12::text is not null then $12 when name = $3 then last_name else $14 end,
        name = $3, phone = $4, email = $5, address = $6, lat = $7, lng = $8, source = $9, notes = $10, updated_at = now()
      where business_id = $1 and id = $2 returning id`,
    [
      businessId,
      id,
      input.name,
      input.phone,
      input.email,
      input.address,
      input.lat,
      input.lng,
      input.source,
      input.notes,
      input.firstName ?? null,
      input.lastName ?? null,
      splitName(input.name).firstName,
      splitName(input.name).lastName,
    ],
  );
  return rows.length ? customerRow(query, businessId, id) : null;
}

/** Removes a customer with their jobs and their record. Roof designs are kept: they belong to the business, not the customer. */
export async function deleteCustomer(businessId: string, id: string): Promise<boolean> {
  const rows = await query(`delete from design_customers where business_id = $1 and id = $2 returning id`, [businessId, id]);
  return rows.length > 0;
}

/**
 * A note, call or email written on a customer, with who wrote it and the
 * server's time. "missing" when the business has no such customer;
 * "not-their-job" when the job named isn't one of that customer's.
 */
export async function addActivity(
  businessId: string,
  customerId: string,
  input: ActivityInput,
  by: string,
): Promise<Activity | "missing" | "not-their-job"> {
  return transaction(async (q) => {
    if (!(await customerRow(q, businessId, customerId))) return "missing";
    if (input.jobId) {
      const job = await q(`select 1 from design_jobs where business_id = $1 and id = $2 and customer_id = $3`, [
        businessId,
        input.jobId,
        customerId,
      ]);
      if (!job.length) return "not-their-job";
    }
    return record(q, businessId, { customerId, jobId: input.jobId, kind: input.kind, text: input.text, by: by.toLowerCase() });
  });
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/** Every job the business has, the most recently changed first, each with its customer's name. */
export async function listJobs(businessId: string, viewer?: DealViewer): Promise<(Job & { customerName: string; sample: boolean })[]> {
  await ensureSamples(businessId);
  return query(
    `select ${JOB}, c.name as "customerName", (c.sample and c.source <> 'Example deal') as "sample"
       from design_jobs j join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where j.business_id = $1 and ${seen(viewer, 2)} order by j.updated_at desc, j.id limit 20000`,
    [businessId, ...seenParams(viewer)],
  );
}

/**
 * The deals a viewer sees, as a condition on design_jobs j: everyone's, or (not seeing every deal) their own, no one's,
 * and those they are mentioned on. The same rule as `seesDeal`. Its parameter is the viewer's email, at `at`.
 */
export function seen(viewer: DealViewer | undefined, at: number): string {
  if (!viewer || viewer.all) return "true";
  const p = `$${at}`;
  return `(j.owner_email is null or j.owner_email = ${p} or exists (select 1 from design_notifications n
    where n.business_id = j.business_id and n.job_id = j.id and n.to_email = ${p}))`;
}
export const seenParams = (viewer: DealViewer | undefined) => (viewer && !viewer.all ? [viewer.email.toLowerCase()] : []);

/** Gives a deal to a member of the business (an email) or to no one (null), written on its record. Null: no such deal. */
export async function setJobOwner(businessId: string, id: string, owner: string | null, by: string): Promise<Job | null> {
  return transaction(async (q) => {
    const rows = await q<Job>(
      `update design_jobs j set owner_email = $3, updated_at = now() where j.business_id = $1 and j.id = $2 returning ${JOB}`,
      [businessId, id, owner],
    );
    if (!rows[0]) return null;
    await record(q, businessId, {
      customerId: rows[0].customerId,
      jobId: id,
      kind: "note",
      text: owner ? `Deal given to ${owner.split("@")[0]}` : "Deal left with no owner",
      by: by.toLowerCase(),
    });
    return rows[0];
  });
}

/** A new job for one of the business's customers. "missing" when it has no such customer, "full" at the limit. */
export async function createJob(
  businessId: string,
  customerId: string,
  input: JobInput,
  by: string,
  assign?: string | null,
): Promise<Job | "missing" | "full"> {
  return transaction(async (q) => {
    if (!(await customerRow(q, businessId, customerId))) return "missing";
    const count = await q<{ n: string }>(`select count(*) as n from design_jobs where business_id = $1 and customer_id = $2`, [
      businessId,
      customerId,
    ]);
    if (Number(count[0]?.n ?? 0) >= MAX_JOBS_PER_CUSTOMER) return "full";
    return insertJob(q, businessId, customerId, input, by.toLowerCase(), assign);
  });
}

export async function jobById(businessId: string, id: string, viewer?: DealViewer): Promise<{ job: Job; customer: Customer } | null> {
  const jobs = await query<Job>(`select ${JOB} from design_jobs j where j.business_id = $1 and j.id = $2 and ${seen(viewer, 3)}`, [
    businessId,
    id,
    ...seenParams(viewer),
  ]);
  const customer = jobs[0] && (await customerRow(query, businessId, jobs[0].customerId));
  return jobs[0] && customer ? { job: jobs[0], customer } : null;
}

/**
 * Changes a job. `change` is given the job as it stands (read under a lock,
 * so two people moving it at once can't both read the old stage) and answers
 * with the job as it should be, or with why what was sent can't be kept (`refused`). A move to another stage is written down. A
 * job moved to another place lets go of its design and picks up the one at
 * the new place, if the business has drawn it. Null when there's no such job.
 */
export async function updateJob(
  businessId: string,
  id: string,
  change: (current: Job) => Cleaned<JobInput>,
  by: string,
): Promise<Job | { refused: string } | null> {
  const who = by.toLowerCase();
  return transaction(async (q) => {
    const rows = await q<Job>(`select ${JOB} from design_jobs j where j.business_id = $1 and j.id = $2 for update`, [businessId, id]);
    const before = rows[0];
    if (!before) return null;
    const changed = change(before);
    if (!changed.ok) return { refused: changed.message };
    const next = changed.value;
    const moved = keyOf(next) !== keyOf(before);
    await q(
      `update design_jobs set title = $3, address = $4, lat = $5, lng = $6, roof_key = $7, stage = $8, value = $9, install_date = $10,
              project_id = case when $11::boolean then null else project_id end, details = $12::jsonb,
              kw = case when $13::boolean then $14::numeric else kw end,
              -- Sold and installed are dated when a job first reaches those stages, and undated if it goes back.
              won_at = case when $15::boolean then coalesce(won_at, now()) else null end,
              installed_at = case when $16::boolean then coalesce(installed_at, now()) else null end,
              sub_stage = $17,
              updated_at = now()
        where business_id = $1 and id = $2`,
      [
        businessId,
        id,
        next.title,
        next.address,
        next.lat,
        next.lng,
        keyOf(next),
        next.stage,
        next.value,
        next.installDate,
        moved,
        JSON.stringify(next.details ?? {}),
        next.kw !== undefined,
        next.kw ?? null,
        WON_STAGES.includes(next.stage),
        INSTALLED_STAGES.includes(next.stage),
        next.subStage ?? null,
      ],
    );
    const sub = next.subStage ?? null;
    if (next.stage !== before.stage || sub !== (before.subStage ?? null)) {
      const own = sub ? await q<OwnStage>(`select ${STAGE} from design_stages where business_id = $1 and id = $2`, [businessId, sub]) : [];
      const named = await q<{ stage: string; name: string }>(
        `select stage, name from design_stage_names where business_id = $1 and stage = $2`,
        [businessId, next.stage],
      );
      const names = cleanStageNames(Object.fromEntries(named.map((r) => [r.stage, r.name])));
      const text = (sub && own[0]) || names[next.stage] ? moveText(next.stage, sub, own, names) : stageMoveText(next.stage);
      await record(q, businessId, { customerId: before.customerId, jobId: id, kind: "stage", text, by: who });
    }
    // Every change of a deal's address is on its record, with what it was (26 Nov 2026, Martin: a deal brought in from
    // Pylon showed another address and nothing said how it got there).
    const was = (before.address ?? "").trim();
    const now = (next.address ?? "").trim();
    if (was !== now)
      await record(q, businessId, {
        customerId: before.customerId,
        jobId: id,
        kind: "note",
        text: was ? `Address changed from ${was} to ${now || "no address"}` : `Address set to ${now}`,
        by: who,
      });
    if (moved) await link(q, businessId, { jobId: id }, who);
    const after = await q<Job>(`select ${JOB} from design_jobs j where j.business_id = $1 and j.id = $2`, [businessId, id]);
    return after[0];
  });
}

export async function deleteJob(businessId: string, id: string): Promise<boolean> {
  const rows = await query(`delete from design_jobs where business_id = $1 and id = $2 returning id`, [businessId, id]);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Saved pipelines
// ---------------------------------------------------------------------------

const PIPELINE = `id, name, stages, base_id as "baseId"`;
const STAGE = `id, name, base`;

/** The pipelines the business keeps (its own, and stand-ins for set ones it changed), in the order they were made. */
export async function listPipelines(businessId: string): Promise<KeptPipeline[]> {
  return query(`select ${PIPELINE} from design_pipelines where business_id = $1 order by created_at, id`, [businessId]);
}

/**
 * Saves a pipeline for the business: one of its own, or (with `baseId`) a stand-in for a set pipeline, which replaces
 * any stand-in it had for that one. "full" at the limit.
 */
export async function createPipeline(
  businessId: string,
  input: Pick<KeptPipeline, "name" | "stages" | "baseId">,
  by: string,
): Promise<KeptPipeline | "full"> {
  return transaction(async (q) => {
    if (input.baseId) {
      const rows = await q<KeptPipeline>(
        `insert into design_pipelines (id, business_id, name, stages, base_id, created_by) values ($2,$1,$3,$4::jsonb,$5,$6)
           on conflict (business_id, base_id) where base_id is not null do update set name = excluded.name, stages = excluded.stages
           returning ${PIPELINE}`,
        [businessId, newId("pipe"), input.name, JSON.stringify(input.stages), input.baseId, by.toLowerCase()],
      );
      return rows[0];
    }
    const count = await q<{ n: string }>(`select count(*) as n from design_pipelines where business_id = $1 and base_id is null`, [
      businessId,
    ]);
    if (Number(count[0]?.n ?? 0) >= MAX_PIPELINES) return "full";
    const rows = await q<KeptPipeline>(
      `insert into design_pipelines (id, business_id, name, stages, created_by) values ($2,$1,$3,$4::jsonb,$5) returning ${PIPELINE}`,
      [businessId, newId("pipe"), input.name, JSON.stringify(input.stages), by.toLowerCase()],
    );
    return rows[0];
  });
}

/** Renames one of the business's pipelines or changes its stages. Null when it has no such pipeline. */
export async function updatePipeline(
  businessId: string,
  id: string,
  input: Pick<KeptPipeline, "name" | "stages">,
): Promise<KeptPipeline | null> {
  const rows = await query<KeptPipeline>(
    `update design_pipelines set name = $3, stages = $4::jsonb where business_id = $1 and id = $2 returning ${PIPELINE}`,
    [businessId, id, input.name, JSON.stringify(input.stages)],
  );
  return rows[0] ?? null;
}

/** Removes one of the business's pipelines (a stand-in: the set pipeline comes back as it was). Its deals are untouched. */
export async function deletePipeline(businessId: string, id: string): Promise<boolean> {
  const rows = await query(`delete from design_pipelines where business_id = $1 and id = $2 returning id`, [businessId, id]);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// The business's own stages
// ---------------------------------------------------------------------------

/** The stages the business added, in the order they were made. */
export async function listOwnStages(businessId: string): Promise<OwnStage[]> {
  return query(`select ${STAGE} from design_stages where business_id = $1 order by created_at, id`, [businessId]);
}

/**
 * Adds a stage, and with `pipelineId` puts it into that pipeline after position `after` (a set pipeline's id makes
 * or changes its stand-in). Checked again under a lock: the name not taken, the limit. Answers the stage and the
 * pipeline as kept, or why not.
 */
export async function addOwnStage(
  businessId: string,
  raw: unknown,
  place: { pipelineId: string; after: number } | null,
  by: string,
): Promise<{ stage: OwnStage; pipeline: KeptPipeline | null } | { refused: string }> {
  return transaction(async (q) => {
    await q(`select pg_advisory_xact_lock(hashtext('design_stages:' || $1))`, [businessId]);
    const own = await q<OwnStage>(`select ${STAGE} from design_stages where business_id = $1`, [businessId]);
    if (own.length >= MAX_OWN_STAGES) return { refused: OWN_STAGES_FULL };
    const input = cleanOwnStageInput(raw, own, await stageNamesIn(q, businessId));
    if (!input.ok) return { refused: input.message };
    const made = await q<OwnStage>(
      `insert into design_stages (id, business_id, name, base, created_by) values ($2,$1,$3,$4,$5) returning ${STAGE}`,
      [businessId, newId("st", 8), input.value.name, input.value.base, by.toLowerCase()],
    );
    const stage = made[0];
    if (!place) return { stage, pipeline: null };
    const kept = await q<KeptPipeline>(`select ${PIPELINE} from design_pipelines where business_id = $1`, [businessId]);
    const shown = pipelinesFor(kept, [...own, stage]).find((p) => p.id === place.pipelineId);
    if (!shown) return { refused: "That pipeline isn't here." };
    const stages = insertStage(shown.stages, stage.id, place.after);
    if (stages.length > MAX_PIPELINE_STAGES) return { refused: PIPELINE_TOO_LONG };
    const rows = shown.rowId
      ? await q<KeptPipeline>(`update design_pipelines set stages = $3::jsonb where business_id = $1 and id = $2 returning ${PIPELINE}`, [
          businessId,
          shown.rowId,
          JSON.stringify(stages),
        ])
      : await q<KeptPipeline>(
          `insert into design_pipelines (id, business_id, name, stages, base_id, created_by) values ($2,$1,$3,$4::jsonb,$5,$6) returning ${PIPELINE}`,
          [businessId, newId("pipe"), shown.name, JSON.stringify(stages), shown.id, by.toLowerCase()],
        );
    return { stage, pipeline: rows[0] };
  });
}

/** Renames a stage the business added. Null: no such stage. */
export async function renameOwnStage(businessId: string, id: string, raw: unknown): Promise<OwnStage | { refused: string } | null> {
  return transaction(async (q) => {
    await q(`select pg_advisory_xact_lock(hashtext('design_stages:' || $1))`, [businessId]);
    const own = await q<OwnStage>(`select ${STAGE} from design_stages where business_id = $1`, [businessId]);
    if (!own.some((s) => s.id === id)) return null;
    const name = cleanStageName(raw);
    if (!name) return { refused: STAGE_NAME_MISSING };
    if (nameTaken(name, own, id, await stageNamesIn(q, businessId))) return { refused: STAGE_NAME_TAKEN };
    const rows = await q<OwnStage>(`update design_stages set name = $3 where business_id = $1 and id = $2 returning ${STAGE}`, [
      businessId,
      id,
      name,
    ]);
    return rows[0];
  });
}

/**
 * Removes a stage the business added: out of every pipeline, and its deals stay at the stage it counted as.
 * Their records aren't rewritten.
 */
export async function deleteOwnStage(businessId: string, id: string): Promise<boolean> {
  return transaction(async (q) => {
    const gone = await q(`delete from design_stages where business_id = $1 and id = $2 returning id`, [businessId, id]);
    if (!gone.length) return false;
    await q(`update design_jobs set sub_stage = null where business_id = $1 and sub_stage = $2`, [businessId, id]);
    await q(
      `update design_pipelines set stages = coalesce((select jsonb_agg(k) from jsonb_array_elements(stages) k where k <> to_jsonb($2::text)), '[]'::jsonb)
        where business_id = $1 and stages ? $2`,
      [businessId, id],
    );
    return true;
  });
}

// ---------------------------------------------------------------------------
// The overview
// ---------------------------------------------------------------------------

export interface Overview {
  /** Jobs at each stage. Every stage is there, at 0 when it has none. */
  counts: Record<JobStage, number>;
  /** The prices of the jobs still being sold (lead, designed, proposal), added up. Jobs without a price add nothing. */
  openValue: number;
  /** The prices of the jobs won, installed ones included. */
  wonValue: number;
  customers: number;
  /** The latest 12 things that happened, across every customer. */
  recent: (Activity & { customerName: string })[];
  /** What the member asking did today (the market's day), for Today's "Your day so far": each thing's kind and writer. */
  mine: Pick<Activity, "kind" | "by">[];
}

export async function overview(businessId: string, viewer?: DealViewer): Promise<Overview> {
  await ensureSamples(businessId);
  const dayStart = marketDateTime(todayInMarket(), 0);
  const [stages, customers, recent, mine] = await Promise.all([
    query<{ stage: JobStage; n: string; value: number }>(
      `select stage, count(*) as n, coalesce(sum(value), 0)::float8 as value from design_jobs j where business_id = $1 and ${seen(viewer, 2)} group by stage`,
      [businessId, ...seenParams(viewer)],
    ),
    query<{ n: string }>(`select count(*) as n from design_customers where business_id = $1`, [businessId]),
    query<Activity & { customerName: string }>(
      `select ${ACTIVITY}, c.name as "customerName"
         from design_activity a join design_customers c on c.business_id = a.business_id and c.id = a.customer_id
        where a.business_id = $1 order by a.at desc, a.id limit 12`,
      [businessId],
    ),
    viewer
      ? query<Pick<Activity, "kind" | "by">>(
          `select kind, by_email as by from design_activity where business_id = $1 and lower(by_email) = $2 and at >= $3 limit 500`,
          [businessId, viewer.email.toLowerCase(), dayStart],
        )
      : Promise.resolve([]),
  ]);
  const counts = Object.fromEntries(JOB_STAGES.map((s) => [s, 0])) as Record<JobStage, number>;
  let openValue = 0;
  let wonValue = 0;
  for (const row of stages) {
    if (!(row.stage in counts)) continue;
    counts[row.stage] = Number(row.n);
    if (OPEN_STAGES.includes(row.stage)) openValue += row.value;
    if (WON_STAGES.includes(row.stage)) wonValue += row.value;
  }
  return {
    counts,
    openValue: Math.round(openValue * 100) / 100,
    wonValue: Math.round(wonValue * 100) / 100,
    customers: Number(customers[0]?.n ?? 0),
    recent,
    mine,
  };
}

// ---------------------------------------------------------------------------
// The business's own names for the twelve stages
// ---------------------------------------------------------------------------

type Ask = typeof query;
export const stageNamesIn = async (q: Ask, businessId: string): Promise<StageNames> => {
  const rows = await q<{ stage: string; name: string }>(`select stage, name from design_stage_names where business_id = $1`, [businessId]);
  return cleanStageNames(Object.fromEntries(rows.map((r) => [r.stage, r.name])));
};

/**
 * A deal's stage in the business's own words, for the server to put on what it sends (a feed card, a call list, Sol's
 * facts): the added stage it sits at, else its name for the stage, else ours.
 */
export async function stageWordsOf(businessId: string): Promise<(job: { stage: JobStage; subStage?: string | null }) => string> {
  const [own, names] = await Promise.all([listOwnStages(businessId), stageNamesIn(query, businessId)]);
  return (job) => dealStageName(job, own, names);
}

/** The business's names for the twelve stages (only those it changed). */
export async function stageNamesOf(businessId: string): Promise<StageNames> {
  return stageNamesIn(query, businessId);
}

/** Renames one of the twelve for the business, or puts ours back with a blank name. Answers the names as they now stand. */
export async function renameBuiltinStage(businessId: string, stage: unknown, raw: unknown): Promise<StageNames | { refused: string }> {
  return transaction(async (q) => {
    await q(`select pg_advisory_xact_lock(hashtext('design_stages:' || $1))`, [businessId]);
    const own = await q<OwnStage>(`select ${STAGE} from design_stages where business_id = $1`, [businessId]);
    const next = renameBuiltin(stage, raw, own, await stageNamesIn(q, businessId));
    if (!next.ok) return { refused: next.message };
    await q(`delete from design_stage_names where business_id = $1`, [businessId]);
    for (const [k, v] of Object.entries(next.value)) {
      await q(`insert into design_stage_names (business_id, stage, name) values ($1,$2,$3)`, [businessId, k, v]);
    }
    return next.value;
  });
}
