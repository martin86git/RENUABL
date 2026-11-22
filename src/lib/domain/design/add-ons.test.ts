import { describe, expect, it } from "vitest";
import {
  ADD_ON_KEYS,
  ADD_ON_MONTHLY_CENTS,
  ADD_ON_WORDS,
  addOnAction,
  addOnPriceWords,
  addOnRequestNote,
  addOnStanding,
  addOnUsable,
  addRefusal,
  cleanAddOnKey,
  marketingUsable,
  needsAddOn,
  voiceStanding,
} from "./add-ons";

describe("add-ons", () => {
  it("prices Calls & Texts at $49 (Martin, 22 Nov 2026) and Growth at $19 a month", () => {
    expect(ADD_ON_MONTHLY_CENTS).toEqual({ voice: 4900, marketing: 1900 });
    expect(addOnPriceWords("voice")).toBe("$49 a month for your business, including GST");
    expect(addOnPriceWords("voice", null)).toBe("Price on request");
    expect(addOnPriceWords("voice", 4900)).toBe("$49 a month for your business, including GST");
    expect(addOnPriceWords("marketing", 1950)).toBe("$19.50 a month for your business, including GST");
  });

  it("reads keys strictly", () => {
    expect(cleanAddOnKey("voice")).toBe("voice");
    expect(cleanAddOnKey("marketing")).toBe("marketing");
    expect(cleanAddOnKey("sol")).toBeNull();
    expect(cleanAddOnKey(undefined)).toBeNull();
  });

  it("gives RENUABL's own business every add-on, and others only what is on their plan", () => {
    expect(addOnStanding({ own: true, row: null })).toBe("included");
    expect(addOnStanding({ own: false, row: null })).toBe("off");
    expect(addOnStanding({ own: false, row: { status: "requested", stripeItem: null } })).toBe("requested");
    expect(addOnStanding({ own: false, row: { status: "on", stripeItem: "si_1" } })).toBe("on");
    expect(addOnUsable("included")).toBe(true);
    expect(addOnUsable("on")).toBe(true);
    expect(addOnUsable("requested")).toBe(false);
    expect(addOnUsable("off")).toBe(false);
  });

  it("buys a priced add-on, asks for an unpriced one, and does nothing once on or asked for", () => {
    expect(addOnAction("off", null)).toBe("request");
    expect(addOnAction("off", 4900)).toBe("buy");
    expect(addOnAction("requested", null)).toBe("none");
    expect(addOnAction("on", 4900)).toBe("none");
    expect(addOnAction("included", null)).toBe("none");
  });

  it("lets only a retailer's owner add one, and needs a monthly plan only to charge", () => {
    const base = { owner: true, retailer: true, plan: "monthly" as const, cents: 4900 };
    expect(addRefusal(base)).toBeNull();
    expect(addRefusal({ ...base, owner: false })).toBe("not-owner");
    expect(addRefusal({ ...base, retailer: false })).toBe("retailers-only");
    expect(addRefusal({ ...base, plan: "none" })).toBe("no-plan");
    expect(addRefusal({ ...base, plan: "yearly" })).toBe("not-monthly");
    expect(addRefusal({ ...base, plan: "none", cents: null })).toBeNull();
  });

  it("switches calls on only with the add-on and a number, except for RENUABL's own business", () => {
    const base = { settings: true, own: false, addOn: true, number: true };
    expect(voiceStanding(base)).toBe("on");
    expect(voiceStanding({ ...base, settings: false })).toBe("not-set-up");
    expect(voiceStanding({ ...base, addOn: false })).toBe("add-on");
    expect(voiceStanding({ ...base, number: false })).toBe("number");
    expect(voiceStanding({ settings: true, own: true, addOn: false, number: false })).toBe("on");
    expect(voiceStanding({ settings: false, own: true, addOn: false, number: false })).toBe("not-set-up");
  });

  it("gives marketing to retailers with the add-on only", () => {
    expect(marketingUsable({ retailer: true, standing: "on" })).toBe(true);
    expect(marketingUsable({ retailer: true, standing: "included" })).toBe(true);
    expect(marketingUsable({ retailer: true, standing: "requested" })).toBe(false);
    expect(marketingUsable({ retailer: false, standing: "on" })).toBe(false);
  });

  it("words its offers plainly, with no price or claim it can't back", () => {
    for (const key of ADD_ON_KEYS) {
      const w = ADD_ON_WORDS[key];
      expect(w.name.length).toBeGreaterThan(3);
      expect(`${w.what} ${w.includes.join(" ")}`).not.toMatch(/\$|best|guarantee|unlimited|free/i);
      expect(needsAddOn(key)).toContain("Settings → Billing");
    }
    const note = addOnRequestNote({ key: "voice", business: "Sunrise Solar", by: "sam@example.com" });
    expect(note).toContain("Calls & Texts");
    expect(note).toContain("/admin");
  });
});
