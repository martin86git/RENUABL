/**
 * Server only. The deal feed on Today (domain/design/deal-feed.ts): one card for each deal still being sold or heading
 * to its install that the member may see, with its latest happenings, its heat and what Sol has lined up. Read from the
 * business's own record; business id first, as everywhere.
 */
import Anthropic from "@anthropic-ai/sdk";
import { usageOf } from "@/lib/domain/ai-costs";
import type { DealViewer } from "@/lib/domain/design/account";
import { OPEN_STAGES, PRE_INSTALL_STAGES, STAGE_LABELS } from "@/lib/domain/design/crm";
import { EXAMPLE_DEALS, EXAMPLE_SOURCE, exampleAddress, exampleEmail, mayHaveExamples } from "@/lib/domain/design/example-deals";
import { SAMPLE_AUTHOR } from "@/lib/domain/design/crm";
import { readDraft, writeAsk, writeSystem, type WriteFacts } from "@/lib/domain/design/deal-write";
import { SOL_OUT_SHORT } from "@/lib/domain/design/sol-credits";
import { USE_TIER } from "@/lib/domain/design/sol-routing";
import { redactSecrets } from "./bill-reader";
import { batteryOf, CARD_EVENTS, suburbOfAddress, type FeedDeal, type FeedEvent, type FeedEventKind } from "@/lib/domain/design/deal-feed";
import { newId, query, transaction } from "./db";
import { jobById, listJobs } from "./design-crm-repo";
import { padsFor } from "./design-deal-team-repo";
import { dealPulses } from "./design-pulse-repo";
import { outbox } from "./design-sol-agents";
import { withSolCredit } from "./sol-credits";
import { voiceOnFor } from "./voice-calls";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const handle = (email: string) => (email === "sol" ? "Sol" : email.split("@")[0] || email);

/** What an activity on the record reads as on a card. Moves between stages are told as such; reminders and the like aren't news. */
function eventOfActivity(kind: string, text: string, at: string, by: string): FeedEvent | null {
  const words = text.replace(/\s+/g, " ").trim().slice(0, 220);
  const map: Partial<Record<string, FeedEventKind>> = { call: "call", email: "email", note: "note", stage: "stage", proposal: "proposal" };
  const k = map[kind];
  if (!k) return null;
  // Sol's notes and requests are written on the record from the deal's team chat, which the card's pad already shows.
  if (k === "note" && by === "sol") return null;
  if (k === "proposal" && /opened/i.test(words)) return { kind: "opened", text: words, at, by: handle(by) };
  return { kind: by === "sol" ? (k === "email" ? "sol" : k) : k, text: words, at, by: handle(by) };
}

export async function dealFeed(
  member: { businessId: string; businessName: string; email: string },
  viewer: DealViewer,
): Promise<FeedDeal[]> {
  const businessId = member.businessId;
  const jobs = (await listJobs(businessId, viewer)).filter((j) => OPEN_STAGES.includes(j.stage) || PRE_INSTALL_STAGES.includes(j.stage));
  if (!jobs.length) return [];
  const ids = jobs.map((j) => j.id);
  const [pulses, box, customers, activity, messages, proposals, pads] = await Promise.all([
    dealPulses(businessId, viewer).catch(() => ({}) as Awaited<ReturnType<typeof dealPulses>>),
    outbox(member, viewer, true).catch(() => null),
    query<{ id: string; phone: string; email: string; sample: boolean }>(
      `select id, phone, email, sample from design_customers where business_id = $1 and id = any($2)`,
      [businessId, jobs.map((j) => j.customerId)],
    ),
    query<{ job: string; kind: string; text: string; by: string; at: string }>(
      `select job_id as job, kind, text, by_email as by, ${moment("at")} as at from (
         select job_id, kind, text, by_email, at, row_number() over (partition by job_id order by at desc) as n
           from design_activity where business_id = $1 and job_id = any($2) and kind in ('call','email','note','stage','proposal')
       ) a where n <= 6`,
      [businessId, ids],
    ),
    query<{ job: string; theirs: boolean; text: string; by: string | null; at: string }>(
      `select job_id as job, from_customer as theirs, text, by_email as by, ${moment("at")} as at from (
         select job_id, from_customer, text, by_email, at, row_number() over (partition by job_id order by at desc) as n
           from design_messages where business_id = $1 and job_id = any($2)
       ) m where n <= 4`,
      [businessId, ids],
    ),
    query<{ job: string; opened: boolean }>(
      `select p.job_id as job, bool_or(v.opened_at is not null) as opened
         from design_proposals p join design_proposal_versions v on v.business_id = p.business_id and v.proposal_id = p.id
        where p.business_id = $1 and p.job_id = any($2) and p.withdrawn_at is null group by p.job_id`,
      [businessId, ids],
    ),
    padsFor(businessId, ids).catch(() => ({}) as Awaited<ReturnType<typeof padsFor>>),
  ]);
  const byCustomer = new Map(customers.map((c) => [c.id, c]));
  return jobs.map((j): FeedDeal => {
    const c = byCustomer.get(j.customerId);
    const firstName = j.customerName.split(/\s+/)[0] || "Customer";
    const events: FeedEvent[] = [
      ...activity
        .filter((a) => a.job === j.id)
        .map((a) => eventOfActivity(a.kind, a.text, a.at, a.by))
        .filter((e): e is FeedEvent => e !== null)
        // The customer opened it, not the member who sent it.
        .map((e) => (e.kind === "opened" ? { ...e, by: firstName } : e)),
      ...messages
        .filter((m) => m.job === j.id)
        .map((m): FeedEvent => ({
          kind: m.theirs ? "message" : m.by === "sol" ? "sol" : "reply",
          text: m.text.replace(/\s+/g, " ").trim().slice(0, 280),
          at: m.at,
          by: m.theirs ? firstName : handle(m.by ?? ""),
        })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, CARD_EVENTS);
    const pulse = (
      pulses as Record<string, { heat: { heat: "hot" | "warm" | "cold"; reasons: { text: string }[] }; clock: { words: string } }>
    )[j.id];
    const lined = box?.outbox.entries.find((e) => e.jobId === j.id);
    const proposal = proposals.find((p) => p.job === j.id);
    return {
      jobId: j.id,
      customer: j.customerName,
      suburb: suburbOfAddress(j.address),
      title: j.title,
      stage: j.stage,
      value: j.value,
      kw: j.kw,
      batteryKwh: batteryOf(j.details),
      projectId: j.projectId,
      sample: Boolean(c?.sample),
      createdAt: j.createdAt,
      installDate: j.installDate,
      heat: pulse?.heat.heat ?? null,
      heatWhy: pulse?.heat.reasons.slice(0, 3).map((r) => r.text) ?? [],
      clock: pulse?.clock.words ?? null,
      proposal: proposal ? { opened: proposal.opened } : null,
      events,
      sol: lined ? { subject: lined.subject ?? "", firesAt: lined.firesAt, held: lined.held } : null,
      canCall: Boolean(c?.phone),
      canEmail: Boolean(c?.email),
      phone: c?.phone || null,
      place: j.lat !== null && j.lng !== null ? { lat: j.lat, lng: j.lng } : null,
      ...(pads[j.id] ? { team: pads[j.id] } : {}),
    };
  });
}

/** Whether Sol may ring this business's customers (voice-calls.ts), and the other people in the business to bring in. */
export async function feedExtras(businessId: string, me: string): Promise<{ callsOn: boolean; team: { email: string; name: string }[] }> {
  const [callsOn, members] = await Promise.all([
    voiceOnFor(businessId).catch(() => false),
    query<{ email: string; first_name: string | null }>(
      `select email, first_name from business_members where business_id = $1 and email <> $2 order by first_name nulls last, email`,
      [businessId, me.toLowerCase()],
    ),
  ]);
  return { callsOn, team: members.map((m) => ({ email: m.email, name: m.first_name || m.email.split("@")[0] })) };
}

/**
 * Write with Sol (deal-write.ts): an email to the deal's customer, as the member asked, from what the record says
 * (never a cost). One Sol credit of the customer tier, given back when no answer comes. Nothing is sent or kept.
 */
export async function solWritesEmail(
  member: { businessId: string; businessName: string; email: string },
  jobId: string,
  ask: string,
  viewer: DealViewer,
): Promise<{ subject: string; body: string } | { problem: string; status: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { problem: "Sol isn't set up on this site yet, so he can't write it.", status: 503 };
  const found = await jobById(member.businessId, jobId, viewer);
  if (!found) return { problem: "That deal isn't here.", status: 404 };
  const firstName = found.customer.firstName || found.customer.name.split(/\s+/)[0] || "there";
  const [acts, msgs] = await Promise.all([
    query<{ kind: string; text: string; at: string }>(
      `select kind, text, ${moment("at")} as at from design_activity where business_id = $1 and job_id = $2 and kind in ('email','call') order by at desc limit 4`,
      [member.businessId, jobId],
    ),
    query<{ theirs: boolean; text: string; at: string }>(
      `select from_customer as theirs, text, ${moment("at")} as at from design_messages where business_id = $1 and job_id = $2 order by at desc limit 6`,
      [member.businessId, jobId],
    ),
  ]);
  const recent = [
    ...msgs.map((m) => ({ at: m.at, line: `${m.theirs ? firstName : "Us"}: ${m.text.replace(/\s+/g, " ").slice(0, 300)}` })),
    ...acts.map((a) => ({ at: a.at, line: `Us (${a.kind}): ${a.text.replace(/\s+/g, " ").slice(0, 200)}` })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-8)
    .map((r) => r.line);
  const facts: WriteFacts = {
    business: member.businessName,
    customerFirst: firstName,
    title: found.job.title,
    stage: STAGE_LABELS[found.job.stage],
    suburb: suburbOfAddress(found.job.address || found.customer.address),
    recent,
  };
  try {
    const raw = await withSolCredit(
      member.businessId,
      "customer",
      member.email,
      async (ai) => {
        const client = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 });
        const m = await client.messages.create({
          model: ai.model,
          max_tokens: 700,
          system: writeSystem(member.businessName),
          messages: [{ role: "user", content: writeAsk(facts, ask) }],
        });
        ai.onUsage(usageOf(m.model, m.usage));
        return m.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
      },
      USE_TIER.customer,
      "email to a customer from the feed",
    );
    if (raw === "out") return { problem: SOL_OUT_SHORT, status: 402 };
    return readDraft(raw) ?? { problem: "Sol couldn't write that one. Try putting it another way.", status: 502 };
  } catch (e) {
    console.error("sol couldn't write an email", redactSecrets(e instanceof Anthropic.APIError ? `Claude API ${e.status}` : String(e)));
    return { problem: "Sol couldn't write it just now. Try again in a moment.", status: 502 };
  }
}

/** The business's owner email: example deals go only to a made-up business (`mayHaveExamples`). */
async function ownerOf(businessId: string): Promise<string> {
  const rows = await query<{ email: string }>(`select email from business_members where business_id = $1 and role = 'owner' limit 1`, [
    businessId,
  ]);
  return rows[0]?.email ?? "";
}

/** How many example deals the business has, or null when it is a real business (none may be added). */
export async function exampleCount(businessId: string): Promise<number | null> {
  if (!mayHaveExamples(await ownerOf(businessId))) return null;
  const rows = await query<{ n: number }>(`select count(*)::int as n from design_customers where business_id = $1 and source = $2`, [
    businessId,
    EXAMPLE_SOURCE,
  ]);
  return rows[0]?.n ?? 0;
}

/**
 * Adds the example deals (example-deals.ts) to a made-up business, each with its customer, deal, record and chat lines
 * at their times. Refused for a real business; the old ones are cleared first so it can be run again.
 */
export async function addExampleDeals(businessId: string): Promise<number> {
  const owner = await ownerOf(businessId);
  if (!mayHaveExamples(owner)) return 0;
  await clearExampleDeals(businessId);
  await transaction(async (q) => {
    for (const [i, d] of EXAMPLE_DEALS.entries()) {
      const customerId = newId("cus");
      const jobId = newId("job");
      const age = String(Math.round(d.ageHours * 60));
      const address = exampleAddress(d, i);
      await q(
        `insert into design_customers (id, business_id, name, first_name, last_name, phone, email, address, source, notes, sample, created_by, created_at, updated_at)
         values ($2,$1,$3,$4,$5,$6,$7,$8,$9,'',true,$10, now() - ($11 || ' minutes')::interval, now())`,
        [
          businessId,
          customerId,
          `${d.first} ${d.last}`,
          d.first,
          d.last,
          d.phone,
          exampleEmail(d),
          address,
          EXAMPLE_SOURCE,
          SAMPLE_AUTHOR,
          age,
        ],
      );
      const won = ["won", "ordered", "scheduled"].includes(d.stage);
      await q(
        `insert into design_jobs (id, business_id, customer_id, title, address, stage, value, kw, details, install_date, won_at, created_by, created_at, updated_at)
         values ($2,$1,$3,$4,$5,$6,$7,$8,$9::jsonb,
                 case when $10::int is null then null else (now() at time zone 'Australia/Melbourne')::date + $10::int end,
                 case when $11 then now() - interval '20 hours' else null end,
                 $12, now() - ($13 || ' minutes')::interval, now())`,
        [
          businessId,
          jobId,
          customerId,
          d.title,
          address,
          d.stage,
          d.value,
          d.kw,
          JSON.stringify(d.batteryKwh ? { batteryStorage: `${d.batteryKwh} kWh` } : {}),
          d.installInDays,
          won,
          SAMPLE_AUTHOR,
          age,
        ],
      );
      for (const e of d.events) {
        const minutes = String(Math.round(e.hoursAgo * 60));
        if (e.on === "record")
          await q(
            `insert into design_activity (id, business_id, customer_id, job_id, kind, text, by_email, at)
             values ($2,$1,$3,$4,$5,$6,$7, now() - ($8 || ' minutes')::interval)`,
            [businessId, newId("act"), customerId, jobId, e.kind, e.text, e.sol ? "sol" : owner, minutes],
          );
        else
          await q(
            `insert into design_messages (id, business_id, job_id, customer_id, from_customer, text, by_email, at, read_at)
             values ($2,$1,$3,$4,$5,$6,$7, now() - ($8 || ' minutes')::interval, case when $5 then null else now() end)`,
            [
              businessId,
              newId("msg"),
              jobId,
              customerId,
              e.from === "them",
              e.text,
              e.from === "them" ? null : e.from === "sol" ? "sol" : owner,
              minutes,
            ],
          );
      }
    }
  });
  return EXAMPLE_DEALS.length;
}

/** Takes every example deal away (their customers, and with them their deals, record and chat). */
export async function clearExampleDeals(businessId: string): Promise<void> {
  await query(`delete from design_customers where business_id = $1 and source = $2 and sample = true`, [businessId, EXAMPLE_SOURCE]);
}
