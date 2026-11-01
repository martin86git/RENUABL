import { describe, expect, it } from "vitest";
import {
  bidOrder,
  bidRefusal,
  browse,
  cleanBidInput,
  cleanListingInput,
  closesWords,
  publicWords,
  roughPlace,
  suburbAlone,
  systemLine,
  windowWords,
  type Bid,
  type Listing,
} from "./marketplace";

const TODAY = "2026-11-04";

const listing = (id: string, more: Partial<Listing> = {}): Listing => ({
  id,
  business: "Alpha Solar",
  title: "6.65 kW in Glen Waverley",
  suburb: "Glen Waverley",
  state: "VIC",
  postcode: "3150",
  near: { lat: -37.88, lng: 145.16 },
  system: { kw: 6.65, panels: 14, panel: "", inverter: "", batteryKwh: null, ev: false, storeys: "Single", roof: "Tile", phases: "1" },
  notes: "",
  from: null,
  to: null,
  guide: null,
  status: "open",
  closesOn: "2026-11-10",
  createdAt: "2026-11-01T00:00:00Z",
  bids: 0,
  mine: false,
  myBid: null,
  ...more,
});

describe("what a listing may show other businesses", () => {
  it("takes contact details, links and street addresses out of what is written", () => {
    const out = publicWords("Call Casey on 0412 345 678 or casey@example.com, see www.x.com. Site is 12 Hanwell Court, side gate.", 500);
    expect(out).not.toMatch(/0412|casey@|www\.|Hanwell Court/);
    expect(out).toContain("[phone removed]");
    expect(out).toContain("[email removed]");
    expect(out).toContain("[address removed]");
    expect(out).toContain("side gate");
  });

  it("shows the suburb alone, and rounds a place to about a kilometre", () => {
    expect(suburbAlone("12 Listing Court, Glen Waverley VIC 3150")).toBe("Glen Waverley");
    expect(suburbAlone("2 Hanwell Court, Glen Waverley, VIC, 3150")).toBe("Glen Waverley");
    expect(roughPlace({ lat: -37.876543, lng: 145.164321 })).toEqual({ lat: -37.88, lng: 145.16 });
  });
});

describe("listing and bidding", () => {
  it("checks a listing's window, guide and how long it is open", () => {
    expect(cleanListingInput({ from: "2026-11-01" }, TODAY)).toMatchObject({ ok: false });
    expect(cleanListingInput({ from: "2026-11-20", to: "2026-11-10" }, TODAY)).toMatchObject({ ok: false });
    expect(cleanListingInput({ guide: "abc" }, TODAY)).toMatchObject({ ok: false });
    expect(cleanListingInput({ from: "2026-11-10", guide: "2400", openFor: 14, notes: "Ring 0412345678" }, TODAY)).toEqual({
      ok: true,
      notes: "Ring [phone removed]",
      from: "2026-11-10",
      to: null,
      guide: 2400,
      openFor: 14,
    });
    expect(cleanListingInput({ openFor: 99 }, TODAY)).toMatchObject({ ok: true, openFor: 7, guide: null });
  });

  it("checks a bid, and refuses bids on your own, closed or awarded listings", () => {
    expect(cleanBidInput({ amount: "0" }, TODAY)).toMatchObject({ ok: false });
    expect(cleanBidInput({ amount: 2350, start: "2026-11-01" }, TODAY)).toMatchObject({ ok: false });
    expect(cleanBidInput({ amount: "2350", start: "2026-11-12", note: "Crew of two" }, TODAY)).toEqual({
      ok: true,
      amount: 2350,
      start: "2026-11-12",
      note: "Crew of two",
    });
    expect(bidRefusal(listing("a", { mine: true }), TODAY)).toMatch(/own/);
    expect(bidRefusal(listing("a", { status: "awarded" }), TODAY)).toMatch(/another installer/);
    expect(bidRefusal(listing("a", { closesOn: "2026-11-03" }), TODAY)).toMatch(/stopped/);
    expect(bidRefusal(listing("a"), TODAY)).toBeNull();
  });

  it("shows nearby open listings, not your own, the soonest closing first", () => {
    const base = { lat: -37.88, lng: 145.16 };
    const got = browse(
      [
        listing("far", { near: { lat: -33.87, lng: 151.21 } }),
        listing("mine", { mine: true }),
        listing("late", { closesOn: "2026-11-12" }),
        listing("soon", { closesOn: "2026-11-05" }),
        listing("closed", { closesOn: "2026-11-01" }),
      ],
      base,
      50,
      TODAY,
    );
    expect(got.map((l) => l.id)).toEqual(["soon", "late"]);
    expect(got[0].km).toBe(0);
  });

  it("orders bids for the poster, and says things plainly", () => {
    const bid = (id: string, amount: number, status: Bid["status"] = "open", start: string | null = null): Bid => ({
      id,
      listingId: "l",
      business: id,
      amount,
      start,
      note: "",
      status,
      at: "",
    });
    expect(bidOrder([bid("a", 3000), bid("b", 2500, "withdrawn"), bid("c", 2800)]).map((b) => b.id)).toEqual(["c", "a", "b"]);
    expect(closesWords(listing("a", { closesOn: TODAY }), TODAY)).toBe("Closes today");
    expect(closesWords(listing("a"), TODAY)).toBe("Closes in 6 days");
    expect(systemLine({ ...listing("a").system, batteryKwh: 13.5, ev: true })).toBe("6.65 kW · 14 panels · 13.5 kWh battery · EV charger");
    expect(windowWords("2026-11-10", "2026-11-20")).toBe("10 Nov to 20 Nov");
    expect(windowWords(null, null)).toBe("Flexible dates");
  });
});
