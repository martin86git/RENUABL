/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): equipment
 * trading across three businesses. That an item for sale is seen by others under the seller's name only, never its id;
 * that each buyer's conversation is read only by it and the seller; that the seller replies only within a conversation
 * on its own item; that a sold item disappears from others but stays for a buyer already talking; and that photos are
 * served only for an item the business may see.
 */
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import type { ItemInput } from "@/lib/domain/design/trade";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-trade.test";
const B = "owner@beta-trade.test";
const C = "owner@gamma-trade.test";

describe.skipIf(!url)("equipment trading (database)", () => {
  let db: typeof import("./db");
  let trade: typeof import("./design-trade-repo");
  let a: string;
  let b: string;
  let c: string;
  let itemId: string;
  const who = (businessId: string, businessName: string, email: string) => ({ businessId, businessName, email });
  const input: ItemInput = {
    category: "Inverters",
    title: "Spare 5 kW inverter",
    make: "Sungrow",
    model: "SG5.0RS",
    qty: 1,
    condition: "New, opened",
    price: 650,
    handover: "Pick up",
    description: "",
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    trade = await import("./design-trade-repo");
    await db.query(`delete from businesses where created_by in ($1,$2,$3)`, [A, B, C]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Installs", BUSINESS_TERMS_VERSION)).businessId;
    c = (await repo.createBusiness(C, "Gamma Electrical", BUSINESS_TERMS_VERSION)).businessId;
    itemId = await trade.createItem(
      who(a, "Alpha Solar", A),
      input,
      trade.placeOf({ address: "1 Warehouse Way, Clayton VIC 3168", lat: -37.9171, lng: 145.1234 }),
    );
  });
  afterAll(async () => {
    await db.query(`delete from businesses where id in ($1,$2,$3)`, [a, b, c]);
    await db.resetDbForTests();
  });

  it("shows an item for sale to others under the seller's name, its place to the suburb", async () => {
    const forB = await trade.itemDetail(b, itemId);
    expect(forB?.item).toMatchObject({ business: "Alpha Solar", suburb: "Clayton", mine: false, near: { lat: -37.92, lng: 145.12 } });
    expect(JSON.stringify(forB)).not.toContain(a);
    expect(JSON.stringify(forB)).not.toContain("Warehouse");
    expect((await trade.listItems(b)).map((i) => i.id)).toContain(itemId);
  });

  it("keeps each buyer's conversation to it and the seller", async () => {
    expect(await trade.sendMessage(who(b, "Beta Installs", B), itemId, "Still available?", null)).toEqual({ ok: true });
    expect(await trade.sendMessage(who(c, "Gamma Electrical", C), itemId, "Take $500?", null)).toEqual({ ok: true });
    const seller = await trade.itemDetail(a, itemId);
    expect(seller?.conversations.map((x) => x.with).sort()).toEqual(["Beta Installs", "Gamma Electrical"]);
    expect(seller?.item.unread).toBe(2);
    const betaThread = seller!.conversations.find((x) => x.with === "Beta Installs")!.id;
    expect(await trade.sendMessage(who(a, "Alpha Solar", A), itemId, "Yes, come Friday", betaThread)).toEqual({ ok: true });
    // The seller can't write into a conversation that isn't on its own item, or with no conversation named.
    expect(await trade.sendMessage(who(a, "Alpha Solar", A), itemId, "hello", null)).toMatchObject({ ok: false });
    const forB = await trade.itemDetail(b, itemId);
    expect(forB?.conversations).toHaveLength(1);
    expect(forB?.conversations[0].messages.map((m) => [m.own, m.text])).toEqual([
      [true, "Still available?"],
      [false, "Yes, come Friday"],
    ]);
    const forC = await trade.itemDetail(c, itemId);
    expect(forC?.conversations[0].messages.map((m) => m.text)).toEqual(["Take $500?"]);
    expect(await trade.tradeUnread(b)).toBe(1);
    await trade.markThreadRead(b, forB!.conversations[0].id);
    expect(await trade.tradeUnread(b)).toBe(0);
  });

  it("hides a sold item from others but keeps it for a buyer already talking, and serves photos only where it may be seen", async () => {
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#888" } })
      .png()
      .toBuffer();
    expect(await trade.addPhotos(b, itemId, [new Uint8Array(png)])).toMatchObject({ ok: false });
    expect(await trade.addPhotos(a, itemId, [new Uint8Array(png)])).toEqual({ ok: true });
    const photoId = (await trade.itemDetail(a, itemId))!.item.photos[0];
    expect(await trade.updateItem(b, itemId, { status: "sold" })).toBe(false);
    expect(await trade.updateItem(a, itemId, { status: "sold" })).toBe(true);
    const outsider = await (await import("./design-repo")).createBusiness("owner@delta-trade.test", "Delta", BUSINESS_TERMS_VERSION);
    expect(await trade.itemDetail(outsider.businessId, itemId)).toBeNull();
    expect(await trade.tradePhoto(outsider.businessId, photoId)).toBeNull();
    expect(await trade.itemDetail(b, itemId)).not.toBeNull();
    expect((await trade.tradePhoto(b, photoId))?.contentType).toBe("image/jpeg");
    expect(await trade.sendMessage(who(outsider.businessId, "Delta", "owner@delta-trade.test"), itemId, "Any left?", null)).toMatchObject({
      ok: false,
      status: 409,
    });
    await db.query(`delete from businesses where id = $1`, [outsider.businessId]);
  });
});
