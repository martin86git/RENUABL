/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): a business's
 * marketing contacts. One contact per email in a business; a later import only fills blanks; consent moves only from
 * "not checked" or to "none"; an unsubscribe survives an import and reaches the business's group emails; lists count who
 * can be emailed; one business never sees another's; its CRM customers come across with their unsubscribes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ContactInput } from "@/lib/domain/marketing/contacts";

const url = process.env.TEST_DATABASE_URL;
const blank = { firstName: null, lastName: null, company: null, phone: null, website: null, state: null, postcode: null, role: null };
const person = (email: string, extra: Partial<ContactInput> = {}): ContactInput => ({ ...blank, email, ...extra });
const A = "biz_mkt_a";
const B = "biz_mkt_b";

describe.skipIf(!url)("marketing contacts (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./marketing-repo");
  const by = "owner@mkt-a.test";
  const meta = { fileName: "list.csv", source: "Test list", consentNote: null, by, skipped: 0 };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./marketing-repo");
    await db.query(`delete from businesses where id in ($1, $2)`, [A, B]);
    for (const id of [A, B])
      await db.query(`insert into businesses (id, name, created_by) values ($1, $2, $3)`, [id, `Business ${id}`, by]);
  });

  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1, $2)`, [A, B]);
    await db.resetDbForTests();
  });

  it("adds contacts once and fills only blanks after", async () => {
    const listId = await repo.listNamed(A, "Installers", by);
    const first = await repo.importContacts(A, [person("a@mkt.test", { company: "Alpha Solar" }), person("b@mkt.test")], {
      ...meta,
      consent: "unknown",
      listId,
    });
    expect(first).toEqual({ added: 2, updated: 0 });
    const again = await repo.importContacts(A, [person("a@mkt.test", { company: "Other", state: "VIC" })], {
      ...meta,
      consent: "inferred",
      consentNote: "Published on their site",
      listId: null,
    });
    expect(again).toEqual({ added: 0, updated: 1 });
    const { contacts } = await repo.listContacts(A, { search: "alpha" });
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ company: "Alpha Solar", state: "VIC", consent: "inferred", lists: [listId] });
  });

  it("keeps each business's contacts apart", async () => {
    await repo.importContacts(B, [person("a@mkt.test")], { ...meta, consent: "unknown", listId: null });
    expect((await repo.listContacts(B, {})).total).toBe(1);
    expect((await repo.listContacts(A, {})).total).toBe(2);
    const [bList] = await Promise.all([repo.listNamed(B, "Theirs", by)]);
    const [aContact] = (await repo.listContacts(A, { search: "a@mkt.test" })).contacts;
    // A's contact can't be put on B's list, nor B's list renamed by A.
    expect(await repo.addToList(B, bList, [aContact.id])).toBe(0);
    expect(await repo.renameList(A, bList, "Mine")).toBe(false);
  });

  it("keeps express consent, but a no always wins", async () => {
    const [{ id }] = (await repo.listContacts(A, { search: "a@mkt.test" })).contacts;
    await repo.setConsent(A, [id], "express", "Asked at a trade show", by);
    await repo.importContacts(A, [person("a@mkt.test")], { ...meta, consent: "unknown", listId: null });
    expect((await repo.listContacts(A, { search: "a@mkt.test" })).contacts[0].consent).toBe("express");
    await repo.importContacts(A, [person("a@mkt.test")], { ...meta, consent: "none", listId: null });
    expect((await repo.listContacts(A, { search: "a@mkt.test" })).contacts[0].consent).toBe("none");
  });

  it("never undoes an unsubscribe, stops the group emails too, and counts who can be emailed", async () => {
    await db.query(
      `insert into design_customers (id, business_id, name, email) values ('cu_mkt_b', $1, 'Bea Brown', 'b@mkt.test') on conflict do nothing`,
      [A],
    );
    const [b] = (await repo.listContacts(A, { search: "b@mkt.test" })).contacts;
    await repo.setConsent(A, [b.id], "inferred", "Published", by);
    let [list] = await repo.listLists(A);
    expect(list).toMatchObject({ members: 2, emailable: 1 });
    await repo.unsubscribeContact(A, b.id);
    await repo.importContacts(A, [person("b@mkt.test")], { ...meta, consent: "express", consentNote: "x", listId: null });
    expect((await repo.listContacts(A, { search: "b@mkt.test" })).contacts[0].unsubscribedAt).not.toBeNull();
    [list] = await repo.listLists(A);
    expect(list.emailable).toBe(0);
    const [cu] = await db.query<{ unsubscribed_at: string | null }>(`select unsubscribed_at from design_customers where id = 'cu_mkt_b'`);
    expect(cu.unsubscribed_at).not.toBeNull();
  });

  it("brings in CRM customers, keeping their unsubscribes", async () => {
    await db.query(
      `insert into design_customers (id, business_id, name, first_name, email) values ('cu_mkt_c', $1, 'Cal Chen', 'Cal', 'C@Mkt.test ')
       on conflict do nothing`,
      [B],
    );
    await db.query(
      `insert into design_customers (id, business_id, name, email, unsubscribed_at) values ('cu_mkt_d', $1, 'Di', 'd@mkt.test', now())
       on conflict do nothing`,
      [B],
    );
    const people = await repo.crmPeople(B);
    expect(people.map((p) => [p.email, p.firstName, p.unsubscribed]).sort()).toEqual([
      ["c@mkt.test", "Cal", false],
      ["d@mkt.test", "Di", true],
    ]);
    await repo.importContacts(B, people, {
      ...meta,
      consent: "inferred",
      consentNote: "Existing customers",
      listId: null,
      unsubscribed: ["d@mkt.test"],
    });
    expect((await repo.contactCounts(B)).unsubscribed).toBe(1);
    expect((await repo.contactCounts(B)).emailable).toBe(1);
  });
});
