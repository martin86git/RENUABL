/**
 * Server only. Ready for you (domain/design/prepared.ts): the work Sol prepares for a business, kept in
 * `design_prepared` under the designer's tenant rule (business id first, from the signed-in member only). Reading the
 * tray finds the proposals' follow-ups that have fallen due, starts a draft for each new one (a few at a time), and
 * lets the drafts be written after the answer has gone back, so the tray never waits on Claude. A draft whose reason
 * has gone (the follow-up marked done, the customer wrote, a newer version went out) is put aside as stale.
 */
import {
  DRAFT_SCHEMA,
  MAX_NEW_AT_ONCE,
  PREPARING_MINUTES,
  RECAP_BASIS,
  cleanDraft,
  composeFollowUp,
  followUpBasis,
  followUpKey,
  followUpPrompt,
  followUpWhy,
  plainFollowUp,
  recapKey,
  signOff,
  type FollowUpFacts,
  type PreparedItem,
  type PreparedStatus,
} from "@/lib/domain/design/prepared";
import { dueFollowUp } from "@/lib/domain/design/proposal-lists";
import type { DealViewer } from "@/lib/domain/design/account";
import type { ProposalView } from "@/lib/domain/design/proposal";
import { todayInMarket } from "@/lib/domain/market";
import { siteUrl } from "@/lib/domain/sms";
import { parseApiKey, redactSecrets } from "./bill-reader";
import { readWithClaude } from "./claude-reader";
import { modelFor } from "./sol-credits";
import { newId, query } from "./db";
import { listProposals } from "./design-after-sale-repo";
import { listJobs } from "./design-crm-repo";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

interface Row {
  id: string;
  key: string;
  status: PreparedStatus;
  item: PreparedItem;
  createdAt: string;
}

const ACTIVE: PreparedStatus[] = ["preparing", "ready"];

async function rows(businessId: string): Promise<Row[]> {
  return query<Row>(
    `select id, key, status, item, ${moment("created_at")} as "createdAt"
       from design_prepared where business_id = $1 and status = any($2::text[]) order by created_at`,
    [businessId, ACTIVE],
  );
}

/** What the follow-up needs beyond the Proposals list: the customer's email, their last words, indicative or not. */
async function extras(businessId: string, jobIds: string[]) {
  if (!jobIds.length) return new Map<string, { email: string; lastText: string | null; indicative: boolean }>();
  const found = await query<{ jobId: string; email: string | null; lastText: string | null; view: ProposalView }>(
    `select j.id as "jobId", c.email,
            (select m.text from design_messages m where m.business_id = j.business_id and m.job_id = j.id and m.from_customer
              order by m.at desc limit 1) as "lastText",
            (select v.view from design_proposals p join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id
              where p.business_id = j.business_id and p.job_id = j.id order by v.version desc limit 1) as view
       from design_jobs j join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where j.business_id = $1 and j.id = any($2::text[])`,
    [businessId, jobIds],
  );
  return new Map(found.map((r) => [r.jobId, { email: r.email ?? "", lastText: r.lastText, indicative: Boolean(r.view?.indicative) }]));
}

/** A follow-up in its waiting shape, before Sol's words are in (or for ever, in the plain words, without Claude). */
function followUpItem(
  base: { id: string; jobId: string; customerId: string; customer: string; title: string; to: string; day: number },
  facts: FollowUpFacts,
  words: { subject: string; body: string },
  url: string | null,
  by: PreparedItem["by"],
  status: PreparedStatus,
): PreparedItem {
  return {
    ...base,
    kind: "follow-up",
    why: followUpWhy(facts),
    subject: words.subject,
    body: composeFollowUp(words.body, facts.business, url),
    basis: followUpBasis(facts),
    by,
    status,
    createdAt: new Date().toISOString(),
  };
}

export interface Pending {
  id: string;
  facts: FollowUpFacts;
  url: string | null;
}

/**
 * The tray for a member: what is ready or being prepared on the deals they may see. Follow-ups that have fallen due
 * since it was last read are started (a few at a time) and handed back as `pending`, to be drafted after the answer.
 */
export async function readyFor(
  member: { businessId: string; businessName: string; email: string },
  viewer: DealViewer,
  now = new Date(),
): Promise<{ items: PreparedItem[]; pending: Pending[] }> {
  const businessId = member.businessId;
  const [proposals, seenJobs, existing] = await Promise.all([
    listProposals(businessId, todayInMarket(now)),
    viewer.all ? Promise.resolve(null) : listJobs(businessId, viewer),
    rows(businessId),
  ]);
  const seen = seenJobs && new Set(seenJobs.map((j) => j.id));
  // Every follow-up due now, the business's whole list (the tray is shared; who sees which is decided below).
  const due = proposals
    .filter((p) => p.state === "live" && !p.acceptedAt)
    .map((p) => ({ p, d: dueFollowUp({ sentAt: p.publishedAt, now, done: p.followUps.map((f) => f.day), lastWord: p.lastWord }) }))
    .filter((x): x is { p: (typeof proposals)[number]; d: NonNullable<typeof x.d> } => Boolean(x.d));
  const dueKeys = new Set(due.map(({ p, d }) => followUpKey(p.jobId, p.version, d.day)));

  // A follow-up whose reason has gone is put aside.
  const stale = existing.filter((r) => r.item.kind === "follow-up" && !dueKeys.has(r.key)).map((r) => r.id);
  if (stale.length)
    await query(`update design_prepared set status = 'stale', done_at = now() where business_id = $1 and id = any($2::text[])`, [
      businessId,
      stale,
    ]);

  // New ones, a few at a time, in their plain words to start with (so the tray has something even if Claude fails).
  const have = new Set(existing.map((r) => r.key));
  const fresh = due.filter(({ p, d }) => !have.has(followUpKey(p.jobId, p.version, d.day)));
  const ex = await extras(businessId, [...new Set(fresh.slice(0, MAX_NEW_AT_ONCE).map((f) => f.p.jobId))]);
  const site = siteUrl();
  const pending: Pending[] = [];
  const business = member.businessName;
  for (const { p, d } of fresh.slice(0, MAX_NEW_AT_ONCE)) {
    const x = ex.get(p.jobId);
    const facts: FollowUpFacts = {
      business,
      customer: p.customer,
      title: p.title,
      step: d.step,
      age: d.age,
      opened: Boolean(p.openedAt),
      options: p.options,
      indicative: x?.indicative ?? false,
      lastWord: x?.lastText ?? null,
    };
    const url = site ? `${site}${p.path}` : null;
    const id = newId("prep", 10);
    const item = followUpItem(
      { id, jobId: p.jobId, customerId: p.customerId, customer: p.customer, title: p.title, to: x?.email ?? "", day: d.day },
      facts,
      plainFollowUp(facts),
      url,
      "plain",
      "preparing",
    );
    const made = await query<{ id: string }>(
      `insert into design_prepared (id, business_id, job_id, key, kind, status, item) values ($1, $2, $3, $4, 'follow-up', 'preparing', $5::jsonb)
       on conflict (business_id, key) do nothing returning id`,
      [id, businessId, p.jobId, followUpKey(p.jobId, p.version, d.day), JSON.stringify(item)],
    );
    if (made.length) pending.push({ id, facts, url });
  }

  // Anything left preparing too long (Claude never answered) shows in its plain words.
  const late = Date.now() - PREPARING_MINUTES * 60_000;
  await query(
    `update design_prepared set status = 'ready', item = jsonb_set(item, '{status}', '"ready"')
      where business_id = $1 and status = 'preparing' and created_at < to_timestamp($2 / 1000.0)`,
    [businessId, late],
  );

  const all = await rows(businessId);
  const items = all.map((r) => ({ ...r.item, id: r.id, status: r.status })).filter((i) => !seen || seen.has(i.jobId));
  return { items, pending: pending.filter((p) => !seen || all.some((r) => r.id === p.id && seen.has(r.item.jobId))) };
}

/**
 * Writes each new follow-up in Sol's words (after the answer has gone back); the plain words stay when Claude can't,
 * or when `sol` is false (past the hour's limit).
 */
export async function draftPending(businessId: string, pending: Pending[], sol = true): Promise<void> {
  const apiKey = sol ? parseApiKey(process.env.ANTHROPIC_API_KEY) : null;
  for (const p of pending) {
    let words: { subject: string; body: string } | null = null;
    if (apiKey) {
      try {
        // A customer reads it: the deeper model (sol-routing.ts).
        words = cleanDraft(await readWithClaude<unknown>([], DRAFT_SCHEMA, followUpPrompt(p.facts), apiKey, { model: modelFor("deep") }));
      } catch (e) {
        console.error("a follow-up couldn't be drafted", redactSecrets(e instanceof Error ? e.message : String(e)));
      }
    }
    const patch = words
      ? { subject: words.subject, body: composeFollowUp(words.body, p.facts.business, p.url), by: "sol", status: "ready" }
      : { status: "ready" };
    await query(
      `update design_prepared set status = 'ready', item = item || $3::jsonb where business_id = $1 and id = $2 and status = 'preparing'`,
      [businessId, p.id, JSON.stringify(patch)],
    ).catch(() => console.error("a follow-up draft couldn't be kept"));
  }
}

/** A call's recap email, put in the tray when the call's write-up is applied. */
export async function addRecap(
  businessId: string,
  input: {
    jobId: string;
    customerId: string;
    customer: string;
    title: string;
    to: string;
    business: string;
    subject: string;
    body: string;
  },
): Promise<PreparedItem> {
  const at = new Date().toISOString();
  const id = newId("prep", 10);
  const item: PreparedItem = {
    id,
    kind: "recap",
    jobId: input.jobId,
    customerId: input.customerId,
    customer: input.customer,
    title: input.title,
    why: "Recap of your call",
    to: input.to,
    subject: input.subject,
    body: [input.body.trim(), signOff(input.business)].join("\n\n"),
    basis: RECAP_BASIS,
    day: 0,
    by: "sol",
    status: "ready",
    createdAt: at,
  };
  await query(
    `insert into design_prepared (id, business_id, job_id, key, kind, status, item) values ($1, $2, $3, $4, 'recap', 'ready', $5::jsonb)
     on conflict (business_id, key) do nothing`,
    [id, businessId, input.jobId, recapKey(input.jobId, at), JSON.stringify(item)],
  );
  return item;
}

/** One item, if it is the business's and still waiting. */
export async function preparedById(businessId: string, id: string): Promise<PreparedItem | null> {
  const found = await query<Row>(
    `select id, key, status, item, ${moment("created_at")} as "createdAt" from design_prepared
      where business_id = $1 and id = $2 and status = any($3::text[])`,
    [businessId, id, ACTIVE],
  );
  return found[0] ? { ...found[0].item, id: found[0].id, status: found[0].status } : null;
}

/** Sent (by the member's press) or put aside: either way it leaves the tray. */
export async function closePrepared(businessId: string, id: string, status: "sent" | "dismissed", by: string): Promise<boolean> {
  const done = await query(
    `update design_prepared set status = $3, item = jsonb_set(item, '{status}', to_jsonb($3::text)), done_at = now(), done_by = $4
      where business_id = $1 and id = $2 and status = any($5::text[]) returning id`,
    [businessId, id, status, by.toLowerCase(), ACTIVE],
  );
  return done.length > 0;
}
