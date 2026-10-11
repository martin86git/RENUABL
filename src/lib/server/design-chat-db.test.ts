/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped
 * otherwise; `npm run test:db` sets it): the conversation between a business
 * and its customer. That a link reaches its own job's conversation and no
 * other, that one business can't reach another's, that who a line is from is
 * the server's to say, and that nothing of the business's own reaches the
 * customer through it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { CHAT_CLOSED, CHAT_FULL, MAX_CUSTOMER_LINES } from "@/lib/domain/design/chat";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { COST_WORDS, buildProposal } from "@/lib/domain/design/proposal";
import { ADDRESS, PLACE, sampleInputs } from "@/lib/domain/design/proposal-fixture";
import { packDesignSet } from "@/lib/domain/design/roof-design";
import { VERIFIED_RATES } from "@/lib/domain/rebates";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-chat.test";
const B = "owner@beta-chat.test";
const TODAY = "2026-10-12";

describe.skipIf(!url)("roof designer chat (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-repo");
  let crm: typeof import("./design-crm-repo");
  let proposals: typeof import("./design-proposal-repo");
  let chats: typeof import("./design-chat-repo");
  let chat: typeof import("./design-chat");
  let a: string;
  let b: string;
  let jobId: string;
  let otherJob: string;
  let customerId: string;
  let token: string;
  /** What `customerSays` hands over to be done after the answer has gone back: run here, so a test sees it happen. */
  const later: (() => Promise<void>)[] = [];
  const defer = (work: () => Promise<void>) => void later.push(work);
  const owner = () => ({
    businessId: a,
    businessName: "Alpha Solar",
    email: A,
    role: "owner" as const,
    termsVersion: BUSINESS_TERMS_VERSION,
    permissions: { costs: true, prices: true, publish: true },
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    // No email service here: nothing is ever sent from a test.
    delete process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    crm = await import("./design-crm-repo");
    proposals = await import("./design-proposal-repo");
    chats = await import("./design-chat-repo");
    chat = await import("./design-chat");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;

    const sample = sampleInputs();
    await repo.saveList(a, sample.workspace.lists[0], A);
    const customer = cleanCustomerInput({ name: "Alex Example", email: "alex@example.com", address: ADDRESS, ...PLACE });
    const job = cleanJobInput({ address: ADDRESS, ...PLACE });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, A);
    if (made === "full" || !made.job) throw new Error("unexpected");
    customerId = made.customer.id;
    jobId = made.job.id;
    const second = await crm.createJob(a, customerId, cleanJobInputValue({ title: "Battery" }), A);
    if (typeof second === "string") throw new Error(second);
    otherJob = second.id;
    await repo.createProject(
      a,
      { address: ADDRESS, ...PLACE },
      { design: packDesignSet(sample.project.set), extras: sample.project.extras },
      A,
    );
    const saved = await proposals.savedFor(a, "Alpha Solar", jobId);
    if (!saved || typeof saved === "string") throw new Error("unexpected");
    const built = buildProposal({
      ...sample,
      version: 1,
      job: saved.job,
      customer: saved.customer,
      project: saved.project,
      workspace: saved.workspace,
      rates: VERIFIED_RATES,
      brand: saved.brand,
      images: [],
    });
    if (!built.ok) throw new Error(built.problems.join(" "));
    const kept = await proposals.publishProposal(a, jobId, built, A);
    if (!kept || kept === "raced") throw new Error("unexpected");
    token = kept.token;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2)`, [a, b]);
    await db.resetDbForTests();
  });

  it("opens empty, under the two names each side is shown as", async () => {
    expect(await chat.publicChat(token)).toEqual({ open: true, messages: [], names: { customer: "Alex", business: "Alpha Solar team" } });
    for (const bad of ["", "nope", "f".repeat(48), token.slice(0, 47), token.toUpperCase()]) expect(await chat.publicChat(bad)).toBeNull();
  });

  it("keeps what the customer writes, shows it unread to the business, and writes it on their record", async () => {
    const said = await chat.customerSays(token, "Can it go on the garage?", defer);
    if (!said || "problem" in said) throw new Error("unexpected");
    expect(said.chat.messages).toHaveLength(1);
    expect(said.chat.messages[0]).toMatchObject({ from: "customer", text: "Can it go on the garage?" });
    // Telling the business was put off until after the answer, and does nothing harmful with no email service.
    expect(later).toHaveLength(1);
    await later.pop()!();

    const lines = await chats.chatLines(a, jobId);
    expect(lines).toEqual([
      {
        id: said.chat.messages[0].id,
        from: "customer",
        text: "Can it go on the garage?",
        at: said.chat.messages[0].at,
        by: null,
        read: false,
      },
    ]);
    expect(await chats.unreadCount(a)).toBe(1);
    expect(await chats.chatThreads(a)).toEqual([
      { jobId, customerId, customerName: "Alex Example", title: "Solar", last: "Can it go on the garage?", at: lines[0].at, unread: 1 },
    ]);
    const record = (await crm.customerDetail(a, customerId))!.activity[0];
    expect(record).toMatchObject({ kind: "message", text: "Message from the customer: Can it go on the garage?", by: "Customer", jobId });
    expect(await chat.customerSays("f".repeat(48), "Hello?", defer)).toBeNull();
  });

  it("keeps each business's conversations, and each job's, to itself", async () => {
    expect(await chats.chatLines(b, jobId)).toEqual([]);
    expect(await chats.unreadCount(b)).toBe(0);
    expect(await chats.chatThreads(b)).toEqual([]);
    expect(await chats.markRead(b, jobId)).toBe(0);
    expect(await chats.addReply(b, jobId, "Beta was here", B)).toBeNull();
    expect(await chats.addCustomerLine(b, jobId, "Beta was here")).toBeNull();
    expect(
      await chat.memberReplies({ ...owner(), businessId: b, businessName: "Beta Electrical", email: B }, jobId, "Beta was here"),
    ).toBeNull();
    // The same customer's other job has its own conversation.
    expect(await chats.chatLines(a, otherJob)).toEqual([]);
    expect((await chats.chatLines(a, jobId)).map((l) => l.text)).toEqual(["Can it go on the garage?"]);
    expect(await chats.unreadCount(a)).toBe(1);
  });

  it("takes a member's reply, marks the customer's lines read, and says why no email went", async () => {
    const replied = await chat.memberReplies(owner(), jobId, "It can. We'll redraw it.");
    expect(replied?.email).toBe("not-set-up");
    expect(replied?.lines.map((l) => [l.from, l.text, l.by, l.read])).toEqual([
      ["customer", "Can it go on the garage?", null, true],
      ["business", "It can. We'll redraw it.", A, true],
    ]);
    expect(await chats.unreadCount(a)).toBe(0);
    expect((await chats.chatThreads(a))[0].unread).toBe(0);
    expect((await crm.customerDetail(a, customerId))!.activity[0]).toMatchObject({
      kind: "message",
      text: "Reply sent: It can. We'll redraw it.",
      by: A,
    });

    // Switched off in settings, or with no address on file, the answer says which.
    await proposals.saveBrand(a, { ...(await proposals.loadBrand(a, "Alpha Solar")), emailReplies: false }, A);
    expect((await chat.memberReplies(owner(), jobId, "Second reply"))?.email).toBe("switched-off");
    await proposals.saveBrand(a, { ...(await proposals.loadBrand(a, "Alpha Solar")), emailReplies: true }, A);
    const current = await crm.customerById(a, customerId);
    await crm.updateCustomer(a, customerId, { ...current!, email: "" });
    expect((await chat.memberReplies(owner(), jobId, "Third reply"))?.email).toBe("no-address");
    expect(await chat.memberReplies(owner(), "job_000000000000000000000000", "Nobody")).toBeNull();
  });

  it("shows the customer the reply as the business's, and nothing of who wrote it or of the business's own figures", async () => {
    const seen = await chat.publicChat(token);
    expect(seen?.messages.map((l) => [l.from, l.text])).toEqual([
      ["customer", "Can it go on the garage?"],
      ["business", "It can. We'll redraw it."],
      ["business", "Second reply"],
      ["business", "Third reply"],
    ]);
    const sent = JSON.stringify(seen);
    expect(sent).not.toContain(A);
    expect(sent).not.toContain("@");
    const keys = new Set<string>();
    JSON.stringify(seen, (key, value) => (keys.add(key.toLowerCase()), value));
    const banned = [...COST_WORDS, "by", "read", "email", "businessId", "jobId", "customerId"].map((word) => word.toLowerCase());
    expect(banned.filter((word) => keys.has(word))).toEqual([]);
    expect([...keys].filter((key) => !/^\d*$/.test(key)).sort()).toEqual([
      "at",
      "business",
      "customer",
      "from",
      "id",
      "messages",
      "names",
      "open",
      "text",
    ]);
    expect(seen?.names).toEqual({ customer: "Alex", business: "Alpha Solar team" });
  });

  it("marks a conversation read by the button, once", async () => {
    await chat.customerSays(token, "One more thing", defer);
    await chat.customerSays(token, "And another", defer);
    later.length = 0;
    expect(await chats.unreadCount(a)).toBe(2);
    expect((await chats.chatThreads(a))[0]).toMatchObject({ last: "And another", unread: 2 });
    expect(await chats.markRead(a, jobId)).toBe(2);
    expect(await chats.markRead(a, jobId)).toBe(0);
    expect(await chats.unreadCount(a)).toBe(0);
  });

  it("stops taking a customer's lines past the limit for one job", async () => {
    await db.query(
      `insert into design_messages (id, business_id, job_id, customer_id, from_customer, text, read_at)
       select 'msg_fill_' || n, $1, $2, $3, true, 'filler', now() from generate_series(1, $4::int) n`,
      [a, jobId, customerId, MAX_CUSTOMER_LINES],
    );
    expect(await chat.customerSays(token, "Too many", defer)).toEqual({ problem: CHAT_FULL, status: 429 });
    // A member can still write.
    expect((await chat.memberReplies(owner(), jobId, "Call us"))?.lines.at(-1)?.text).toBe("Call us");
  });

  it("carries on when the proposal is published again or its price lapses, and closes when it is withdrawn", async () => {
    // Past its last day the price has lapsed; the conversation is still there (that is when a customer asks for a new one).
    expect((await proposals.publicProposal(token, "2027-01-01"))?.state).toBe("lapsed");
    expect((await chat.publicChat(token))?.open).toBe(true);

    expect(await proposals.withdrawProposal(a, jobId, A)).toBe(true);
    expect(await chat.publicChat(token)).toEqual({ open: false, messages: [], names: { customer: "Alex", business: "Alpha Solar team" } });
    expect(await chat.customerSays(token, "Hello?", defer)).toEqual({ problem: CHAT_CLOSED, status: 409 });
    // The business still has all of it.
    expect((await chats.chatLines(a, jobId)).length).toBeGreaterThan(5);
    expect(TODAY).toBe("2026-10-12");
  });

  it("goes with its job", async () => {
    expect(await crm.deleteJob(a, jobId)).toBe(true);
    const rows = await db.query<{ n: string }>(`select count(*) as n from design_messages where business_id = $1`, [a]);
    expect(Number(rows[0].n)).toBe(0);
  });
});

function cleanJobInputValue(raw: Record<string, unknown>) {
  const cleaned = cleanJobInput(raw);
  if (!cleaned.ok) throw new Error(cleaned.message);
  return cleaned.value;
}
