import { describe, expect, it } from "vitest";
import { askedEmail, browseItems, cleanItemInput, cleanMessage, listedWords, priceWords, type TradeItem } from "./trade";

const item = (id: string, more: Partial<TradeItem> = {}): TradeItem => ({
  id,
  business: "Alpha Solar",
  category: "Panels",
  title: "20 × 440 W panels",
  make: "Jinko",
  model: "Tiger Neo",
  qty: 20,
  condition: "New, in the box",
  price: 120,
  handover: "Pick up",
  description: "",
  suburb: "Clayton",
  near: { lat: -37.92, lng: 145.12 },
  status: "available",
  photos: [],
  createdAt: "2026-11-01T00:00:00Z",
  mine: false,
  threads: 0,
  unread: 0,
  ...more,
});

describe("putting equipment up for sale", () => {
  it("checks what is sent, and takes contact details out of the title and description", () => {
    expect(cleanItemInput({ category: "Toasters" })).toMatchObject({ ok: false });
    expect(cleanItemInput({ category: "Panels", title: "", condition: "New, in the box", qty: 1 })).toMatchObject({ ok: false });
    expect(cleanItemInput({ category: "Panels", title: "Panels", condition: "Mint", qty: 1 })).toMatchObject({ ok: false });
    expect(cleanItemInput({ category: "Panels", title: "Panels", condition: "Used, working", qty: 0 })).toMatchObject({ ok: false });
    const ok = cleanItemInput({
      category: "Inverters",
      title: "Spare 5 kW inverter",
      make: "Sungrow",
      condition: "New, opened",
      qty: "1",
      price: "650.5",
      handover: "Can deliver",
      description: "Call 0412 345 678 or sales@example.com",
    });
    expect(ok).toMatchObject({ ok: true, value: { category: "Inverters", qty: 1, price: 650.5, handover: "Can deliver" } });
    if (ok.ok) expect(ok.value.description).toBe("Call [phone removed] or [email removed]");
    expect(cleanItemInput({ category: "Other", title: "Rail", condition: "For parts", qty: 4, price: "" })).toMatchObject({
      ok: true,
      value: { price: null, handover: "Pick up" },
    });
    expect(cleanMessage("  Still available?\n\n\n\nThanks ")).toBe("Still available?\n\nThanks");
  });
});

describe("browsing equipment", () => {
  it("shows things for sale near you, not your own, by kind and words, pending ones after", () => {
    const base = { lat: -37.92, lng: 145.12 };
    const got = browseItems(
      [
        item("mine", { mine: true }),
        item("sold", { status: "sold" }),
        item("pending", { status: "pending", createdAt: "2026-11-03T00:00:00Z" }),
        item("battery", { category: "Batteries", title: "13.5 kWh battery", make: "Tesla" }),
        item("far", { near: { lat: -33.87, lng: 151.21 } }),
        item("new", { createdAt: "2026-11-02T00:00:00Z" }),
      ],
      { base, within: 50, category: "All", search: "" },
    );
    expect(got.map((i) => i.id)).toEqual(["new", "battery", "pending"]);
    expect(
      browseItems([item("battery", { category: "Batteries", make: "Tesla" }), item("p")], {
        base,
        within: null,
        category: "Batteries",
        search: "",
      }).map((i) => i.id),
    ).toEqual(["battery"]);
    expect(
      browseItems([item("a"), item("b", { make: "Trina" })], { base, within: null, category: "All", search: "trina" }).map((i) => i.id),
    ).toEqual(["b"]);
  });

  it("says the price and when it was listed plainly", () => {
    expect(priceWords(null)).toBe("Make an offer");
    expect(priceWords(1250)).toBe("$1,250 each");
    expect(priceWords(99.5)).toBe("$99.5 each");
    const now = new Date("2026-11-04T02:00:00Z");
    expect(listedWords("2026-11-04T01:00:00Z", now)).toBe("Listed today");
    expect(listedWords("2026-11-01T01:00:00Z", now)).toBe("Listed 3 days ago");
    const e = askedEmail({ item: "spare inverter", buyer: "Beta Installs", text: "<b>Still there?</b>", link: "https://x.example/i" });
    expect(e.subject).toBe("Beta Installs asked about your spare inverter");
    expect(e.html).toContain("&lt;b&gt;");
  });
});
