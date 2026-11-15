/**
 * Server only. Sends a business's marketing email (domain/marketing/*), run by the cron (/api/cron/marketing) and, once
 * a campaign is sent now, straight after the press.
 *
 * Nothing goes out unless a person sent a campaign on purpose (scheduled it, typed SEND) or switched a sequence on, and
 * only for a business that has Marketing (marketingOn). Every email: only to a contact who may be emailed at that
 * moment (consent express or inferred, not unsubscribed, not bounced, not unsubscribed from the business's group emails),
 * only inside the sending hours, never past the business's daily cap or the batch, from RENUABL's sender in the
 * business's name, with its own footer, a working unsubscribe link and the List-Unsubscribe one-click header, opens and
 * clicks counted by its own token.
 */
import { WON_STAGES } from "@/lib/domain/design/crm";
import { mayEmail, type ConsentKind } from "@/lib/domain/marketing/contacts";
import {
  cleanContent,
  edmLinks,
  renderEdm,
  senderProblem,
  type EdmBrand,
  type EdmContent,
  type EdmSender,
  type RenderLinks,
} from "@/lib/domain/marketing/edm";
import { cleanSequence, inSendingHours, roomThisRun, stepAction, stopReason, type SequenceDraft } from "@/lib/domain/marketing/sequences";
import { marketDateTime, todayInMarket } from "@/lib/domain/market";
import { siteUrl } from "@/lib/domain/sms";
import { newId, query, randomToken } from "./db";
import { emailProvider, sendEmail } from "./email";
import { isRenuablBusiness, marketingOn, senderFor } from "./marketing-access";
import { marketingSettings } from "./marketing-campaigns-repo";
import { EMAILABLE, stopGroupEmails } from "./marketing-repo";

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

interface NewSend {
  contactId: string;
  campaignId?: string;
  sequenceId?: string;
  step?: number;
  content?: EdmContent;
}

async function insertSends(businessId: string, rows: NewSend[]): Promise<number> {
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
      `insert into design_marketing_sends (id, business_id, token, contact_id, campaign_id, sequence_id, step, content)
       select r.id, $2, r.token, r.contact_id, r.campaign_id, r.sequence_id, r.step, r.content
         from jsonb_to_recordset($1::jsonb) as r(id text, token text, contact_id text, campaign_id text, sequence_id text, step int, content jsonb)
       on conflict do nothing returning id`,
      [JSON.stringify(chunk), businessId],
    );
    n += out.length;
  }
  return n;
}

/** The business's scheduled campaigns whose time has come: one queued email for each list member who may be emailed now. */
export async function queueDueCampaigns(businessId: string, now: Date = new Date()): Promise<number> {
  const due = await query<{ id: string; list_id: string }>(
    `update design_marketing_campaigns set status = 'sending', started_at = now(), updated_at = now()
      where business_id = $1 and status = 'scheduled' and send_at <= $2 and list_id is not null returning id, list_id`,
    [businessId, now.toISOString()],
  );
  let queued = 0;
  for (const c of due) {
    const members = await query<{ id: string }>(
      `select c.id from design_marketing_list_members m join design_marketing_contacts c on c.id = m.contact_id
        where m.business_id = $1 and m.list_id = $2 and ${EMAILABLE}`,
      [businessId, c.list_id],
    );
    queued += await insertSends(
      businessId,
      members.map((m) => ({ contactId: m.id, campaignId: c.id })),
    );
  }
  return queued;
}

// ---- Sequences ----

/** People the business's triggers caught since each sequence was switched on, let in once each. */
export async function enrolNew(businessId: string): Promise<number> {
  const seqs = await query<{ id: string; draft: unknown; on_at: string }>(
    `select id, draft, on_at from design_marketing_sequences where business_id = $1 and status = 'on' and on_at is not null`,
    [businessId],
  );
  let n = 0;
  for (const s of seqs) {
    const t = cleanSequence(s.draft).trigger;
    if (!t) continue;
    const source =
      t.kind === "list"
        ? `select m.contact_id from design_marketing_list_members m where m.business_id = $1 and m.list_id = $3 and m.added_at >= $4`
        : `select x.contact_id from design_marketing_sends x where x.business_id = $1 and x.campaign_id = $3 and x.${t.kind === "opened" ? "opened_at" : "clicked_at"} >= $4`;
    const out = await query(
      `insert into design_marketing_enrolments (id, business_id, sequence_id, contact_id)
       select 'men_' || md5($2 || src.contact_id), $1, $2, src.contact_id from (${source}) src
       on conflict do nothing returning id`,
      [businessId, s.id, t.kind === "list" ? t.listId : t.campaignId, s.on_at],
    );
    n += out.length;
  }
  return n;
}

const WON = WON_STAGES.map((s) => `'${s}'`).join(",");

/** Each of the business's enrolments due: stopped if it should be, else its next step (one email at most a run). */
export async function stepEnrolments(businessId: string, now: Date = new Date(), limit = 300): Promise<number> {
  const renuabl = await isRenuablBusiness(businessId);
  const due = await query<
    { id: string; sequence_id: string; contact_id: string; step: number; draft: unknown } & ContactRow & {
        customer: boolean;
        clicked: boolean;
      }
  >(
    `select e.id, e.sequence_id, e.contact_id, e.step, q.draft,
            c.email, c.first_name, c.company, c.consent, c.unsubscribed_at, c.bounced_at, c.unsub_token,
            (exists (select 1 from design_customers cu join design_jobs j on j.business_id = cu.business_id and j.customer_id = cu.id
                      where cu.business_id = e.business_id and lower(trim(cu.email)) = c.email and j.stage in (${WON}))
             or ($3::boolean and exists (select 1 from business_members b where lower(b.email) = c.email))) as customer,
            exists (select 1 from design_marketing_sends x where x.sequence_id = e.sequence_id and x.contact_id = e.contact_id and x.clicked_at is not null) as clicked
       from design_marketing_enrolments e
       join design_marketing_sequences q on q.id = e.sequence_id and q.business_id = e.business_id
       join design_marketing_contacts c on c.id = e.contact_id and c.business_id = e.business_id
      where e.business_id = $1 and e.status = 'active' and q.status = 'on' and e.next_at <= $2
      order by e.next_at limit ${limit}`,
    [businessId, now.toISOString(), renuabl],
  );
  let moved = 0;
  for (const e of due) {
    const draft: SequenceDraft = cleanSequence(e.draft);
    const reason = stopReason(
      {
        signedUp: e.customer,
        unsubscribed: Boolean(e.unsubscribed_at),
        bounced: Boolean(e.bounced_at),
        mayEmail: mayEmailRow(e),
        clickedInSequence: e.clicked,
      },
      draft.stops,
    );
    if (reason) {
      await query(`update design_marketing_enrolments set status = 'stopped', stop_reason = $2, ended_at = now() where id = $1`, [
        e.id,
        reason,
      ]);
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
      await insertSends(businessId, [{ contactId: e.contact_id, sequenceId: e.sequence_id, step, content: a.content }]);
      step++;
      // One email a run: a wait straight after is taken now; another email waits for the next run.
      if (draft.steps[step]?.kind !== "wait") break;
    }
    if (finished)
      await query(
        `update design_marketing_enrolments set status = 'stopped', stop_reason = 'finished', step = $2, ended_at = now() where id = $1`,
        [e.id, step],
      );
    else await query(`update design_marketing_enrolments set step = $2, next_at = $3 where id = $1`, [e.id, step, next.toISOString()]);
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
  held?: "paused" | "outside-hours" | "no-email-service" | "no-site-url" | "cap-reached" | "no-sender";
}

async function sentToday(businessId: string, now: Date): Promise<number> {
  const rows = await query<{ n: number }>(
    `select count(*)::int as n from design_marketing_sends where business_id = $1 and sent_at >= $2`,
    [businessId, marketDateTime(todayInMarket(now), 0)],
  );
  return rows[0]?.n ?? 0;
}

/** Sends the business's next queued emails, within the hours, the batch and its daily cap. */
export async function sendBatch(businessId: string, now: Date = new Date()): Promise<BatchResult> {
  const settings = await marketingSettings(businessId);
  const empty = { sent: 0, failed: 0, skipped: 0 };
  if (settings.paused) return { ...empty, held: "paused" };
  if (!inSendingHours(now)) return { ...empty, held: "outside-hours" };
  if (!emailProvider()) return { ...empty, held: "no-email-service" };
  const site = siteUrl();
  if (!site) return { ...empty, held: "no-site-url" };
  const sender = await senderFor(businessId);
  if (senderProblem(sender)) return { ...empty, held: "no-sender" };
  // A send left half-way (a run that died) is never retried blind: it may have gone.
  await query(
    `update design_marketing_sends set status = 'failed', error = 'Interrupted while sending'
      where business_id = $1 and status = 'sending' and queued_at < now() - interval '1 hour'`,
    [businessId],
  );
  const room = roomThisRun(await sentToday(businessId, now), settings.dailyCap);
  if (!room) return { ...empty, held: "cap-reached" };
  const claimed = await query<{ id: string; token: string; contact_id: string; campaign_id: string | null; content: unknown }>(
    `update design_marketing_sends set status = 'sending' where id in (
       select id from design_marketing_sends where business_id = $1 and status = 'queued' order by queued_at limit $2 for update skip locked)
     returning id, token, contact_id, campaign_id, content`,
    [businessId, room],
  );
  const result: BatchResult = { ...empty };
  const campaigns = new Map<string, EdmContent | null>();
  for (const s of claimed) {
    const [c] = await query<ContactRow & { crm_unsub: boolean }>(
      `select c.id, c.email, c.first_name, c.company, c.consent, c.unsubscribed_at, c.bounced_at, c.unsub_token,
              exists (select 1 from design_customers cu where cu.business_id = c.business_id and lower(trim(cu.email)) = c.email
                        and cu.unsubscribed_at is not null) as crm_unsub
         from design_marketing_contacts c where c.business_id = $1 and c.id = $2`,
      [businessId, s.contact_id],
    );
    // Unsubscribed from the business's group emails counts here too: an unsubscribe is honoured everywhere.
    if (c?.crm_unsub && !c.unsubscribed_at) {
      await query(`update design_marketing_contacts set unsubscribed_at = now() where id = $1`, [c.id]);
      c.unsubscribed_at = new Date().toISOString();
    }
    if (!c || !mayEmailRow(c)) {
      await query(`update design_marketing_sends set status = 'skipped', error = 'May not be emailed now' where id = $1`, [s.id]);
      result.skipped++;
      continue;
    }
    let content: EdmContent | null = s.content ? cleanContent(s.content) : null;
    if (!content && s.campaign_id) {
      if (!campaigns.has(s.campaign_id)) {
        const rows = await query<{ content: unknown; status: string }>(
          `select content, status from design_marketing_campaigns where business_id = $1 and id = $2`,
          [businessId, s.campaign_id],
        );
        campaigns.set(s.campaign_id, rows[0] && rows[0].status === "sending" ? cleanContent(rows[0].content) : null);
      }
      content = campaigns.get(s.campaign_id) ?? null;
    }
    if (!content) {
      await query(`update design_marketing_sends set status = 'skipped', error = 'Campaign stopped' where id = $1`, [s.id]);
      result.skipped++;
      continue;
    }
    const unsub = c.unsub_token ?? randomToken(20);
    if (!c.unsub_token)
      await query(`update design_marketing_contacts set unsub_token = $2 where id = $1 and unsub_token is null`, [c.id, unsub]);
    try {
      await deliver(content, settings.brand, sender, c, linksFor(site, s.token, unsub), s.token);
      await query(`update design_marketing_sends set status = 'sent', sent_at = now() where id = $1`, [s.id]);
      result.sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 200) : "Failed";
      await query(`update design_marketing_sends set status = 'failed', error = $2 where id = $1`, [s.id, msg]);
      result.failed++;
    }
  }
  await query(
    `update design_marketing_campaigns c set status = 'sent', finished_at = now(), updated_at = now()
      where c.business_id = $1 and c.status = 'sending'
        and not exists (select 1 from design_marketing_sends s where s.campaign_id = c.id and s.status in ('queued','sending'))`,
    [businessId],
  );
  return result;
}

async function deliver(
  content: EdmContent,
  brand: EdmBrand,
  sender: EdmSender,
  c: ContactRow,
  links: ReturnType<typeof linksFor>,
  token: string,
) {
  const r = renderEdm(content, brand, sender, { firstName: c.first_name, company: c.company }, links);
  const out = await sendEmail({
    to: c.email,
    subject: r.subject,
    html: r.html,
    text: r.text,
    fromName: brand.fromName || sender.name,
    ...(brand.replyTo || sender.email ? { replyTo: (brand.replyTo || sender.email)! } : {}),
    headers: { "List-Unsubscribe": `<${links.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    tags: { renuabl_m: token },
  });
  if (out !== "sent") throw new Error("Email isn't set up");
}

/** The businesses with marketing work waiting: scheduled or sending campaigns, sequences on, or emails queued. */
async function businessesWithWork(): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `select business_id as id from design_marketing_campaigns where status in ('scheduled','sending')
     union select business_id from design_marketing_sequences where status = 'on'
     union select business_id from design_marketing_sends where status = 'queued'`,
  );
  return rows.map((r) => r.id);
}

/** One business's run: its due campaigns queued, its sequences stepped (in the hours), then a batch. */
export async function runMarketingFor(businessId: string, now: Date = new Date()) {
  if (!(await marketingOn(businessId))) return null;
  const queued = await queueDueCampaigns(businessId, now);
  let enrolled = 0;
  let stepped = 0;
  const settings = await marketingSettings(businessId);
  if (!settings.paused && inSendingHours(now)) {
    enrolled = await enrolNew(businessId);
    stepped = await stepEnrolments(businessId, now);
  }
  return { queued, enrolled, stepped, ...(await sendBatch(businessId, now)) };
}

/** Everything the cron does, business by business; one failing never stops the others. */
export async function runMarketing(now: Date = new Date()) {
  let sent = 0;
  let businesses = 0;
  for (const id of await businessesWithWork()) {
    const r = await runMarketingFor(id, now).catch((e) => {
      console.error("marketing run failed for a business", e instanceof Error ? e.message : e);
      return null;
    });
    if (r) {
      businesses++;
      sent += r.sent;
    }
  }
  return { businesses, sent };
}

// ---- A test to yourself ----

/** One copy to the member's own address, marked [Test]: no tracking, and its unsubscribe link only says it's a test. */
export async function sendTest(businessId: string, content: EdmContent, to: string): Promise<"sent" | "skipped"> {
  const site = siteUrl() ?? "https://www.renuabl.com.au";
  const [{ brand }, sender] = await Promise.all([marketingSettings(businessId), senderFor(businessId)]);
  const r = renderEdm(
    content,
    brand,
    sender,
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
    fromName: brand.fromName || sender.name,
    ...(brand.replyTo || sender.email ? { replyTo: (brand.replyTo || sender.email)! } : {}),
  });
}

// ---- Opens, clicks, unsubscribes, bounces (by token: these come from the email, not a signed-in member) ----

export async function recordOpen(token: string): Promise<void> {
  await query(
    `update design_marketing_sends set opened_at = coalesce(opened_at, now()), open_count = open_count + 1 where token = $1 and status = 'sent'`,
    [token],
  );
}

/** The link a click goes on to, counted; null when the token or index isn't one of ours (no open redirects). */
export async function recordClick(token: string, index: number): Promise<string | null> {
  const rows = await query<{ id: string; content: unknown; campaign: unknown }>(
    `select s.id, s.content, c.content as campaign from design_marketing_sends s
       left join design_marketing_campaigns c on c.id = s.campaign_id and c.business_id = s.business_id where s.token = $1`,
    [token],
  );
  const r = rows[0];
  if (!r) return null;
  const content = cleanContent(r.content ?? r.campaign);
  const url = edmLinks(content.blocks)[index];
  if (!url) return null;
  await query(
    `update design_marketing_sends set clicked_at = coalesce(clicked_at, now()), click_count = click_count + 1, opened_at = coalesce(opened_at, now()) where id = $1`,
    [r.id],
  );
  return url;
}

/** The contact behind an unsubscribe link: their email and the business's name shown on the page, nothing else. */
export async function unsubscribeTarget(unsubToken: string): Promise<{ email: string; business: string; done: boolean } | null> {
  const rows = await query<{ email: string; business_id: string; unsubscribed_at: string | null }>(
    `select email, business_id, unsubscribed_at from design_marketing_contacts where unsub_token = $1`,
    [unsubToken],
  );
  if (!rows[0]) return null;
  const sender = await senderFor(rows[0].business_id).catch(() => null);
  return { email: rows[0].email, business: sender?.name || "this business", done: Boolean(rows[0].unsubscribed_at) };
}

/** Unsubscribes for good: no campaign, sequence or group email from that business reaches them again. */
export async function unsubscribeByToken(unsubToken: string, sendToken: string | null): Promise<boolean> {
  const rows = await query<{ id: string; business_id: string; email: string }>(
    `update design_marketing_contacts set unsubscribed_at = coalesce(unsubscribed_at, now()), updated_at = now()
      where unsub_token = $1 returning id, business_id, email`,
    [unsubToken],
  );
  const c = rows[0];
  if (!c) return false;
  await stopContact(c.business_id, c.id, "unsubscribed");
  await stopGroupEmails(c.business_id, c.email);
  if (sendToken)
    await query(
      `update design_marketing_sends set unsubscribed_at = coalesce(unsubscribed_at, now()) where token = $1 and contact_id = $2`,
      [sendToken, c.id],
    );
  return true;
}

async function stopContact(businessId: string, contactId: string, reason: "unsubscribed" | "bounced") {
  await query(
    `update design_marketing_enrolments set status = 'stopped', stop_reason = $3, ended_at = now()
      where business_id = $1 and contact_id = $2 and status = 'active'`,
    [businessId, contactId, reason],
  );
  await query(
    `update design_marketing_sends set status = 'skipped', error = $3 where business_id = $1 and contact_id = $2 and status = 'queued'`,
    [businessId, contactId, reason === "bounced" ? "Bounced" : "Unsubscribed"],
  );
}

/**
 * A bounce or a spam complaint reported by the email service, by our send token (that business's contact). Without a
 * token, by the address: a bounce is the address's, so every business's contact with it is marked; a complaint
 * unsubscribes it everywhere too (the safe side).
 */
export async function recordDeliveryProblem(
  kind: "bounce" | "complaint",
  ref: { token?: string | null; email?: string | null },
  note: string,
): Promise<boolean> {
  const bySend = ref.token
    ? await query<{ id: string; business_id: string; contact_id: string }>(
        `select id, business_id, contact_id from design_marketing_sends where token = $1`,
        [ref.token],
      )
    : [];
  const targets = bySend[0]
    ? await query<{ id: string; business_id: string; email: string }>(
        `select id, business_id, email from design_marketing_contacts where id = $1`,
        [bySend[0].contact_id],
      )
    : ref.email
      ? await query<{ id: string; business_id: string; email: string }>(
          `select id, business_id, email from design_marketing_contacts where email = $1`,
          [ref.email.toLowerCase()],
        )
      : [];
  for (const t of targets) {
    if (kind === "bounce") {
      await query(
        `update design_marketing_contacts set bounced_at = coalesce(bounced_at, now()), bounce_note = $2, updated_at = now() where id = $1`,
        [t.id, note.slice(0, 300)],
      );
      await stopContact(t.business_id, t.id, "bounced");
    } else {
      await query(
        `update design_marketing_contacts set unsubscribed_at = coalesce(unsubscribed_at, now()), updated_at = now() where id = $1`,
        [t.id],
      );
      await stopContact(t.business_id, t.id, "unsubscribed");
      await stopGroupEmails(t.business_id, t.email);
    }
  }
  if (bySend[0])
    await query(
      `update design_marketing_sends set ${kind === "bounce" ? "bounced_at = coalesce(bounced_at, now())" : "unsubscribed_at = coalesce(unsubscribed_at, now())"} where id = $1`,
      [bySend[0].id],
    );
  return targets.length > 0;
}

/** How many a campaign would reach right now: the business's list members who may be emailed. */
export async function reachOf(businessId: string, listId: string): Promise<{ members: number; emailable: number }> {
  const rows = await query<{ members: number; emailable: number }>(
    `select count(*)::int as members, count(*) filter (where ${EMAILABLE})::int as emailable
       from design_marketing_list_members m join design_marketing_contacts c on c.id = m.contact_id
      where m.business_id = $1 and m.list_id = $2`,
    [businessId, listId],
  );
  return rows[0] ?? { members: 0, emailable: 0 };
}
