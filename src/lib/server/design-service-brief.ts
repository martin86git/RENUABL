/**
 * Server only. A service case at a glance (domain/design/service-brief.ts): what the customer said and what the team has
 * done, read from the record, and Sol's three summaries (issue, solution, what it waits on), kept on the case until
 * something new happens on it, so opening a case again costs nothing.
 */
import { asBuiltInWords } from "@/lib/domain/design/as-built";
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import {
  SERVICE_BRIEF_PROMPT,
  SERVICE_BRIEF_SCHEMA,
  briefByRule,
  briefFacts,
  briefKey,
  cleanBrief,
  customerWords,
  teamTimeline,
  type CaseBrief,
  type ServiceBrief,
} from "@/lib/domain/design/service-brief";
import type { ServiceCase } from "@/lib/domain/design/service";
import { parseApiKey, redactSecrets } from "./bill-reader";
import { readWithClaude } from "./claude-reader";
import { chatLines } from "./design-chat-repo";
import { customerDetail, jobById } from "./design-crm-repo";
import { asBuiltOf } from "./design-job-card-repo";
import { query } from "./db";
import { withSolCredit } from "./sol-credits";

const CASE = `id, job_id as "jobId", customer_id as "customerId", issue, state,
  to_char(raised_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "raisedAt", raised_by as "raisedBy",
  to_char(resolved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "resolvedAt", updates, brief, brief_key as "briefKey"`;

/**
 * The case brief, for a member of the business (the service pipeline is the whole team's). Sol is asked only when the
 * case has changed since he last summed it up, and only with `mayAsk` (one credit); otherwise, or when he can't answer,
 * the brief is read by rule. Null for a case the business hasn't.
 */
export async function caseBrief(member: { businessId: string; email: string }, caseId: string, mayAsk: boolean): Promise<CaseBrief | null> {
  const { businessId } = member;
  const rows = await query<ServiceCase & { brief: ServiceBrief | null; briefKey: string | null }>(
    `select ${CASE} from design_service_cases where business_id = $1 and id = $2`,
    [businessId, caseId],
  );
  const c = rows[0];
  if (!c) return null;
  const found = await jobById(businessId, c.jobId);
  if (!found) return null;
  const { job, customer } = found;
  const [chat, detail, built] = await Promise.all([
    chatLines(businessId, job.id).catch(() => []),
    customerDetail(businessId, customer.id),
    asBuiltOf(businessId, job.id).catch(() => null),
  ]);
  const activity = detail?.activity ?? [];
  const words = customerWords(c, chat, activity);
  const timeline = teamTimeline(c, chat, activity);
  const key = briefKey(c, words, timeline);
  const byRule = briefByRule(c, words, timeline, customer.name);
  if (c.brief && c.briefKey === key) return { words, timeline, brief: c.brief };

  const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
  if (!apiKey || !mayAsk) return { words, timeline, brief: byRule };
  const facts = briefFacts(
    c,
    {
      customer: customer.name,
      title: job.title,
      stage: STAGE_LABELS[job.stage],
      installDate: job.installDate,
      installer: job.details?.installer || null,
      system: [job.kw ? `${job.kw} kW solar` : "", built ? asBuiltInWords(built).replace(/\n/g, "; ") : ""].filter(Boolean).join(". "),
    },
    words,
    timeline,
  );
  try {
    const read = await withSolCredit(
      businessId,
      "chat",
      member.email,
      (ai) => readWithClaude<unknown>([{ type: "text", text: facts }], SERVICE_BRIEF_SCHEMA, SERVICE_BRIEF_PROMPT, apiKey, ai),
      "quick",
      "service brief",
    );
    if (read === "out") return { words, timeline, brief: byRule };
    const brief = cleanBrief(read, byRule);
    if (brief.from === "sol")
      await query(`update design_service_cases set brief = $3, brief_key = $4 where business_id = $1 and id = $2`, [
        businessId,
        caseId,
        JSON.stringify(brief),
        key,
      ]);
    return { words, timeline, brief };
  } catch (e) {
    console.error("service brief failed", redactSecrets(e instanceof Error ? e.message : String(e)));
    return { words, timeline, brief: byRule };
  }
}
