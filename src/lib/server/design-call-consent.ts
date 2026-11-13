/**
 * Server only. Asking a customer by email before the phone assistant calls (domain/design/call-consent.ts): one row an
 * ask (`design_call_consent`, business id first), its private link's token, the email it went to, the words they
 * agreed to and when. A Yes lines up the call (voice-calls.ts `queueCall`, as a customer who asked); a No is kept, and
 * no further ask goes for that deal. Under the designer's tenant rule: the business id only ever comes from the
 * signed-in member, and the customer's page is reached by its token alone.
 */
import {
  askRefusal,
  CALL_CONSENT_VERSION,
  consentEmail,
  consentRecordLine,
  consentState,
  consentWords,
  type AskRefusal,
  type ConsentAnswer,
  type ConsentState,
} from "@/lib/domain/design/call-consent";
import { normaliseMobile } from "@/lib/domain/contact";
import type { DealViewer } from "@/lib/domain/design/account";
import { siteUrl } from "@/lib/domain/sms";
import { newId, query, randomToken } from "./db";
import { callerOf } from "./design-caller-repo";
import { jobById, record } from "./design-crm-repo";
import { loadBrand } from "./design-proposal-repo";
import { emailProvider, sendEmail } from "./email";
import { callMeFor, queueCall } from "./voice-calls";

interface ConsentRow {
  id: string;
  business_id: string;
  job_id: string;
  customer_id: string;
  token: string;
  email: string;
  assistant: string;
  business: string;
  first_name: string;
  words: string;
  answer: ConsentAnswer | null;
  asked_at: string;
  answered_at: string | null;
}

async function businessName(businessId: string): Promise<string> {
  const biz = await query<{ name: string }>(`select name from businesses where id = $1`, [businessId]);
  const brand = await loadBrand(businessId, biz[0]?.name ?? "").catch(() => null);
  return brand?.name || biz[0]?.name || "";
}

/** The latest ask on a deal, as it stands now. */
export async function lastAsk(businessId: string, jobId: string): Promise<{ state: ConsentState; at: string } | null> {
  const rows = await query<{ answer: ConsentAnswer | null; asked_at: string; answered_at: string | null }>(
    `select answer, asked_at, answered_at from design_call_consent
      where business_id = $1 and job_id = $2 order by asked_at desc limit 1`,
    [businessId, jobId],
  );
  const r = rows[0];
  if (!r) return null;
  return { state: consentState({ answer: r.answer, askedAt: new Date(r.asked_at) }, new Date()), at: r.answered_at ?? r.asked_at };
}

/**
 * Emails the deal's customer to ask whether they'd like a call from the business's phone assistant. Only where calls
 * are on for the business, to the email on the customer's record, never one from a browser.
 */
export async function askForCall(
  member: { businessId: string; email: string },
  jobId: string,
  viewer: DealViewer,
): Promise<{ ok: true; assistant: string; email: string } | { ok: false; why: AskRefusal }> {
  const found = await jobById(member.businessId, jobId, viewer);
  if (!found) return { ok: false, why: "missing" };
  const { customer } = found;
  const on = await callMeFor(member.businessId);
  const last = await lastAsk(member.businessId, jobId);
  const why = askRefusal({
    callsOn: Boolean(on),
    email: customer.email,
    mobile: normaliseMobile(customer.phone),
    last: last?.state ?? null,
  });
  if (why) return { ok: false, why };
  const site = siteUrl();
  if (!site) return { ok: false, why: "no-site" };
  if (!emailProvider()) return { ok: false, why: "no-email-service" };

  const assistant = (await callerOf(member.businessId)).name;
  const business = await businessName(member.businessId);
  const firstName = customer.firstName || customer.name.split(" ")[0] || "";
  const words = consentWords({ business, assistant, firstName });
  const token = randomToken(20);
  await query(
    `insert into design_call_consent
       (id, business_id, job_id, customer_id, token, email, assistant, business, first_name, words, version, asked_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      newId("cc"),
      member.businessId,
      jobId,
      customer.id,
      token,
      customer.email,
      assistant,
      business,
      firstName,
      words,
      CALL_CONSENT_VERSION,
      member.email.toLowerCase(),
    ],
  );
  await sendEmail({
    to: customer.email,
    ...consentEmail({ business, assistant, firstName, link: `${site}/c/${token}` }),
    replyTo: member.email,
  });
  await record(query, member.businessId, {
    customerId: customer.id,
    jobId,
    kind: "call",
    text: consentRecordLine({ kind: "asked", assistant, email: customer.email }),
    by: member.email.toLowerCase(),
  }).catch(() => undefined);
  return { ok: true, assistant, email: customer.email };
}

/** What the customer's page shows: the business, the assistant, the words, and whether they have answered. */
export async function consentPage(
  token: string,
): Promise<{ business: string; assistant: string; firstName: string; words: string; state: ConsentState } | null> {
  const rows = await query<ConsentRow>(`select * from design_call_consent where token = $1`, [token]);
  const r = rows[0];
  if (!r) return null;
  return {
    business: r.business,
    assistant: r.assistant,
    firstName: r.first_name,
    words: r.words,
    state: consentState({ answer: r.answer, askedAt: new Date(r.asked_at) }, new Date()),
  };
}

/**
 * The customer's press, kept once (a second press changes nothing). A Yes lines up the call as a customer who asked;
 * a No is written on the deal and stops the ask. Never throws for a call that can't be lined up: the answer is kept.
 */
export async function answerConsent(token: string, answer: ConsentAnswer): Promise<ConsentState | null> {
  const rows = await query<ConsentRow>(
    `update design_call_consent set answer = $2, answered_at = now()
      where token = $1 and answer is null and asked_at > now() - interval '14 days'
      returning *`,
    [token, answer],
  );
  const r = rows[0];
  if (!r) return (await consentPage(token))?.state ?? null;
  await record(query, r.business_id, {
    customerId: r.customer_id,
    jobId: r.job_id,
    kind: "call",
    text: consentRecordLine(
      answer === "yes" ? { kind: "yes", assistant: r.assistant, words: r.words } : { kind: "no", assistant: r.assistant, words: "" },
    ),
    by: r.email.toLowerCase(),
  }).catch(() => undefined);
  if (answer === "yes") {
    const out = await query<{ n: number }>(
      `select count(*)::int as n from design_proposals where business_id = $1 and job_id = $2 and withdrawn_at is null`,
      [r.business_id, r.job_id],
    ).catch(() => [{ n: 0 }]);
    const placed = await queueCall({
      businessId: r.business_id,
      jobId: r.job_id,
      mode: out[0]?.n ? "proposal" : "lead",
      asked: true,
      askedNote: `They said yes by email to a call from ${r.assistant}.`,
      source: "Said yes to a call by email",
    }).catch(() => null);
    if (placed && placed.result !== "placed" && placed.result !== "already") console.error("consent call not lined up", placed.result);
  }
  return answer;
}

/** A deal the assistant may not call about: its customer said no by email. */
export async function saidNoToCalls(businessId: string, jobId: string): Promise<boolean> {
  return (await lastAsk(businessId, jobId))?.state === "no";
}
