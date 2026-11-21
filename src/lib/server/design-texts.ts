/**
 * Server only. Whether a business may text its customers from RENUABL (13 Nov 2026, Martin: call or text a contact
 * from the phone assistant's window). Texts go from the business's own number, which comes with the voice add-on
 * (add-ons.ts, business-numbers.ts); RENUABL's own business texts from RENUABL's number (`TWILIO_FROM`).
 */
import { recordTextSent } from "./design-voice-usage";
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
import { numberOf, businessOfNumber } from "./business-numbers";
import { hasAddOn } from "./design-addons";
import { smsConfigured } from "./sms";

export async function textsOnFor(businessId: string): Promise<boolean> {
  if (!smsConfigured() || !dbConfigured()) return false;
  if ((await renuablCrm().catch(() => null))?.businessId === businessId) return true;
  const [addOn, number] = await Promise.all([hasAddOn(businessId, "voice").catch(() => false), numberOf(businessId).catch(() => null)]);
  return addOn && Boolean(number);
}

/** The number a business's texts go from (its own, or RENUABL's for RENUABL's own business). */
export async function textFrom(businessId: string): Promise<string | undefined> {
  const n = await numberOf(businessId).catch(() => null);
  return n && !n.renuabl ? n.e164 : undefined;
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
  const id = newId("txt");
  await query(
    `insert into design_texts (business_id, id, job_id, customer_id, direction, mobile, text, by_email) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [businessId, id, t.jobId, t.customerId, t.direction, t.mobile, t.text.slice(0, TEXT_IN_MAX), t.by.toLowerCase()],
  );
  // A text sent from the business's number counts towards Calls & Texts (voice-usage.ts).
  if (t.direction === "out") await recordTextSent(businessId, id, t.text);
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
 * A text that came in to a business's number (`to`: its own, else RENUABL's): kept on the deal of the customer whose
 * mobile it is (their newest deal not lost, else their newest), put in that deal's team chat as their own words so it shows under Deals
 * in the chat window for whoever looks after it, and written on the deal's record. STOP stops texts to them; START
 * lets them be texted again. From a number on no customer's record it is kept apart.
 */
export async function receiveText(from: string, body: string, to?: string): Promise<"kept" | "stray" | "ignored"> {
  const mobile = normaliseMobile(from);
  const text = cleanInbound(body);
  // The business whose number it came in to; with no number given, RENUABL's own.
  const businessId = to ? await businessOfNumber({ e164: to }).catch(() => null) : (await renuablCrm().catch(() => null))?.businessId;
  if (!mobile || !text || !businessId) return "ignored";
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
