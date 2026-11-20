/**
 * Server only. The lead inbox (domain/design/lead-inbox.ts): a business's chosen Gmail mailbox read for new leads, each
 * email once by its Gmail id, a lead made a customer and a deal at "lead" in the business's own CRM (found by email,
 * else mobile, never overwritten), the original email on the deal as a note. Run by the ten-minute cron
 * (/api/cron/sol-outbox) and on demand from Settings → CRM → Lead inbox. Under the tenant rule: business id first.
 * Nothing here writes to HubSpot.
 */
import { randomBytes } from "node:crypto";
import { cleanCustomerInput } from "@/lib/domain/design/crm";
import { normaliseMobile } from "@/lib/domain/contact";
import {
  LEAD_SCHEMA,
  PER_RUN,
  RECENT_SHOWN,
  SKIP_WORDS,
  cleanLeadReading,
  contactOf,
  gmailQuery,
  leadEmailOf,
  leadFirstName,
  leadNote,
  leadPrompt,
  leadTitle,
  readLeadEmail,
  skipByRule,
  type LeadEmail,
  type LeadInboxEntry,
  type LeadInboxRun,
  type LeadInboxSettings,
  type LeadReading,
  type Skip,
} from "@/lib/domain/design/lead-inbox";
import { parseApiKey, redactSecrets } from "./bill-reader";
import { readWithClaude } from "./claude-reader";
import { query, transaction } from "./db";
import { createCustomer, createJob, record } from "./design-crm-repo";
import { findCustomerByMobile } from "./renuabl-crm";
import { GmailOff, searchMessages, type GmailMessage } from "./gmail";
import { autocomplete, placeAddress } from "./google-places";
import { withSolCredit } from "./sol-credits";

/** Who writes the lead inbox's deals and notes on the record. */
export const LEAD_INBOX_BY = "lead-inbox";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export interface LeadInboxState {
  settings: LeadInboxSettings;
  lastRunAt: string | null;
  lastRun: LeadInboxRun | null;
}

/** The business's lead inbox as set, with what its last check did. */
export async function leadInboxOf(businessId: string): Promise<LeadInboxState> {
  const rows = await query<{
    owner: string | null;
    address: string | null;
    label: string | null;
    on: boolean;
    onAt: string | null;
    lastRunAt: string | null;
    lastRun: LeadInboxRun | null;
  }>(
    `select owner_email as owner, address, label, is_on as on, ${moment("on_at")} as "onAt", ${moment("last_run_at")} as "lastRunAt", last_run as "lastRun"
       from design_lead_inbox where business_id = $1`,
    [businessId],
  );
  const r = rows[0];
  if (!r) return { settings: { on: false, owner: null, address: null, label: null, onAt: null }, lastRunAt: null, lastRun: null };
  return {
    settings: { on: r.on, owner: r.owner, address: r.address, label: r.label, onAt: r.onAt },
    lastRunAt: r.lastRunAt,
    lastRun: r.lastRun,
  };
}

/** Every mailbox the business's people have connected, each with whose it is. */
export async function businessMailboxes(businessId: string): Promise<{ owner: string; address: string }[]> {
  return query<{ owner: string; address: string }>(
    `select g.email as owner, g.address from design_gmail g
       join business_members m on m.business_id = g.business_id and lower(m.email) = g.email
      where g.business_id = $1 and g.provider = 'google' order by g.created_at, g.address`,
    [businessId],
  );
}

/**
 * Keeps the setting. The mailbox must be one a member of this business has connected; switching it on (or choosing
 * another mailbox or label) starts it from now, so nothing that came in before is taken. Answers a refusal in words.
 */
export async function saveLeadInbox(
  businessId: string,
  input: { on: boolean; owner: string | null; address: string | null; label: string | null },
  by: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (input.owner && input.address) {
    const boxes = await businessMailboxes(businessId);
    if (!boxes.some((b) => b.owner === input.owner && b.address === input.address))
      return { ok: false, message: "That mailbox isn't connected in your business. Connect it in Email first." };
  }
  if (input.on && !input.address) return { ok: false, message: "Choose the mailbox your leads arrive in first." };
  await query(
    `insert into design_lead_inbox (business_id, owner_email, address, label, is_on, on_at, by_email, updated_at)
       values ($1,$2,$3,$4,$5, case when $5 then now() end, $6, now())
     on conflict (business_id) do update set
       on_at = case when excluded.is_on and (not design_lead_inbox.is_on or design_lead_inbox.address is distinct from excluded.address
                  or design_lead_inbox.label is distinct from excluded.label) then now()
                  when excluded.is_on then design_lead_inbox.on_at else null end,
       owner_email = excluded.owner_email, address = excluded.address, label = excluded.label, is_on = excluded.is_on,
       by_email = excluded.by_email, updated_at = now()`,
    [businessId, input.owner, input.address, input.label, input.on, by.toLowerCase()],
  );
  return { ok: true };
}

/** The latest emails the lead inbox looked at, newest first. */
export async function recentLeadEmails(businessId: string, limit = RECENT_SHOWN): Promise<LeadInboxEntry[]> {
  return query<LeadInboxEntry>(
    `select e.message_id as id, e.from_email as "from", e.subject, ${moment("coalesce(e.received_at, e.processed_at)")} as at,
            e.outcome, e.reason, e.job_id as "jobId", c.name as customer
       from design_lead_inbox_emails e
       left join design_customers c on c.business_id = e.business_id and c.id = e.customer_id
      where e.business_id = $1 and e.outcome in ('taken', 'skipped')
      order by e.processed_at desc limit $2`,
    [businessId, limit],
  );
}

/** Businesses whose lead inbox is switched on. */
export async function leadInboxBusinesses(): Promise<string[]> {
  const rows = await query<{ id: string }>(`select business_id as id from design_lead_inbox where is_on and address is not null`);
  return rows.map((r) => r.id);
}

/** Claims an email for this check: false when another check has it or it was dealt with (a claim left 15 minutes is stale). */
async function claim(businessId: string, e: LeadEmail, address: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `insert into design_lead_inbox_emails (business_id, message_id, address, from_email, subject, received_at, outcome)
       values ($1,$2,$3,$4,$5,$6,'working')
     on conflict (business_id, message_id) do update set processed_at = now()
       where design_lead_inbox_emails.outcome = 'working' and design_lead_inbox_emails.processed_at < now() - interval '15 minutes'
     returning message_id as id`,
    [businessId, e.id, address, (contactOf(e) ?? e.from).email.slice(0, 254), e.subject.slice(0, 200), e.at],
  );
  return rows.length > 0;
}

const finish = (businessId: string, id: string, outcome: "taken" | "skipped", reason: string, customerId?: string, jobId?: string) =>
  query(
    `update design_lead_inbox_emails set outcome = $3, reason = $4, customer_id = $5, job_id = $6, processed_at = now()
      where business_id = $1 and message_id = $2`,
    [businessId, id, outcome, reason.slice(0, 300), customerId ?? null, jobId ?? null],
  );

const letGo = (businessId: string, id: string) =>
  query(`delete from design_lead_inbox_emails where business_id = $1 and message_id = $2 and outcome = 'working'`, [businessId, id]);

/** The customer with this email, else this mobile, with whether they have a deal that isn't lost. */
async function knownCustomer(
  businessId: string,
  email: string | null,
  mobile: string | null,
): Promise<{ id: string; open: boolean } | null> {
  const rows = email
    ? await query<{ id: string }>(
        `select id from design_customers where business_id = $1 and lower(email) = $2 order by created_at limit 1`,
        [businessId, email.toLowerCase()],
      )
    : [];
  const id = rows[0]?.id ?? (mobile ? await findCustomerByMobile(businessId, mobile) : null);
  if (!id) return null;
  const open = await query<{ n: string }>(
    `select count(*) as n from design_jobs where business_id = $1 and customer_id = $2 and stage <> 'lost'`,
    [businessId, id],
  );
  return { id, open: Number(open[0]?.n ?? 0) > 0 };
}

/** The address found on the map (Google Places), for Sol · Leads' hello; null when there's no key or no match. */
async function placeOf(address: string): Promise<{ address: string; lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key || address.length < 8) return null;
  try {
    const token = randomBytes(16).toString("hex");
    const first = (await autocomplete(address, token, key))[0];
    if (!first) return null;
    const a = await placeAddress(first.id, token, key);
    if (!a || a.lat === undefined || a.lng === undefined) return null;
    return { address: `${a.line}, ${a.suburb} ${a.state} ${a.postcode}`.trim(), lat: a.lat, lng: a.lng };
  } catch {
    return null;
  }
}

/** What a check can be given in place of Gmail, Claude and the map (tests). */
export interface LeadInboxDeps {
  fetch?: (who: { businessId: string; email: string }, address: string, q: string, max: number) => Promise<GmailMessage[]>;
  /** Sol's reading of one email: the reading, "out" of credits, or null when he couldn't. */
  read?: (e: LeadEmail, businessName: string) => Promise<LeadReading | "out" | null>;
  place?: (address: string) => Promise<{ address: string; lat: number; lng: number } | null>;
  now?: Date;
}

async function readWithSol(businessId: string, e: LeadEmail, businessName: string): Promise<LeadReading | "out" | null> {
  const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
  if (!apiKey) return null;
  try {
    const out = await withSolCredit(
      businessId,
      "inbox",
      null,
      (ai) => readWithClaude<unknown>([], LEAD_SCHEMA, leadPrompt(e, businessName), apiKey, ai),
      "quick",
      "lead inbox",
    );
    return out === "out" ? "out" : cleanLeadReading(out);
  } catch (err) {
    console.error("lead inbox: Sol couldn't read an email", redactSecrets(err instanceof Error ? err.message : String(err)));
    return null;
  }
}

/** Makes the lead: the customer found or made, a new deal at "lead", the original email as a note. */
async function takeLead(
  businessId: string,
  e: LeadEmail,
  r: LeadReading,
  mailbox: string,
  existing: string | null,
  place: LeadInboxDeps["place"],
): Promise<{ customerId: string; jobId: string } | "full"> {
  const email = leadEmailOf(e, r) || null;
  const mobile = r.mobile ? normaliseMobile(r.mobile) : null;
  const found = r.address ? await (place ?? placeOf)(r.address) : null;
  const job = {
    title: leadTitle(r),
    address: found?.address ?? r.address,
    lat: found?.lat ?? null,
    lng: found?.lng ?? null,
    stage: "lead" as const,
    value: null,
    installDate: null,
    details: {},
  };
  let customerId = existing;
  let jobId: string;
  if (customerId) {
    const made = await createJob(businessId, customerId, job, LEAD_INBOX_BY);
    if (typeof made === "string") return "full";
    jobId = made.id;
  } else {
    const first = leadFirstName(e, r);
    const input = cleanCustomerInput({
      firstName: first || "New lead",
      lastName: first ? r.lastName : `(${email ?? mobile ?? "by email"})`,
      phone: mobile ?? r.mobile,
      email: email ?? "",
      address: job.address,
      lat: job.lat,
      lng: job.lng,
      source: "Lead inbox",
    });
    if (!input.ok) return "full";
    const made = await createCustomer(businessId, input.value, job, LEAD_INBOX_BY);
    if (made === "full" || !made.job) return "full";
    customerId = made.customer.id;
    jobId = made.job.id;
  }
  const cid = customerId;
  await transaction((q) =>
    record(q, businessId, { customerId: cid, jobId, kind: "note", text: leadNote(e, r, mailbox), by: LEAD_INBOX_BY }),
  );
  return { customerId: cid, jobId };
}

/**
 * One check of the business's lead inbox: the newest emails not looked at yet, each claimed, passed over by rule or
 * read by Sol, and a lead made a deal. An email Sol couldn't read (busy, out of credits) is let go for the next check.
 * Safe to run twice at once and again: each email is dealt with once.
 */
export async function syncLeadInbox(businessId: string, deps: LeadInboxDeps = {}): Promise<LeadInboxRun> {
  const run: LeadInboxRun = { looked: 0, taken: 0, skipped: 0, waiting: 0, problem: null };
  const { settings } = await leadInboxOf(businessId);
  if (!settings.on || !settings.owner || !settings.address) return { ...run, problem: "The lead inbox is switched off." };
  const boxes = await businessMailboxes(businessId);
  if (!boxes.some((b) => b.owner === settings.owner && b.address === settings.address)) {
    run.problem = `${settings.address} isn't connected any more. Connect it again in Email.`;
    return keepRun(businessId, run);
  }
  const names = await query<{ name: string }>(`select name from businesses where id = $1`, [businessId]);
  const members = await query<{ email: string }>(`select lower(email) as email from business_members where business_id = $1`, [businessId]);
  const ownAddresses = [...boxes.map((b) => b.address), ...members.map((m) => m.email)];
  let messages: GmailMessage[];
  try {
    messages = await (deps.fetch ?? searchMessages)(
      { businessId, email: settings.owner },
      settings.address,
      gmailQuery(settings, deps.now ?? new Date()),
      PER_RUN * 2,
    );
  } catch (e) {
    run.problem = e instanceof GmailOff ? e.message : "Gmail couldn't be read just now.";
    if (!(e instanceof GmailOff)) console.error("lead inbox: Gmail failed", e instanceof Error ? e.message : e);
    return keepRun(businessId, run);
  }
  const seen = messages.length
    ? new Set(
        (
          await query<{ id: string }>(
            `select message_id as id from design_lead_inbox_emails where business_id = $1 and message_id = any($2) and outcome <> 'working'`,
            [businessId, messages.map((m) => m.id)],
          )
        ).map((r) => r.id),
      )
    : new Set<string>();
  // Oldest first, so leads land in the order they came.
  const fresh = messages
    .filter((m) => !seen.has(m.id))
    .reverse()
    .slice(0, PER_RUN);
  // Whether an address already has a deal that isn't lost (a reply, not a new lead), asked once a check.
  const openFor = new Map<string, boolean>();
  const contacts = [...new Set(fresh.map((m) => contactOf(readLeadEmail(m))?.email).filter((x): x is string => Boolean(x)))];
  if (contacts.length) {
    const rows = await query<{ email: string }>(
      `select distinct lower(c.email) as email from design_customers c join design_jobs j on j.business_id = c.business_id and j.customer_id = c.id
        where c.business_id = $1 and lower(c.email) = any($2) and j.stage <> 'lost'`,
      [businessId, contacts],
    );
    for (const r of rows) openFor.set(r.email, true);
  }
  for (const m of fresh) {
    const e = readLeadEmail(m);
    if (!(await claim(businessId, e, settings.address))) continue;
    run.looked++;
    const skip = (why: Skip, extra = "") => {
      run.skipped++;
      return finish(businessId, e.id, "skipped", extra ? `${SKIP_WORDS[why]}: ${extra}` : SKIP_WORDS[why]);
    };
    try {
      const rule = skipByRule(e, { ownAddresses, openDealFor: (a) => openFor.get(a) === true, labelled: Boolean(settings.label) });
      if (rule) {
        await skip(rule);
        continue;
      }
      const reading = await (deps.read ?? ((x, n) => readWithSol(businessId, x, n)))(e, names[0]?.name ?? "the business");
      if (reading === "out" || reading === null) {
        run.waiting++;
        await letGo(businessId, e.id);
        if (reading === "out") run.problem = "Sol is out of credits: the rest wait until there are more.";
        continue;
      }
      if (!reading.isLead) {
        await skip("not-lead", reading.why);
        continue;
      }
      const email = leadEmailOf(e, reading) || null;
      const mobile = reading.mobile ? normaliseMobile(reading.mobile) : null;
      if (!email && !mobile) {
        await skip("no-contact");
        continue;
      }
      const known = await knownCustomer(businessId, email, mobile);
      if (known?.open) {
        await skip("customer");
        continue;
      }
      const made = await takeLead(businessId, e, reading, settings.address, known?.id ?? null, deps.place);
      if (made === "full") {
        await skip("full");
        continue;
      }
      run.taken++;
      if (email) openFor.set(email, true);
      await finish(businessId, e.id, "taken", reading.wants || reading.summary || "New lead", made.customerId, made.jobId);
    } catch (err) {
      run.waiting++;
      await letGo(businessId, e.id).catch(() => undefined);
      console.error("lead inbox: an email couldn't be taken", err instanceof Error ? err.message : err);
    }
  }
  return keepRun(businessId, run);
}

async function keepRun(businessId: string, run: LeadInboxRun): Promise<LeadInboxRun> {
  await query(`update design_lead_inbox set last_run_at = now(), last_run = $2 where business_id = $1`, [businessId, JSON.stringify(run)]);
  return run;
}
