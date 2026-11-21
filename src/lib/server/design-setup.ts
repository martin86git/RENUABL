/**
 * Sol's setup wizard on the server (domain/design/setup.ts): what is really set up for this person and their business,
 * read fresh each time, and the steps they chose to skip. One row a person (`design_setup`, business id first).
 */
import { can } from "@/lib/domain/design/account";
import { cleanSkipped, setupView, type SetupFacts, type SetupStep, type SetupView } from "@/lib/domain/design/setup";
import { query } from "./db";
import type { Member } from "./design-repo";

let ready: Promise<unknown> | null = null;
const table = () =>
  (ready ??= query(`create table if not exists design_setup (
  business_id text not null references businesses(id) on delete cascade,
  email text not null,
  skipped jsonb not null default '[]',
  put_away_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (business_id, email)
)`).catch((e) => {
    ready = null;
    throw e;
  }));

const has = async (sql: string, params: unknown[]): Promise<boolean> => (await query(sql, params).catch(() => [])).length > 0;

/** What is set up now. Each is its own read, so one table missing never hides the rest. */
export async function setupFacts(member: Pick<Member, "businessId" | "email">): Promise<SetupFacts> {
  const b = member.businessId;
  const me = [b, member.email];
  const [email, calendar, pricing, leadInbox, imported, proposal, team] = await Promise.all([
    has(`select 1 from design_gmail where business_id = $1 and lower(email) = lower($2) limit 1`, me),
    has(`select 1 from design_calendar where business_id = $1 and lower(email) = lower($2) limit 1`, me),
    has(`select 1 from design_price_lists where business_id = $1 limit 1`, [b]),
    has(`select 1 from design_lead_inbox where business_id = $1 and is_on limit 1`, [b]),
    has(`select 1 from design_customers where business_id = $1 and not sample and source <> 'Example deal' limit 1`, [b]),
    has(`select 1 from design_brand where business_id = $1 limit 1`, [b]),
    has(`select 1 from business_members where business_id = $1 offset 1 limit 1`, [b]),
  ]);
  return { email, calendar, pricing, leadInbox, imported, proposal, team };
}

async function rowOf(member: Pick<Member, "businessId" | "email">): Promise<{ skipped: SetupStep[]; putAway: boolean }> {
  await table();
  const rows = await query<{ skipped: unknown; put_away_at: Date | null }>(
    `select skipped, put_away_at from design_setup where business_id = $1 and lower(email) = lower($2)`,
    [member.businessId, member.email],
  );
  return { skipped: cleanSkipped(rows[0]?.skipped), putAway: Boolean(rows[0]?.put_away_at) };
}

export interface SetupAnswer {
  view: SetupView;
  putAway: boolean;
  firstName: string | null;
}

/** Where setup stands for this person. */
export async function setupFor(member: Member): Promise<SetupAnswer> {
  const [facts, row] = await Promise.all([setupFacts(member), rowOf(member)]);
  const who = { settings: can(member.role, "prices", member.permissions), owner: can(member.role, "members", member.permissions) };
  return { view: setupView(facts, row.skipped, who), putAway: row.putAway, firstName: member.firstName ?? null };
}

/** Skips a step, or takes the skip back. Only this person's own row. */
export async function skipSetupStep(member: Pick<Member, "businessId" | "email">, step: SetupStep, skip: boolean): Promise<void> {
  const { skipped } = await rowOf(member);
  const next = skip ? [...new Set([...skipped, step])] : skipped.filter((s) => s !== step);
  await query(
    `insert into design_setup (business_id, email, skipped) values ($1, lower($2), $3::jsonb)
     on conflict (business_id, email) do update set skipped = excluded.skipped, updated_at = now()`,
    [member.businessId, member.email, JSON.stringify(next)],
  );
}

/** Puts the wizard's pill away (it stays in the cog's menu), or brings it back. */
export async function putSetupAway(member: Pick<Member, "businessId" | "email">, away: boolean): Promise<void> {
  await table();
  await query(
    `insert into design_setup (business_id, email, put_away_at) values ($1, lower($2), ${away ? "now()" : "null"})
     on conflict (business_id, email) do update set put_away_at = excluded.put_away_at, updated_at = now()`,
    [member.businessId, member.email],
  );
}
