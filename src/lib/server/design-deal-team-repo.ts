/**
 * Server only. The team chat on each deal (domain/design/deal-team.ts), in `design_deal_lines`. Under the designer's
 * tenant rule (business id first, from the signed-in member only). Every function a member reaches first reads the deal
 * through `jobById` with their viewer, so a deal they may not see answers as if it weren't there; the customer never
 * reaches any of it. Sol writes through `solPostsOnDeal` (a note, or a request with the customer's words), never
 * through a member's functions.
 */
import { can, cleanPermissions, type DealViewer, type MemberRole } from "@/lib/domain/design/account";
import { mentionsIn } from "@/lib/domain/design/mentions";
import {
  DEAL_LINES_SHOWN,
  PAD_LINES,
  SOL_WRITER,
  askFollowers,
  cleanAsk,
  dealChatOrder,
  designAskFor,
  isFollowing,
  openAsks,
  padOf,
  writerName,
  type DealAsk,
  type DealChatLine,
  type DealLine,
  type DealLineKind,
  type SaidSomewhere,
} from "@/lib/domain/design/deal-team";
import { newId, query, transaction } from "./db";
import { jobById, listJobs } from "./design-crm-repo";
import { notifyMentions } from "./design-notifications-repo";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export class DealTeamRefusal extends Error {}

export interface DealTeamMe {
  businessId: string;
  email: string;
  viewer: DealViewer;
}

interface Row {
  id: string;
  job: string;
  by: string;
  kind: string;
  text: string;
  ask: unknown;
  at: string;
}

const LINE = `id, job_id as job, by_email as by, kind, text, ask, ${moment("at")} as at`;

function lineOf(r: Row): DealLine {
  const ask = r.kind === "ask" ? cleanAsk(r.ask) : null;
  const kind: DealLineKind = ask ? "ask" : r.kind === "note" ? "note" : "line";
  return { id: r.id, jobId: r.job, by: r.by, kind, text: r.text, at: r.at, ...(ask ? { ask } : {}) };
}

/** The deal, as this member may see it; refused as if it weren't there otherwise. */
async function dealFor(me: DealTeamMe, jobId: string) {
  const found = await jobById(me.businessId, jobId, me.viewer);
  if (!found) throw new DealTeamRefusal("That deal isn't here.");
  return found;
}

async function linesOf(businessId: string, jobId: string, n = DEAL_LINES_SHOWN): Promise<DealLine[]> {
  const rows = await query<Row>(
    `select ${LINE} from design_deal_lines where business_id = $1 and job_id = $2 order by at desc, id desc limit $3`,
    [businessId, jobId, n],
  );
  return rows.reverse().map(lineOf);
}

/** A deal's team chat as this member sees it: its lines (oldest first), and the business's people to @mention. */
export async function dealTeam(me: DealTeamMe, jobId: string, opts: { seen?: boolean } = {}) {
  const found = await dealFor(me, jobId);
  if (opts.seen) await markSeen(me.businessId, jobId, me.email);
  const [lines, members, following] = await Promise.all([
    linesOf(me.businessId, jobId),
    query<{ email: string; first_name: string | null; role: string }>(
      `select email, first_name, role from business_members where business_id = $1 order by first_name nulls last, email`,
      [me.businessId],
    ),
    follows(me.businessId, jobId, me.email, found.job.owner),
  ]);
  return {
    jobId,
    customer: found.customer.name,
    title: found.job.title,
    following,
    lines,
    members: members.map((m) => ({ email: m.email.toLowerCase(), name: m.first_name || writerName(m.email), role: m.role })),
  };
}

/**
 * Says something on a deal, as the signed-in member. Members it @mentions get a notification (which also lets them see
 * the deal) and an email when email is set up, linking to this chat. Answers with the line and who was told.
 */
export async function sayOnDeal(me: DealTeamMe, jobId: string, text: string): Promise<{ line: DealLine; told: string[] }> {
  if (!text) throw new DealTeamRefusal("Write something first.");
  const found = await dealFor(me, jobId);
  const id = newId("dl", 10);
  await query(`insert into design_deal_lines (business_id, id, job_id, by_email, kind, text) values ($1,$2,$3,$4,'line',$5)`, [
    me.businessId,
    id,
    jobId,
    me.email.toLowerCase(),
    text,
  ]);
  // Writing in it follows it, and has it read; those @mentioned follow it unless they chose not to.
  await setFollow(me.businessId, jobId, me.email, true);
  await markSeen(me.businessId, jobId, me.email);
  const everyone = (await query<{ email: string }>(`select email from business_members where business_id = $1`, [me.businessId])).map(
    (m) => m.email,
  );
  for (const who of mentionsIn(text, everyone, me.email)) await joinFollow(me.businessId, jobId, who);
  const told = await notifyMentions(me.businessId, {
    jobId,
    customerId: found.customer.id,
    text,
    by: me.email,
    tab: "team",
  }).catch((e) => {
    console.error("deal chat mentions", e instanceof Error ? e.message : e);
    return [] as string[];
  });
  const rows = await query<Row>(`select ${LINE} from design_deal_lines where business_id = $1 and id = $2`, [me.businessId, id]);
  return { line: lineOf(rows[0]), told };
}

/**
 * Sol writes on a deal: a note (first person, only when something changed or he learned something), or a request with
 * what he wants and the customer's words. One open request of a kind a deal: a second is not written (null). The note
 * or request is also written on the deal's record as a note by Sol, so the deal's history stays in one place; the team's
 * own lines aren't (they would crowd it).
 */
export async function solPostsOnDeal(
  businessId: string,
  jobId: string,
  post: { kind: "note" | "ask" | "line"; text: string; ask?: DealAsk },
): Promise<DealLine | null> {
  const ask = post.kind === "ask" ? cleanAsk(post.ask) : null;
  if (post.kind === "ask" && !ask) return null;
  const text = post.text.trim().slice(0, 2000);
  if (!text) return null;
  const id = newId("dl", 10);
  const written = await transaction(async (q) => {
    // Under the deal's lock, so two readers of the feed can't both write the same request.
    const jobs = await q<{ customer: string }>(
      `select customer_id as customer from design_jobs where business_id = $1 and id = $2 for update`,
      [businessId, jobId],
    );
    if (!jobs[0]) return false;
    if (ask) {
      const open = await q(
        `select 1 from design_deal_lines where business_id = $1 and job_id = $2 and kind = 'ask' and ask->>'type' = $3 and not (ask ? 'done') limit 1`,
        [businessId, jobId, ask.type],
      );
      if (open.length) return false;
    }
    await q(`insert into design_deal_lines (business_id, id, job_id, by_email, kind, text, ask) values ($1,$2,$3,$4,$5,$6,$7::jsonb)`, [
      businessId,
      id,
      jobId,
      SOL_WRITER,
      ask ? "ask" : post.kind,
      text,
      ask ? JSON.stringify(ask) : null,
    ]);
    if (post.kind !== "line")
      await q(
        `insert into design_activity (id, business_id, customer_id, job_id, kind, text, by_email) values ($1,$2,$3,$4,'note',$5,$6)`,
        [newId("act"), businessId, jobs[0].customer, jobId, ask ? `Asked the team: ${text}` : text, SOL_WRITER],
      );
    return true;
  });
  if (!written) return null;
  if (ask) {
    // The request goes to whose job it is: they follow the deal's chat unless they chose not to.
    const members = await query<{ email: string; role: string; permissions: unknown }>(
      `select email, role, permissions from business_members where business_id = $1`,
      [businessId],
    );
    const people = members.map((m) => ({
      email: m.email,
      role: m.role,
      prices: can(m.role as MemberRole, "prices", m.permissions ? cleanPermissions(m.permissions) : undefined),
    }));
    for (const who of askFollowers(ask.type, people)) await joinFollow(businessId, jobId, who);
  }
  const rows = await query<Row>(`select ${LINE} from design_deal_lines where business_id = $1 and id = $2`, [businessId, id]);
  return lineOf(rows[0]);
}

// ---------------------------------------------------------------------------
// Following, read marks, and the team chat window's Deals section
// ---------------------------------------------------------------------------

/** A member's own choice to follow a deal's chat or not (also taking part in it, which follows). */
async function setFollow(businessId: string, jobId: string, email: string, following: boolean): Promise<void> {
  await query(
    `insert into design_deal_follows (business_id, job_id, email, following, at) values ($1,$2,$3,$4,now())
       on conflict (business_id, job_id, email) do update set following = excluded.following, at = now()`,
    [businessId, jobId, email.toLowerCase(), following],
  );
}

/** Brought in (@mentioned, or a request is for them): following, unless they already chose. */
async function joinFollow(businessId: string, jobId: string, email: string): Promise<void> {
  await query(`insert into design_deal_follows (business_id, job_id, email, following) values ($1,$2,$3,true) on conflict do nothing`, [
    businessId,
    jobId,
    email.toLowerCase(),
  ]);
}

async function markSeen(businessId: string, jobId: string, email: string): Promise<void> {
  await query(
    `insert into design_deal_seen (business_id, job_id, email, seen_at) values ($1,$2,$3,now())
       on conflict (business_id, job_id, email) do update set seen_at = now()`,
    [businessId, jobId, email.toLowerCase()],
  );
}

async function follows(businessId: string, jobId: string, email: string, owner: string | null): Promise<boolean> {
  const rows = await query<{ following: boolean }>(
    `select following from design_deal_follows where business_id = $1 and job_id = $2 and email = $3`,
    [businessId, jobId, email.toLowerCase()],
  );
  return isFollowing(rows[0]?.following ?? null, (owner ?? "").toLowerCase() === email.toLowerCase());
}

/** The Following toggle, for a member who may see the deal. Answers with where it now stands. */
export async function followDeal(me: DealTeamMe, jobId: string, following: boolean): Promise<boolean> {
  await dealFor(me, jobId);
  await setFollow(me.businessId, jobId, me.email, following);
  return following;
}

/** Opening a deal's chat from the team chat window (# and its name): it joins their Deals, and is read. */
export async function openDealChat(me: DealTeamMe, jobId: string): Promise<void> {
  await dealFor(me, jobId);
  await setFollow(me.businessId, jobId, me.email, true);
  await markSeen(me.businessId, jobId, me.email);
}

/** The deal's chat has been on screen: read. */
export async function markDealSeen(me: DealTeamMe, jobId: string): Promise<void> {
  await dealFor(me, jobId);
  await markSeen(me.businessId, jobId, me.email);
}

/**
 * The deal chats this member follows, for the team chat window's Deals section: only deals they may see (the deal
 * viewer rules), each with the customer and deal, its latest line and how many lines from others they haven't seen
 * (never opened, the last day's). Followed by choice or by taking part, or as the owner of a deal whose chat has
 * something in it.
 */
export async function dealChats(me: DealTeamMe): Promise<{ deals: DealChatLine[]; unread: number }> {
  const self = me.email.toLowerCase();
  const rows = await query<{ job: string; by: string | null; text: string | null; at: string | null; unread: number }>(
    `with mine as (
       select j.id from design_jobs j
         left join design_deal_follows f on f.business_id = j.business_id and f.job_id = j.id and f.email = $2
        where j.business_id = $1
          and (f.following is true
               or (f.following is null and lower(coalesce(j.owner_email, '')) = $2
                   and exists (select 1 from design_deal_lines l where l.business_id = j.business_id and l.job_id = j.id)))
     )
     select m.id as job, last.by_email as by, last.text, ${moment("last.at")} as at,
            (select count(*)::int from design_deal_lines l
               left join design_deal_seen s on s.business_id = l.business_id and s.job_id = l.job_id and s.email = $2
              where l.business_id = $1 and l.job_id = m.id and l.by_email <> $2
                and l.at > coalesce(s.seen_at, now() - interval '1 day')) as unread
       from mine m
       left join lateral (select by_email, text, at from design_deal_lines l
                            where l.business_id = $1 and l.job_id = m.id order by at desc, id desc limit 1) last on true`,
    [me.businessId, self],
  );
  if (!rows.length) return { deals: [], unread: 0 };
  const seen = new Map((await listJobs(me.businessId, me.viewer)).map((j) => [j.id, j]));
  const deals = dealChatOrder(
    rows
      .filter((r) => seen.has(r.job))
      .map((r) => {
        const j = seen.get(r.job)!;
        return {
          jobId: r.job,
          customer: j.customerName,
          title: j.title,
          last: r.by && r.at ? { by: r.by, text: (r.text ?? "").replace(/\s+/g, " ").slice(0, 160), at: r.at } : null,
          unread: r.unread,
        };
      }),
  );
  return { deals, unread: deals.reduce((n, d) => n + d.unread, 0) };
}

/** A request marked done (or opened again) by a member who may see the deal; written on the record. False when it isn't there. */
export async function markAskDone(me: DealTeamMe, jobId: string, lineId: string, done: boolean): Promise<boolean> {
  const found = await dealFor(me, jobId);
  const stamp = JSON.stringify({ by: me.email.toLowerCase(), at: new Date().toISOString() });
  const rows = done
    ? await query<{ text: string }>(
        `update design_deal_lines set ask = jsonb_set(ask, '{done}', $4::jsonb)
          where business_id = $1 and job_id = $2 and id = $3 and kind = 'ask' and not (ask ? 'done') returning text`,
        [me.businessId, jobId, lineId, stamp],
      )
    : await query<{ text: string }>(
        `update design_deal_lines set ask = ask - 'done' where business_id = $1 and job_id = $2 and id = $3 and kind = 'ask' and ask ? 'done' returning text`,
        [me.businessId, jobId, lineId],
      );
  if (!rows[0]) return false;
  await query(
    `insert into design_activity (id, business_id, customer_id, job_id, kind, text, by_email) values ($1,$2,$3,$4,'note',$5,$6)`,
    [
      newId("act"),
      me.businessId,
      found.customer.id,
      jobId,
      done ? `Done: Sol's request "${rows[0].text.slice(0, 160)}"` : "Sol's request opened again",
      me.email.toLowerCase(),
    ],
  );
  return true;
}

/** One request on a deal this member may see (the designer's brief); null when it isn't one. */
export async function dealAsk(me: DealTeamMe, jobId: string, lineId: string): Promise<DealLine | null> {
  await dealFor(me, jobId);
  const rows = await query<Row>(
    `select ${LINE} from design_deal_lines where business_id = $1 and job_id = $2 and id = $3 and kind = 'ask'`,
    [me.businessId, jobId, lineId],
  );
  return rows[0] ? lineOf(rows[0]) : null;
}

/**
 * The feed's pads: for each deal, its last few lines (with an open request kept in view) and its open requests. The
 * deal ids come from the feed, already read with the member's viewer.
 */
export async function padsFor(
  businessId: string,
  jobIds: readonly string[],
): Promise<Record<string, { lines: DealLine[]; openAsks: { id: string; type: DealAsk["type"] }[] }>> {
  if (!jobIds.length) return {};
  const [recent, asks] = await Promise.all([
    query<Row>(
      `select ${LINE} from (
         select *, row_number() over (partition by job_id order by at desc, id desc) as n
           from design_deal_lines where business_id = $1 and job_id = any($2)
       ) l where n <= $3 order by at, id`,
      [businessId, jobIds, PAD_LINES],
    ),
    query<Row>(
      `select ${LINE} from design_deal_lines where business_id = $1 and job_id = any($2) and kind = 'ask' and not (ask ? 'done') order by at, id`,
      [businessId, jobIds],
    ),
  ]);
  const out: Record<string, { lines: DealLine[]; openAsks: { id: string; type: DealAsk["type"] }[] }> = {};
  for (const id of jobIds) {
    const open = asks.filter((r) => r.job === id).map(lineOf);
    const lines = recent.filter((r) => r.job === id).map(lineOf);
    const merged = [...open.filter((a) => !lines.some((l) => l.id === a.id)), ...lines].sort((x, y) => x.at.localeCompare(y.at));
    if (!merged.length) continue;
    out[id] = {
      lines: padOf(merged),
      openAsks: openAsks(merged).map((l) => ({ id: l.id, type: l.ask!.type })),
    };
  }
  return out;
}

/** A deal's last lines, as Sol reads them for context: who said what. */
export async function dealTeamContext(businessId: string, jobId: string, n = 12): Promise<{ by: string; text: string }[]> {
  return (await linesOf(businessId, jobId, n)).map((l) => ({ by: l.by, text: l.text }));
}

// ---------------------------------------------------------------------------
// The design request: a deal not yet designed whose customer has said what they want
// ---------------------------------------------------------------------------

const lastLooked = new Map<string, number>();
/** How often one business's deals are looked over for design requests. */
const LOOK_EVERY_MS = 5 * 60_000;

/**
 * Sol's design requests: every lead with no roof design whose customer has said what they want (in
 * their proposal chat, or on the deal's notes and call notes) gets one request for a design, quoting them. Never a
 * second for the same deal, even once the first is done (the team has it). By rule, so no Sol credit is taken.
 * At most once every few minutes a business (`force` for tests). Answers with how many were written.
 */
export async function solAsksForDesigns(businessId: string, force = false, now = new Date()): Promise<number> {
  const last = lastLooked.get(businessId) ?? 0;
  if (!force && now.getTime() - last < LOOK_EVERY_MS) return 0;
  lastLooked.set(businessId, now.getTime());
  const jobs = await query<{ id: string; stage: string; first: string | null; name: string }>(
    `select j.id, j.stage, c.first_name as first, c.name from design_jobs j
       join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where j.business_id = $1 and j.stage = 'lead' and j.project_id is null and j.kw is null
        and not exists (select 1 from design_deal_lines l where l.business_id = j.business_id and l.job_id = j.id and l.kind = 'ask' and l.ask->>'type' = 'design')
      order by j.created_at desc limit 40`,
    [businessId],
  );
  if (!jobs.length) return 0;
  const ids = jobs.map((j) => j.id);
  const [chat, record] = await Promise.all([
    query<{ job: string; text: string; at: string }>(
      `select job_id as job, text, ${moment("at")} as at from design_messages
        where business_id = $1 and job_id = any($2) and from_customer order by at desc limit 400`,
      [businessId, ids],
    ),
    query<{ job: string; kind: string; text: string; at: string }>(
      `select job_id as job, kind, text, ${moment("at")} as at from design_activity
        where business_id = $1 and job_id = any($2) and kind in ('note','call') and by_email <> $3 order by at desc limit 400`,
      [businessId, ids, SOL_WRITER],
    ),
  ]);
  let written = 0;
  for (const j of jobs) {
    const said: SaidSomewhere[] = [
      ...chat.filter((c) => c.job === j.id).map((c) => ({ from: "chat" as const, text: c.text, at: c.at })),
      ...record
        .filter((r) => r.job === j.id)
        .map((r) => ({ from: r.kind === "call" ? ("call" as const) : ("note" as const), text: r.text, at: r.at })),
    ];
    const asked = designAskFor(
      { stage: j.stage, projectId: null, kw: null, customerFirst: j.first || j.name.split(/\s+/)[0] || "" },
      said,
      now,
    );
    if (!asked) continue;
    if (await solPostsOnDeal(businessId, j.id, { kind: "ask", text: asked.text, ask: asked.ask })) written += 1;
  }
  return written;
}
