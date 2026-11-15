/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it):
 * RENUABL's own marketing contacts. One contact per email; a later import only fills blanks; consent moves only
 * from "not checked" or to "none"; an unsubscribe survives an import; lists count who can be emailed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ContactInput } from "@/lib/domain/marketing/contacts";

const url = process.env.TEST_DATABASE_URL;
const blank = { firstName: null, lastName: null, company: null, phone: null, website: null, state: null, postcode: null, role: null };
const person = (email: string, extra: Partial<ContactInput> = {}): ContactInput => ({ ...blank, email, ...extra });

describe.skipIf(!url)("marketing contacts (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./marketing-repo");
  const meta = { fileName: "list.csv", source: "Test list", consentNote: null, by: "staff@renuabl.test", skipped: 0 };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./marketing-repo");
    await db.query(`truncate marketing_contacts, marketing_lists, marketing_imports cascade`);
  });

  afterAll(async () => {
    await db.resetDbForTests();
  });

  it("adds contacts once and fills only blanks after", async () => {
    const listId = await repo.listNamed("Installers", "staff@renuabl.test");
    const first = await repo.importContacts([person("a@mkt.test", { company: "Alpha Solar" }), person("b@mkt.test")], {
      ...meta,
      consent: "unknown",
      listId,
    });
    expect(first).toEqual({ added: 2, updated: 0 });
    const again = await repo.importContacts([person("a@mkt.test", { company: "Other", state: "VIC" })], {
      ...meta,
      consent: "inferred",
      consentNote: "Published on their site",
      listId: null,
    });
    expect(again).toEqual({ added: 0, updated: 1 });
    const { contacts } = await repo.listContacts({ search: "alpha" });
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ company: "Alpha Solar", state: "VIC", consent: "inferred", lists: [listId] });
  });

  it("keeps express consent, but a no always wins", async () => {
    const [{ id }] = (await repo.listContacts({ search: "a@mkt.test" })).contacts;
    await repo.setConsent([id], "express", "Asked at a trade show", "staff@renuabl.test");
    await repo.importContacts([person("a@mkt.test")], { ...meta, consent: "unknown", listId: null });
    expect((await repo.listContacts({ search: "a@mkt.test" })).contacts[0].consent).toBe("express");
    await repo.importContacts([person("a@mkt.test")], { ...meta, consent: "none", listId: null });
    expect((await repo.listContacts({ search: "a@mkt.test" })).contacts[0].consent).toBe("none");
  });

  it("never undoes an unsubscribe and counts who can be emailed", async () => {
    const [b] = (await repo.listContacts({ search: "b@mkt.test" })).contacts;
    await repo.setConsent([b.id], "inferred", "Published", "staff@renuabl.test");
    let [list] = await repo.listLists();
    expect(list).toMatchObject({ members: 2, emailable: 1 });
    await repo.unsubscribeContact(b.id);
    await repo.importContacts([person("b@mkt.test")], { ...meta, consent: "express", consentNote: "x", listId: null });
    const [again] = (await repo.listContacts({ search: "b@mkt.test" })).contacts;
    expect(again.unsubscribedAt).not.toBeNull();
    [list] = await repo.listLists();
    expect(list.emailable).toBe(0);
    expect((await repo.contactCounts()).emailable).toBe(0);
  });
});
