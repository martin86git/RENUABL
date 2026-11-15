/**
 * Server only. Whether a business may text its customers from RENUABL (13 Nov 2026, Martin: call or text a contact
 * from the phone assistant's window). Only RENUABL's own business for now, as its calls are: the number a text comes
 * from is RENUABL's (`TWILIO_FROM`). Each business's own number comes later.
 */
import { normaliseMobile } from "@/lib/domain/contact";
import {
  TEXTS_SHOWN,
  TEXT_IN_MAX,
  cleanInbound,
  localMobile,
  replyRecord,
  stopRecord,
  stopWord,
  type StrayText,
  type TextLine,
} from "@/lib/domain/design/texts";
import { dbConfigured, newId, query } from "./db";
import { customerTextsOnDeal, solPostsOnDeal, tellDealFollowers } from "./design-deal-team-repo";
import { findCustomerByMobile, renuablCrm } from "./renuabl-crm";
import { smsConfigured } from "./sms";

export async function textsOnFor(businessId: string): Promise<boolean> {
  if (!smsConfigured() || !dbConfigured()) return false;
  return (await renuablCrm().catch(() => null))?.businessId === businessId;
}

// ---------------------------------------------------------------------------
// Texts kept, both ways, and replies coming in (domain/design/texts.ts)
// ---------------------------------------------------------------------------

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/** Keeps a text on its deal (or, with no deal, as one from a number on no customer's record). */
export async function keepText(
  businessId: string,
  t: { jobId: string | null; customerId: string | null; direction: "in" | "out"; mobile: string; text: string; by: string },
): Promise<void> {
  await query(
    `insert into design_texts (business_id, id, job_id, customer_id, direction, mobile, text, by_email) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [businessId, newId("txt"), t.jobId, t.customerId, t.direction, t.mobile, t.text.slice(0, TEXT_IN_MAX), t.by.toLowerCase()],
  );
}

/** The texts on a deal, oldest first (the latest `TEXTS_SHOWN`). The caller has checked the member may see the deal. */
export async function textsOnDeal(businessId: string, jobId: string): Promise<TextLine[]> {
  const rows = await query<TextLine>(
    `select id, direction, text, ${moment("at")} as at, by_email as by from design_texts
      where business_id = $1 and job_id = $2 order by at desc, id desc limit $3`,
    [businessId, jobId, TEXTS_SHOWN],
  );
  return rows.reverse();
}

/** Whether this customer replied STOP (and hasn't texted START since). */
export async function textsStopped(businessId: string, customerId: string): Promise<boolean> {
  const rows = await query<{ stopped: boolean }>(
    `select no_texts_at is not null as stopped from design_customers where business_id = $1 and id = $2`,
    [businessId, customerId],
  );
  return rows[0]?.stopped === true;
}

/** The latest texts from numbers on no customer's record, newest first. */
export async function strayTexts(businessId: string): Promise<StrayText[]> {
  const rows = await query<{ id: string; mobile: string; text: string; at: string }>(
    `select id, mobile, text, ${moment("at")} as at from design_texts
      where business_id = $1 and job_id is null and direction = 'in' and at > now() - interval '30 days'
      order by at desc limit 20`,
    [businessId],
  );
  return rows.map((r) => ({ id: r.id, from: localMobile(r.mobile), text: r.text, at: r.at }));
}

/**
 * A text that came in to RENUABL's number (the only one texts go from for now): kept on the deal of the customer whose
 * mobile it is (their newest deal not lost, else their newest), put in that deal's team chat as their own words so it shows under Deals
 * in the chat window for whoever looks after it, and written on the deal's record. STOP stops texts to them; START
 * lets them be texted again. From a number on no customer's record it is kept apart.
 */
export async function receiveText(from: string, body: string): Promise<"kept" | "stray" | "ignored"> {
  const mobile = normaliseMobile(from);
  const text = cleanInbound(body);
  const crm = await renuablCrm().catch(() => null);
  if (!mobile || !text || !crm) return "ignored";
  const businessId = crm.businessId;
  const customerId = await findCustomerByMobile(businessId, mobile);
  const jobs = customerId
    ? await query<{ id: string }>(
        `select id from design_jobs where business_id = $1 and customer_id = $2 order by (stage = 'lost'), updated_at desc limit 1`,
        [businessId, customerId],
      )
    : [];
  const jobId = jobs[0]?.id ?? null;
  if (!customerId || !jobId) {
    await keepText(businessId, { jobId: null, customerId, direction: "in", mobile, text, by: "" });
    return "stray";
  }
  await keepText(businessId, { jobId, customerId, direction: "in", mobile, text, by: "" });
  const word = stopWord(text);
  if (word)
    await query(`update design_customers set no_texts_at = ${word === "stop" ? "now()" : "null"} where business_id = $1 and id = $2`, [
      businessId,
      customerId,
    ]);
  // In the deal's team chat as the customer's own words (and on the deal's record), for whoever looks after the deal.
  await tellDealFollowers(businessId, jobId);
  await customerTextsOnDeal(businessId, jobId, text, replyRecord(mobile, text));
  // What STOP or START means for the team is Sol's to say.
  if (word) await solPostsOnDeal(businessId, jobId, { kind: "note", text: stopRecord(mobile, word) });
  return "kept";
}
