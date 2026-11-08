/**
 * Server only. Sol's sales agents (domain/design/sol-agents.ts): the outbox behind the pipeline's stage agents, under
 * the designer's tenant rule (business id first, from the signed-in member only). The outbox is Ready for you
 * (design-prepared.ts) given a stage and a time to go; a business's settings are kept in `design_sol_agents`. Sol sends
 * an email himself only when that stage's agent is on, its time has come inside the business's hours, it isn't held,
 * and the deal is still at the stage his agent works: it then goes as the deal's own email does (RENUABL's sender in the
 * business's name, replies to the business, written on the deal's record by "sol", its opens tracked, the follow-up
 * marked done). The item is claimed before it is sent, so two readers can't send it twice.
 */
import {
  AGENTS,
  SOL_SENDER,
  agentFor,
  cleanAgentSettings,
  firesAtFor,
  outboxState,
  shouldFire,
  withinHours,
  type AgentSettings,
  type AgentStage,
  type OutboxState,
} from "@/lib/domain/design/sol-agents";
import type { DealViewer } from "@/lib/domain/design/account";
import type { JobStage } from "@/lib/domain/design/crm";
import { dealEmail, emailRecord } from "@/lib/domain/design/deal-email";
import { openPixel, tracksOpensTo, withPixel } from "@/lib/domain/design/email-opens";
import type { PreparedItem } from "@/lib/domain/design/prepared";
import { siteUrl } from "@/lib/domain/sms";
import { query } from "./db";
import { markFollowUp } from "./design-after-sale-repo";
import { addActivity, listJobs } from "./design-crm-repo";
import { readyFor, type Pending } from "./design-prepared";
import { loadBrand } from "./design-proposal-repo";
import { listMembers } from "./design-repo";
import { newOpenToken, recordSent } from "./design-pulse-repo";
import { emailProvider, sendEmail } from "./email";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function agentSettings(businessId: string): Promise<AgentSettings> {
  const rows = await query<{ settings: unknown }>(`select settings from design_sol_agents where business_id = $1`, [businessId]);
  return cleanAgentSettings(rows[0]?.settings);
}

export async function saveAgentSettings(businessId: string, settings: AgentSettings, by: string): Promise<AgentSettings> {
  const clean = cleanAgentSettings(settings);
  await query(
    `insert into design_sol_agents (business_id, settings, updated_by) values ($1, $2::jsonb, $3)
     on conflict (business_id) do update set settings = excluded.settings, updated_at = now(), updated_by = excluded.updated_by`,
    [businessId, JSON.stringify(clean), by.toLowerCase()],
  );
  return clean;
}

export interface OutboxEntry extends PreparedItem {
  stage: AgentStage | null;
  firesAt: string;
  state: OutboxState;
  held: boolean;
}

export interface NeedsYou {
  jobId: string;
  customer: string;
  title: string;
  stage: AgentStage | null;
  /** The customer's latest line, unanswered, and when. */
  last: string;
  at: string;
}

export interface SentBySol {
  id: string;
  jobId: string;
  customer: string;
  subject: string;
  stage: AgentStage | null;
  at: string;
}

export interface Outbox {
  settings: AgentSettings;
  entries: OutboxEntry[];
  needsYou: NeedsYou[];
  sent: SentBySol[];
  canSend: boolean;
}

type Held = PreparedItem & { held?: boolean; notBefore?: string };

const entryOf = (item: Held, stage: JobStage | undefined, settings: AgentSettings, now = new Date()): OutboxEntry => {
  const agent = stage ? agentFor(stage) : null;
  const held = item.held === true;
  return {
    ...item,
    stage: agent,
    held,
    firesAt: firesAtFor(item, settings.hours, now),
    // With no email service on the site nothing can go, so nothing counts down.
    state: outboxState({
      stage: agent,
      held,
      hasEmail: EMAIL.test(item.to),
      settings: emailProvider() ? settings : { ...settings, on: [] },
      scheduled: Boolean(item.notBefore) && Boolean(emailProvider()),
    }),
  };
};

/** The conversations whose latest line is the customer's, unanswered: what Sol hands to a person. */
async function unanswered(businessId: string): Promise<{ jobId: string; last: string; at: string }[]> {
  return query(
    `select j.id as "jobId", latest.text as last, ${moment("latest.at")} as at
       from design_jobs j
       join lateral (select text, at, from_customer from design_messages m where m.business_id = $1 and m.job_id = j.id
                      order by m.at desc, m.id desc limit 1) latest on latest.from_customer
      where j.business_id = $1 order by latest.at desc limit 50`,
    [businessId],
  );
}

/**
 * The outbox for a member: what Sol has lined up on the deals they may see, each with its stage and time to go, the
 * conversations waiting on a person, and what Sol sent in the last week. `pending` drafts are for the caller to write
 * after the answer has gone back, as with Ready for you.
 */
export async function outbox(
  member: { businessId: string; businessName: string; email: string },
  viewer: DealViewer,
  readOnly = false,
): Promise<{ outbox: Outbox; pending: Pending[] }> {
  const businessId = member.businessId;
  const [{ items, pending }, settings, jobs, waiting, sentRows] = await Promise.all([
    readyFor(member, viewer, new Date(), readOnly),
    agentSettings(businessId),
    listJobs(businessId, viewer),
    unanswered(businessId),
    query<{ id: string; jobId: string; item: PreparedItem; at: string }>(
      `select id, job_id as "jobId", item, ${moment("done_at")} as at from design_prepared
        where business_id = $1 and status = 'sent' and done_by = $2 and done_at > now() - interval '7 days' order by done_at desc limit 30`,
      [businessId, SOL_SENDER],
    ),
  ]);
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const entries = items
    .map((i) => entryOf(i as Held, byId.get(i.jobId)?.stage, settings))
    .sort((a, b) => a.firesAt.localeCompare(b.firesAt));
  const needsYou = waiting.flatMap((w) => {
    const job = byId.get(w.jobId);
    if (!job || !agentFor(job.stage)) return [];
    return [
      { jobId: w.jobId, customer: job.customerName, title: job.title, stage: agentFor(job.stage), last: w.last.slice(0, 200), at: w.at },
    ];
  });
  const sent = sentRows.flatMap((r) => {
    const job = byId.get(r.jobId);
    if (!job) return [];
    return [{ id: r.id, jobId: r.jobId, customer: r.item.customer, subject: r.item.subject, stage: agentFor(job.stage), at: r.at }];
  });
  return { outbox: { settings, entries, needsYou, sent, canSend: Boolean(emailProvider()) }, pending };
}

/** Where replies to Sol's emails go: the business's own email, else its owner's. */
async function replyAddress(businessId: string, brandEmail: string): Promise<string | null> {
  if (EMAIL.test(brandEmail)) return brandEmail;
  const owner = await query<{ email: string }>(`select email from business_members where business_id = $1 and role = 'owner' limit 1`, [
    businessId,
  ]);
  return owner[0]?.email ?? null;
}

/**
 * Sends one waiting item as the deal's email and takes it off the outbox. `by` is who sent it: a member's email for a
 * press, `sol` at the window. Claimed first (ready → sent), so it goes once; put back as ready and held if the email
 * fails. Answers with what happened.
 */
export async function sendOutboxItem(
  business: { id: string; name: string },
  id: string,
  by: string,
  replyTo?: string,
): Promise<"sent" | "gone" | "no-email" | "failed"> {
  if (!emailProvider()) return "failed";
  const claimed = await query<{ item: Held; customerId: string }>(
    `update design_prepared p set status = 'sent', item = jsonb_set(p.item, '{status}', '"sent"'), done_at = now(), done_by = $3
       from design_jobs j
      where p.business_id = $1 and p.id = $2 and p.status = 'ready' and j.business_id = p.business_id and j.id = p.job_id
      returning p.item, j.customer_id as "customerId"`,
    [business.id, id, by.toLowerCase()],
  );
  const row = claimed[0];
  if (!row) return "gone";
  const item = row.item;
  const putBack = () =>
    query(
      `update design_prepared set status = 'ready', item = item || '{"status":"ready","held":true}'::jsonb, done_at = null, done_by = null
        where business_id = $1 and id = $2`,
      [business.id, id],
    );
  if (!EMAIL.test(item.to)) {
    await putBack();
    return "no-email";
  }
  try {
    const brand = await loadBrand(business.id, business.name);
    const name = brand.name || business.name;
    const site = siteUrl();
    // Never tracked when it goes to one of the business's own people: their opening it isn't the customer's.
    const members = site ? await listMembers(business.id).catch(() => []) : [];
    const ours = [...members.map((m) => m.email), brand.email, ...brand.notify].filter(Boolean);
    const token = site && tracksOpensTo(item.to, ours) ? newOpenToken() : null;
    const email = dealEmail({ business: name, subject: item.subject, body: item.body });
    const reply = replyTo ?? (await replyAddress(business.id, brand.email));
    await sendEmail({
      to: item.to,
      ...email,
      ...(token && site ? { html: withPixel(email.html, openPixel(site, token)) } : {}),
      ...(reply ? { replyTo: reply } : {}),
    });
    const activity = await addActivity(
      business.id,
      row.customerId,
      { kind: "email", text: emailRecord(item.to, item.subject, item.body).slice(0, 2000), jobId: item.jobId },
      by,
    ).catch(() => null);
    if (token)
      await recordSent(business.id, token, item.jobId, activity && typeof activity !== "string" ? activity.id : null).catch(() =>
        console.error("an outbox email's open tracking couldn't be kept"),
      );
    if (item.kind === "follow-up" && item.day)
      await markFollowUp(business.id, item.jobId, item.day, "email", by).catch(() => console.error("a follow-up couldn't be marked done"));
    return "sent";
  } catch (e) {
    console.error("an outbox email couldn't be sent", e instanceof Error ? e.message : e);
    await putBack();
    return "failed";
  }
}

/**
 * What Sol sends himself now: every ready item whose time has come inside the hours, while its agent is on and the
 * deal is still at a stage whose agent works (today Proposals). Called when the outbox or Ready for you is read, and
 * from the hourly cron.
 */
export async function fireDue(business: { id: string; name: string }, now = new Date()): Promise<number> {
  const settings = await agentSettings(business.id);
  if (!emailProvider()) return 0;
  const rows = await query<{ id: string; item: Held; createdAt: string; stage: JobStage }>(
    `select p.id, p.item, ${moment("p.created_at")} as "createdAt", j.stage
       from design_prepared p join design_jobs j on j.business_id = p.business_id and j.id = p.job_id
      where p.business_id = $1 and p.status = 'ready'`,
    [business.id],
  );
  let sent = 0;
  for (const r of rows) {
    const entry = entryOf({ ...r.item, id: r.id, createdAt: r.item.createdAt ?? r.createdAt }, r.stage, settings, now);
    // A time a person picked sends whatever the agent; otherwise only an agent that works sends on its own.
    if (!r.item.notBefore && (!entry.stage || !AGENTS[entry.stage].working)) continue;
    if (!shouldFire(entry.state, entry.firesAt, now) || !withinHours(now, settings.hours)) continue;
    if ((await sendOutboxItem(business, r.id, SOL_SENDER)) === "sent") sent++;
  }
  return sent;
}

/** Every business with an agent on, or with an email someone put off to a time (for the hourly cron); older settings had one switch, `sending`. */
export async function sendingBusinesses(): Promise<{ id: string; name: string }[]> {
  return query(
    `select b.id, b.name from businesses b
      where exists (
              select 1 from design_sol_agents a where a.business_id = b.id
                 and (jsonb_array_length(case when jsonb_typeof(a.settings->'on') = 'array' then a.settings->'on' else '[]'::jsonb end) > 0
                      or a.settings->>'sending' = 'true'))
         or exists (select 1 from design_prepared p where p.business_id = b.id and p.status = 'ready' and p.item ? 'notBefore')`,
  );
}

/** Holds an item (Sol won't send it; a person will), lets it go again, or changes its words. */
export async function changeOutboxItem(
  businessId: string,
  id: string,
  change: { held: boolean; notBefore?: string } | { subject: string; body: string },
): Promise<boolean> {
  const done = await query(
    `update design_prepared set item = item || $3::jsonb where business_id = $1 and id = $2 and status in ('preparing', 'ready') returning id`,
    [businessId, id, JSON.stringify(change)],
  );
  return done.length > 0;
}
