/**
 * Server only. RENUABL's database (Neon Postgres, connected to the Vercel
 * project: DATABASE_URL, or POSTGRES_URL). Holds partner accounts, jobs, job
 * offers and sign-in sessions. Tables are created on first use.
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
