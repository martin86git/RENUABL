/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the group
 * email. That each person chosen gets their own unsubscribe link and a line on their record; that someone with no
 * address is left out and counted; that their link stops group emails for them alone; and that another business's
 * people can't be reached by naming their ids.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput } from "@/lib/domain/design/crm";

const url = process.env.TEST_DATABASE_URL;
const OWNER = "owner@alpha-people.test";
const OTHER = "owner@beta-people.test";

describe.skipIf(!url)("the group email (database)", () => {
  let db: typeof import("./db");
  let people: typeof import("./design-people-repo");
  let a: string;
  let b: string;
  const ids: Record<string, string> = {};

  async function person(business: string, name: string, email: string) {
    const crm = await import("./design-crm-repo");
    const c = cleanCustomerInput({ name, email });
    if (!c.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(business, c.value, null, OWNER);
    if (made === "full") throw new Error("unexpected");
    return made.customer.id;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.SITE_URL = "https://renuabl.test";
    delete process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    people = await import("./design-people-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [OWNER, OTHER]);
    a = (await repo.createBusiness(OWNER, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(OTHER, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
    ids.casey = await person(a, "Casey Group", "casey@example.com");
    ids.robin = await person(a, "Robin Noemail", "");
    ids.theirs = await person(b, "Kim Theirs", "kim@example.com");
  });
  afterAll(async () => {
    await db.query(`delete from businesses where created_by in ($1,$2)`, [OWNER, OTHER]);
  });

  it("sends each their own copy, records it, and leaves out those without an address or in another business", async () => {
    const r = await people.sendGroupEmail(
      { businessId: a, email: OWNER },
      { business: "Alpha Solar", subject: "Hi {firstName}", body: "News", ids: Object.values(ids) },
    );
    expect(r).toMatchObject({ sent: 1, noEmail: 1, unsubscribed: 0, failed: 0 });
    const logged = await db.query<{ text: string }>(
      `select text from design_activity where business_id = $1 and customer_id = $2 and kind = 'email'`,
      [a, ids.casey],
    );
    expect(logged[0]?.text).toContain("Group email to casey@example.com: Hi Casey");
    const theirs = await db.query(`select 1 from design_activity where business_id = $1 and customer_id = $2 and kind = 'email'`, [
      b,
      ids.theirs,
    ]);
    expect(theirs).toEqual([]);
  });

  it("stops group emails for the person whose link it is", async () => {
    const rows = await db.query<{ token: string }>(`select unsub_token as token from design_customers where business_id = $1 and id = $2`, [
      a,
      ids.casey,
    ]);
    const token = rows[0].token;
    expect(await people.unsubscribeTarget(token)).toEqual({ business: "Alpha Solar", done: false });
    expect(await people.unsubscribe(token)).toBe(true);
    expect(await people.unsubscribeTarget(token)).toEqual({ business: "Alpha Solar", done: true });
    expect(await people.unsubscribe("0".repeat(40))).toBe(false);
    const again = await people.sendGroupEmail(
      { businessId: a, email: OWNER },
      { business: "Alpha Solar", subject: "Again", body: "News", ids: [ids.casey] },
    );
    expect(again).toMatchObject({ sent: 0, unsubscribed: 1 });
  });
});
