/**
 * Server only. RENUABL's database (Neon Postgres, connected to the Vercel
 * project: DATABASE_URL, or POSTGRES_URL). Holds partner accounts, jobs, job
 * offers, sign-in sessions, and the roof designer's businesses with their
 * settings and roofs. Tables are created on first use.
 */
import { Pool, type QueryResultRow } from "pg";

export class DbError extends Error {}

export function dbUrl() {
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || null;
}

export function dbConfigured() {
  return Boolean(dbUrl());
}

const g = globalThis as unknown as { __renuablPool?: Pool; __renuablSchema?: Promise<void> };

function pool(): Pool {
  const url = dbUrl();
  if (!url) throw new DbError("The database isn't set up (DATABASE_URL)");
  // One small pool per server instance; Neon's pooled connection string handles the rest.
  g.__renuablPool ??= new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000 });
  return g.__renuablPool;
}

const SCHEMA = `
create table if not exists partners (
  id text primary key,
  reference text unique not null,
  status text not null default 'pending',
  type text not null,
  email text unique not null,
  full_name text not null,
  mobile text,
  business_name text not null,
  abn text,
  base jsonb,
  radius_km integer not null default 50,
  insurance_expires date,
  public_liability bigint,
  application jsonb not null,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create table if not exists jobs (
  id text primary key,
  reference text unique not null,
  record_key text unique not null,
  customer jsonb not null,
  customer_email text not null,
  address jsonb not null,
  system jsonb not null,
  site jsonb not null,
  package_name text not null,
  value numeric not null default 0,
  solar_victoria boolean not null default false,
  install_date date,
  status text not null default 'unassigned',
  partner_id text references partners(id),
  created_at timestamptz not null default now()
);
alter table jobs add column if not exists layout jsonb;
alter table jobs add column if not exists obstructions jsonb;
create index if not exists jobs_partner on jobs(partner_id);
create index if not exists jobs_customer on jobs(customer_email);
create table if not exists offers (
  id text primary key,
  job_id text not null references jobs(id),
  partner_id text not null references partners(id),
  status text not null default 'offered',
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  decided_at timestamptz
);
create unique index if not exists offers_one_open on offers(job_id) where status = 'offered';
create index if not exists offers_partner on offers(partner_id, status);
create table if not exists login_tokens (
  token_hash text primary key,
  email text not null,
  role text not null,
  next text,
  expires_at timestamptz not null,
  used_at timestamptz
);
create table if not exists roof_cache (
  key text primary key,
  data jsonb,
  fetched_at timestamptz not null default now()
);
-- The ground around a roof from Google's data layers (server/ground-map.ts): the drawing and the heights, from one lookup a place, then kept. Nulls are a place with no data.
create table if not exists ground_cache (
  key text primary key,
  png bytea,
  fetched_at timestamptz not null default now()
);
alter table ground_cache add column if not exists terrain bytea;
create table if not exists price_uploads (
  id text primary key,
  supplier text not null,
  filename text not null,
  uploaded_by text not null,
  uploaded_at timestamptz not null default now(),
  status text not null default 'pending',
  changes jsonb not null,
  unchanged int not null default 0,
  not_in_file int not null default 0,
  decided_by text,
  decided_at timestamptz
);
create table if not exists price_overrides (
  sku text primary key,
  cost numeric not null,
  upload_id text references price_uploads(id),
  updated_at timestamptz not null default now()
);
create table if not exists whoop_claims (
  job_reference text primary key,
  status text not null default 'claimed',
  claimed_at timestamptz not null default now(),
  shipped_at timestamptz,
  delivered_at timestamptz,
  released_at timestamptz
);
alter table jobs add column if not exists healthy_home_interest boolean not null default false;
alter table jobs add column if not exists health_reminded_at timestamptz;
create table if not exists home_health (
  id text primary key,
  job_reference text unique,
  email text,
  address text,
  answers jsonb not null,
  plan jsonb not null,
  sensitive_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- health_quotes: no longer written (healthy home products aren't offered yet); kept for past rows.
create table if not exists health_quotes (
  id text primary key,
  job_reference text,
  email text,
  item text not null,
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  unique (job_reference, item)
);
create table if not exists briefs (
  key text primary key,
  first_name text not null,
  mobile text,
  email text,
  created_by text,
  answers jsonb not null default '{}',
  summary jsonb,
  status text not null default 'sent',
  call_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  booked_at timestamptz
);
alter table briefs add column if not exists call_slot text;
alter table briefs add column if not exists hubspot_id text;
alter table briefs add column if not exists unfinished_noted_at timestamptz;
-- The roof designer's own customers: businesses and the people in them. Not RENUABL's installation partners.
-- Every table below carries business_id, and every query on it filters by it (server/design-repo.ts).
create table if not exists businesses (
  id text primary key,
  name text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists business_members (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  email text unique not null,
  role text not null default 'member',
  invited_by text,
  terms_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists business_members_business on business_members(business_id);
-- What the owner lets a member do (the can function in domain/design/account.ts). Null is everything, as it was before this could be set.
alter table business_members add column if not exists permissions jsonb;
create table if not exists design_settings (
  business_id text primary key references businesses(id) on delete cascade,
  settings jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);
create table if not exists design_price_lists (
  business_id text not null references businesses(id) on delete cascade,
  name text not null,
  data jsonb not null,
  uploaded_by text,
  created_at timestamptz not null default now(),
  primary key (business_id, name)
);
-- unique (business_id, id): so a later table (customers, proposals, jobs) can point at a roof and its business together.
create table if not exists design_projects (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  roof_key text not null,
  address text not null default '',
  lat double precision not null,
  lng double precision not null,
  design jsonb not null,
  extras jsonb not null,
  version integer not null default 1,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, roof_key),
  unique (business_id, id)
);
-- The roof designer's CRM (server/design-crm-repo.ts): a business's own customers, their jobs, and what happened.
-- Jobs and activity point at their customer together with the business, so a row can never hang off another business's customer.
alter table businesses add column if not exists samples_added_at timestamptz;
create table if not exists design_customers (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  lat double precision,
  lng double precision,
  source text not null default '',
  notes text not null default '',
  sample boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);
create index if not exists design_customers_business on design_customers(business_id, updated_at desc);
create table if not exists design_jobs (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  customer_id text not null,
  title text not null,
  address text not null default '',
  lat double precision,
  lng double precision,
  roof_key text,
  stage text not null default 'lead',
  project_id text references design_projects(id) on delete set null,
  value numeric,
  install_date date,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, customer_id) references design_customers(business_id, id) on delete cascade
);
create index if not exists design_jobs_customer on design_jobs(business_id, customer_id);
create index if not exists design_jobs_roof on design_jobs(business_id, roof_key);
create table if not exists design_activity (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  customer_id text not null,
  job_id text references design_jobs(id) on delete set null,
  kind text not null,
  text text not null,
  by_email text not null,
  at timestamptz not null default now(),
  foreign key (business_id, customer_id) references design_customers(business_id, id) on delete cascade
);
create index if not exists design_activity_customer on design_activity(business_id, customer_id, at desc);
create index if not exists design_activity_recent on design_activity(business_id, at desc);
-- A customer's name in its two parts. Both empty on a customer kept before there were parts: read as the name split at its first space.
alter table design_customers add column if not exists first_name text not null default '';
alter table design_customers add column if not exists last_name text not null default '';
-- A job's solar size from its design, and when it was sold and installed (for the overview's figures).
alter table design_jobs add column if not exists kw numeric;
alter table design_jobs add column if not exists won_at timestamptz;
alter table design_jobs add column if not exists installed_at timestamptz;
-- System details typed in by hand on a deal, by key (domain/design/crm.ts DETAIL_KEYS).
alter table design_jobs add column if not exists details jsonb not null default '{}'::jsonb;
-- The pipelines a business has saved: a name for a run of stages, shared by its members.
create table if not exists design_pipelines (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  name text not null,
  stages jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);
create index if not exists design_pipelines_business on design_pipelines(business_id, created_at);
-- Proposals (server/design-proposal-repo.ts): a business's branding, the pictures it has put up, and what it has sent.
-- design_brand: one row a business. design_files: its logo, cover and photos, made safe and small before they are kept;
-- a picture taken out of the brand kit is only marked removed, so a proposal already sent keeps its pictures.
create table if not exists design_brand (
  business_id text primary key references businesses(id) on delete cascade,
  kit jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);
create table if not exists design_files (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  kind text not null,
  content_type text not null,
  bytes bytea not null,
  width integer not null,
  height integer not null,
  created_by text,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (business_id, id)
);
create index if not exists design_files_business on design_files(business_id, kind, created_at);
-- design_proposals: one for a job, with the private link's token. design_proposal_versions: each publishing, a fixed copy.
-- "view" is what the customer may see; "internal" (costs, margin) is the business's record and is never read by the public routes.
create table if not exists design_proposals (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  customer_id text not null,
  token text unique not null,
  withdrawn_at timestamptz,
  questions integer not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, job_id),
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete cascade
);
create table if not exists design_proposal_versions (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  proposal_id text not null,
  version integer not null,
  view jsonb not null,
  internal jsonb not null,
  published_by text not null,
  published_at timestamptz not null default now(),
  opened_at timestamptz,
  accepted_at timestamptz,
  accepted_name text,
  unique (proposal_id, version),
  foreign key (business_id, proposal_id) references design_proposals(business_id, id) on delete cascade
);
-- The deposit on an accepted version (domain/design/deposit.ts): the reference the customer pays with, what the
-- customer has said about paying (said, never seen: no payment passes through us), and the business marking it
-- received. Kept beside the fixed copy, which it never changes.
alter table design_proposal_versions add column if not exists deposit_ref text;
alter table design_proposal_versions add column if not exists deposit_said_way text;
alter table design_proposal_versions add column if not exists deposit_said_at timestamptz;
alter table design_proposal_versions add column if not exists deposit_received_at timestamptz;
alter table design_proposal_versions add column if not exists deposit_received_by text;
create unique index if not exists design_proposal_versions_deposit_ref
  on design_proposal_versions (business_id, deposit_ref) where deposit_ref is not null;
-- The conversation between a business and its customer about a job (server/design-chat-repo.ts): one a job, so it
-- carries on when a design is deleted or the proposal is published again. by_email (the member who replied) is never
-- sent to the customer; read_at is when someone at the business saw a line the customer wrote.
create table if not exists design_messages (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  customer_id text not null,
  from_customer boolean not null,
  text text not null,
  by_email text,
  at timestamptz not null default now(),
  read_at timestamptz,
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete cascade
);
create index if not exists design_messages_job on design_messages(business_id, job_id, at);
create index if not exists design_messages_unread on design_messages(business_id) where from_customer and read_at is null;
-- A business's after-sale settings (domain/design/prefs.ts): suppliers' order addresses, the invoice tolerance, and
-- the automations that reach its customers (each off until turned on).
create table if not exists design_prefs (
  business_id text primary key references businesses(id) on delete cascade,
  prefs jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);
-- A signed job's order for its hardware (domain/design/orders.ts): only the hand changes are kept; the worked-out
-- quantities always come from the version the customer accepted. Made when a proposal is accepted.
create table if not exists design_orders (
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  status text not null default 'open',
  data jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (business_id, job_id),
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete cascade
);
-- What a signed job's installation was allowed for in its quote (domain/design/installer-invoices.ts), fixed at signing.
create table if not exists design_install_costs (
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  cost jsonb not null,
  at timestamptz not null default now(),
  primary key (business_id, job_id),
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete cascade
);
-- Installers' invoices, read from their file or typed in; job_id is null while one waits to be put against a job.
-- The file itself is never kept: only the figures the business checked.
create table if not exists design_installer_invoices (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  job_id text,
  invoice jsonb not null,
  uploaded_by text not null,
  at timestamptz not null default now(),
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete set null (job_id)
);
create index if not exists design_installer_invoices_job on design_installer_invoices(business_id, job_id);
-- Reminders sent to a business's customers, so each is sent once (server/design-reminders.ts).
create table if not exists design_reminders_sent (
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  kind text not null,
  install_date date not null,
  at timestamptz not null default now(),
  primary key (business_id, job_id, kind, install_date)
);
create table if not exists sessions (
  id_hash text primary key,
  email text not null,
  role text not null,
  partner_id text references partners(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
`;

async function ensureSchema() {
  g.__renuablSchema ??= pool()
    .query(SCHEMA)
    .then(() => undefined)
    .catch((e) => {
      g.__renuablSchema = undefined;
      throw e;
    });
  return g.__renuablSchema;
}

/** Runs `fn` in one transaction on one connection (for counters that must not overshoot). */
export async function transaction<T>(
  fn: (q: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
): Promise<T> {
  await ensureSchema();
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(
      async <R extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) => (await client.query<R>(text, params)).rows,
    );
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const res = await pool().query<T>(text, params);
  return res.rows;
}

/** Tests only: drop the pool so the next query reconnects (and re-checks the schema). */
export async function resetDbForTests() {
  await g.__renuablPool?.end();
  g.__renuablPool = undefined;
  g.__renuablSchema = undefined;
}

/** A random id with a prefix, e.g. "pa_k3j9…". */
export function newId(prefix: string, bytes = 12) {
  return `${prefix}_${randomToken(bytes)}`;
}

/** Random hex from the system's secure generator. */
export function randomToken(bytes = 32) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}
