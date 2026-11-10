/**
 * Server only. Posts in the industry feed (domain/design/feed-posts.ts), in `design_feed_posts` with their comments,
 * likes and reports. Every business reads every post (that is the feed), so reading runs across businesses; writing is
 * always as the signed-in member (`requireMember`), whose business and email are set here, never from a browser. A
 * reader is sent `FeedPost`: first name and business, never an email or a business's id. A post is removed by its writer,
 * the owner of the business that wrote it, or RENUABL's staff; it is hidden once `REPORT_HIDE` businesses report it, and
 * only its writer and staff still see it until staff keep or remove it.
 */
import {
  REPORT_HIDE,
  POST_LIMITS,
  authorWords,
  hiddenByReports,
  kindWords,
  linkSite,
  type FeedComment,
  type FeedPost,
} from "@/lib/domain/design/feed-posts";
import { newId, query, transaction } from "./db";
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
  businessId: string;
  memberEmail: string;
  author: string;
  businessName: string;
  kind: string | null;
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
}

const POST_COLUMNS = (who: number, biz: number) => `
  p.id, p.business_id as "businessId", p.member_email as "memberEmail", p.author, b.name as "businessName", b.kind,
  p.body, p.link_url as "linkUrl", p.link_title as "linkTitle", p.link_image is not null as "hasLinkImage",
  p.photo is not null as "hasPhoto", ${moment("p.created_at")} as at, p.hidden_at is not null as hidden,
  (select count(*)::int from design_feed_likes l where l.post_id = p.id) as likes,
  exists (select 1 from design_feed_likes l where l.post_id = p.id and l.member_email = $${who}) as liked,
  (select count(*)::int from design_feed_comments c where c.post_id = p.id and c.removed_at is null) as comments,
  exists (select 1 from design_feed_reports r where r.post_id = p.id and r.business_id = $${biz}) as reported,
  (select count(*)::int from design_feed_reports r where r.post_id = p.id) as reports`;

const postOf = (r: PostRow, reader: Reader): FeedPost => ({
  id: r.id,
  author: r.author,
  businessName: r.businessName,
  kind: kindWords(r.kind),
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
});

const mayRemove = (p: { businessId: string; memberEmail: string }, reader: Reader) =>
  reader.staff || p.memberEmail === reader.email || (reader.owner && p.businessId === reader.businessId);

/** The feed's posts, newest first: hidden ones only to their writer and staff; `reported` limits it to reported ones (staff). */
export async function listPosts(reader: Reader, reported = false): Promise<FeedPost[]> {
  const rows = await query<PostRow>(
    `select ${POST_COLUMNS(1, 2)}
       from design_feed_posts p join businesses b on b.id = p.business_id
      where p.removed_at is null
        and (p.hidden_at is null or p.member_email = $1 or $3)
        and (not $4 or exists (select 1 from design_feed_reports r where r.post_id = p.id))
      order by p.created_at desc limit $5`,
    [reader.email, reader.businessId, reader.staff, reported && reader.staff, POST_LIMITS.shown],
  );
  return rows.map((r) => postOf(r, reader));
}

async function onePost(id: string, reader: Reader): Promise<PostRow | null> {
  const rows = await query<PostRow>(
    `select ${POST_COLUMNS(2, 3)} from design_feed_posts p join businesses b on b.id = p.business_id
      where p.id = $1 and p.removed_at is null and (p.hidden_at is null or p.member_email = $2 or $4)`,
    [id, reader.email, reader.businessId, reader.staff],
  );
  return rows[0] ?? null;
}

/** A new post as this member; answers its id. Its link's title and picture are filled in later (`setLinkPreview`). */
export async function createPost(m: Member, body: string, linkUrl: string | null, photo: Buffer | null): Promise<string> {
  const id = newId("post", 8);
  await query(
    `insert into design_feed_posts (id, business_id, member_email, author, body, link_url, photo) values ($1, $2, $3, $4, $5, $6, $7)`,
    [id, m.businessId, m.email.toLowerCase(), authorWords(m.firstName, m.businessName), body, linkUrl, photo],
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

/** Likes or unlikes a post the reader can see. */
export async function setLike(id: string, reader: Reader, like: boolean): Promise<boolean> {
  if (!(await onePost(id, reader))) return false;
  if (like)
    await query(`insert into design_feed_likes (post_id, business_id, member_email) values ($1, $2, $3) on conflict do nothing`, [
      id,
      reader.businessId,
      reader.email,
    ]);
  else await query(`delete from design_feed_likes where post_id = $1 and member_email = $2`, [id, reader.email]);
  return true;
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

export async function addComment(id: string, m: Member, reader: Reader, body: string): Promise<boolean> {
  if (!(await onePost(id, reader))) return false;
  await query(`insert into design_feed_comments (id, post_id, business_id, member_email, author, body) values ($1, $2, $3, $4, $5, $6)`, [
    newId("cmt", 8),
    id,
    m.businessId,
    reader.email,
    authorWords(m.firstName, m.businessName),
    body,
  ]);
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
    const rows = await q<{ businessId: string }>(
      `select business_id as "businessId" from design_feed_posts where id = $1 and removed_at is null for update`,
      [id],
    );
    if (!rows[0] || rows[0].businessId === reader.businessId) return null;
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
