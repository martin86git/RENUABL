/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the marketing
 * email engine, per business. A campaign queues only its business's contacts who may be emailed; nothing is sent outside
 * the hours or without an email service; a click only ever goes to a link in its own email; an unsubscribe or bounce
 * stops everything; a sequence lets in only people its trigger caught after it was switched on, and stops when they
 * become a customer (a deal of theirs sold).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ContactInput } from "@/lib/domain/marketing/contacts";
import { newBlock, type EdmContent } from "@/lib/domain/marketing/edm";

const url = process.env.TEST_DATABASE_URL;
const blank = { firstName: null, lastName: null, company: null, phone: null, website: null, state: null, postcode: null, role: null };
const person = (email: string): ContactInput => ({ ...blank, email });
const content: EdmContent = {
  subject: "Hello",
  preview: "",
  blocks: [newBlock("heading"), { ...newBlock("button"), text: "Go", url: "https://example.com/offer" }],
};
// Monday 11am Melbourne: inside the sending hours.
const MONDAY = new Date("2026-11-16T00:00:00Z");
const SUNDAY = new Date("2026-11-15T00:00:00Z");
const A = "biz_mks_a";
const B = "biz_mks_b";

describe.skipIf(!url)("marketing sending (database)", () => {
  let db: typeof import("./db");
  let contacts: typeof import("./marketing-repo");
  let repo: typeof import("./marketing-campaigns-repo");
  let send: typeof import("./marketing-send");
  let listId: string;
  const by = "owner@mks-a.test";
  const meta = { fileName: "a.csv", source: "Test", consentNote: "Published", by, skipped: 0 };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
    db = await import("./db");
    await db.resetDbForTests();
    contacts = await import("./marketing-repo");
    repo = await import("./marketing-campaigns-repo");
    send = await import("./marketing-send");
    await db.query(`delete from businesses where id in ($1, $2)`, [A, B]);
    for (const id of [A, B])
      await db.query(`insert into businesses (id, name, created_by) values ($1, $2, $3)`, [id, `Business ${id}`, by]);
    listId = await contacts.listNamed(A, "Installers", by);
    await contacts.importContacts(A, [person("yes@mks.test"), person("also@mks.test")], { ...meta, consent: "inferred", listId });
    await contacts.importContacts(A, [person("unknown@mks.test")], { ...meta, consent: "unknown", consentNote: null, listId });
    // Another business with the same address: never touched by A's campaign.
    await contacts.importContacts(B, [person("yes@mks.test")], { ...meta, consent: "inferred", listId: null });
  });

  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1, $2)`, [A, B]);
    await db.resetDbForTests();
  });

  it("queues a campaign only for its business's contacts who may be emailed, and only once its time has come", async () => {
    const id = await repo.createCampaign(A, "Launch", content, by);
    await repo.saveCampaign(A, id, { name: "Launch", content, listId });
    expect(await send.reachOf(A, listId)).toEqual({ members: 3, emailable: 2 });
    // B can't see or schedule A's campaign.
    expect(await repo.campaignById(B, id)).toBeNull();
    expect(await repo.scheduleCampaign(B, id, MONDAY, by)).toBe(false);
    await repo.scheduleCampaign(A, id, new Date(MONDAY.getTime() + 3_600_000), by);
    expect(await send.queueDueCampaigns(A, MONDAY)).toBe(0);
    expect(await send.queueDueCampaigns(B, new Date(MONDAY.getTime() + 3_600_000))).toBe(0);
    expect(await send.queueDueCampaigns(A, new Date(MONDAY.getTime() + 3_600_000))).toBe(2);
    expect((await repo.campaignById(A, id))?.status).toBe("sending");
  });

  it("holds the batch outside the hours and without an email service", async () => {
    expect((await send.sendBatch(A, SUNDAY)).held).toBe("outside-hours");
    expect((await send.sendBatch(A, MONDAY)).held).toBe("no-email-service");
  });

  it("counts a click only to the email's own link", async () => {
    await db.query(`update design_marketing_sends set status = 'sent', sent_at = now() where business_id = $1`, [A]);
    const [{ token }] = await db.query<{ token: string }>(`select token from design_marketing_sends where business_id = $1 limit 1`, [A]);
    expect(await send.recordClick(token, 0)).toBe("https://example.com/offer");
    expect(await send.recordClick(token, 5)).toBeNull();
    expect(await send.recordClick("0".repeat(40), 0)).toBeNull();
    const [row] = await db.query<{ click_count: number; opened_at: string | null }>(
      `select click_count, opened_at from design_marketing_sends where token = $1`,
      [token],
    );
    expect(row.click_count).toBe(1);
    expect(row.opened_at).not.toBeNull();
  });

  it("unsubscribes and bounces for good, within the business that sent it", async () => {
    const [yes] = await db.query<{ unsub_token: string }>(
      `select unsub_token from design_marketing_contacts where business_id = $1 and email = 'yes@mks.test'`,
      [A],
    );
    expect(await send.unsubscribeByToken(yes.unsub_token, null)).toBe(true);
    expect((await send.unsubscribeTarget(yes.unsub_token))?.business).toBe(`Business ${A}`);
    expect(await send.recordDeliveryProblem("bounce", { email: "also@mks.test" }, "550")).toBe(true);
    expect(await send.reachOf(A, listId)).toEqual({ members: 3, emailable: 0 });
    // B's contact with the same address is still subscribed.
    expect((await contacts.contactCounts(B)).emailable).toBe(1);
  });

  it("lets people into a sequence only after it is on, sends its first email, and stops when a deal of theirs is sold", async () => {
    await contacts.importContacts(A, [person("old@mks.test")], { ...meta, consent: "express", listId });
    const seqList = await contacts.listNamed(A, "Welcome", by);
    const seq = await repo.createSequence(
      A,
      {
        name: "Welcome",
        trigger: { kind: "list", listId: seqList },
        steps: [
          { id: "aaaa1111", kind: "email", content },
          { id: "bbbb2222", kind: "wait", days: 2 },
          { id: "cccc3333", kind: "email", content },
        ],
        stops: { signedUp: true, clicked: false },
      },
      by,
    );
    const [old] = await db.query<{ id: string }>(
      `select id from design_marketing_contacts where business_id = $1 and email = 'old@mks.test'`,
      [A],
    );
    await contacts.addToList(A, seqList, [old.id]);
    await db.query(`update design_marketing_list_members set added_at = now() - interval '1 day' where list_id = $1`, [seqList]);
    await repo.setSequenceOn(A, seq, true);
    expect(await send.enrolNew(A)).toBe(0);
    await contacts.importContacts(A, [person("new@mks.test")], { ...meta, consent: "express", listId: seqList });
    expect(await send.enrolNew(A)).toBe(1);
    // JS's "now" can sit a hair behind Postgres's: a second's margin.
    expect(await send.stepEnrolments(A, new Date(Date.now() + 1000))).toBe(1);
    const [e] = await db.query<{ step: number; next_at: string }>(
      `select step, next_at from design_marketing_enrolments where sequence_id = $1`,
      [seq],
    );
    expect(e.step).toBe(2);
    expect(new Date(e.next_at).getTime()).toBeGreaterThan(Date.now());
    expect(await db.query(`select id from design_marketing_sends where sequence_id = $1`, [seq])).toHaveLength(1);
    // A deal of theirs is sold in the business's CRM: the sequence stops.
    await db.query(`update design_marketing_enrolments set next_at = now() where sequence_id = $1`, [seq]);
    await db.query(`insert into design_customers (id, business_id, name, email) values ('cu_mks_new', $1, 'New', 'new@mks.test')`, [A]);
    await db.query(
      `insert into design_jobs (id, business_id, customer_id, title, stage) values ('jb_mks_new', $1, 'cu_mks_new', 'Solar', 'won')`,
      [A],
    );
    await send.stepEnrolments(A, new Date(Date.now() + 1000));
    const [stopped] = await db.query<{ status: string; stop_reason: string }>(
      `select status, stop_reason from design_marketing_enrolments where sequence_id = $1`,
      [seq],
    );
    expect(stopped).toEqual({ status: "stopped", stop_reason: "signed-up" });
  });
});
