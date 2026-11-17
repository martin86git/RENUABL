/**
 * Server only. The industry feed as the industry's network (17 Nov 2026, domain/design/feed-social.ts): a member's
 * notifications from the feed, what they follow and mute, a business's page, wins shared from a job, Sol's weekly poll
 * and its results, and the Monday digest email. Each member reads only their own notifications and follows; a
 * business's page shows what its posts already show, plus its suburb only when it is listed in the directory.
 */
import { INSTALLED_STAGES } from "@/lib/domain/design/crm";
import { kindWords } from "@/lib/domain/design/feed-posts";
import {
  FOLLOW_LIMITS,
  NO_FOLLOWS,
  SOL_AUTHOR,
  SOL_WRITER,
  digestAddress,
  digestEmail,
  digestPost,
  digestStories,
  resultsPost,
  solPollFor,
  weekOf,
  winHeadline,
  type FeedBusiness,
  type FeedNote,
  type Follows,
  type NoteKind,
  type WinFacts,
} from "@/lib/domain/design/feed-social";
import { suburbAlone } from "@/lib/domain/design/marketplace";
import type { Standing } from "@/lib/domain/design/connections";
import type { NewsTopic } from "@/lib/domain/design/industry-news";
import { siteUrl } from "@/lib/domain/sms";
import { newId, query } from "./db";
import { standings } from "./design-connections-repo";
import { jobById } from "./design-crm-repo";
import { createPost, listPosts, type Reader } from "./design-feed-posts-repo";
import { listingPicture } from "./design-listing-picture";
import { systemOf } from "./design-marketplace-repo";
import type { Member } from "./design-repo";
import { emailProvider, sendEmail } from "./email";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/* ---------- Notifications ---------- */

/** Tells a member something happened on their post or a story: adds to an unread note of that kind and place, else a new one. */
export async function addNote(
  to: { email: string; businessId: string },
  kind: NoteKind,
  where: { postId?: string; storyId?: string },
  by: string,
): Promise<void> {
  const postId = where.postId ?? null;
  const storyId = where.storyId ?? null;
  const bumped = await query(
    `update design_feed_notes set count = count + 1, last_by = $5, at = now()
      where to_email = $1 and kind = $2 and read_at is null and post_id is not distinct from $3 and story_id is not distinct from $4
      returning id`,
    [to.email.toLowerCase(), kind, postId, storyId, by.slice(0, 120)],
  );
  if (bumped.length) return;
  await query(`insert into design_feed_notes (id, to_email, business_id, kind, post_id, story_id, last_by) values ($1,$2,$3,$4,$5,$6,$7)`, [
    newId("fnt", 8),
    to.email.toLowerCase(),
    to.businessId,
    kind,
    postId,
    storyId,
    by.slice(0, 120),
  ]);
}

/** A member's feed notifications, newest first (the latest 40), with what each is about. */
export async function feedNotes(email: string): Promise<FeedNote[]> {
  const rows = await query<FeedNote & { body: string | null; win: WinFacts | null; headline: string | null }>(
    `select n.id, n.kind, n.post_id as "postId", n.story_id as "storyId", n.last_by as by, n.count, ${moment("n.at")} as at,
            n.read_at is not null as read, p.body, p.win, s.headline, '' as about
       from design_feed_notes n
       left join design_feed_posts p on p.id = n.post_id
       left join industry_news s on s.id = n.story_id
      where n.to_email = $1 and (n.post_id is null or p.removed_at is null)
      order by n.at desc limit 40`,
    [email.toLowerCase()],
  );
  return rows.map(({ body, win, headline, ...n }) => {
    const words = (headline ?? body ?? "").trim() || (win ? winHeadline(win) : "A post");
    return { ...n, about: words.length > 90 ? `${words.slice(0, 88)}…` : words };
  });
}

export async function unreadFeedNotes(email: string): Promise<number> {
  const rows = await query<{ n: number }>(`select count(*)::int as n from design_feed_notes where to_email = $1 and read_at is null`, [
    email.toLowerCase(),
  ]);
  return rows[0]?.n ?? 0;
}

/** Marks a member's own feed notifications read: those named, or all. */
export async function readFeedNotes(email: string, which: { ids?: string[]; all?: boolean }): Promise<void> {
  const base = `update design_feed_notes set read_at = now() where to_email = $1 and read_at is null`;
  if (which.all) await query(base, [email.toLowerCase()]);
  else if (which.ids?.length) await query(`${base} and id = any($2)`, [email.toLowerCase(), which.ids]);
}

/* ---------- Following and muting ---------- */

export async function followsOf(email: string): Promise<Follows> {
  const rows = await query<{ kind: string; target: string; name: string | null; key: string | null }>(
    `select f.kind, f.target, b.name, d.key from design_feed_follows f
       left join businesses b on f.kind = 'business' and b.id = f.target
       left join design_directory d on f.kind = 'business' and d.business_id = f.target
      where f.member_email = $1 order by f.at`,
    [email.toLowerCase()],
  );
  const off = await query<{ off: boolean }>(`select off_at is not null as off from design_feed_digest where email = $1`, [
    email.toLowerCase(),
  ]);
  return {
    words: rows.filter((r) => r.kind === "word").map((r) => r.target),
    businesses: rows.filter((r) => r.kind === "business" && r.key && r.name).map((r) => ({ key: r.key as string, name: r.name as string })),
    muted: rows.filter((r) => r.kind === "mute").map((r) => r.target as NewsTopic),
    digest: !off[0]?.off,
  };
}

async function businessOfKey(key: string): Promise<string | null> {
  const rows = await query<{ id: string }>(`select business_id as id from design_directory where key = $1`, [key]);
  return rows[0]?.id ?? null;
}

/** Follows or stops following: a business (by its key), a word, or mutes a topic. Refused past the limits. */
export async function setFollow(
  m: Pick<Member, "businessId" | "email">,
  what: { kind: "business"; key: string } | { kind: "word"; word: string } | { kind: "mute"; topic: NewsTopic },
  on: boolean,
): Promise<string | null> {
  const email = m.email.toLowerCase();
  let target: string;
  if (what.kind === "business") {
    const id = await businessOfKey(what.key);
    if (!id) return "That business isn't on RENUABL any more.";
    if (id === m.businessId) return "That's your own business.";
    target = id;
  } else target = what.kind === "word" ? what.word.toLowerCase() : what.topic;
  if (!on) {
    await query(`delete from design_feed_follows where member_email = $1 and kind = $2 and target = $3`, [email, what.kind, target]);
    return null;
  }
  const limit = what.kind === "word" ? FOLLOW_LIMITS.words : what.kind === "business" ? FOLLOW_LIMITS.businesses : 50;
  const n = await query<{ n: number }>(`select count(*)::int as n from design_feed_follows where member_email = $1 and kind = $2`, [
    email,
    what.kind,
  ]);
  if ((n[0]?.n ?? 0) >= limit)
    return what.kind === "word" ? `You can follow up to ${limit} words.` : "You're following as many as you can.";
  await query(`insert into design_feed_follows (member_email, business_id, kind, target) values ($1,$2,$3,$4) on conflict do nothing`, [
    email,
    m.businessId,
    what.kind,
    target,
  ]);
  return null;
}

/** Turns the Monday email on or off for this address. */
export async function setDigest(email: string, on: boolean): Promise<void> {
  await query(
    `insert into design_feed_digest (email, off_at) values ($1, case when $2 then null else now() end)
     on conflict (email) do update set off_at = case when $2 then null else coalesce(design_feed_digest.off_at, now()) end`,
    [email.toLowerCase(), on],
  );
}

/* ---------- A business's page ---------- */

/** A business as the feed shows it, with its posts and where the reader's business stands with it; null when there's no such key. */
export async function feedBusiness(reader: Reader, key: string): Promise<FeedBusiness | null> {
  const rows = await query<{ id: string; name: string; kind: string; listed: boolean; suburb: string; state: string }>(
    `select b.id, b.name, b.kind, d.listed, d.suburb, d.state from design_directory d join businesses b on b.id = d.business_id where d.key = $1`,
    [key],
  );
  const b = rows[0];
  if (!b) return null;
  const own = b.id === reader.businessId;
  const [mine, posts, following] = await Promise.all([
    own ? Promise.resolve(new Map()) : standings(reader.businessId),
    listPosts(reader, false, b.id),
    query(`select 1 from design_feed_follows where member_email = $1 and kind = 'business' and target = $2`, [reader.email, b.id]),
  ]);
  return {
    key,
    name: b.name,
    kind: kindWords(b.kind),
    suburb: b.listed ? b.suburb : "",
    state: b.listed ? b.state : "",
    listed: b.listed,
    own,
    standing: (mine.get(b.id)?.standing as Standing | undefined) ?? "none",
    following: following.length > 0,
    posts: posts.slice(0, 20),
  };
}

/* ---------- Wins ---------- */

/** The business's installed jobs that this member may see and that haven't been shared as a win yet. */
export async function winnableJobs(m: Member, viewer: { email: string; all: boolean }): Promise<{ jobId: string; label: string }[]> {
  const rows = await query<{ id: string; customer: string; kw: number | null; address: string; seen: boolean; owner: string | null }>(
    `select j.id, c.name as customer, j.kw, coalesce(nullif(j.address, ''), c.address) as address, j.owner_email as owner, true as seen
       from design_jobs j join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where j.business_id = $1 and j.stage = any($2)
        and not exists (select 1 from design_feed_posts p where p.business_id = j.business_id and p.job_id = j.id and p.removed_at is null)
      order by j.updated_at desc limit 40`,
    [m.businessId, [...INSTALLED_STAGES]],
  );
  return rows
    .filter((r) => viewer.all || !r.owner || r.owner === viewer.email)
    .map((r) => ({
      jobId: r.id,
      label: [r.customer, r.kw ? `${Number(r.kw).toFixed(2)} kW` : "", suburbAlone(r.address)].filter(Boolean).join(" · "),
    }));
}

/** Shares one installed job as a win: its system and suburb, and its roof drawn (surroundings blurred). */
export async function postWin(
  m: Member,
  viewer: { email: string; all: boolean },
  jobId: string,
  text: string,
): Promise<{ ok: true; id: string } | { ok: false; status: number; message: string }> {
  const found = await jobById(m.businessId, jobId, viewer);
  if (!found) return { ok: false, status: 404, message: "There's no such job." };
  if (!INSTALLED_STAGES.includes(found.job.stage))
    return { ok: false, status: 409, message: "Only an installed job can be shared as a win." };
  const spec = await systemOf(m, jobId);
  const address = found.job.address || found.customer.address;
  const sys = spec?.system;
  const win: WinFacts = {
    kw: sys?.kw ?? found.job.kw ?? null,
    panels: sys?.panels ?? null,
    batteryKwh: sys?.batteryKwh ?? null,
    ev: sys?.ev ?? false,
    suburb: suburbAlone(address),
    state: address.match(/\b(VIC|NSW|QLD|SA|WA|TAS|ACT|NT)\b/i)?.[1]?.toUpperCase() ?? "",
  };
  const picture = spec?.design ? await listingPicture(spec.design, address).catch(() => null) : null;
  try {
    const id = await createPost(m, text, null, picture, null, { kind: "win", win, jobId });
    return { ok: true, id };
  } catch (e) {
    if (String((e as { code?: string }).code) === "23505") return { ok: false, status: 409, message: "That job is already shared." };
    throw e;
  }
}

/* ---------- Sol's weekly poll ---------- */

/** Posts this week's poll from Sol, once a week; answers whether it was posted now. */
export async function postSolPoll(now = new Date()): Promise<boolean> {
  const week = weekOf(now);
  const poll = solPollFor(week);
  const rows = await query(
    `insert into design_feed_posts (id, business_id, member_email, author, body, poll, kind, week)
     values ($1, null, $2, $3, $4, $5::jsonb, 'sol-poll', $6)
     on conflict (kind, week) where week is not null do nothing returning id`,
    [newId("post", 8), SOL_WRITER, SOL_AUTHOR, poll.question, JSON.stringify(poll.choices), week],
  );
  return rows.length > 0;
}

/** Posts last week's poll's results, once, when enough people voted; answers whether it did. */
export async function postSolResults(now = new Date()): Promise<boolean> {
  const week = weekOf(new Date(now.getTime() - 7 * 86_400_000));
  const polls = await query<{ id: string; body: string; poll: string[] }>(
    `select id, body, poll from design_feed_posts where kind = 'sol-poll' and week = $1 and removed_at is null`,
    [week],
  );
  const p = polls[0];
  if (!p || !Array.isArray(p.poll)) return false;
  const counts = await query<{ choice: number; n: number }>(
    `select choice, count(*)::int as n from design_feed_votes where post_id = $1 group by choice`,
    [p.id],
  );
  const votes = p.poll.map((_, i) => counts.find((c) => c.choice === i)?.n ?? 0);
  const made = resultsPost(p.body, p.poll, votes);
  if (!made) return false;
  const rows = await query(
    `insert into design_feed_posts (id, business_id, member_email, author, body, kind, week, results)
     values ($1, null, $2, $3, $4, 'sol-results', $5, $6::jsonb)
     on conflict (kind, week) where week is not null do nothing returning id`,
    [newId("post", 8), SOL_WRITER, SOL_AUTHOR, made.text, week, JSON.stringify(made.results)],
  );
  return rows.length > 0;
}

/* ---------- The Monday digest ---------- */

/** Sends this week's digest to every member who hasn't turned it off and hasn't had it this week; answers how many went. */
export async function sendDigests(now = new Date()): Promise<number> {
  const site = siteUrl();
  if (!site || !emailProvider()) return 0;
  const week = weekOf(now);
  const stories = await query<{
    id: string;
    headline: string;
    site: string;
    url: string;
    foundAt: string;
    likes: number;
    comments: number;
  }>(
    `select s.id, s.headline, s.site, s.url, ${moment("s.found_at")} as "foundAt",
            (select count(*)::int from design_story_likes l where l.story_id = s.id) as likes,
            (select count(*)::int from design_story_comments c where c.story_id = s.id and c.removed_at is null) as comments
       from industry_news s where s.found_at > now() - interval '7 days'`,
  );
  const posts = await query<{ id: string; author: string; text: string; likes: number; comments: number; votes: number }>(
    `select p.id, p.author, p.body as text,
            (select count(*)::int from design_feed_likes l where l.post_id = p.id) as likes,
            (select count(*)::int from design_feed_comments c where c.post_id = p.id and c.removed_at is null) as comments,
            (select count(*)::int from design_feed_votes v where v.post_id = p.id) as votes
       from design_feed_posts p
      where p.created_at > now() - interval '7 days' and p.removed_at is null and p.hidden_at is null and p.body <> ''`,
  );
  const top = digestStories(stories, now);
  const post = digestPost(posts);
  const members = await query<{ email: string; firstName: string | null }>(
    `select distinct on (lower(m.email)) lower(m.email) as email, m.first_name as "firstName"
       from business_members m join businesses b on b.id = m.business_id
      where coalesce(b.created_by, '') not like '%.example'
      order by lower(m.email)`,
  );
  let sent = 0;
  for (const m of members) {
    if (!digestAddress(m.email)) continue;
    const email = digestEmail({ firstName: m.firstName, stories: top, post, link: `${site}/design/news` });
    if (!email) return sent;
    // Claimed first, so a second run in the same week sends nothing twice.
    const claimed = await query(
      `insert into design_feed_digest (email, last_week) values ($1, $2)
       on conflict (email) do update set last_week = excluded.last_week
        where design_feed_digest.off_at is null and design_feed_digest.last_week is distinct from excluded.last_week
       returning email`,
      [m.email, week],
    );
    if (!claimed.length) continue;
    try {
      await sendEmail({ to: m.email, ...email });
      sent++;
    } catch {
      console.error("a feed digest couldn't be sent");
    }
  }
  return sent;
}

export { NO_FOLLOWS };
