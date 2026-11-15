/**
 * Server only. Sends RENUABL's marketing email (domain/marketing/*), run by the cron (/api/cron/marketing)
 * and, once a campaign is sent now, straight after the press.
 *
 * Nothing goes out unless a person sent a campaign on purpose (scheduled it, typed SEND) or switched a
 * sequence on. Every email: only to a contact who may be emailed at that moment (consent express or inferred,
 * not unsubscribed, not bounced), only inside the sending hours, never past the day's cap or the batch, with a
 * working unsubscribe link and the List-Unsubscribe one-click header, opens and clicks counted by its own token.
 */
import { mayEmail, type ConsentKind } from "@/lib/domain/marketing/contacts";
import { cleanContent, edmLinks, renderEdm, type EdmBrand, type EdmContent, type RenderLinks } from "@/lib/domain/marketing/edm";
import { cleanSequence, inSendingHours, roomThisRun, stepAction, stopReason, type SequenceDraft } from "@/lib/domain/marketing/sequences";
import { marketDateTime, todayInMarket } from "@/lib/domain/market";
import { siteUrl } from "@/lib/domain/sms";
import { newId, query, randomToken } from "./db";
import { emailProvider, sendEmail } from "./email";
import { marketingSettings } from "./marketing-campaigns-repo";

interface ContactRow {
  id: string;
  email: string;
  first_name: string | null;
  company: string | null;
  consent: ConsentKind;
  unsubscribed_at: string | null;
  bounced_at: string | null;
  unsub_token: string | null;
}

const mayEmailRow = (c: ContactRow) => mayEmail({ consent: c.consent, unsubscribedAt: c.unsubscribed_at, bouncedAt: c.bounced_at });

/** The addresses inside one email for one send. */
export function linksFor(site: string, sendToken: string, unsubToken: string): RenderLinks & { oneClick: string } {
  return {
    click: (i) => `${site}/api/m/c/${sendToken}?l=${i}`,
    pixel: `${site}/api/m/o/${sendToken}`,
    unsubscribe: `${site}/m/u/${unsubToken}?s=${sendToken}`,
    oneClick: `${site}/api/m/u/${unsubToken}?s=${sendToken}`,
    image: (id) => `${site}/api/m/i/${id}`,
  };
}

// ---- Campaigns due: their emails queued ----

async function insertSends(
  rows: { contactId: string; campaignId?: string; sequenceId?: string; step?: number; content?: EdmContent }[],
): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => ({
      id: newId("ms"),
      token: randomToken(20),
      contact_id: r.contactId,
      campaign_id: r.campaignId ?? null,
      sequence_id: r.sequenceId ?? null,
      step: r.step ?? null,
      content: r.content ?? null,
    }));
    const out = await query(
      `insert into marketing_sends (id, token, contact_id, campaign_id, sequence_id, step, content)
       select r.id, r.token, r.contact_id, r.campaign_id, r.sequence_id, r.step, r.content
         from jsonb_to_recordset($1::jsonb) as r(id text, token text, contact_id text, campaign_id text, sequence_id text, step int, content jsonb)
       on conflict do nothing returning id`,
      [JSON.stringify(chunk)],
    );
    n += out.length;
  }
  return n;
}

const EMAILABLE = `c.consent in ('express','inferred') and c.unsubscribed_at is null and c.bounced_at is null`;

/** Scheduled campaigns whose time has come: one queued email for each list member who may be emailed now. */
export async function queueDueCampaigns(now: Date = new Date()): Promise<number> {
  const due = await query<{ id: string; list_id: string }>(
    `update marketing_campaigns set status = 'sending', started_at = now(), updated_at = now()
      where status = 'scheduled' and send_at <= $1 and list_id is not null returning id, list_id`,
    [now.toISOString()],
  );
  let queued = 0;
  for (const c of due) {
    const members = await query<{ id: string }>(
      `select c.id from marketing_list_members m join marketing_contacts c on c.id = m.contact_id where m.list_id = $1 and ${EMAILABLE}`,
      [c.list_id],
    );
    queued += await insertSends(members.map((m) => ({ contactId: m.id, campaignId: c.id })));
  }
  return queued;
}

// ---- Sequences ----

/** People the triggers caught since each sequence was switched on, let in once each. */
export async function enrolNew(): Promise<number> {
  const seqs = await query<{ id: string; draft: unknown; on_at: string }>(
    `select id, draft, on_at from marketing_sequences where status = 'on' and on_at is not null`,
  );
  let n = 0;
  for (const s of seqs) {
    const t = cleanSequence(s.draft).trigger;
    if (!t) continue;
    const source =
      t.kind === "list"
        ? `select m.contact_id from marketing_list_members m where m.list_id = $2 and m.added_at >= $3`
        : `select x.contact_id from marketing_sends x where x.campaign_id = $2 and x.${t.kind === "opened" ? "opened_at" : "clicked_at"} >= $3`;
    const out = await query(
      `insert into marketing_enrolments (id, sequence_id, contact_id)
       select 'men_' || md5($1 || src.contact_id), $1, src.contact_id from (${source}) src
       on conflict do nothing returning id`,
      [s.id, t.kind === "list" ? t.listId : t.campaignId, s.on_at],
    );
    n += out.length;
  }
  return n;
}

/** Each enrolment due: stopped if it should be, else its next step (one email at most a run). */
export async function stepEnrolments(now: Date = new Date(), limit = 300): Promise<number> {
  const due = await query<
    { id: string; sequence_id: string; contact_id: string; step: number; draft: unknown } & ContactRow & {
        signed_up: boolean;
        clicked: boolean;
      }
  >(
    `select e.id, e.sequence_id, e.contact_id, e.step, q.draft,
            c.email, c.first_name, c.company, c.consent, c.unsubscribed_at, c.bounced_at, c.unsub_token,
            exists (select 1 from business_members b where lower(b.email) = c.email) as signed_up,
            exists (select 1 from marketing_sends x where x.sequence_id = e.sequence_id and x.contact_id = e.contact_id and x.clicked_at is not null) as clicked
       from marketing_enrolments e join marketing_sequences q on q.id = e.sequence_id join marketing_contacts c on c.id = e.contact_id
      where e.status = 'active' and q.status = 'on' and e.next_at <= $1
      order by e.next_at limit ${limit}`,
    [now.toISOString()],
  );
  let moved = 0;
  for (const e of due) {
    const draft: SequenceDraft = cleanSequence(e.draft);
    const reason = stopReason(
      {
        signedUp: e.signed_up,
        unsubscribed: Boolean(e.unsubscribed_at),
        bounced: Boolean(e.bounced_at),
        mayEmail: mayEmailRow(e),
        clickedInSequence: e.clicked,
      },
      draft.stops,
    );
    if (reason) {
      await query(`update marketing_enrolments set status = 'stopped', stop_reason = $2, ended_at = now() where id = $1`, [e.id, reason]);
      moved++;
      continue;
    }
    let step = e.step;
    let next = now;
    let finished = false;
    for (let guard = 0; guard < 3; guard++) {
      const a = stepAction(draft.steps, step, now);
      if (a.kind === "finish") {
        finished = true;
        break;
      }
      if (a.kind === "wait") {
        step++;
        next = a.next;
        break;
      }
      await insertSends([{ contactId: e.contact_id, sequenceId: e.sequence_id, step, content: a.content }]);
      step++;
      // One email a run: a wait straight after is taken now; another email waits for the next run.
      if (draft.steps[step]?.kind !== "wait") break;
    }
    if (finished)
      await query(
        `update marketing_enrolments set status = 'stopped', stop_reason = 'finished', step = $2, ended_at = now() where id = $1`,
        [e.id, step],
      );
    else await query(`update marketing_enrolments set step = $2, next_at = $3 where id = $1`, [e.id, step, next.toISOString()]);
    moved++;
  }
  return moved;
}

// ---- The batch ----

export interface BatchResult {
  sent: number;
  failed: number;
  skipped: number;
  /** Why nothing went, when nothing could. */
  held?: "paused" | "outside-hours" | "no-email-service" | "no-site-url" | "cap-reached";
}

async function sentToday(now: Date): Promise<number> {
  const rows = await query<{ n: number }>(`select count(*)::int as n from marketing_sends where sent_at >= $1`, [
    marketDateTime(todayInMarket(now), 0),
  ]);
  return rows[0]?.n ?? 0;
}

/** Sends the next queued emails, within the hours, the batch and the day's cap. */
export async function sendBatch(now: Date = new Date()): Promise<BatchResult> {
  const settings = await marketingSettings();
  const empty = { sent: 0, failed: 0, skipped: 0 };
  if (settings.paused) return { ...empty, held: "paused" };
  if (!inSendingHours(now)) return { ...empty, held: "outside-hours" };
  if (!emailProvider()) return { ...empty, held: "no-email-service" };
  const site = siteUrl();
  if (!site) return { ...empty, held: "no-site-url" };
  // A send left half-way (a run that died) is never retried blind: it may have gone.
  await query(
    `update marketing_sends set status = 'failed', error = 'Interrupted while sending' where status = 'sending' and queued_at < now() - interval '1 hour'`,
  );
  const room = roomThisRun(await sentToday(now), settings.dailyCap);
  if (!room) return { ...empty, held: "cap-reached" };
  const claimed = await query<{ id: string; token: string; contact_id: string; campaign_id: string | null; content: unknown }>(
    `update marketing_sends set status = 'sending' where id in (
       select id from marketing_sends where status = 'queued' order by queued_at limit $1 for update skip locked)
     returning id, token, contact_id, campaign_id, content`,
    [room],
  );
  const result: BatchResult = { ...empty };
  const campaigns = new Map<string, EdmContent | null>();
  for (const s of claimed) {
    const [c] = await query<ContactRow>(
      `select id, email, first_name, company, consent, unsubscribed_at, bounced_at, unsub_token from marketing_contacts where id = $1`,
      [s.contact_id],
    );
    if (!c || !mayEmailRow(c)) {
      await query(`update marketing_sends set status = 'skipped', error = 'May not be emailed now' where id = $1`, [s.id]);
      result.skipped++;
      continue;
    }
    let content: EdmContent | null = s.content ? cleanContent(s.content) : null;
    if (!content && s.campaign_id) {
      if (!campaigns.has(s.campaign_id)) {
        const rows = await query<{ content: unknown; status: string }>(`select content, status from marketing_campaigns where id = $1`, [
          s.campaign_id,
        ]);
        campaigns.set(s.campaign_id, rows[0] && rows[0].status === "sending" ? cleanContent(rows[0].content) : null);
      }
      content = campaigns.get(s.campaign_id) ?? null;
    }
    if (!content) {
      await query(`update marketing_sends set status = 'skipped', error = 'Campaign stopped' where id = $1`, [s.id]);
      result.skipped++;
      continue;
    }
    const unsub = c.unsub_token ?? randomToken(20);
    if (!c.unsub_token) await query(`update marketing_contacts set unsub_token = $2 where id = $1 and unsub_token is null`, [c.id, unsub]);
    try {
      await deliver(content, settings.brand, c, linksFor(site, s.token, unsub), s.token);
      await query(`update marketing_sends set status = 'sent', sent_at = now() where id = $1`, [s.id]);
      result.sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 200) : "Failed";
      await query(`update marketing_sends set status = 'failed', error = $2 where id = $1`, [s.id, msg]);
      result.failed++;
    }
  }
  await query(
    `update marketing_campaigns c set status = 'sent', finished_at = now(), updated_at = now()
      where c.status = 'sending' and not exists (select 1 from marketing_sends s where s.campaign_id = c.id and s.status in ('queued','sending'))`,
  );
  return result;
}

async function deliver(content: EdmContent, brand: EdmBrand, c: ContactRow, links: ReturnType<typeof linksFor>, token: string) {
  const r = renderEdm(content, brand, { firstName: c.first_name, company: c.company }, links);
  const out = await sendEmail({
    to: c.email,
    subject: r.subject,
    html: r.html,
    text: r.text,
    fromName: brand.fromName,
    ...(brand.replyTo ? { replyTo: brand.replyTo } : {}),
    headers: { "List-Unsubscribe": `<${links.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    tags: { renuabl_m: token },
  });
  if (out !== "sent") throw new Error("Email isn't set up");
}

/** Everything the cron does, in order. */
export async function runMarketing(now: Date = new Date()) {
  const queued = await queueDueCampaigns(now);
  let enrolled = 0;
  let stepped = 0;
  const settings = await marketingSettings();
  if (!settings.paused && inSendingHours(now)) {
    enrolled = await enrolNew();
    stepped = await stepEnrolments(now);
  }
  const batch = await sendBatch(now);
  return { queued, enrolled, stepped, ...batch };
}

// ---- A test to yourself ----

/** Sends one copy to a staff member's own address, marked [Test]: no tracking, and its unsubscribe link only says it's a test. */
export async function sendTest(content: EdmContent, to: string): Promise<"sent" | "skipped"> {
  const site = siteUrl() ?? "https://www.renuabl.com.au";
  const { brand } = await marketingSettings();
  const r = renderEdm(
    content,
    brand,
    { firstName: "Sam", company: "Sunrise Solar" },
    {
      click: (_i, url) => url,
      pixel: null,
      unsubscribe: `${site}/m/u/test`,
      image: (id) => `${site}/api/m/i/${id}`,
    },
  );
  return sendEmail({
    to,
    subject: `[Test] ${r.subject}`,
    html: r.html,
    text: r.text,
    fromName: brand.fromName,
    ...(brand.replyTo ? { replyTo: brand.replyTo } : {}),
  });
}

// ---- Opens, clicks, unsubscribes, bounces ----

export async function recordOpen(token: string): Promise<void> {
  await query(
    `update marketing_sends set opened_at = coalesce(opened_at, now()), open_count = open_count + 1 where token = $1 and status = 'sent'`,
    [token],
  );
}

/** The link a click goes on to, counted; null when the token or index isn't one of ours (no open redirects). */
export async function recordClick(token: string, index: number): Promise<string | null> {
  const rows = await query<{ id: string; content: unknown; campaign: unknown }>(
    `select s.id, s.content, c.content as campaign from marketing_sends s left join marketing_campaigns c on c.id = s.campaign_id where s.token = $1`,
    [token],
  );
  const r = rows[0];
  if (!r) return null;
  const content = cleanContent(r.content ?? r.campaign);
  const url = edmLinks(content.blocks)[index];
  if (!url) return null;
  await query(
    `update marketing_sends set clicked_at = coalesce(clicked_at, now()), click_count = click_count + 1, opened_at = coalesce(opened_at, now()) where id = $1`,
    [r.id],
  );
  return url;
}

/** The contact behind an unsubscribe link: their email shown on the page, nothing else. */
export async function unsubscribeTarget(unsubToken: string): Promise<{ email: string; done: boolean } | null> {
  const rows = await query<{ email: string; unsubscribed_at: string | null }>(
    `select email, unsubscribed_at from marketing_contacts where unsub_token = $1`,
    [unsubToken],
  );
  return rows[0] ? { email: rows[0].email, done: Boolean(rows[0].unsubscribed_at) } : null;
}

/** Unsubscribes for good: no campaign or sequence reaches them again. */
export async function unsubscribeByToken(unsubToken: string, sendToken: string | null): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `update marketing_contacts set unsubscribed_at = coalesce(unsubscribed_at, now()), updated_at = now() where unsub_token = $1 returning id`,
    [unsubToken],
  );
  const id = rows[0]?.id;
  if (!id) return false;
  await stopContact(id, "unsubscribed");
  if (sendToken)
    await query(`update marketing_sends set unsubscribed_at = coalesce(unsubscribed_at, now()) where token = $1 and contact_id = $2`, [
      sendToken,
      id,
    ]);
  return true;
}

async function stopContact(contactId: string, reason: "unsubscribed" | "bounced") {
  await query(
    `update marketing_enrolments set status = 'stopped', stop_reason = $2, ended_at = now() where contact_id = $1 and status = 'active'`,
    [contactId, reason],
  );
  await query(`update marketing_sends set status = 'skipped', error = $2 where contact_id = $1 and status = 'queued'`, [
    contactId,
    reason === "bounced" ? "Bounced" : "Unsubscribed",
  ]);
}

/** A bounce or a spam complaint reported by the email service, by our send token (else the address). */
export async function recordDeliveryProblem(
  kind: "bounce" | "complaint",
  ref: { token?: string | null; email?: string | null },
  note: string,
): Promise<boolean> {
  const rows = ref.token
    ? await query<{ id: string; contact_id: string }>(`select id, contact_id from marketing_sends where token = $1`, [ref.token])
    : [];
  let contactId = rows[0]?.contact_id;
  if (!contactId && ref.email) {
    const c = await query<{ id: string }>(`select id from marketing_contacts where email = $1`, [ref.email.toLowerCase()]);
    contactId = c[0]?.id;
  }
  if (!contactId) return false;
  if (kind === "bounce") {
    await query(
      `update marketing_contacts set bounced_at = coalesce(bounced_at, now()), bounce_note = $2, updated_at = now() where id = $1`,
      [contactId, note.slice(0, 300)],
    );
    if (rows[0]) await query(`update marketing_sends set bounced_at = coalesce(bounced_at, now()) where id = $1`, [rows[0].id]);
    await stopContact(contactId, "bounced");
  } else {
    await query(`update marketing_contacts set unsubscribed_at = coalesce(unsubscribed_at, now()), updated_at = now() where id = $1`, [
      contactId,
    ]);
    if (rows[0]) await query(`update marketing_sends set unsubscribed_at = coalesce(unsubscribed_at, now()) where id = $1`, [rows[0].id]);
    await stopContact(contactId, "unsubscribed");
  }
  return true;
}

/** How many a campaign would reach right now: list members who may be emailed. */
export async function reachOf(listId: string): Promise<{ members: number; emailable: number }> {
  const rows = await query<{ members: number; emailable: number }>(
    `select count(*)::int as members, count(*) filter (where ${EMAILABLE})::int as emailable
       from marketing_list_members m join marketing_contacts c on c.id = m.contact_id where m.list_id = $1`,
    [listId],
  );
  return rows[0] ?? { members: 0, emailable: 0 };
}
