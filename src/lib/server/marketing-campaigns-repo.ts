/**
 * Server only. RENUABL's marketing emails: settings, pictures, campaigns and sequences, and their reports
 * (domain/marketing/edm.ts, sequences.ts). Staff only: every caller checks the staff session first.
 * Sending itself is marketing-send.ts.
 */
import { DEFAULT_BRAND, cleanBrand, type EdmBrand, type EdmContent } from "@/lib/domain/marketing/edm";
import {
  DAILY_CAP,
  cleanDailyCap,
  cleanSequence,
  type CampaignState,
  type SendCounts,
  type SequenceDraft,
  type StopReason,
} from "@/lib/domain/marketing/sequences";
import { newId, query } from "./db";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

// ---- Settings ----

export interface MarketingSettings {
  brand: EdmBrand;
  dailyCap: number;
  paused: boolean;
}

export async function marketingSettings(): Promise<MarketingSettings> {
  const rows = await query<{ brand: unknown; daily_cap: number; paused: boolean }>(
    `select brand, daily_cap, paused from marketing_settings where id = 'main'`,
  );
  const r = rows[0];
  return r
    ? { brand: cleanBrand(r.brand), dailyCap: cleanDailyCap(r.daily_cap), paused: r.paused }
    : { brand: DEFAULT_BRAND, dailyCap: DAILY_CAP.default, paused: false };
}

export async function saveMarketingSettings(s: MarketingSettings, by: string): Promise<void> {
  await query(
    `insert into marketing_settings (id, brand, daily_cap, paused, updated_by) values ('main', $1, $2, $3, $4)
     on conflict (id) do update set brand = excluded.brand, daily_cap = excluded.daily_cap, paused = excluded.paused,
       updated_by = excluded.updated_by, updated_at = now()`,
    [JSON.stringify(cleanBrand(s.brand)), cleanDailyCap(s.dailyCap), s.paused, by.toLowerCase()],
  );
}

// ---- Pictures ----

export async function saveImage(img: { bytes: Buffer; contentType: string; width: number; height: number }, by: string): Promise<string> {
  const id = newId("mimg");
  await query(`insert into marketing_images (id, bytes, content_type, width, height, by_email) values ($1,$2,$3,$4,$5,$6)`, [
    id,
    img.bytes,
    img.contentType,
    img.width,
    img.height,
    by.toLowerCase(),
  ]);
  return id;
}

export async function imageById(id: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const rows = await query<{ bytes: Buffer; content_type: string }>(`select bytes, content_type from marketing_images where id = $1`, [id]);
  return rows[0] ? { bytes: rows[0].bytes, contentType: rows[0].content_type } : null;
}

// ---- Reports ----

const COUNTS = `count(*) filter (where s.status = 'queued' or s.status = 'sending')::int as queued,
  count(*) filter (where s.status = 'sent')::int as sent,
  count(*) filter (where s.status = 'failed')::int as failed,
  count(*) filter (where s.status = 'skipped')::int as skipped,
  count(*) filter (where s.opened_at is not null)::int as opened,
  count(*) filter (where s.clicked_at is not null)::int as clicked,
  count(*) filter (where s.unsubscribed_at is not null)::int as unsubscribed,
  count(*) filter (where s.bounced_at is not null)::int as bounced`;

const EMPTY: SendCounts = { queued: 0, sent: 0, failed: 0, skipped: 0, opened: 0, clicked: 0, unsubscribed: 0, bounced: 0 };

// ---- Campaigns ----

export interface CampaignLine {
  id: string;
  name: string;
  subject: string;
  status: CampaignState;
  listId: string | null;
  listName: string | null;
  sendAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  counts: SendCounts;
}

export interface Campaign extends CampaignLine {
  content: EdmContent;
  sentBy: string | null;
}

const CAMPAIGN_COLUMNS = `c.id, c.name, c.content->>'subject' as subject, c.status, c.list_id as "listId", l.name as "listName",
  ${moment("c.send_at")} as "sendAt", ${moment("c.started_at")} as "startedAt", ${moment("c.finished_at")} as "finishedAt",
  ${moment("c.updated_at")} as "updatedAt",
  (select row_to_json(x) from (select ${COUNTS} from marketing_sends s where s.campaign_id = c.id) x) as counts`;

export async function listCampaigns(): Promise<CampaignLine[]> {
  const rows = await query<CampaignLine>(
    `select ${CAMPAIGN_COLUMNS} from marketing_campaigns c left join marketing_lists l on l.id = c.list_id order by c.created_at desc limit 200`,
  );
  return rows.map((r) => ({ ...r, counts: r.counts ?? EMPTY }));
}

export async function campaignById(id: string): Promise<Campaign | null> {
  const rows = await query<Campaign>(
    `select ${CAMPAIGN_COLUMNS}, c.content, c.sent_by as "sentBy" from marketing_campaigns c left join marketing_lists l on l.id = c.list_id where c.id = $1`,
    [id],
  );
  return rows[0] ? { ...rows[0], counts: rows[0].counts ?? EMPTY } : null;
}

export async function createCampaign(name: string, content: EdmContent, by: string): Promise<string> {
  const id = newId("mca");
  await query(`insert into marketing_campaigns (id, name, content, created_by) values ($1,$2,$3,$4)`, [
    id,
    name,
    JSON.stringify(content),
    by.toLowerCase(),
  ]);
  return id;
}

/** Only a draft changes; a scheduled campaign is cancelled back to a draft first. */
export async function saveCampaign(id: string, patch: { name: string; content: EdmContent; listId: string | null }): Promise<boolean> {
  const rows = await query(
    `update marketing_campaigns set name = $2, content = $3,
       list_id = (select id from marketing_lists where id = $4), updated_at = now()
     where id = $1 and status = 'draft' returning id`,
    [id, patch.name, JSON.stringify(patch.content), patch.listId],
  );
  return rows.length > 0;
}

/** A deliberate send: draft → scheduled for `at`. Nothing is queued until the time comes (the cron). */
export async function scheduleCampaign(id: string, at: Date, by: string): Promise<boolean> {
  const rows = await query(
    `update marketing_campaigns set status = 'scheduled', send_at = $2, sent_by = $3, updated_at = now()
     where id = $1 and status = 'draft' and list_id is not null returning id`,
    [id, at.toISOString(), by.toLowerCase()],
  );
  return rows.length > 0;
}

/** Back to a draft while scheduled; while sending, stops it (the emails not yet gone are taken off). */
export async function cancelCampaign(id: string): Promise<CampaignState | null> {
  const back = await query(
    `update marketing_campaigns set status = 'draft', send_at = null, updated_at = now() where id = $1 and status = 'scheduled' returning id`,
    [id],
  );
  if (back.length) return "draft";
  const stopped = await query(
    `update marketing_campaigns set status = 'cancelled', finished_at = now(), updated_at = now() where id = $1 and status = 'sending' returning id`,
    [id],
  );
  if (!stopped.length) return null;
  await query(`update marketing_sends set status = 'skipped', error = 'Campaign stopped' where campaign_id = $1 and status = 'queued'`, [
    id,
  ]);
  return "cancelled";
}

export async function deleteCampaign(id: string): Promise<boolean> {
  return (await query(`delete from marketing_campaigns where id = $1 and status in ('draft','cancelled') returning id`, [id])).length > 0;
}

export async function duplicateCampaign(id: string, by: string): Promise<string | null> {
  const c = await campaignById(id);
  return c ? createCampaign(`${c.name} (copy)`.slice(0, 80), c.content, by) : null;
}

export interface Recipient {
  email: string;
  name: string;
  company: string | null;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  status: string;
}

/** Who clicked (and opened) in a campaign, most engaged first. */
export async function campaignRecipients(id: string, limit = 200): Promise<Recipient[]> {
  return query<Recipient>(
    `select k.email, trim(concat_ws(' ', k.first_name, k.last_name)) as name, k.company, ${moment("s.sent_at")} as "sentAt",
            ${moment("s.opened_at")} as "openedAt", ${moment("s.clicked_at")} as "clickedAt", s.status
       from marketing_sends s join marketing_contacts k on k.id = s.contact_id
      where s.campaign_id = $1
      order by (s.clicked_at is not null) desc, (s.opened_at is not null) desc, s.sent_at desc nulls last limit ${Math.min(limit, 500)}`,
    [id],
  );
}

// ---- Sequences ----

export interface SequenceLine {
  id: string;
  name: string;
  status: "on" | "off";
  onAt: string | null;
  updatedAt: string;
  active: number;
  finished: number;
  stopped: number;
  counts: SendCounts;
}

export interface Sequence extends SequenceLine {
  draft: SequenceDraft;
  stops: Partial<Record<StopReason, number>>;
}

const SEQUENCE_COLUMNS = `q.id, q.name, q.status, ${moment("q.on_at")} as "onAt", ${moment("q.updated_at")} as "updatedAt",
  (select count(*)::int from marketing_enrolments e where e.sequence_id = q.id and e.status = 'active') as active,
  (select count(*)::int from marketing_enrolments e where e.sequence_id = q.id and e.stop_reason = 'finished') as finished,
  (select count(*)::int from marketing_enrolments e where e.sequence_id = q.id and e.status = 'stopped' and e.stop_reason <> 'finished') as stopped,
  (select row_to_json(x) from (select ${COUNTS} from marketing_sends s where s.sequence_id = q.id) x) as counts`;

export async function listSequences(): Promise<SequenceLine[]> {
  const rows = await query<SequenceLine>(`select ${SEQUENCE_COLUMNS} from marketing_sequences q order by q.created_at desc`);
  return rows.map((r) => ({ ...r, counts: r.counts ?? EMPTY }));
}

export async function sequenceById(id: string): Promise<Sequence | null> {
  const rows = await query<Sequence & { draft: unknown }>(
    `select ${SEQUENCE_COLUMNS}, q.draft from marketing_sequences q where q.id = $1`,
    [id],
  );
  if (!rows[0]) return null;
  const stops = await query<{ reason: StopReason; n: number }>(
    `select stop_reason as reason, count(*)::int as n from marketing_enrolments where sequence_id = $1 and stop_reason is not null group by stop_reason`,
    [id],
  );
  return {
    ...rows[0],
    counts: rows[0].counts ?? EMPTY,
    draft: cleanSequence(rows[0].draft),
    stops: Object.fromEntries(stops.map((s) => [s.reason, s.n])),
  };
}

export async function createSequence(draft: SequenceDraft, by: string): Promise<string> {
  const id = newId("msq");
  await query(`insert into marketing_sequences (id, name, draft, created_by) values ($1,$2,$3,$4)`, [
    id,
    draft.name || "New sequence",
    JSON.stringify(draft),
    by.toLowerCase(),
  ]);
  return id;
}

/**
 * Saves the sequence. While it is on, its trigger can't change (people already in it were let in by it);
 * its steps can, and people carry on from the step number they are at.
 */
export async function saveSequence(id: string, draft: SequenceDraft): Promise<boolean> {
  const rows = await query(
    `update marketing_sequences set name = $2,
       draft = case when status = 'on' then jsonb_set($3::jsonb, '{trigger}', draft->'trigger') else $3::jsonb end,
       updated_at = now()
     where id = $1 returning id`,
    [id, draft.name || "New sequence", JSON.stringify(draft)],
  );
  return rows.length > 0;
}

/** On: from now, people the trigger catches are let in (never anyone from before it was switched on). Off: everyone in it is paused where they are. */
export async function setSequenceOn(id: string, on: boolean): Promise<boolean> {
  const rows = await query(
    `update marketing_sequences set status = $2, on_at = case when $2 = 'on' and status <> 'on' then now() else on_at end, updated_at = now()
     where id = $1 returning id`,
    [id, on ? "on" : "off"],
  );
  return rows.length > 0;
}

export async function deleteSequence(id: string): Promise<boolean> {
  return (await query(`delete from marketing_sequences where id = $1 and status = 'off' returning id`, [id])).length > 0;
}
