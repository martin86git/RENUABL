/**
 * Server only. A business's marketing emails in RENUABL Business: settings, pictures, campaigns and sequences, and their
 * reports (domain/marketing/edm.ts, sequences.ts). The tenant rule holds: the business id first in every function,
 * filtered by it, from the signed-in member only. Sending itself is marketing-send.ts.
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

export async function marketingSettings(businessId: string): Promise<MarketingSettings> {
  const rows = await query<{ brand: unknown; daily_cap: number; paused: boolean }>(
    `select brand, daily_cap, paused from design_marketing_settings where business_id = $1`,
    [businessId],
  );
  const r = rows[0];
  return r
    ? { brand: cleanBrand(r.brand), dailyCap: cleanDailyCap(r.daily_cap), paused: r.paused }
    : { brand: DEFAULT_BRAND, dailyCap: DAILY_CAP.default, paused: false };
}

export async function saveMarketingSettings(businessId: string, s: MarketingSettings, by: string): Promise<void> {
  await query(
    `insert into design_marketing_settings (business_id, brand, daily_cap, paused, updated_by) values ($1, $2, $3, $4, $5)
     on conflict (business_id) do update set brand = excluded.brand, daily_cap = excluded.daily_cap, paused = excluded.paused,
       updated_by = excluded.updated_by, updated_at = now()`,
    [businessId, JSON.stringify(cleanBrand(s.brand)), cleanDailyCap(s.dailyCap), s.paused, by.toLowerCase()],
  );
}

// ---- Pictures ----

export async function saveImage(
  businessId: string,
  img: { bytes: Buffer; contentType: string; width: number; height: number },
  by: string,
): Promise<string> {
  const id = newId("mimg");
  await query(
    `insert into design_marketing_images (id, business_id, bytes, content_type, width, height, by_email) values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, businessId, img.bytes, img.contentType, img.width, img.height, by.toLowerCase()],
  );
  return id;
}

/** A picture in an email, by its id alone: mail apps load it, so it is public (the id is long and random). */
export async function imageById(id: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const rows = await query<{ bytes: Buffer; content_type: string }>(
    `select bytes, content_type from design_marketing_images where id = $1`,
    [id],
  );
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
  (select row_to_json(x) from (select ${COUNTS} from design_marketing_sends s where s.campaign_id = c.id) x) as counts`;

const FROM_CAMPAIGNS = `from design_marketing_campaigns c left join design_marketing_lists l on l.id = c.list_id and l.business_id = c.business_id`;

export async function listCampaigns(businessId: string): Promise<CampaignLine[]> {
  const rows = await query<CampaignLine>(
    `select ${CAMPAIGN_COLUMNS} ${FROM_CAMPAIGNS} where c.business_id = $1 order by c.created_at desc limit 200`,
    [businessId],
  );
  return rows.map((r) => ({ ...r, counts: r.counts ?? EMPTY }));
}

export async function campaignById(businessId: string, id: string): Promise<Campaign | null> {
  const rows = await query<Campaign>(
    `select ${CAMPAIGN_COLUMNS}, c.content, c.sent_by as "sentBy" ${FROM_CAMPAIGNS} where c.business_id = $1 and c.id = $2`,
    [businessId, id],
  );
  return rows[0] ? { ...rows[0], counts: rows[0].counts ?? EMPTY } : null;
}

export async function createCampaign(businessId: string, name: string, content: EdmContent, by: string): Promise<string> {
  const id = newId("mca");
  await query(`insert into design_marketing_campaigns (id, business_id, name, content, created_by) values ($1,$2,$3,$4,$5)`, [
    id,
    businessId,
    name,
    JSON.stringify(content),
    by.toLowerCase(),
  ]);
  return id;
}

/** Only a draft changes; a scheduled campaign is cancelled back to a draft first. A list must be the business's own. */
export async function saveCampaign(
  businessId: string,
  id: string,
  patch: { name: string; content: EdmContent; listId: string | null },
): Promise<boolean> {
  const rows = await query(
    `update design_marketing_campaigns set name = $3, content = $4,
       list_id = (select l.id from design_marketing_lists l where l.business_id = $1 and l.id = $5), updated_at = now()
     where business_id = $1 and id = $2 and status = 'draft' returning id`,
    [businessId, id, patch.name, JSON.stringify(patch.content), patch.listId],
  );
  return rows.length > 0;
}

/** A deliberate send: draft → scheduled for `at`. Nothing is queued until the time comes (the cron). */
export async function scheduleCampaign(businessId: string, id: string, at: Date, by: string): Promise<boolean> {
  const rows = await query(
    `update design_marketing_campaigns set status = 'scheduled', send_at = $3, sent_by = $4, updated_at = now()
     where business_id = $1 and id = $2 and status = 'draft' and list_id is not null returning id`,
    [businessId, id, at.toISOString(), by.toLowerCase()],
  );
  return rows.length > 0;
}

/** Back to a draft while scheduled; while sending, stops it (the emails not yet gone are taken off). */
export async function cancelCampaign(businessId: string, id: string): Promise<CampaignState | null> {
  const back = await query(
    `update design_marketing_campaigns set status = 'draft', send_at = null, updated_at = now()
      where business_id = $1 and id = $2 and status = 'scheduled' returning id`,
    [businessId, id],
  );
  if (back.length) return "draft";
  const stopped = await query(
    `update design_marketing_campaigns set status = 'cancelled', finished_at = now(), updated_at = now()
      where business_id = $1 and id = $2 and status = 'sending' returning id`,
    [businessId, id],
  );
  if (!stopped.length) return null;
  await query(
    `update design_marketing_sends set status = 'skipped', error = 'Campaign stopped' where business_id = $1 and campaign_id = $2 and status = 'queued'`,
    [businessId, id],
  );
  return "cancelled";
}

export async function deleteCampaign(businessId: string, id: string): Promise<boolean> {
  return (
    (
      await query(
        `delete from design_marketing_campaigns where business_id = $1 and id = $2 and status in ('draft','cancelled') returning id`,
        [businessId, id],
      )
    ).length > 0
  );
}

export async function duplicateCampaign(businessId: string, id: string, by: string): Promise<string | null> {
  const c = await campaignById(businessId, id);
  return c ? createCampaign(businessId, `${c.name} (copy)`.slice(0, 80), c.content, by) : null;
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
export async function campaignRecipients(businessId: string, id: string, limit = 200): Promise<Recipient[]> {
  return query<Recipient>(
    `select k.email, trim(concat_ws(' ', k.first_name, k.last_name)) as name, k.company, ${moment("s.sent_at")} as "sentAt",
            ${moment("s.opened_at")} as "openedAt", ${moment("s.clicked_at")} as "clickedAt", s.status
       from design_marketing_sends s join design_marketing_contacts k on k.id = s.contact_id
      where s.business_id = $1 and s.campaign_id = $2
      order by (s.clicked_at is not null) desc, (s.opened_at is not null) desc, s.sent_at desc nulls last limit ${Math.min(limit, 500)}`,
    [businessId, id],
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
  (select count(*)::int from design_marketing_enrolments e where e.sequence_id = q.id and e.status = 'active') as active,
  (select count(*)::int from design_marketing_enrolments e where e.sequence_id = q.id and e.stop_reason = 'finished') as finished,
  (select count(*)::int from design_marketing_enrolments e where e.sequence_id = q.id and e.status = 'stopped' and e.stop_reason <> 'finished') as stopped,
  (select row_to_json(x) from (select ${COUNTS} from design_marketing_sends s where s.sequence_id = q.id) x) as counts`;

export async function listSequences(businessId: string): Promise<SequenceLine[]> {
  const rows = await query<SequenceLine>(
    `select ${SEQUENCE_COLUMNS} from design_marketing_sequences q where q.business_id = $1 order by q.created_at desc`,
    [businessId],
  );
  return rows.map((r) => ({ ...r, counts: r.counts ?? EMPTY }));
}

export async function sequenceById(businessId: string, id: string): Promise<Sequence | null> {
  const rows = await query<Sequence & { draft: unknown }>(
    `select ${SEQUENCE_COLUMNS}, q.draft from design_marketing_sequences q where q.business_id = $1 and q.id = $2`,
    [businessId, id],
  );
  if (!rows[0]) return null;
  const stops = await query<{ reason: StopReason; n: number }>(
    `select stop_reason as reason, count(*)::int as n from design_marketing_enrolments
      where business_id = $1 and sequence_id = $2 and stop_reason is not null group by stop_reason`,
    [businessId, id],
  );
  return {
    ...rows[0],
    counts: rows[0].counts ?? EMPTY,
    draft: cleanSequence(rows[0].draft),
    stops: Object.fromEntries(stops.map((s) => [s.reason, s.n])),
  };
}

export async function createSequence(businessId: string, draft: SequenceDraft, by: string): Promise<string> {
  const id = newId("msq");
  await query(`insert into design_marketing_sequences (id, business_id, name, draft, created_by) values ($1,$2,$3,$4,$5)`, [
    id,
    businessId,
    draft.name || "New sequence",
    JSON.stringify(draft),
    by.toLowerCase(),
  ]);
  return id;
}

/**
 * Saves the sequence. While it is on, its trigger can't change (people already in it were let in by it); its steps can,
 * and people carry on from the step number they are at.
 */
export async function saveSequence(businessId: string, id: string, draft: SequenceDraft): Promise<boolean> {
  const rows = await query(
    `update design_marketing_sequences set name = $3,
       draft = case when status = 'on' then jsonb_set($4::jsonb, '{trigger}', draft->'trigger') else $4::jsonb end,
       updated_at = now()
     where business_id = $1 and id = $2 returning id`,
    [businessId, id, draft.name || "New sequence", JSON.stringify(draft)],
  );
  return rows.length > 0;
}

/** On: from now, people the trigger catches are let in (never anyone from before it was switched on). Off: everyone in it waits where they are. */
export async function setSequenceOn(businessId: string, id: string, on: boolean): Promise<boolean> {
  const rows = await query(
    `update design_marketing_sequences set status = $3, on_at = case when $3 = 'on' and status <> 'on' then now() else on_at end, updated_at = now()
     where business_id = $1 and id = $2 returning id`,
    [businessId, id, on ? "on" : "off"],
  );
  return rows.length > 0;
}

export async function deleteSequence(businessId: string, id: string): Promise<boolean> {
  return (
    (
      await query(`delete from design_marketing_sequences where business_id = $1 and id = $2 and status = 'off' returning id`, [
        businessId,
        id,
      ])
    ).length > 0
  );
}
