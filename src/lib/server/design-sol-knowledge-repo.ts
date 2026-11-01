/**
 * Server only. Sol's memory (domain/design/sol-knowledge.ts) in `design_sol_knowledge`: answers he found on the web,
 * kept for the whole business with the pages they came from. Under the designer's tenant rule: business id first in
 * every function, from the signed-in member only. Recalling marks what was used, so the most useful stay.
 */
import {
  MAX_KNOWLEDGE,
  TOPIC_LABELS,
  cleanSources,
  recallKnowledge,
  type KnowledgeEntry,
  type KnowledgeInput,
  type KnowledgeTopic,
} from "@/lib/domain/design/sol-knowledge";
import { newId, query } from "./db";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

interface Row {
  id: string;
  topic: string;
  question: string;
  answer: string;
  sources: unknown;
  savedBy: string;
  savedAt: string;
  uses: number;
  usedAt: string | null;
}

const COLUMNS = `id, topic, question, answer, sources, saved_by as "savedBy", ${moment("saved_at")} as "savedAt", uses, ${moment("used_at")} as "usedAt"`;

const entryOf = (r: Row): KnowledgeEntry => ({
  id: r.id,
  topic: (r.topic in TOPIC_LABELS ? r.topic : "other") as KnowledgeTopic,
  question: r.question,
  answer: r.answer,
  sources: cleanSources(r.sources).map((s) => ({ ...s, from: "memory" as const, at: r.savedAt })),
  savedBy: r.savedBy,
  savedAt: r.savedAt,
  uses: r.uses,
  usedAt: r.usedAt,
});

/** Everything the business's Sol knows, newest first. */
export async function listKnowledge(businessId: string): Promise<KnowledgeEntry[]> {
  const rows = await query<Row>(`select ${COLUMNS} from design_sol_knowledge where business_id = $1 order by saved_at desc limit $2`, [
    businessId,
    MAX_KNOWLEDGE,
  ]);
  return rows.map(entryOf);
}

/** The saved answers that match a question (`recallKnowledge`), marked as used. */
export async function recall(businessId: string, question: string): Promise<KnowledgeEntry[]> {
  const found = recallKnowledge(await listKnowledge(businessId), question);
  if (found.length)
    await query(`update design_sol_knowledge set uses = uses + 1, used_at = now() where business_id = $1 and id = any($2::text[])`, [
      businessId,
      found.map((e) => e.id),
    ]).catch(() => undefined);
  return found;
}

/**
 * An answer kept. One that asks the same question as one already kept replaces it (an answer found again is the newer
 * truth); beyond `MAX_KNOWLEDGE` the least used of the oldest go.
 */
export async function saveKnowledge(businessId: string, input: KnowledgeInput, by: string): Promise<KnowledgeEntry> {
  const same = await query<{ id: string }>(
    `select id from design_sol_knowledge where business_id = $1 and lower(question) = lower($2) limit 1`,
    [businessId, input.question],
  );
  const id = same[0]?.id ?? newId("know", 8);
  const rows = await query<Row>(
    `insert into design_sol_knowledge (id, business_id, topic, question, answer, sources, saved_by)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7)
     on conflict (id) do update set topic = excluded.topic, answer = excluded.answer, sources = excluded.sources,
       saved_by = excluded.saved_by, saved_at = now()
     returning ${COLUMNS}`,
    [id, businessId, input.topic, input.question, input.answer, JSON.stringify(input.sources), by.toLowerCase()],
  );
  await query(
    `delete from design_sol_knowledge where business_id = $1 and id in (
       select id from design_sol_knowledge where business_id = $1 order by saved_at desc, uses desc offset $2)`,
    [businessId, MAX_KNOWLEDGE],
  ).catch(() => undefined);
  return entryOf(rows[0]);
}

/** A saved answer forgotten. */
export async function forgetKnowledge(businessId: string, id: string): Promise<boolean> {
  const gone = await query(`delete from design_sol_knowledge where business_id = $1 and id = $2 returning id`, [businessId, id]);
  return gone.length > 0;
}
