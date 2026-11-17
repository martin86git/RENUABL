/**
 * Server only. Likes and comments on Sol's stories in the industry feed (16 Nov 2026, Martin: the feed as the
 * industry's own social network), kept in `design_story_likes` and `design_story_comments`. Every business reads every
 * story, so reading runs across businesses; writing is always as the signed-in member (`requireMember`). As on posts,
 * a reader is sent a first name and business, never an email or a business's id, and a comment is removed by its writer,
 * the owner of the business that wrote it, or RENUABL's staff.
 */
import { POST_LIMITS, authorWords, type FeedComment, type StoryTalk } from "@/lib/domain/design/feed-posts";
import { newId, query } from "./db";
import type { Member } from "./design-repo";
import type { Reader } from "./design-feed-posts-repo";
import { addNote } from "./design-feed-social-repo";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const mayRemove = (c: { businessId: string; memberEmail: string }, reader: Reader) =>
  reader.staff || c.memberEmail === reader.email || (reader.owner && c.businessId === reader.businessId);

const storyThere = async (id: string) => (await query<{ id: string }>(`select id from industry_news where id = $1`, [id])).length > 0;

/** Each story's likes and comments for this reader, by story id. */
export async function storyTalk(ids: readonly string[], reader: Reader): Promise<Map<string, StoryTalk>> {
  const out = new Map<string, StoryTalk>();
  if (!ids.length) return out;
  const rows = await query<{ id: string; likes: number; liked: boolean; comments: number }>(
    `select s.id,
            (select count(*)::int from design_story_likes l where l.story_id = s.id) as likes,
            exists (select 1 from design_story_likes l where l.story_id = s.id and l.member_email = $2) as liked,
            (select count(*)::int from design_story_comments c where c.story_id = s.id and c.removed_at is null) as comments
       from unnest($1::text[]) as s(id)`,
    [ids, reader.email],
  );
  for (const r of rows) out.set(r.id, { likes: r.likes, liked: r.liked, comments: r.comments });
  return out;
}

export async function setStoryLike(id: string, reader: Reader, like: boolean): Promise<boolean> {
  if (!(await storyThere(id))) return false;
  if (like)
    await query(`insert into design_story_likes (story_id, business_id, member_email) values ($1, $2, $3) on conflict do nothing`, [
      id,
      reader.businessId,
      reader.email,
    ]);
  else await query(`delete from design_story_likes where story_id = $1 and member_email = $2`, [id, reader.email]);
  return true;
}

/** A story's comments, oldest first; null when there's no such story. */
export async function listStoryComments(id: string, reader: Reader): Promise<FeedComment[] | null> {
  if (!(await storyThere(id))) return null;
  const rows = await query<{ id: string; author: string; body: string; at: string; businessId: string; memberEmail: string }>(
    `select id, author, body, ${moment("created_at")} as at, business_id as "businessId", member_email as "memberEmail"
       from design_story_comments where story_id = $1 and removed_at is null order by created_at limit $2`,
    [id, POST_LIMITS.comments],
  );
  return rows.map((c) => ({ id: c.id, author: c.author, text: c.body, at: c.at, mine: mayRemove(c, reader) }));
}

export async function addStoryComment(id: string, m: Member, reader: Reader, body: string): Promise<boolean> {
  if (!(await storyThere(id))) return false;
  const by = authorWords(m.firstName, m.businessName);
  await query(`insert into design_story_comments (id, story_id, business_id, member_email, author, body) values ($1, $2, $3, $4, $5, $6)`, [
    newId("scm", 8),
    id,
    m.businessId,
    reader.email,
    by,
    body,
  ]);
  // Everyone else who has commented on the story is told (17 Nov 2026, feed-social.ts).
  const others = await query<{ email: string; businessId: string }>(
    `select distinct on (member_email) member_email as email, business_id as "businessId" from design_story_comments
      where story_id = $1 and removed_at is null and member_email <> $2 limit 20`,
    [id, reader.email],
  );
  for (const o of others) await addNote(o, "reply", { storyId: id }, by).catch(() => undefined);
  return true;
}

export async function removeStoryComment(storyId: string, commentId: string, reader: Reader): Promise<boolean> {
  const rows = await query<{ businessId: string; memberEmail: string }>(
    `select business_id as "businessId", member_email as "memberEmail" from design_story_comments
      where id = $1 and story_id = $2 and removed_at is null`,
    [commentId, storyId],
  );
  if (!rows[0] || !mayRemove(rows[0], reader)) return false;
  await query(`update design_story_comments set removed_at = now() where id = $1`, [commentId]);
  return true;
}
