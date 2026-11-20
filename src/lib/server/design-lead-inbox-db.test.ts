/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the lead
 * inbox (domain/design/lead-inbox.ts) with Gmail, Sol and the map stood in for. That only a connected mailbox can be
 * chosen, that a lead becomes a customer and a deal with the email as a note, that each email is dealt with once, that an
 * existing customer is never overwritten or given a second open deal, that an email Sol couldn't read waits, and that
 * one business never sees another's.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import type { LeadReading } from "@/lib/domain/design/lead-inbox";
import type { GmailMessage } from "./gmail";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-leadinbox.test";
const B = "owner@beta-leadinbox.test";
const BOX = "leads@alpha-leadinbox.test";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const mail = (id: string, from: string, subject: string, text: string, replyTo?: string): GmailMessage => ({
  id,
  threadId: id,
  box: BOX,
  internalDate: String(Date.now()),
  payload: {
    mimeType: "text/plain",
    headers: [
      { name: "From", value: from },
      { name: "Subject", value: subject },
      ...(replyTo ? [{ name: "Reply-To", value: replyTo }] : []),
    ],
    body: { data: b64(text) },
  },
});

const reading = (over: Partial<LeadReading>): LeadReading => ({
  isLead: true,
  why: "Asks for a quote",
  firstName: "",
  lastName: "",
  email: "",
  mobile: "",
  address: "",
  wants: "Solar and a battery",
  summary: "Wants a quote.",
  ...over,
});

describe.skipIf(!url)("the lead inbox (database)", () => {
  let db: typeof import("./db");
  let li: typeof import("./design-lead-inbox");
  let a: string;
  let b: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    li = await import("./design-lead-inbox");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Solar", BUSINESS_TERMS_VERSION)).businessId;
    await db.query(`insert into design_gmail (business_id, email, address, token, can_modify) values ($1,$2,$3,'x',true)`, [a, A, BOX]);
  });
  afterAll(async () => {
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
  });

  it("only lets a business choose a mailbox connected in it", async () => {
    expect((await li.saveLeadInbox(b, { on: true, owner: A, address: BOX, label: null }, B)).ok).toBe(false);
    expect((await li.saveLeadInbox(a, { on: true, owner: null, address: null, label: null }, A)).ok).toBe(false);
    expect((await li.saveLeadInbox(a, { on: true, owner: A, address: BOX, label: null }, A)).ok).toBe(true);
    const s = (await li.leadInboxOf(a)).settings;
    expect(s.on).toBe(true);
    expect(s.onAt).toBeTruthy();
    expect(await li.leadInboxBusinesses()).toContain(a);
    expect(await li.leadInboxBusinesses()).not.toContain(b);
    expect((await li.businessMailboxes(b)).length).toBe(0);
  });

  it("makes leads, passes others over, deals with each email once, never overwrites a customer", async () => {
    // Someone already a customer with an open deal.
    const crm = await import("./design-crm-repo");
    const existing = await crm.createCustomer(
      a,
      {
        name: "Kim Known",
        firstName: "Kim",
        lastName: "Known",
        phone: "",
        email: "kim@example.com",
        address: "",
        lat: null,
        lng: null,
        source: "",
        notes: "",
      },
      { title: "Solar", address: "", lat: null, lng: null, stage: "lead", value: null, installDate: null, details: {} },
      A,
    );
    if (existing === "full") throw new Error("full");

    const inbox = [
      mail(
        "aaaa00000001",
        "Website <no-reply@alpha-leadinbox.test>",
        "New enquiry",
        "Name: Jo Citizen\nPhone: 0491 570 156",
        "Jo Citizen <jo@example.com>",
      ),
      mail("aaaa00000002", "Newsletter <news@vendor.example>", "Our November deals", "Buy now"),
      mail("aaaa00000003", "Kim Known <kim@example.com>", "Re: your proposal", "Thanks!"),
      mail("aaaa00000004", "Spammy <win@prize.example>", "You won", "Click here"),
      mail("aaaa00000005", "Lee Busy <lee@example.com>", "Quote please", "Solar for my home"),
    ];
    let asked = 0;
    const read = async (e: { id: string }) => {
      asked++;
      if (e.id === "aaaa00000001")
        return reading({
          firstName: "Jo",
          lastName: "Citizen",
          mobile: "0491 570 156",
          address: "8 Example Court, Glen Waverley VIC 3150",
        });
      if (e.id === "aaaa00000004") return reading({ isLead: false, why: "A prize email" });
      return null; // Sol couldn't read it: it waits.
    };
    const place = async () => ({ address: "8 Example Court, Glen Waverley VIC 3150", lat: -37.88, lng: 145.16 });
    const deps = { fetch: async () => inbox, read, place };

    const first = await li.syncLeadInbox(a, deps);
    expect(first).toMatchObject({ taken: 1, skipped: 3, waiting: 1, problem: null });
    expect(asked).toBe(3);

    const recent = await li.recentLeadEmails(a);
    const taken = recent.find((r) => r.outcome === "taken")!;
    expect(taken.customer).toBe("Jo Citizen");
    const reasons = Object.fromEntries(recent.map((r) => [r.id, r.reason]));
    expect(reasons.aaaa00000002).toBe("An automated email");
    expect(reasons.aaaa00000003).toBe("From someone who already has a deal");
    expect(reasons.aaaa00000004).toMatch(/^Not a lead/);
    expect(reasons.aaaa00000005).toBeUndefined();

    const job = await crm.jobById(a, taken.jobId!);
    expect(job?.job.stage).toBe("lead");
    expect(job?.job.lat).toBeCloseTo(-37.88);
    expect(job?.customer.email).toBe("jo@example.com");
    const notes = await db.query<{ text: string }>(
      `select text from design_activity where business_id = $1 and job_id = $2 and kind = 'note'`,
      [a, taken.jobId],
    );
    expect(notes[0].text).toContain("The original email:");
    expect(notes[0].text).toContain("Phone: 0491 570 156");

    // Again: only the one that waited is read; nothing is taken twice.
    asked = 0;
    const second = await li.syncLeadInbox(a, deps);
    expect(second).toMatchObject({ taken: 0, looked: 1, waiting: 1 });
    expect(asked).toBe(1);
    const kim = await db.query<{ name: string }>(
      `select name from design_customers where business_id = $1 and lower(email) = 'kim@example.com'`,
      [a],
    );
    expect(kim.map((k) => k.name)).toEqual(["Kim Known"]);

    // Another business sees none of it.
    expect(await li.recentLeadEmails(b)).toEqual([]);
  });

  it("finds an existing customer by mobile and adds a deal without changing them", async () => {
    const crm = await import("./design-crm-repo");
    const lost = await crm.createCustomer(
      a,
      {
        name: "Pat Past",
        firstName: "Pat",
        lastName: "Past",
        phone: "0412 345 678",
        email: "",
        address: "",
        lat: null,
        lng: null,
        source: "",
        notes: "",
      },
      { title: "Solar", address: "", lat: null, lng: null, stage: "lost", value: null, installDate: null, details: {} },
      A,
    );
    if (lost === "full") throw new Error("full");
    const run = await li.syncLeadInbox(a, {
      fetch: async () => [mail("aaaa00000006", "Patricia <pat.new@example.com>", "Battery?", "Call me on 0412345678")],
      read: async () => reading({ firstName: "Patricia", email: "pat.new@example.com", mobile: "0412345678" }),
      place: async () => null,
    });
    expect(run.taken).toBe(1);
    const jobs = await db.query<{ n: string }>(`select count(*) as n from design_jobs where business_id = $1 and customer_id = $2`, [
      a,
      lost.customer.id,
    ]);
    expect(Number(jobs[0].n)).toBe(2);
    const pat = await crm.customerById(a, lost.customer.id);
    expect(pat?.name).toBe("Pat Past");
    expect(pat?.email).toBe("");
  });

  it("says when it is switched off", async () => {
    await li.saveLeadInbox(a, { on: false, owner: A, address: BOX, label: null }, A);
    expect((await li.syncLeadInbox(a, { fetch: async () => [] })).problem).toMatch(/switched off/);
  });
});
