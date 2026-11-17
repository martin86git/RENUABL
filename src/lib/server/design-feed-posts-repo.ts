/**
 * Server only. Posts in the industry feed (domain/design/feed-posts.ts), in `design_feed_posts` with their comments,
 * likes and reports. Every business reads every post (that is the feed), so reading runs across businesses; writing is
 * always as the signed-in member (`requireMember`), whose business and email are set here, never from a browser. A
 * reader is sent `FeedPost`: first name and business, never an email or a business's id (its directory key, which
 * says nothing, opens its page). A post is removed by its writer, the owner of the business that wrote it, or RENUABL's
 * staff; it is hidden once `REPORT_HIDE` businesses report it, and only its writer and staff still see it until staff
 * keep or remove it. Since 17 Nov 2026 (feed-social.ts) a post may be a question, a win or one of Sol's (no business),
 * and what is liked, said and voted on tells its writer (`addNote`).
 */
import {
  REPORT_HIDE,
  POST_LIMITS,
  authorWords,
  hiddenByReports,
  kindWords,
  linkSite,
  pollFor,
  pollOpen,
  type FeedComment,
  type FeedPost,
} from "@/lib/domain/design/feed-posts";
import {
  SOL_KIND_WORDS,
  cleanPostKind,
  cleanWin,
  type PollResults,
  type PostKind,
  type SolAnswer,
  type WinFacts,
} from "@/lib/domain/design/feed-social";
import { newId, query, transaction } from "./db";
import { keyOf } from "./design-connections-repo";
import { addNote } from "./design-feed-social-repo";
import type { Member } from "./design-repo";

export interface Reader {
  businessId: string;
  email: string;
  owner: boolean;
  staff: boolean;
}

export const readerOf = (m: Member, staff: boolean): Reader => ({
  businessId: m.businessId,
  email: m.email.toLowerCase(),
  owner: m.role === "owner",
  staff,
});

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

interface PostRow {
  id: string;
  businessId: string | null;
  businessKey: string | null;
  memberEmail: string;
  author: string;
  businessName: string;
  kind: string | null;
  postKind: string;
  body: string;
  linkUrl: string | null;
  linkTitle: string | null;
  hasLinkImage: boolean;
  hasPhoto: boolean;
  at: string;
  hidden: boolean;
  likes: number;
  liked: boolean;
  comments: number;
  reported: boolean;
  reports: number;
  poll: unknown;
  votes: number[] | null;
  myVote: number | null;
  answered: boolean;
  solAnswer: SolAnswer | null;
  win: unknown;
  results: PollResults | null;
}

const POST_COLUMNS = (who: number, biz: number) => `
  p.id, p.business_id as "businessId", d.key as "businessKey", p.member_email as "memberEmail", p.author,
  coalesce(b.name, 'RENUABL') as "businessName", b.kind, p.kind as "postKind",
  p.body, p.link_url as "linkUrl", p.link_title as "linkTitle", p.link_image is not null as "hasLinkImage",
  p.photo is not null as "hasPhoto", ${moment("p.created_at")} as at, p.hidden_at is not null as hidden,
  (select count(*)::int from design_feed_likes l where l.post_id = p.id) as likes,
  exists (select 1 from design_feed_likes l where l.post_id = p.id and l.member_email = $${who}) as liked,
  (select count(*)::int from design_feed_comments c where c.post_id = p.id and c.removed_at is null) as comments,
  exists (select 1 from design_feed_reports r where r.post_id = p.id and r.business_id = $${biz}) as reported,
  (select count(*)::int from design_feed_reports r where r.post_id = p.id) as reports,
  p.poll,
  case when p.poll is null then null else array(
    select (select count(*)::int from design_feed_votes v where v.post_id = p.id and v.choice = i)
      from generate_series(0, jsonb_array_length(p.poll) - 1) i order by i) end as votes,
  (select v.choice from design_feed_votes v where v.post_id = p.id and v.member_email = $${who}) as "myVote",
  p.answered_at is not null as answered, p.sol_answer as "solAnswer", p.win, p.results`;

const FROM = `design_feed_posts p left join businesses b on b.id = p.business_id left join design_directory d on d.business_id = p.business_id`;

const postOf = (r: PostRow, reader: Reader): FeedPost => ({
  id: r.id,
  author: r.author,
  businessName: r.businessName,
  kind: r.businessId ? kindWords(r.kind) : SOL_KIND_WORDS,
  text: r.body,
  link: r.linkUrl ? { url: r.linkUrl, site: linkSite(r.linkUrl), title: r.linkTitle, hasImage: r.hasLinkImage } : null,
  hasPhoto: r.hasPhoto,
  at: r.at,
  likes: r.likes,
  liked: r.liked,
  comments: r.comments,
  mine: mayRemove(r, reader),
  reported: r.reported,
  hidden: r.hidden,
  ...(reader.staff ? { reports: r.reports } : {}),
  poll: pollOf(r, reader),
  postKind: cleanPostKind(r.postKind),
  businessKey: r.businessId ? r.businessKey : null,
  sol: !r.businessId,
  writer: r.memberEmail === reader.email,
  answered: r.answered,
  solAnswer: r.solAnswer ?? null,
  win: r.win ? cleanWin(r.win) : null,
  results: r.results ?? null,
});

const choicesOf = (v: unknown) => (Array.isArray(v) ? v.filter((c): c is string => typeof c === "string") : []);

function pollOf(r: PostRow, reader: Reader) {
  const choices = choicesOf(r.poll);
  if (choices.length < 2) return null;
  return pollFor(choices, r.votes ?? [], r.myVote, r.memberEmail === reader.email, r.at, new Date());
}

const mayRemove = (p: { businessId: string | null; memberEmail: string }, reader: Reader) =>
  reader.staff || p.memberEmail === reader.email || (reader.owner && p.businessId === reader.businessId);

/** Gives a key to every business in these rows that has none yet (made once, the first time its post is read). */
async function withKeys(rows: PostRow[]): Promise<PostRow[]> {
  const missing = [...new Set(rows.filter((r) => r.businessId && !r.businessKey).map((r) => r.businessId as string))];
  if (!missing.length) return rows;
  const keys = new Map<string, string>();
  for (const id of missing) keys.set(id, await keyOf(id));
  return rows.map((r) => (r.businessId && !r.businessKey ? { ...r, businessKey: keys.get(r.businessId) ?? null } : r));
}

/**
 * The feed's posts, newest first: hidden ones only to their writer and staff; `reported` limits it to reported ones
 * (staff); `byBusiness` to one business's (its page).
 */
export async function listPosts(reader: Reader, reported = false, byBusiness: string | null = null): Promise<FeedPost[]> {
  const rows = await query<PostRow>(
    `select ${POST_COLUMNS(1, 2)}
       from ${FROM}
      where p.removed_at is null
        and (p.hidden_at is null or p.member_email = $1 or $3)
        and (not $4 or exists (select 1 from design_feed_reports r where r.post_id = p.id))
        and ($6::text is null or p.business_id = $6)
      order by p.created_at desc limit $5`,
    [reader.email, reader.businessId, reader.staff, reported && reader.staff, POST_LIMITS.shown, byBusiness],
  );
  return (await withKeys(rows)).map((r) => postOf(r, reader));
}

async function onePost(id: string, reader: Reader): Promise<PostRow | null> {
  const rows = await query<PostRow>(
    `select ${POST_COLUMNS(2, 3)} from ${FROM}
      where p.id = $1 and p.removed_at is null and (p.hidden_at is null or p.member_email = $2 or $4)`,
    [id, reader.email, reader.businessId, reader.staff],
  );
  return rows[0] ?? null;
}

/** What else a post may carry (17 Nov 2026): its kind, a win's facts and job. */
export interface PostExtras {
  kind?: PostKind;
  win?: WinFacts | null;
  jobId?: string | null;
}

/** A new post as this member; answers its id. Its link's title and picture are filled in later (`setLinkPreview`). */
export async function createPost(
  m: Member,
  body: string,
  linkUrl: string | null,
  photo: Buffer | null,
  poll: string[] | null = null,
  extras: PostExtras = {},
): Promise<string> {
  const id = newId("post", 8);
  await query(
    `insert into design_feed_posts (id, business_id, member_email, author, body, link_url, photo, poll, kind, win, job_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11)`,
    [
      id,
      m.businessId,
      m.email.toLowerCase(),
      authorWords(m.firstName, m.businessName),
      body,
      linkUrl,
      photo,
      poll ? JSON.stringify(poll) : null,
      extras.kind ?? "post",
      extras.win ? JSON.stringify(extras.win) : null,
      extras.jobId ?? null,
    ],
  );
  return id;
}

export async function setLinkPreview(id: string, title: string | null, picture: Buffer | null): Promise<void> {
  await query(`update design_feed_posts set link_title = coalesce($2, link_title), link_image = coalesce($3, link_image) where id = $1`, [
    id,
    title,
    picture,
  ]);
}

/** Takes a post down (its writer, the owner of its business, or staff). False when it isn't theirs to remove. */
export async function removePost(id: string, reader: Reader): Promise<boolean> {
  const p = await onePost(id, reader);
  if (!p || !mayRemove(p, reader)) return false;
  await query(`update design_feed_posts set removed_at = now(), removed_by = $2 where id = $1`, [id, reader.email]);
  return true;
}

/** Who the post is from, to tell them; null for Sol's own or the reader's own. */
const tellWriter = (p: PostRow, reader: Reader) =>
  p.businessId && p.memberEmail !== reader.email ? { email: p.memberEmail, businessId: p.businessId } : null;

/** Likes or unlikes a post the reader can see; a new like tells its writer. */
export async function setLike(id: string, reader: Reader, like: boolean, by = ""): Promise<boolean> {
  const p = await onePost(id, reader);
  if (!p) return false;
  if (like) {
    const made = await query(
      `insert into design_feed_likes (post_id, business_id, member_email) values ($1, $2, $3) on conflict do nothing returning post_id`,
      [id, reader.businessId, reader.email],
    );
    const to = tellWriter(p, reader);
    if (made.length && to && by) await addNote(to, "like", { postId: id }, by).catch(() => undefined);
  } else await query(`delete from design_feed_likes where post_id = $1 and member_email = $2`, [id, reader.email]);
  return true;
}

/** Votes in a post's poll (or changes a vote) while it is open; false when there is no such poll or choice, or it has closed. */
export async function votePoll(id: string, reader: Reader, choice: number, by = ""): Promise<boolean> {
  const p = await onePost(id, reader);
  const choices = p ? choicesOf(p.poll) : [];
  if (!p || choices.length < 2 || !Number.isInteger(choice) || choice < 0 || choice >= choices.length) return false;
  if (!pollOpen(p.at, new Date())) return false;
  const first = await query<{ fresh: boolean }>(
    `insert into design_feed_votes (post_id, business_id, member_email, choice) values ($1, $2, $3, $4)
     on conflict (post_id, member_email) do update set choice = excluded.choice, at = now()
     returning (xmax = 0) as fresh`,
    [id, reader.businessId, reader.email, choice],
  );
  const to = tellWriter(p, reader);
  if (first[0]?.fresh && to && by) await addNote(to, "vote", { postId: id }, by).catch(() => undefined);
  return true;
}

/** A question's writer marks it answered, or not. */
export async function markAnswered(id: string, reader: Reader, answered: boolean): Promise<boolean> {
  const rows = await query(
    `update design_feed_posts set answered_at = case when $3 then coalesce(answered_at, now()) else null end
      where id = $1 and member_email = $2 and kind = 'question' and removed_at is null returning id`,
    [id, reader.email, answered],
  );
  return rows.length > 0;
}

/** Keeps Sol's answer under a question and tells its writer. */
export async function setSolAnswer(id: string, answer: SolAnswer): Promise<void> {
  const rows = await query<{ email: string; businessId: string }>(
    `update design_feed_posts set sol_answer = $2::jsonb where id = $1 and kind = 'question' and removed_at is null
     returning member_email as email, business_id as "businessId"`,
    [id, JSON.stringify(answer)],
  );
  if (rows[0]?.businessId) await addNote({ email: rows[0].email, businessId: rows[0].businessId }, "answered", { postId: id }, "Sol");
}

/** A post's comments, oldest first; null when the reader can't see the post. */
export async function listComments(id: string, reader: Reader): Promise<FeedComment[] | null> {
  if (!(await onePost(id, reader))) return null;
  const rows = await query<{ id: string; author: string; body: string; at: string; businessId: string; memberEmail: string }>(
    `select id, author, body, ${moment("created_at")} as at, business_id as "businessId", member_email as "memberEmail"
       from design_feed_comments where post_id = $1 and removed_at is null order by created_at limit $2`,
    [id, POST_LIMITS.comments],
  );
  return rows.map((c) => ({ id: c.id, author: c.author, text: c.body, at: c.at, mine: mayRemove(c, reader) }));
}

/** A comment as this member; its post's writer is told, and so is everyone else who has commented on it. */
export async function addComment(id: string, m: Member, reader: Reader, body: string): Promise<boolean> {
  const p = await onePost(id, reader);
  if (!p) return false;
  const by = authorWords(m.firstName, m.businessName);
  await query(`insert into design_feed_comments (id, post_id, business_id, member_email, author, body) values ($1, $2, $3, $4, $5, $6)`, [
    newId("cmt", 8),
    id,
    m.businessId,
    reader.email,
    by,
    body,
  ]);
  const to = tellWriter(p, reader);
  if (to) await addNote(to, "comment", { postId: id }, by).catch(() => undefined);
  const others = await query<{ email: string; businessId: string }>(
    `select distinct on (member_email) member_email as email, business_id as "businessId" from design_feed_comments
      where post_id = $1 and removed_at is null and member_email <> $2 and member_email <> $3 limit 20`,
    [id, reader.email, p.memberEmail],
  );
  for (const o of others) await addNote(o, "reply", { postId: id }, by).catch(() => undefined);
  return true;
}

export async function removeComment(postId: string, commentId: string, reader: Reader): Promise<boolean> {
  const rows = await query<{ businessId: string; memberEmail: string }>(
    `select business_id as "businessId", member_email as "memberEmail" from design_feed_comments
      where id = $1 and post_id = $2 and removed_at is null`,
    [commentId, postId],
  );
  if (!rows[0] || !mayRemove(rows[0], reader)) return false;
  await query(`update design_feed_comments set removed_at = now() where id = $1`, [commentId]);
  return true;
}

/**
 * Reports a post for this business (once a business). Answers whether it was the post's first report (staff are told
 * then) and whether it is now hidden; null when the reader can't see it or it is their own business's.
 */
export async function reportPost(id: string, reader: Reader, reason: string): Promise<{ first: boolean; hidden: boolean } | null> {
  return transaction(async (q) => {
    const rows = await q<{ businessId: string | null }>(
      `select business_id as "businessId" from design_feed_posts where id = $1 and removed_at is null for update`,
      [id],
    );
    if (!rows[0] || !rows[0].businessId || rows[0].businessId === reader.businessId) return null;
    await q(`insert into design_feed_reports (post_id, business_id, member_email, reason) values ($1, $2, $3, $4) on conflict do nothing`, [
      id,
      reader.businessId,
      reader.email,
      reason,
    ]);
    const n = (await q<{ n: number }>(`select count(*)::int as n from design_feed_reports where post_id = $1`, [id]))[0]?.n ?? 0;
    const hidden = hiddenByReports(n);
    if (hidden) await q(`update design_feed_posts set hidden_at = coalesce(hidden_at, now()) where id = $1`, [id]);
    return { first: n === 1, hidden };
  });
}

/** Staff keep a reported post: its reports are cleared and it shows again. */
export async function keepPost(id: string): Promise<void> {
  await query(`delete from design_feed_reports where post_id = $1`, [id]);
  await query(`update design_feed_posts set hidden_at = null where id = $1`, [id]);
}

/** A post's own photo or its link's picture, while the reader may see the post. */
export async function postPicture(id: string, which: "photo" | "link", reader: Reader): Promise<Buffer | null> {
  if (!(await onePost(id, reader))) return null;
  const rows = await query<{ pic: Buffer | null }>(
    `select ${which === "photo" ? "photo" : "link_image"} as pic from design_feed_posts where id = $1`,
    [id],
  );
  return rows[0]?.pic ?? null;
}

export { REPORT_HIDE };
