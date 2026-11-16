/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): add-ons to a
 * business's plan and its own phone number (domain/design/add-ons.ts). That an add-on asked for isn't usable until it is
 * switched on, that marketing follows the add-on, that a number routes back to its own business only, and that ending
 * voice releases the number.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-addons.test";
const B = "owner@beta-addons.test";

describe.skipIf(!url)("add-ons and business numbers (database)", () => {
  let db: typeof import("./db");
  let addons: typeof import("./design-addons");
  let numbers: typeof import("./business-numbers");
  let marketing: typeof import("./marketing-access");
  let a: string;
  let b: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.RENUABL_CRM_EMAIL;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    addons = await import("./design-addons");
    numbers = await import("./business-numbers");
    marketing = await import("./marketing-access");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Solar", BUSINESS_TERMS_VERSION)).businessId;
  });
  afterAll(async () => {
    await db.query(`delete from design_subscriptions where id = $1`, ["sub-row-alpha"]);
    await db.query(`delete from businesses where created_by in ($1,$2)`, [A, B]);
  });

  it("asks for an unpriced add-on without switching it on, once, then switches it on and ends it", async () => {
    expect(await addons.standingOf(a, "marketing")).toBe("off");
    expect(await marketing.marketingOn(a)).toBe(false);
    expect(await addons.requestAddOn(a, "marketing", A)).toBe(true);
    expect(await addons.requestAddOn(a, "marketing", A)).toBe(false);
    expect(await addons.standingOf(a, "marketing")).toBe("requested");
    expect(await marketing.marketingOn(a)).toBe(false);
    expect((await addons.addOnsAskedFor()).some((r) => r.businessId === a && r.key === "marketing")).toBe(true);

    await addons.switchOn(a, "marketing", "staff@renuabl.test");
    expect(await addons.standingOf(a, "marketing")).toBe("on");
    expect(await marketing.marketingOn(a)).toBe(true);
    expect(await addons.hasAddOn(a, "marketing")).toBe(true);
    // Another business is untouched.
    expect(await marketing.marketingOn(b)).toBe(false);

    await addons.endAddOn(a, "marketing");
    expect(await addons.standingOf(a, "marketing")).toBe("off");
    // Asked for again after ending.
    expect(await addons.requestAddOn(a, "marketing", A)).toBe(true);
    await addons.endAddOn(a, "marketing");
  });

  it("routes a business's own number back to it, and releases it when voice ends", async () => {
    expect(await numbers.numberOf(a)).toBeNull();
    await addons.switchOn(a, "voice", "staff@renuabl.test");
    expect(await numbers.attachNumber(a, { e164: "0412 000 111", vapiId: "vapi-alpha", by: "staff@renuabl.test" })).toBe("ok");
    expect(await numbers.attachNumber(b, { e164: "not a number", vapiId: null, by: "staff@renuabl.test" })).toBe("bad-number");
    expect(await numbers.numberOf(a)).toEqual({ e164: "+61412000111", vapiId: "vapi-alpha", renuabl: false });
    expect(await numbers.numberOf(b)).toBeNull();
    expect(await numbers.businessOfNumber({ vapiId: "vapi-alpha" })).toBe(a);
    expect(await numbers.businessOfNumber({ e164: "+61412000111" })).toBe(a);
    expect(await numbers.businessOfNumber({ e164: "0412 000 111" })).toBe(a);
    expect(await numbers.businessOfNumber({ vapiId: "someone-else" })).toBeNull();

    await addons.endAddOn(a, "voice");
    expect(await numbers.numberOf(a)).toBeNull();
    expect(await numbers.businessOfNumber({ vapiId: "vapi-alpha" })).toBeNull();
  });

  it("keeps charged add-ons in step with the Stripe subscription", async () => {
    await db.query(
      `insert into design_subscriptions (id, email, business_id, stripe_subscription, status, billing_interval, seats)
       values ($1, $2, $3, $4, 'active', 'month', 1)`,
      ["sub-row-alpha", A, a, "sub_alpha"],
    );
    await addons.syncAddOnsFromStripe(
      "sub_alpha",
      [
        { id: "si_seats", addon: undefined },
        { id: "si_mkt", addon: "marketing" },
      ],
      false,
    );
    expect(await addons.standingOf(a, "marketing")).toBe("on");
    await addons.syncAddOnsFromStripe("sub_alpha", [{ id: "si_seats", addon: undefined }], false);
    expect(await addons.standingOf(a, "marketing")).toBe("off");
    // Switched on by staff without a charge: left alone when the plan ends.
    await addons.switchOn(a, "custom-proposals", "staff@renuabl.test");
    await addons.syncAddOnsFromStripe("sub_alpha", [], true);
    expect(await addons.standingOf(a, "custom-proposals")).toBe("on");
  });
});
