/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped
 * otherwise; `npm run test:db` sets it): the roof designer's businesses.
 * Above all, that one business can never read or change another's rows.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION, cleanRoofWork, cleanWorkspaceSettings, roofKey, type RoofPlace } from "@/lib/domain/design/account";
import { DEFAULT_WORKSPACE, MAX_SUPPLIER_LISTS, type SupplierList } from "@/lib/domain/design/pricing";

const url = process.env.TEST_DATABASE_URL;

const ROOF: RoofPlace = { address: "8 Example Court, Glen Waverley VIC 3150", lat: -37.87812, lng: 145.16432 };
const ELSEWHERE: RoofPlace = { address: "1 Sample Street, Carlton VIC 3053", lat: -37.8001, lng: 144.9671 };
const work = (roof: RoofPlace, label = "First") => cleanRoofWork(roof, { lat: roof.lat, lng: roof.lng, faces: [], label }, null)!;
const list = (name: string, cost = 100): SupplierList => ({
  name,
  uploadedAt: "2026-10-10",
  items: [{ sku: "PANEL-1", name: "A panel", cost }],
  panels: [{ sku: "PANEL-1", name: "A panel", cost, watts: 475 }],
  inverters: [],
  batteries: [],
});

describe.skipIf(!url)("roof designer businesses (database)", () => {
  let db: typeof import("./db");
  let repo: typeof import("./design-repo");
  let accounts: typeof import("./accounts");
  let a: string;
  let b: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    repo = await import("./design-repo");
    accounts = await import("./accounts");
    await db.query("delete from businesses");
    a = (await repo.createBusiness("Owner@Alpha.test", "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness("owner@beta.test", "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
  });
  afterAll(async () => {
    await db.query("delete from businesses");
    await db.resetDbForTests();
  });

  it("makes a business with its owner, the terms recorded, and one business per email", async () => {
    const owner = await repo.memberByEmail("owner@alpha.test");
    expect(owner).toMatchObject({ businessId: a, businessName: "Alpha Solar", role: "owner", termsVersion: BUSINESS_TERMS_VERSION });
    const when = await db.query<{ at: Date | null }>(`select terms_accepted_at as at from business_members where email = $1`, [
      "owner@alpha.test",
    ]);
    expect(when[0].at).toBeInstanceOf(Date);
    // Naming a second business with the same email changes nothing and leaves no empty business behind.
    const again = await repo.createBusiness("owner@alpha.test", "Another Name", BUSINESS_TERMS_VERSION);
    expect(again.businessId).toBe(a);
    expect(again.businessName).toBe("Alpha Solar");
    expect(Number((await db.query<{ n: string }>(`select count(*) as n from businesses`))[0].n)).toBe(2);
    expect(a).not.toBe(b);
  });

  it("signs a business member in with the same one-time link as everyone else", async () => {
    const token = await accounts.createLoginToken("owner@alpha.test", "business", "/design");
    const session = await accounts.redeemLoginToken(token);
    expect(session).toMatchObject({ role: "business", next: "/design" });
    expect(await accounts.redeemLoginToken(token)).toBeNull();
  });

  it("adds and removes members: an email is in one business only, and the owner stays", async () => {
    expect(await repo.addMember(a, "Sam@Alpha.test", "owner@alpha.test")).toBe("added");
    expect(await repo.addMember(a, "sam@alpha.test", "owner@alpha.test")).toBe("taken");
    expect(await repo.addMember(b, "sam@alpha.test", "owner@beta.test")).toBe("taken");
    const sam = await repo.memberByEmail("sam@alpha.test");
    expect(sam).toMatchObject({ businessId: a, role: "member", termsVersion: null });
    await repo.acceptTerms(a, "sam@alpha.test", BUSINESS_TERMS_VERSION);
    expect((await repo.memberByEmail("sam@alpha.test"))?.termsVersion).toBe(BUSINESS_TERMS_VERSION);
    // A member starts able to do everything a member can: what they may do is the owner's to narrow.
    const everything = { costs: true, prices: true, publish: true };
    expect(await repo.listMembers(a)).toEqual([
      { email: "owner@alpha.test", role: "owner", joined: true, permissions: everything },
      { email: "sam@alpha.test", role: "member", joined: true, permissions: everything },
    ]);
    // The owner narrows it; another business can't; and the owner's own are never changed.
    expect(await repo.setPermissions(a, "sam@alpha.test", { costs: false, prices: false, publish: true })).toBe(true);
    expect((await repo.memberByEmail("sam@alpha.test"))?.permissions).toEqual({ costs: false, prices: false, publish: true });
    expect(await repo.setPermissions(b, "sam@alpha.test", { costs: true, prices: true, publish: true })).toBe(false);
    expect(await repo.setPermissions(a, "owner@alpha.test", { costs: false, prices: false, publish: false })).toBe(false);
    expect((await repo.memberByEmail("sam@alpha.test"))?.permissions.costs).toBe(false);
    expect((await repo.memberByEmail("owner@alpha.test"))?.permissions).toEqual(everything);
    // Another business can't remove them, or accept terms for them; the owner can't be removed at all.
    expect(await repo.removeMember(b, "sam@alpha.test")).toBe(false);
    expect(await repo.removeMember(a, "owner@alpha.test")).toBe(false);
    expect(await repo.removeMember(a, "sam@alpha.test")).toBe(true);
    expect(await repo.memberByEmail("sam@alpha.test")).toBeNull();
  });

  it("keeps each business's roofs to itself", async () => {
    const made = await repo.createProject(a, ROOF, work(ROOF), "owner@alpha.test");
    if (made === "full") throw new Error("unexpected");
    expect(made.existed).toBe(false);
    const id = made.project.id;
    expect(made.project).toMatchObject({ address: ROOF.address, lat: ROOF.lat, lng: ROOF.lng, version: 1 });

    // The other business sees nothing of it: not in its list, not at that place, not by its id.
    expect(await repo.listProjects(b)).toEqual([]);
    expect(await repo.projectAt(b, ROOF)).toBeNull();
    expect(await repo.projectById(b, id)).toBeNull();
    // And can't change or remove it, even knowing the id and the version.
    expect(await repo.saveProject(b, id, 1, work(ROOF, "Taken over"), "owner@beta.test")).toBe("missing");
    expect(await repo.deleteProject(b, id)).toBe(false);
    expect((await repo.projectById(a, id))?.design.label).toBe("First");

    // The same roof for the other business is its own, separate work.
    const theirs = await repo.createProject(b, ROOF, work(ROOF, "Beta's"), "owner@beta.test");
    if (theirs === "full") throw new Error("unexpected");
    expect(theirs.existed).toBe(false);
    expect(theirs.project.id).not.toBe(id);
    expect((await repo.projectAt(a, ROOF))?.design.label).toBe("First");
    expect((await repo.projectAt(b, ROOF))?.design.label).toBe("Beta's");
    expect((await repo.listProjects(a)).map((p) => p.id)).toEqual([id]);
  });

  it("never overwrites a roof with an out-of-date copy, or a second first save", async () => {
    const mine = (await repo.projectAt(a, ROOF))!;
    const saved = await repo.saveProject(a, mine.id, mine.version, work(ROOF, "Second"), "owner@alpha.test");
    expect(saved).toEqual({ version: mine.version + 1 });
    // A teammate still holding the first copy is told, and nothing changes.
    expect(await repo.saveProject(a, mine.id, mine.version, work(ROOF, "Stale"), "sam@alpha.test")).toBe("conflict");
    expect((await repo.projectById(a, mine.id))?.design.label).toBe("Second");
    // Opening the same address twice and saving both: the second is handed the first's work.
    const again = await repo.createProject(a, ROOF, work(ROOF, "Duplicate"), "sam@alpha.test");
    if (again === "full") throw new Error("unexpected");
    expect(again.existed).toBe(true);
    expect(again.project.id).toBe(mine.id);
    expect(again.project.design.label).toBe("Second");
  });

  it("keeps settings and price lists per business, lists apart from settings", async () => {
    expect(await repo.loadSettings(a)).toBeNull();
    const settings = cleanWorkspaceSettings({ ...DEFAULT_WORKSPACE, install: { ...DEFAULT_WORKSPACE.install } });
    settings.settings.margin = { ...settings.settings.margin };
    await repo.saveSettings(a, settings, "owner@alpha.test");
    await repo.saveList(a, list("alpha-prices.xlsx", 123), "owner@alpha.test");
    expect(await repo.loadSettings(a)).toEqual(settings);
    expect((await repo.loadLists(a)).map((l) => l.name)).toEqual(["alpha-prices.xlsx"]);
    // The other business has none of it, and a list of the same name there is its own.
    expect(await repo.loadSettings(b)).toBeNull();
    expect(await repo.loadLists(b)).toEqual([]);
    await repo.saveList(b, list("alpha-prices.xlsx", 999), "owner@beta.test");
    expect((await repo.loadLists(a))[0].items[0].cost).toBe(123);
    await repo.removeList(b, "alpha-prices.xlsx");
    expect((await repo.loadLists(a)).length).toBe(1);
    // A list of the same name replaces; past the limit the oldest go.
    await repo.saveList(a, list("alpha-prices.xlsx", 150), "owner@alpha.test");
    expect((await repo.loadLists(a))[0].items[0].cost).toBe(150);
    for (let i = 0; i < MAX_SUPPLIER_LISTS; i++) await repo.saveList(a, list(`list-${i}.csv`), "owner@alpha.test");
    const names = (await repo.loadLists(a)).map((l) => l.name);
    expect(names).toHaveLength(MAX_SUPPLIER_LISTS);
    expect(names).not.toContain("alpha-prices.xlsx");
    expect(names[0]).toBe(`list-${MAX_SUPPLIER_LISTS - 1}.csv`);
  });

  it("brings a device's work across once, without overwriting what the business has", async () => {
    const roofs = [
      { ...ROOF, ...work(ROOF, "From the device") },
      { ...ELSEWHERE, ...work(ELSEWHERE, "New roof") },
    ];
    // The business already has ROOF: only the other roof comes across, and doing it again brings nothing.
    expect(await repo.importRoofs(a, roofs, "owner@alpha.test")).toEqual([roofKey(ELSEWHERE)]);
    expect(await repo.importRoofs(a, roofs, "owner@alpha.test")).toEqual([]);
    expect((await repo.projectAt(a, ROOF))?.design.label).toBe("Second");
    expect((await repo.projectAt(a, ELSEWHERE))?.design.label).toBe("New roof");
    expect(await repo.projectAt(b, ELSEWHERE)).toBeNull();
    // Settings come across only for a business with none saved and no price lists.
    const settings = cleanWorkspaceSettings(DEFAULT_WORKSPACE);
    expect(await repo.importSettings(a, settings, "sam@alpha.test")).toBe(false);
    expect(await repo.importSettings(b, settings, "owner@beta.test")).toBe(true);
    expect(await repo.importSettings(b, settings, "owner@beta.test")).toBe(false);
  });

  it("removes everything a business has when the business goes", async () => {
    await db.query(`delete from businesses where id = $1`, [b]);
    for (const table of ["business_members", "design_settings", "design_price_lists", "design_projects"]) {
      const rows = await db.query<{ n: string }>(`select count(*) as n from ${table} where business_id = $1`, [b]);
      expect(Number(rows[0].n)).toBe(0);
    }
    expect((await repo.listProjects(a)).length).toBe(2);
  });
});
