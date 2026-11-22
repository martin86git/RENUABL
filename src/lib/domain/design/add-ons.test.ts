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
  CANCEL_PLAN,
  cancelNoticeWords,
  hasNotice,
  noticeEnds,
  voiceTerms,
  addRefusal,
  cleanAddOnKey,
  marketingUsable,
  needsAddOn,
  voiceStanding,
} from "./add-ons";

describe("add-ons", () => {
  it("prices Calls & Texts at $49 and Growth at $19 a month (Martin, 21 Nov 2026)", () => {
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

describe("cancelling with notice", () => {
  it("keeps Calls & Texts on, and usable, while the notice runs", () => {
    const standing = addOnStanding({ own: false, row: { status: "on", stripeItem: "si_1", endsAt: "2026-12-21T00:00:00Z" } });
    expect(standing).toBe("ending");
    expect(addOnUsable(standing)).toBe(true);
  });

  it("gives every add-on 30 days' notice", () => {
    expect(hasNotice("voice")).toBe(true);
    expect(hasNotice("marketing")).toBe(true);
    expect(noticeEnds(new Date("2026-11-21T03:00:00Z")).toISOString()).toBe("2026-12-21T03:00:00.000Z");
  });

  it("tells the business what cancelling costs and what happens to the number", () => {
    const words = cancelNoticeWords({ endsAt: "2026-12-21T03:00:00Z", number: "0420 116 418" }).join(" ");
    expect(words).toContain("30 days' notice");
    expect(words).toContain("21 December");
    expect(words).toContain("0420 116 418 is released");
    expect(words).toContain("by the day");
    expect(CANCEL_PLAN).toBe("Cancel plan");
    expect(voiceTerms().join(" ")).toContain("30 days' notice");
  });

  it("tells a Growth business what stops, and says nothing of a number", () => {
    const words = cancelNoticeWords({ key: "marketing", endsAt: "2026-12-21T03:00:00Z" }).join(" ");
    expect(words).toContain("Growth has 30 days' notice");
    expect(words).toContain("stop sending");
    expect(words).not.toContain("number");
  });
});
