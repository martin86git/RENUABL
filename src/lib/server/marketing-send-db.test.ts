/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): RENUABL's
 * marketing email engine. A campaign queues only contacts who may be emailed; nothing is sent outside the hours or
 * without an email service; a click only ever goes to a link in its own email; an unsubscribe or bounce stops
 * everything; a sequence lets in only people its trigger caught after it was switched on, and stops on signing up.
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
  blocks: [newBlock("heading"), { ...newBlock("button"), text: "Go", url: "https://renuabl.com.au/business" }],
};
// Monday 11am Melbourne: inside the sending hours.
const MONDAY = new Date("2026-11-16T00:00:00Z");
const SUNDAY = new Date("2026-11-15T00:00:00Z");

describe.skipIf(!url)("marketing sending (database)", () => {
  let db: typeof import("./db");
  let contacts: typeof import("./marketing-repo");
  let repo: typeof import("./marketing-campaigns-repo");
  let send: typeof import("./marketing-send");
  let listId: string;
  const by = "staff@renuabl.test";
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
    await db.query(
      `truncate marketing_contacts, marketing_lists, marketing_imports, marketing_campaigns, marketing_sequences, marketing_settings cascade`,
    );
    await db.query(`delete from business_members where email like $1`, ["%@mkt.test"]);
    listId = await contacts.listNamed("Installers", by);
    await contacts.importContacts([person("yes@mkt.test"), person("also@mkt.test")], { ...meta, consent: "inferred", listId });
    await contacts.importContacts([person("unknown@mkt.test")], { ...meta, consent: "unknown", consentNote: null, listId });
  });

  afterAll(async () => {
    await db.resetDbForTests();
  });

  it("queues a campaign only for contacts who may be emailed, and only once its time has come", async () => {
    const id = await repo.createCampaign("Launch", content, by);
    await repo.saveCampaign(id, { name: "Launch", content, listId });
    expect(await send.reachOf(listId)).toEqual({ members: 3, emailable: 2 });
    await repo.scheduleCampaign(id, new Date(MONDAY.getTime() + 3_600_000), by);
    expect(await send.queueDueCampaigns(MONDAY)).toBe(0);
    expect(await send.queueDueCampaigns(new Date(MONDAY.getTime() + 3_600_000))).toBe(2);
    expect((await repo.campaignById(id))?.status).toBe("sending");
  });

  it("holds the batch outside the hours and without an email service", async () => {
    expect((await send.sendBatch(SUNDAY)).held).toBe("outside-hours");
    expect((await send.sendBatch(MONDAY)).held).toBe("no-email-service");
  });

  it("counts a click only to the email's own link", async () => {
    await db.query(`update marketing_sends set status = 'sent', sent_at = now()`);
    const [{ token }] = await db.query<{ token: string }>(`select token from marketing_sends limit 1`);
    expect(await send.recordClick(token, 0)).toBe("https://renuabl.com.au/business");
    expect(await send.recordClick(token, 5)).toBeNull();
    expect(await send.recordClick("0".repeat(40), 0)).toBeNull();
    const [row] = await db.query<{ click_count: number; opened_at: string | null }>(
      `select click_count, opened_at from marketing_sends where token = $1`,
      [token],
    );
    expect(row.click_count).toBe(1);
    expect(row.opened_at).not.toBeNull();
  });

  it("unsubscribes and bounces for good", async () => {
    const [yes] = await db.query<{ unsub_token: string; id: string }>(
      `select id, unsub_token from marketing_contacts where email = 'yes@mkt.test'`,
    );
    expect(await send.unsubscribeByToken(yes.unsub_token, null)).toBe(true);
    expect(await send.recordDeliveryProblem("bounce", { email: "also@mkt.test" }, "550")).toBe(true);
    expect(await send.reachOf(listId)).toEqual({ members: 3, emailable: 0 });
  });

  it("lets people into a sequence only after it is on, sends its first email, and stops on signing up", async () => {
    await contacts.importContacts([person("old@mkt.test")], { ...meta, consent: "express", listId });
    const seqList = await contacts.listNamed("Welcome", by);
    const seq = await repo.createSequence(
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
    const [old] = await db.query<{ id: string }>(`select id from marketing_contacts where email = 'old@mkt.test'`);
    await contacts.addToList(seqList, [old.id]);
    await db.query(`update marketing_list_members set added_at = now() - interval '1 day' where list_id = $1`, [seqList]);
    await repo.setSequenceOn(seq, true);
    expect(await send.enrolNew()).toBe(0);
    await contacts.importContacts([person("new@mkt.test")], { ...meta, consent: "express", listId: seqList });
    expect(await send.enrolNew()).toBe(1);
    expect(await send.stepEnrolments(new Date(Date.now() + 1000))).toBe(1);
    const [e] = await db.query<{ step: number; next_at: string }>(`select step, next_at from marketing_enrolments where sequence_id = $1`, [
      seq,
    ]);
    expect(e.step).toBe(2);
    expect(new Date(e.next_at).getTime()).toBeGreaterThan(Date.now());
    const sends = await db.query(`select id from marketing_sends where sequence_id = $1`, [seq]);
    expect(sends).toHaveLength(1);
    // Signing up on RENUABL Business stops it.
    await db.query(`update marketing_enrolments set next_at = now() where sequence_id = $1`, [seq]);
    await db
      .query(`insert into businesses (id, name, created_by) values ('biz_mkt', 'Test', 'staff@renuabl.test') on conflict do nothing`)
      .catch(() => undefined);
    await db.query(
      `insert into business_members (id, business_id, email, role) values ('bm_mkt', 'biz_mkt', 'new@mkt.test', 'owner') on conflict do nothing`,
    );
    await send.stepEnrolments(new Date(Date.now() + 1000));
    const [stopped] = await db.query<{ status: string; stop_reason: string }>(
      `select status, stop_reason from marketing_enrolments where sequence_id = $1`,
      [seq],
    );
    expect(stopped).toEqual({ status: "stopped", stop_reason: "signed-up" });
  });
});
