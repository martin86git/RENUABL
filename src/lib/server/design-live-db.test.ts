/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): live
 * co-design. That a roof has one open link, reused; that only the business pushes to it; that the customer's side
 * holds only the snapshot and the business's name; that a choice is only one they were shown, written on the deal;
 * and that an ended link takes nothing more.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-live.test";
const B = "owner@beta-live.test";
const square: [number, number][] = [
  [300, 190],
  [310, 190],
  [310, 205],
  [300, 205],
];

describe.skipIf(!url)("live co-design (database)", () => {
  let db: typeof import("./db");
  let live: typeof import("./design-live-repo");
  let crm: typeof import("./design-crm-repo");
  let a: string;
  let b: string;
  let jobId: string;
  let customerId: string;
  let token: string;
  const place = { lat: -37.9, lng: 145.1 };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    crm = await import("./design-crm-repo");
    live = await import("./design-live-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION, "retailer")).businessId;
    b = (await repo.createBusiness(B, "Beta Solar", BUSINESS_TERMS_VERSION, "retailer")).businessId;
    const customer = cleanCustomerInput({ name: "Casey Live", email: "casey.live@example.com", address: "" });
    const job = cleanJobInput({ address: "" });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, A);
    if (made === "full" || !made.job) throw new Error("unexpected");
    jobId = made.job.id;
    customerId = made.customer.id;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2)`, [a, b]);
    await db.resetDbForTests();
  });

  it("opens one link a roof, and gives the same one back", async () => {
    const first = await live.startLive(a, { ...place, jobId }, A);
    if (first === "missing") throw new Error("unexpected");
    token = first.token;
    expect(token).toMatch(/^[a-f0-9]{48}$/);
    const again = await live.startLive(a, { ...place, jobId }, A);
    expect(again !== "missing" && again.token).toBe(token);
    // Another business's deal isn't there for this one.
    expect(await live.startLive(b, { ...place, jobId }, B)).toBe("missing");
  });

  it("takes a snapshot only from its own business, and shows the customer nothing else", async () => {
    const snapshot = {
      active: 0,
      designs: [
        { at: 0, name: "Solar only", kw: 6.65, panels: 14, youPay: 5200, cost: 3000, outlines: [square] },
        { at: 1, name: "With a battery", kw: 6.65, panels: 14, batteryKwh: 16, youPay: 12100, outlines: [square] },
      ],
    };
    expect(await live.pushLive(b, token, snapshot)).toBe(false);
    expect(await live.pushLive(a, token, snapshot)).toBe(true);
    const seen = await live.liveByToken(token, true);
    expect(seen?.business).toBe("Alpha Solar");
    expect(seen?.open).toBe(true);
    expect(seen?.snapshot?.designs).toHaveLength(2);
    expect(JSON.stringify(seen?.snapshot)).not.toMatch(/cost/);
    expect((await live.liveStatus(a, token))?.seenAt).not.toBeNull();
    expect(await live.liveStatus(b, token)).toBeNull();
  });

  it("takes only a choice the customer was shown, and writes it on the deal", async () => {
    expect(await live.chooseLive(token, 7)).toBeNull();
    expect(await live.chooseLive(token, 1)).toBe(1);
    expect((await live.liveStatus(a, token))?.choice).toBe(1);
    const found = await crm.customerDetail(a, customerId);
    expect(JSON.stringify(found?.activity)).toContain("On the live design, the customer chose With a battery.");
  });

  it("closes when ended", async () => {
    expect(await live.endLive(b, token)).toBe(false);
    expect(await live.endLive(a, token)).toBe(true);
    expect((await live.liveByToken(token))?.open).toBe(false);
    expect(await live.chooseLive(token, 0)).toBe("closed");
    expect(await live.pushLive(a, token, { designs: [] })).toBe(false);
    // A new link for the roof once the old one has ended.
    const next = await live.startLive(a, { ...place, jobId }, A);
    expect(next !== "missing" && next.token).not.toBe(token);
  });
});
