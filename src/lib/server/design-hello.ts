/**
 * Server only. A new lead's own page (domain/design/first-contact.ts): one private link a deal (`/hello/<48 hex>`), made
 * by a member, never by the lead. It shows their home from above with the primary design on it, asks "Is this your
 * home?" and carries the job's conversation (`design_messages`, the same one the proposal's chat carries on later),
 * which Sol answers under the lead-stage rules when the business has him answering customers.
 *
 * Tenant rule: the business and job always come from the token's row, never from the request.
 */
import { randomBytes } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import {
  CHAT_FULL,
  SOL_HANDED_OVER,
  customerWrote,
  firstNameOf,
  publicMessages,
  solReplied,
  teamName,
  type PublicChat,
} from "@/lib/domain/design/chat";
import {
  HELLO_BASIS,
  HELLO_WHY,
  HELLO_WINDOW_DAYS,
  helloEmail,
  helloKey,
  helloPath,
  helloSystem,
  homeRecordLine,
  stillNew,
  type HelloView,
  type HomeAnswer,
} from "@/lib/domain/design/first-contact";
import { firstNameOf as firstWord, type PreparedItem } from "@/lib/domain/design/prepared";
import { jobDrawing } from "@/lib/domain/design/job-card";
import { FROM_CUSTOMER } from "@/lib/domain/design/proposal";
import { designSummary } from "@/lib/domain/design/roof-design";
import { readSolReply, solActive, solHistory, solMayAnswer } from "@/lib/domain/design/sol-customer";
import { TIER_CREDITS, USE_TIER } from "@/lib/domain/design/sol-routing";
import { usageOf } from "@/lib/domain/ai-costs";
import { chatMessageEmail } from "@/lib/domain/emails";
import { siteUrl } from "@/lib/domain/sms";
import { redactSecrets } from "./bill-reader";
import { newId, query, transaction } from "./db";
import { addCustomerLine, addSolLine, chatLines } from "./design-chat-repo";
import { jobById, record } from "./design-crm-repo";
import { NO_DESIGN, loadBrand, savedFor } from "./design-proposal-repo";
import { solAnswersFor } from "./design-sol-customer";
import { emailProvider, sendEmail } from "./email";
import { giveBackSolCredit, keepCost, modelFor, takeSolCredit } from "./sol-credits";

const TIER = USE_TIER.customer;
const BY_SOL = "Sol";

interface Row {
  token: string;
  businessId: string;
  businessName: string;
  jobId: string;
  home: HomeAnswer | null;
}

async function behind(token: string): Promise<Row | null> {
  const rows = await query<Row>(
    `select h.token, h.business_id as "businessId", b.name as "businessName", h.job_id as "jobId", h.home
       from design_hello h join businesses b on b.id = h.business_id where h.token = $1`,
    [token],
  );
  return rows[0] ?? null;
}

/** The lead's link for one of the business's deals, made the first time it is asked for. Null for a deal it hasn't. */
export async function helloFor(businessId: string, jobId: string, by: string): Promise<string | null> {
  if (!(await jobById(businessId, jobId))) return null;
  const rows = await query<{ token: string }>(
    `insert into design_hello (token, business_id, job_id, created_by) values ($1, $2, $3, $4)
     on conflict (business_id, job_id) do update set business_id = excluded.business_id returning token`,
    [randomBytes(24).toString("hex"), businessId, jobId, by.toLowerCase()],
  );
  return rows[0]?.token ?? null;
}

/** The deal behind a lead's link, as Sol and the page need it. */
async function found(token: string) {
  const row = await behind(token);
  if (!row) return null;
  const deal = await jobById(row.businessId, row.jobId);
  if (!deal) return null;
  return { ...row, job: deal.job, customer: deal.customer };
}

/** What the lead's page shows. Null for a link we never made, or a deal since deleted. */
export async function helloView(token: string): Promise<HelloView | null> {
  const f = await found(token);
  if (!f) return null;
  const [brand, saved] = await Promise.all([loadBrand(f.businessId, f.businessName), savedFor(f.businessId, f.businessName, f.jobId)]);
  const set = saved && saved !== NO_DESIGN ? saved.project.set : null;
  const design = set ? (set.designs[set.primary] ?? set.designs[0] ?? null) : null;
  const summary = design ? designSummary(design) : null;
  const drawn = design && summary && summary.panels > 0;
  return {
    business: { name: brand.name || f.businessName, phone: brand.phone, email: brand.email },
    customer: { firstName: firstNameOf(f.customer), address: f.job.address || f.customer.address || "" },
    interest: f.job.title,
    system: drawn
      ? {
          kw: summary.kw,
          panels: summary.panels,
          batteryKwh: design.battery ? Math.round(design.battery.kwh * design.battery.qty * 10) / 10 : null,
        }
      : null,
    drawing: drawn ? jobDrawing(design, "layout") : null,
    hasRoof: Boolean(set) || (f.job.lat !== null && f.job.lng !== null),
    home: f.home,
  };
}

/** Where the roof behind a lead's link is: the design's place, else the deal's. Null without one. */
export async function helloRoof(token: string): Promise<{ businessId: string; lat: number; lng: number; drawn: boolean } | null> {
  const f = await found(token);
  if (!f) return null;
  const saved = await savedFor(f.businessId, f.businessName, f.jobId);
  if (saved && saved !== NO_DESIGN) return { businessId: f.businessId, lat: saved.project.lat, lng: saved.project.lng, drawn: true };
  return f.job.lat !== null && f.job.lng !== null ? { businessId: f.businessId, lat: f.job.lat, lng: f.job.lng, drawn: false } : null;
}

/** The first time the lead opens their page is written on the deal, once. */
export async function markHelloSeen(token: string): Promise<void> {
  const f = await found(token);
  if (!f) return;
  const rows = await query<{ token: string }>(
    `update design_hello set seen_at = now() where token = $1 and seen_at is null returning token`,
    [token],
  );
  if (!rows.length) return;
  await transaction((q) =>
    record(q, f.businessId, {
      customerId: f.customer.id,
      jobId: f.jobId,
      kind: "note",
      text: `${firstNameOf(f.customer)} opened their page.`,
      by: FROM_CUSTOMER,
    }),
  ).catch(() => console.error("a lead's page was opened, but writing it on the record failed"));
}

/** "Is this your home?" answered: kept (a later answer replaces it) and written on the deal. */
export async function answerHome(token: string, answer: HomeAnswer): Promise<boolean> {
  const f = await found(token);
  if (!f) return false;
  await query(`update design_hello set home = $2, home_at = now() where token = $1`, [token, answer]);
  await transaction((q) =>
    record(q, f.businessId, {
      customerId: f.customer.id,
      jobId: f.jobId,
      kind: "note",
      text: homeRecordLine(answer, firstNameOf(f.customer)),
      by: FROM_CUSTOMER,
    }),
  ).catch(() => console.error("a lead answered about their home, but writing it on the record failed"));
  return true;
}

/** The conversation as the lead may see it. */
export async function helloChat(token: string): Promise<PublicChat | null> {
  const f = await found(token);
  if (!f) return null;
  const lines = await chatLines(f.businessId, f.jobId);
  const assistant = solActive(await solAnswersFor(f.businessId, f.businessName).catch(() => false), lines, new Date());
  return {
    open: true,
    messages: publicMessages(lines),
    names: { customer: firstNameOf(f.customer), business: teamName(f.businessName) },
    assistant,
  };
}

/** A lead's message: kept, written on the deal, the business told, then Sol answers when he may. */
export async function helloSays(
  token: string,
  text: string,
  later: (work: () => Promise<void>) => void,
): Promise<{ chat: PublicChat } | { problem: string; status: number } | null> {
  const f = await found(token);
  if (!f) return null;
  const line = await addCustomerLine(f.businessId, f.jobId, text);
  if (!line) return null;
  if (line === "full") return { problem: CHAT_FULL, status: 429 };
  await transaction((q) =>
    record(q, f.businessId, { customerId: f.customer.id, jobId: f.jobId, kind: "message", text: customerWrote(text), by: FROM_CUSTOMER }),
  ).catch(() => console.error("a lead's message was kept, but writing it on the record failed"));
  later(() => tellBusiness(f.businessId, f.businessName, f.customer.name, f.job.title, f.jobId, text).catch(() => {}));
  later(() => solAnswersHello(token).catch(() => console.error("sol couldn't answer a lead")));
  const chat = await helloChat(token);
  return chat ? { chat } : null;
}

async function tellBusiness(businessId: string, businessName: string, customer: string, title: string, jobId: string, text: string) {
  const site = siteUrl();
  if (!emailProvider() || !site) return;
  const brand = await loadBrand(businessId, businessName);
  let to = brand.notify;
  if (!to.length)
    to = (await query<{ email: string }>(`select email from business_members where business_id = $1 and role = 'owner'`, [businessId])).map(
      (o) => o.email,
    );
  const email = chatMessageEmail({ business: brand.name, customer, title, text, link: `${site}/design/deals/${jobId}?tab=chat` });
  for (const address of to)
    await sendEmail({ to: address, ...email }).catch(() => console.error("a lead's message notice couldn't be sent"));
}

/** Sol's answer to a lead on their page, when the business has him on and the team hasn't taken over. Fails quietly. */
export async function solAnswersHello(token: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return;
  const f = await found(token);
  if (!f) return;
  if (!(await loadBrand(f.businessId, f.businessName)).solAnswers) return;
  const lines = await chatLines(f.businessId, f.jobId);
  if (!solMayAnswer({ on: true, lines, now: new Date() })) return;
  const view = await helloView(token);
  if (!view) return;
  const asked = lines[lines.length - 1];
  const credit = await takeSolCredit(f.businessId, "customer", null, TIER_CREDITS[TIER]);
  if (!credit) return;
  let raw = "";
  try {
    const client = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 });
    const m = await client.messages.create({
      model: modelFor(TIER),
      max_tokens: 600,
      system: helloSystem(view),
      messages: solHistory(lines),
    });
    raw = m.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    await keepCost(f.businessId, credit, TIER, "lead chat", [usageOf(m.model, m.usage)]);
  } catch (e) {
    console.error("sol couldn't answer a lead", redactSecrets(e instanceof Anthropic.APIError ? `Claude API ${e.status}` : String(e)));
    await giveBackSolCredit(f.businessId, credit);
    return;
  }
  const reply = readSolReply(raw);
  if (!reply) return;
  const kept = await addSolLine(f.businessId, f.jobId, reply.text, asked.at);
  if (!kept) return;
  await transaction(async (q) => {
    const line = { customerId: f.customer.id, jobId: f.jobId, kind: "message" as const, by: BY_SOL };
    await record(q, f.businessId, { ...line, text: solReplied(reply.text) });
    if (reply.handover) await record(q, f.businessId, { ...line, text: SOL_HANDED_OVER });
  }).catch(() => console.error("sol's answer to a lead was kept, but writing it on the record failed"));
}

// ---------------------------------------------------------------------------
// Step 2: the first hello (domain/design/first-contact.ts). Sol · Leads lines up a short email with the link to the
// lead's page in the outbox (design_prepared, kind "hello"), where it counts down and goes as his follow-ups do
// (design-sol-agents.ts). Run when the outbox or the deal feed is read, and by the outbox cron.

/** Whether anyone from the business (or its phone assistant) has been in touch on the deal: then no hello. */
const REACHED_OUT = `(exists (select 1 from design_activity a where a.business_id = j.business_id and a.job_id = j.id
                          and a.kind in ('email', 'call', 'message', 'proposal') and lower(a.by_email) <> 'customer')
                 or exists (select 1 from design_messages m where m.business_id = j.business_id and m.job_id = j.id and not m.from_customer)
                 or exists (select 1 from design_proposals p where p.business_id = j.business_id and p.job_id = j.id))`;

interface Lead {
  jobId: string;
  customerId: string;
  customer: string;
  email: string;
  title: string;
  stage: string;
  hasPlace: boolean;
  reachedOut: boolean;
}

/**
 * Lines up a hello for each new lead not yet said hello to, and sets aside any lined up whose lead isn't new any more
 * (someone from the business got in touch first, or the deal moved on). Needs the site's address for the link. Answers
 * how many were lined up.
 */
export async function lineUpHellos(business: { id: string; name: string }): Promise<number> {
  const site = siteUrl();
  if (!site) return 0;
  // Those lined up already and still waiting: still new?
  const waiting = await query<{ id: string; stage: string; email: string; hasPlace: boolean; reachedOut: boolean }>(
    `select p.id, j.stage, coalesce(c.email, '') as email, (j.lat is not null and j.lng is not null) as "hasPlace", ${REACHED_OUT} as "reachedOut"
       from design_prepared p
       join design_jobs j on j.business_id = p.business_id and j.id = p.job_id
       join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where p.business_id = $1 and p.kind = 'hello' and p.status in ('preparing', 'ready')`,
    [business.id],
  );
  const gone = waiting.filter((w) => !stillNew(w)).map((w) => w.id);
  if (gone.length)
    await query(
      `update design_prepared set status = 'stale', item = jsonb_set(item, '{status}', '"stale"'), done_at = now()
        where business_id = $1 and id = any($2::text[])`,
      [business.id, gone],
    );

  // New leads from the last days, never example or sample ones, not said hello to before.
  const leads = await query<Lead>(
    `select j.id as "jobId", j.customer_id as "customerId", c.name as customer, coalesce(c.email, '') as email, j.title, j.stage,
            (j.lat is not null and j.lng is not null) as "hasPlace", ${REACHED_OUT} as "reachedOut"
       from design_jobs j join design_customers c on c.business_id = j.business_id and c.id = j.customer_id
      where j.business_id = $1 and j.stage in ('lead', 'designed')
        and j.created_at > now() - make_interval(days => $2)
        and not c.sample and c.source <> 'Example deal'
        and not exists (select 1 from design_prepared p where p.business_id = j.business_id and p.key = 'hello:' || j.id)
      order by j.created_at limit 20`,
    [business.id, HELLO_WINDOW_DAYS],
  );
  const fresh = leads.filter(stillNew);
  if (!fresh.length) return 0;
  const brand = await loadBrand(business.id, business.name);
  const name = brand.name || business.name;
  let made = 0;
  for (const lead of fresh) {
    const link = await query<{ token: string }>(
      `insert into design_hello (token, business_id, job_id, created_by) values ($1, $2, $3, 'sol')
       on conflict (business_id, job_id) do update set business_id = excluded.business_id returning token`,
      [randomBytes(24).toString("hex"), business.id, lead.jobId],
    );
    const token = link[0]?.token;
    if (!token) continue;
    const words = helloEmail({ firstName: firstWord(lead.customer), business: name, url: `${site}${helloPath(token)}` });
    const id = newId("prep", 10);
    const item: PreparedItem = {
      id,
      kind: "hello",
      jobId: lead.jobId,
      customerId: lead.customerId,
      customer: lead.customer,
      title: lead.title,
      why: HELLO_WHY,
      to: lead.email,
      subject: words.subject,
      body: words.body,
      basis: HELLO_BASIS,
      day: 0,
      by: "plain",
      status: "ready",
      createdAt: new Date().toISOString(),
    };
    const kept = await query(
      `insert into design_prepared (id, business_id, job_id, key, kind, status, item) values ($1, $2, $3, $4, 'hello', 'ready', $5::jsonb)
       on conflict (business_id, key) do nothing returning id`,
      [id, business.id, lead.jobId, helloKey(lead.jobId), JSON.stringify(item)],
    );
    made += kept.length;
  }
  return made;
}
