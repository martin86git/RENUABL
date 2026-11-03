/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): watching
 * job listings and equipment, and job alerts. That a person can't watch their own business's listing or item; that
 * others see how many watch, never who; that a new listing's alerts reach only people in businesses that may bid,
 * within their distance of their own base and once each; and that an item's watchers are let go when it is sold.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { cleanItemInput } from "@/lib/domain/design/trade";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-watch.test";
const B = "owner@beta-watch.test";
const C = "owner@gamma-watch.test";
const D = "owner@delta-watch.test";

describe.skipIf(!url)("watching and job alerts on the Marketplace (database)", () => {
  let db: typeof import("./db");
  let watch: typeof import("./design-market-watch-repo");
  let market: typeof import("./design-marketplace-repo");
  let a: string;
  let b: string;
  let c: string;
  let d: string;
  let listingId: string;
  let itemId: string;
  const person = (businessId: string, email: string) => ({ businessId, email });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    const crm = await import("./design-crm-repo");
    const prefs = await import("./design-after-sale-repo");
    const trade = await import("./design-trade-repo");
    market = await import("./design-marketplace-repo");
    watch = await import("./design-market-watch-repo");
    await db.query(`delete from businesses where created_by in ($1,$2,$3,$4)`, [A, B, C, D]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Installs", BUSINESS_TERMS_VERSION, "installer")).businessId;
    c = (await repo.createBusiness(C, "Gamma Installs", BUSINESS_TERMS_VERSION, "installer")).businessId;
    d = (await repo.createBusiness(D, "Delta Inspections", BUSINESS_TERMS_VERSION, "inspector")).businessId;
    // Beta works from Clayton (near the job); Gamma from Geelong (far).
    await prefs.savePrefs(b, { places: { base: { address: "Clayton VIC", lat: -37.915, lng: 145.12 } } }, B);
    await prefs.savePrefs(c, { places: { base: { address: "Geelong VIC", lat: -38.149, lng: 144.361 } } }, C);
    const address = "12 Watch Court, Glen Waverley VIC 3150";
    const customer = cleanCustomerInput({ name: "Wren Private", address, lat: -37.8765, lng: 145.1643 });
    const job = cleanJobInput({ address, lat: -37.8765, lng: 145.1643 });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, A);
    if (made === "full" || !made.job) throw new Error("unexpected");
    await db.query(`update design_jobs set stage = 'won' where business_id = $1 and id = $2`, [a, made.job.id]);
    // Alerts set before the job is listed: Beta within 50 km, Gamma within 25 km, Delta (can't bid) anywhere.
    await watch.saveAlert(person(b, B), { on: true, withinKm: 50, battery: false });
    await watch.saveAlert(person(c, C), { on: true, withinKm: 25, battery: false });
    await watch.saveAlert(person(d, D), { on: true, withinKm: null, battery: false });
    const listed = await market.createListing({ businessId: a, businessName: "Alpha Solar", email: A }, made.job.id, {
      notes: "",
      from: null,
      to: null,
      guide: null,
      openFor: 7,
    });
    if (!listed.ok) throw new Error(listed.message);
    listingId = listed.id;
    const item = cleanItemInput({
      category: "Panels",
      title: "12 × 475 W panels",
      qty: 12,
      condition: "New, in the box",
      price: 95,
      handover: "Pick up",
      description: "",
    });
    if (!item.ok) throw new Error("unexpected");
    itemId = await trade.createItem({ businessId: b, businessName: "Beta Installs", email: B }, item.value, {
      suburb: "Clayton",
      near: null,
    });
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2,$3,$4)`, [a, b, c, d]);
    await db.resetDbForTests();
  });

  it("sends a new listing's alerts only to people who may bid, within their distance of their own base", async () => {
    const found = await watch.alertRecipients(listingId);
    expect(found?.people.map((p) => p.email)).toEqual([B]);
    expect(found?.people[0].km).toBeLessThan(15);
    await watch.saveAlert(person(c, C), { on: true, withinKm: null, battery: false });
    expect((await watch.alertRecipients(listingId))?.people.map((p) => p.email).sort()).toEqual([B, C]);
    await watch.saveAlert(person(c, C), { on: true, withinKm: null, battery: true });
    expect((await watch.alertRecipients(listingId))?.people.map((p) => p.email)).toEqual([B]);
    expect(await watch.loadAlert(person(c, C))).toEqual({ on: true, withinKm: null, battery: true });
  });

  it("lets others watch a listing, never its poster, and shows how many without who", async () => {
    expect(await watch.setWatch(person(a, A), "listing", listingId, true)).toBe(false);
    expect(await watch.setWatch(person(b, B), "listing", listingId, true)).toBe(true);
    expect(await watch.setWatch(person(b, B), "listing", listingId, true)).toBe(true);
    const seenByGamma = await watch.withWatches(person(c, C), "listing", [{ id: listingId }]);
    expect(seenByGamma[0]).toEqual({ id: listingId, watching: 1, watched: false });
    const seenByBeta = await watch.withWatches(person(b, B), "listing", [{ id: listingId }]);
    expect(seenByBeta[0].watched).toBe(true);
    expect(JSON.stringify(seenByGamma)).not.toContain(B);
    await watch.setWatch(person(b, B), "listing", listingId, false);
    expect((await watch.withWatches(person(c, C), "listing", [{ id: listingId }]))[0].watching).toBe(0);
  });

  it("lets an item's watchers go when it is sold", async () => {
    expect(await watch.setWatch(person(b, B), "item", itemId, true)).toBe(false);
    expect(await watch.setWatch(person(d, D), "item", itemId, true)).toBe(true);
    expect((await watch.withWatches(person(c, C), "item", [{ id: itemId }]))[0].watching).toBe(1);
    await watch.tellItemWatchers(itemId, true);
    expect((await watch.withWatches(person(c, C), "item", [{ id: itemId }]))[0].watching).toBe(0);
  });
});
