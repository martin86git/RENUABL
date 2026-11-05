/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): what has
 * been read in a customer's chat is each member's own. One member opening or answering a conversation doesn't clear
 * it for the rest; lines read for the whole business before (read_at) stay read; a member who can't see a deal isn't
 * counted its lines; and one business's reading never touches another's.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";

const url = process.env.TEST_DATABASE_URL;
const OWNER = "owner@alpha-seen.test";
const SAM = "sam@alpha-seen.test";
const OTHER = "owner@beta-seen.test";

describe.skipIf(!url)("customer chat read per member (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-repo");
  let crm: typeof import("./design-crm-repo");
  let chats: typeof import("./design-chat-repo");
  let a: string;
  let b: string;
  let jobId: string;
  const owner = { email: OWNER, all: true };
  const sam = { email: SAM, all: true };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    crm = await import("./design-crm-repo");
    chats = await import("./design-chat-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [OWNER, OTHER]);
    a = (await repo.createBusiness(OWNER, "Alpha Seen", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(OTHER, "Beta Seen", BUSINESS_TERMS_VERSION)).businessId;
    expect(await repo.addMember(a, SAM, OWNER)).toBe("added");
    const customer = cleanCustomerInput({ name: "Alex Example", email: "alex@example.com" });
    const job = cleanJobInput({ title: "Solar" });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, OWNER);
    if (made === "full" || !made.job) throw new Error("unexpected");
    jobId = made.job.id;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2)`, [a, b]);
    await db.resetDbForTests();
  });

  it("keeps a line new for everyone until each has seen it", async () => {
    await chats.addCustomerLine(a, jobId, "Is Tuesday OK?");
    expect(await chats.unreadCount(a, owner)).toBe(1);
    expect(await chats.unreadCount(a, sam)).toBe(1);

    // The owner opens the conversation: read for them, still new for Sam.
    expect(await chats.markRead(a, jobId, OWNER)).toBe(1);
    expect(await chats.markRead(a, jobId, OWNER)).toBe(0);
    expect(await chats.unreadCount(a, owner)).toBe(0);
    expect(await chats.unreadCount(a, sam)).toBe(1);
    expect((await chats.chatThreads(a, sam))[0].unread).toBe(1);
    expect((await chats.chatThreads(a, owner))[0].unread).toBe(0);
    expect((await chats.chatLines(a, jobId, SAM)).map((l) => l.read)).toEqual([false]);
    expect((await chats.chatLines(a, jobId, OWNER)).map((l) => l.read)).toEqual([true]);
  });

  it("marks it read for the member who answers, and only them", async () => {
    await chats.addCustomerLine(a, jobId, "And the roof?");
    expect(await chats.unreadCount(a, owner)).toBe(1);
    expect(await chats.unreadCount(a, sam)).toBe(2);
    await chats.addReply(a, jobId, "Tuesday is fine, and the roof is good.", SAM);
    expect(await chats.unreadCount(a, sam)).toBe(0);
    expect(await chats.unreadCount(a, owner)).toBe(1);
  });

  it("leaves lines read for the whole business before as read for everyone", async () => {
    await db.query(
      `insert into design_messages (id, business_id, job_id, customer_id, from_customer, text, read_at, at)
       select 'msg_seen_old', $1, $2, customer_id, true, 'Read long ago', now(), now() from design_jobs where business_id = $1 and id = $2`,
      [a, jobId],
    );
    expect(await chats.unreadCount(a, owner)).toBe(1);
    expect(await chats.unreadCount(a, sam)).toBe(0);
  });

  it("doesn't count lines on a deal the member can't see", async () => {
    await crm.setJobOwner(a, jobId, OWNER, OWNER);
    await chats.addCustomerLine(a, jobId, "One more");
    expect(await chats.unreadCount(a, { email: SAM, all: false })).toBe(0);
    expect(await chats.chatThreads(a, { email: SAM, all: false })).toEqual([]);
    expect(await chats.unreadCount(a, sam)).toBe(1);
  });

  it("keeps each business's reading to itself", async () => {
    expect(await chats.markRead(b, jobId, OTHER)).toBe(0);
    expect(await chats.unreadCount(b, { email: OTHER, all: true })).toBe(0);
    const rows = await db.query(`select 1 from design_chat_seen where business_id = $1`, [b]);
    expect(rows).toHaveLength(0);
    expect(await chats.unreadCount(a, owner)).toBe(2);
  });
});
