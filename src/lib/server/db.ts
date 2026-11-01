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
-- Group emails (domain/design/customers.ts): each person's own link to stop them, and when they did.
alter table design_customers add column if not exists unsub_token text;
alter table design_customers add column if not exists unsubscribed_at timestamptz;
create unique index if not exists design_customers_unsub on design_customers(unsub_token) where unsub_token is not null;
-- A job's solar size from its design, and when it was sold and installed (for the overview's figures).
alter table design_jobs add column if not exists kw numeric;
-- Who a deal belongs to (a member's email), set to whoever made it; null = no one yet. A member who doesn't see every
-- deal sees only their own, no one's, and those they are mentioned on (seesDeal in domain/design/account.ts).
alter table design_jobs add column if not exists owner_email text;
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
-- Which of a proposal's systems the customer went ahead on (the options in domain/design/proposal.ts), when it offered a choice.
alter table design_proposal_versions add column if not exists accepted_option text;
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
-- The private link to a job's pickup slip (domain/design/pickup-slip.ts): what the installer shows at the wholesaler's
-- counter. One a job, for good; no sign-in, the token is the key.
create table if not exists design_pickup_links (
  token text primary key,
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  created_at timestamptz not null default now(),
  unique (business_id, job_id),
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete cascade
);
-- Follow-ups made on a proposal that is out (domain/design/proposal-lists.ts): one for each follow-up day reached,
-- marked called or emailed by a member.
create table if not exists design_followups (
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  day integer not null,
  how text not null,
  at timestamptz not null default now(),
  by_email text not null,
  primary key (business_id, job_id, day),
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete cascade
);
-- A member's notifications (domain/design/mentions.ts): each time they are @mentioned in a deal's note. Read when they
-- open it or mark it read; a mention also lets them see that deal.
create table if not exists design_notifications (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  to_email text not null,
  kind text not null default 'mention',
  job_id text not null,
  customer_id text not null,
  text text not null,
  by_email text not null,
  at timestamptz not null default now(),
  read_at timestamptz,
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete cascade
);
create index if not exists design_notifications_to on design_notifications(business_id, to_email, at desc);
-- A business's checked product datasheets (domain/design/datasheets.ts): a panel's or inverter's electrical figures
-- by product code, read from its datasheet and checked by a member; the file itself is never kept.
create table if not exists design_datasheets (
  business_id text not null references businesses(id) on delete cascade,
  kind text not null,
  sku text not null,
  model text not null default '',
  figures jsonb not null,
  file_name text not null default '',
  checked_by text not null,
  checked_at timestamptz not null default now(),
  primary key (business_id, kind, sku)
);
-- The service pipeline (domain/design/service.ts): a job's cases to put right after the sale, Open, In hand, Resolved,
-- with their history kept on the case. One open at a time a job (checked in the repo, under a lock on the job).
create table if not exists design_service_cases (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  customer_id text not null,
  issue text not null,
  state text not null default 'open',
  raised_at timestamptz not null default now(),
  raised_by text not null,
  resolved_at timestamptz,
  updates jsonb not null default '[]',
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete cascade
);
create index if not exists design_service_cases_business on design_service_cases(business_id, state);
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
-- Passwords for the roof designer's sign-in (server/design-passwords.ts): scrypt hashes, set only by someone signed in.
create table if not exists design_passwords (
  email text primary key,
  hash text not null,
  updated_at timestamptz not null default now()
);
-- Reminders sent to a business's customers, so each is sent once (server/design-reminders.ts).
create table if not exists design_reminders_sent (
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  kind text not null,
  install_date date not null,
  at timestamptz not null default now(),
  primary key (business_id, job_id, kind, install_date)
);
-- Each member's conversation with Sol (domain/design/sol.ts), with their own preferences and reminders: one row a
-- member, kept apart from everyone else's, gone with the business.
create table if not exists design_sol (
  business_id text not null references businesses(id) on delete cascade,
  email text not null,
  turns jsonb not null default '[]',
  prefs jsonb not null default '[]',
  reminders jsonb not null default '[]',
  seen_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (business_id, email)
);
-- The team chat (domain/design/team-chat.ts): a business's members talking in its channels and in direct
-- conversations, the files sent with lines, and when each member last had each room open. Gone with the business.
create table if not exists design_team_lines (
  business_id text not null references businesses(id) on delete cascade,
  id text not null,
  room text not null,
  by_email text not null,
  text text not null default '',
  files jsonb not null default '[]',
  deals jsonb not null default '[]',
  reactions jsonb not null default '{}',
  at timestamptz not null default now(),
  edited_at timestamptz,
  primary key (business_id, id)
);
create index if not exists design_team_lines_room on design_team_lines(business_id, room, at desc);
create table if not exists design_team_files (
  business_id text not null references businesses(id) on delete cascade,
  id text not null,
  name text not null,
  type text not null,
  size integer not null,
  bytes bytea not null,
  by_email text not null,
  at timestamptz not null default now(),
  primary key (business_id, id)
);
create table if not exists design_team_seen (
  business_id text not null references businesses(id) on delete cascade,
  email text not null,
  room text not null,
  seen_at timestamptz not null,
  primary key (business_id, email, room)
);
-- Emails sent from a deal and when the customer's mail app loaded their pixel (domain/design/email-opens.ts). The token
-- alone opens the row (the pixel's address carries nothing else); gone with the deal.
create table if not exists design_email_opens (
  token text primary key,
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  activity_id text,
  sent_at timestamptz not null default now(),
  opens jsonb not null default '[]',
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete cascade
);
create index if not exists design_email_opens_job on design_email_opens(business_id, job_id);
-- Files kept on a deal (its Attachments tab): bills, photos, signed forms. Gone with the deal.
create table if not exists design_deal_files (
  business_id text not null references businesses(id) on delete cascade,
  id text not null,
  job_id text not null,
  name text not null,
  type text not null,
  size integer not null,
  bytes bytea not null,
  by_email text not null,
  at timestamptz not null default now(),
  primary key (business_id, id),
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete cascade
);
create index if not exists design_deal_files_job on design_deal_files(business_id, job_id, at desc);
-- The installation job card (domain/design/job-card.ts): each installer's private link to a job's card (one each,
-- for good; sent_at when it was last emailed), and the card's thread of notes and the photos on them.
create table if not exists design_job_links (
  token text primary key,
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  installer_id text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, job_id, installer_id),
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete cascade
);
create table if not exists design_job_notes (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  side text not null,
  by_name text not null,
  by_email text,
  text text not null default '',
  at timestamptz not null default now(),
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete cascade
);
create index if not exists design_job_notes_job on design_job_notes(business_id, job_id, at desc);
create table if not exists design_job_files (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  note_id text not null references design_job_notes(id) on delete cascade,
  name text not null,
  type text not null,
  size integer not null,
  bytes bytea not null,
  at timestamptz not null default now()
);
create index if not exists design_job_files_note on design_job_files(business_id, note_id);
-- Updates and Feedback (domain/design/updates.ts, feedback.ts): the day each member last opened Updates, and the
-- business's own feedback items with their comments.
create table if not exists design_updates_seen (
  business_id text not null references businesses(id) on delete cascade,
  email text not null,
  day date not null,
  primary key (business_id, email)
);
create table if not exists design_feedback (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  kind text not null,
  text text not null,
  by_email text not null,
  at timestamptz not null default now(),
  done_at timestamptz,
  done_by text
);
create index if not exists design_feedback_business on design_feedback(business_id, at desc);
-- Email (domain/design/inbox.ts): each member's own Gmail, read only (the refresh token encrypted, never sent to a
-- browser), and the notes on an email with whom it is shared (a copy of that one email, never the mailbox).
create table if not exists design_gmail (
  business_id text not null references businesses(id) on delete cascade,
  email text not null,
  address text not null,
  token text not null,
  access text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (business_id, email)
);
create table if not exists design_email_talks (
  business_id text not null references businesses(id) on delete cascade,
  owner_email text not null,
  message_id text not null,
  snapshot jsonb not null,
  shared text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (business_id, owner_email, message_id)
);
create table if not exists design_email_notes (
  id text primary key,
  business_id text not null,
  owner_email text not null,
  message_id text not null,
  by_email text not null,
  text text not null,
  at timestamptz not null default now(),
  foreign key (business_id, owner_email, message_id) references design_email_talks(business_id, owner_email, message_id) on delete cascade
);
-- The Marketplace's job listings (domain/design/marketplace.ts): what one business shows others of a job (suburb,
-- system, window, guide; never the customer's details), and the bids businesses place on it, one each.
create table if not exists design_listings (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  job_id text not null,
  title text not null,
  suburb text not null,
  state text not null default '',
  postcode text not null default '',
  near_lat double precision,
  near_lng double precision,
  system jsonb not null,
  notes text not null default '',
  from_day date,
  to_day date,
  guide integer,
  status text not null default 'open',
  closes_on date not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  awarded_bid text,
  foreign key (business_id, job_id) references design_jobs(business_id, id) on delete cascade
);
create unique index if not exists design_listings_open_job on design_listings(business_id, job_id) where status = 'open';
create index if not exists design_listings_open on design_listings(status, closes_on);
create table if not exists design_bids (
  id text primary key,
  listing_id text not null references design_listings(id) on delete cascade,
  business_id text not null references businesses(id) on delete cascade,
  by_email text not null,
  amount integer not null,
  start_day date,
  note text not null default '',
  status text not null default 'open',
  at timestamptz not null default now(),
  unique (listing_id, business_id)
);
-- The Marketplace's equipment trading (domain/design/trade.ts): spare stock a business puts up, its photos (redrawn,
-- nothing but the picture kept), and the conversations between the seller and each business that asks about it.
create table if not exists design_trade_items (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  category text not null,
  title text not null,
  make text not null default '',
  model text not null default '',
  qty integer not null,
  condition text not null,
  price numeric,
  handover text not null,
  description text not null default '',
  suburb text not null default '',
  near_lat double precision,
  near_lng double precision,
  status text not null default 'available',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists design_trade_items_open on design_trade_items(status, created_at desc);
create table if not exists design_trade_photos (
  id text primary key,
  item_id text not null references design_trade_items(id) on delete cascade,
  bytes bytea not null,
  content_type text not null,
  position integer not null default 0,
  at timestamptz not null default now()
);
create table if not exists design_trade_threads (
  id text primary key,
  item_id text not null references design_trade_items(id) on delete cascade,
  buyer_id text not null references businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (item_id, buyer_id)
);
create table if not exists design_trade_messages (
  id text primary key,
  thread_id text not null references design_trade_threads(id) on delete cascade,
  from_business text not null references businesses(id) on delete cascade,
  by_email text not null,
  text text not null,
  at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists design_trade_messages_thread on design_trade_messages(thread_id, at);
create table if not exists design_feedback_comments (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  feedback_id text not null references design_feedback(id) on delete cascade,
  text text not null,
  by_email text not null,
  at timestamptz not null default now()
);
create table if not exists design_subscriptions (
  id text primary key,
  email text not null,
  business_id text references businesses(id) on delete set null,
  stripe_customer text,
  stripe_subscription text unique,
  checkout_session text unique,
  status text not null,
  billing_interval text not null,
  seats integer not null,
  trial_end timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists design_subscriptions_email on design_subscriptions(lower(email));
create index if not exists design_subscriptions_business on design_subscriptions(business_id);
create table if not exists design_tokens (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  change integer not null,
  reason text not null,
  stripe_session text unique,
  project_id text,
  by_email text,
  at timestamptz not null default now()
);
create index if not exists design_tokens_business on design_tokens(business_id, at desc);
create unique index if not exists design_tokens_one_trial on design_tokens(business_id) where reason = 'trial';
create unique index if not exists design_tokens_one_job on design_tokens(business_id, project_id) where reason = 'job';
create table if not exists design_leads (
  id text primary key,
  kind text not null,
  email text not null,
  name text,
  business text,
  mobile text,
  users integer,
  note text,
  at timestamptz not null default now()
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
