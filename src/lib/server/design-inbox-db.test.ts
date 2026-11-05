/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the notes
 * on an email in a member's Gmail inbox. That a shared email is read only by the member whose inbox it is and those
 * tagged on it, that tagging someone shares it with them, that someone it isn't shared with can neither read nor write,
 * and that another business never sees it. (The mailbox itself is Gmail's, read live: not run from a test.)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-inbox.test";
const SAM = "sam@alpha-inbox.test";
const KIM = "kim@alpha-inbox.test";
const B = "owner@beta-inbox.test";
const ID = "18c2f0a9b3d4e5f6";

describe.skipIf(!url)("notes on an email (database)", () => {
  let db: typeof import("./db");
  let inbox: typeof import("./design-inbox-repo");
  let a: string;
  let b: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    inbox = await import("./design-inbox-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
    await repo.addMember(a, SAM, A);
    await repo.addMember(a, KIM, A);
    // The talk as it starts when the owner first writes on their own email (the copy of that one email).
    await db.query(`insert into design_email_talks (business_id, owner_email, message_id, snapshot) values ($1,$2,$3,$4)`, [
      a,
      A,
      ID,
      JSON.stringify({
        subject: "My bill",
        from: { name: "Casey", email: "casey@example.com" },
        at: "2026-11-01T00:00:00Z",
        to: A,
        text: "Here it is.",
      }),
    ]);
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2)`, [a, b]);
    await db.resetDbForTests();
  });

  it("shares the email with whoever the owner tags, and no one else", async () => {
    expect(await inbox.addEmailNote({ businessId: a, email: A }, A, ID, "Can you look at this @sam")).toEqual({ told: [SAM] });
    const forSam = await inbox.sharedEmail({ businessId: a, email: SAM }, A, ID);
    expect(forSam).toMatchObject({ subject: "My bill", copy: true, text: "Here it is.", shared: [SAM] });
    expect(forSam?.notes.map((n) => n.text)).toEqual(["Can you look at this @sam"]);
    expect((await inbox.sharedWith({ businessId: a, email: SAM })).map((s) => s.id)).toEqual([ID]);
    expect(await inbox.sharedEmail({ businessId: a, email: KIM }, A, ID)).toBeNull();
    expect(await inbox.addEmailNote({ businessId: a, email: KIM }, A, ID, "sneaking in")).toBeNull();
    expect(await inbox.sharedEmail({ businessId: b, email: B }, A, ID)).toBeNull();
  });

  it("lets someone it is shared with answer, and tag another in", async () => {
    expect(await inbox.addEmailNote({ businessId: a, email: SAM }, A, ID, "Looks fine. @kim for the design")).toEqual({ told: [KIM] });
    const forKim = await inbox.sharedEmail({ businessId: a, email: KIM }, A, ID);
    expect(forKim?.notes).toHaveLength(2);
  });
});

describe.skipIf(!url)("several mailboxes for one person (database)", () => {
  let db: typeof import("./db");
  let gmail: typeof import("./gmail");
  let a: string;
  const OWNER = "owner@gamma-inbox.test";
  const who = () => ({ businessId: a, email: OWNER });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    gmail = await import("./gmail");
    await db.query(`delete from businesses where created_by = $1`, [OWNER]);
    a = (await repo.createBusiness(OWNER, "Gamma Solar", BUSINESS_TERMS_VERSION)).businessId;
    // Two mailboxes, as two connections would keep them (tokens that open nothing, so nothing is sent to Google).
    for (const address of ["owner@gamma-inbox.test", "sales@gamma-inbox.test"])
      await db.query(`insert into design_gmail (business_id, email, address, token) values ($1,$2,$3,'not-a-token')`, [a, OWNER, address]);
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id = $1`, [a]);
    await db.resetDbForTests();
  });

  it("keeps both, and disconnecting one leaves the other", async () => {
    expect(await gmail.gmailAddresses(who())).toEqual(["owner@gamma-inbox.test", "sales@gamma-inbox.test"]);
    await gmail.disconnectGmail(who(), "owner@gamma-inbox.test");
    expect(await gmail.gmailAddresses(who())).toEqual(["sales@gamma-inbox.test"]);
    await gmail.disconnectGmail(who());
    expect(await gmail.gmailAddresses(who())).toEqual([]);
  });
});
