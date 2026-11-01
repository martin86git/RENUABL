/**
 * Server only. Updates (the day each member last opened them) and Feedback (domain/design/updates.ts, feedback.ts),
 * under the designer's tenant rule: the business id first, from the signed-in member only.
 */
import { randomBytes } from "node:crypto";
import type { FeedbackItem, FeedbackKind } from "@/lib/domain/design/feedback";
import type { ISODate } from "@/lib/domain/types";
import { query } from "./db";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export async function updatesSeen(businessId: string, email: string): Promise<ISODate | null> {
  const rows = await query<{ day: string }>(
    `select to_char(day, 'YYYY-MM-DD') as day from design_updates_seen where business_id = $1 and email = $2`,
    [businessId, email.toLowerCase()],
  );
  return rows[0]?.day ?? null;
}

export async function markUpdatesSeen(businessId: string, email: string, day: ISODate): Promise<void> {
  await query(
    `insert into design_updates_seen (business_id, email, day) values ($1,$2,$3)
     on conflict (business_id, email) do update set day = greatest(design_updates_seen.day, excluded.day)`,
    [businessId, email.toLowerCase(), day],
  );
}

export async function listFeedback(businessId: string): Promise<FeedbackItem[]> {
  return query<FeedbackItem>(
    `select f.id, f.kind, f.text, f.by_email as by, ${moment("f.at")} as at, ${moment("f.done_at")} as "doneAt", f.done_by as "doneBy",
            coalesce((select json_agg(json_build_object('id', c.id, 'by', c.by_email, 'at', ${moment("c.at")}, 'text', c.text) order by c.at)
                        from design_feedback_comments c where c.business_id = f.business_id and c.feedback_id = f.id), '[]') as comments
       from design_feedback f where f.business_id = $1 order by f.at desc limit 1000`,
    [businessId],
  );
}

export async function addFeedback(businessId: string, by: string, item: { kind: FeedbackKind; text: string }): Promise<void> {
  await query(`insert into design_feedback (id, business_id, kind, text, by_email) values ($1,$2,$3,$4,$5)`, [
    `fb_${randomBytes(10).toString("hex")}`,
    businessId,
    item.kind,
    item.text,
    by.toLowerCase(),
  ]);
}

/** A comment on one of the business's items; false when there's no such item. At most 100 comments an item. */
export async function addFeedbackComment(businessId: string, id: string, by: string, text: string): Promise<boolean> {
  const rows = await query(
    `insert into design_feedback_comments (id, business_id, feedback_id, text, by_email)
     select $3, $1, f.id, $4, $5 from design_feedback f
      where f.business_id = $1 and f.id = $2
        and (select count(*) from design_feedback_comments c where c.feedback_id = f.id) < 100
     returning id`,
    [businessId, id, `fc_${randomBytes(10).toString("hex")}`, text, by.toLowerCase()],
  );
  return rows.length > 0;
}

/** Ticks an item off (or reopens it), written with who did it. */
export async function setFeedbackDone(businessId: string, id: string, done: boolean, by: string): Promise<boolean> {
  const rows = await query(
    `update design_feedback set done_at = case when $3 then now() else null end, done_by = case when $3 then $4 else null end
      where business_id = $1 and id = $2 returning id`,
    [businessId, id, done, by.toLowerCase()],
  );
  return rows.length > 0;
}

/** Removes an item: by the person who raised it, or (`owner`) anyone in the business who may. */
export async function removeFeedback(businessId: string, id: string, by: string, owner: boolean): Promise<boolean> {
  const rows = await query(`delete from design_feedback where business_id = $1 and id = $2 and ($3 or by_email = $4) returning id`, [
    businessId,
    id,
    owner,
    by.toLowerCase(),
  ]);
  return rows.length > 0;
}
