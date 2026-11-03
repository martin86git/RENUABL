import { describe, expect, it } from "vitest";
import type { ISODate } from "../types";
import { collectionOf, emptyWords, inPeriod, jobSheet, kitLines, periodDays, roofProfile, sheetsFor, storeysWords } from "./my-jobs";

const today = "2026-11-04" as ISODate; // a Wednesday

describe("the periods My Jobs shows", () => {
  it("covers today, tomorrow, the Monday-to-Sunday week and the calendar month", () => {
    expect(periodDays("today", today)).toEqual({ from: "2026-11-04", to: "2026-11-04" });
    expect(periodDays("tomorrow", today)).toEqual({ from: "2026-11-05", to: "2026-11-05" });
    expect(periodDays("week", today)).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(periodDays("month", today)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(periodDays("week", "2026-11-08" as ISODate)).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(periodDays("tomorrow", "2026-12-31" as ISODate)).toEqual({ from: "2027-01-01", to: "2027-01-01" });
    expect(periodDays("month", "2028-02-10" as ISODate)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("never puts a job with no day in a period", () => {
    expect(inPeriod(null, "month", today)).toBe(false);
    expect(inPeriod("2026-11-30", "month", today)).toBe(true);
    expect(inPeriod("2026-12-01", "month", today)).toBe(false);
    expect(emptyWords("week")).toBe("No installations this week.");
  });
});

describe("a job sheet", () => {
  it("lists the kit from the design as qty × model, inverters of a model counted together", () => {
    expect(
      kitLines(
        { panels: 16, panelModel: "Jinko 475W", inverters: ["Sungrow 5kW", "Sungrow 5kW"], battery: { model: "Sigen 8kWh", modules: 2 } },
        [],
      ),
    ).toEqual([
      { kind: "panel", qty: 16, model: "Jinko 475W" },
      { kind: "inverter", qty: 2, model: "Sungrow 5kW" },
      { kind: "battery", qty: 2, model: "Sigen 8kWh" },
    ]);
  });

  it("falls back to what was typed on the deal without a design", () => {
    expect(
      kitLines(null, [
        { label: "PV panel", value: "Trina 440W" },
        { label: "Panel qty", value: "20" },
        { label: "Inverter", value: "Fronius Primo 8.2" },
      ]),
    ).toEqual([
      { kind: "panel", qty: 20, model: "Trina 440W" },
      { kind: "inverter", qty: 1, model: "Fronius Primo 8.2" },
    ]);
  });

  it("reads the roof profile and storeys in the installer's words", () => {
    expect(roofProfile("Tile")).toBe("Tile");
    expect(roofProfile("Flat")).toBe("Flat");
    expect(roofProfile("Kliplok")).toBe("Klip-lok");
    expect(roofProfile("Colorbond")).toBe("Tin");
    expect(roofProfile(null)).toBeNull();
    expect(storeysWords("Double")).toBe("Double storey");
    expect(storeysWords("Single")).toBe("Single storey");
  });

  it("collects from each wholesaler with its SO number, else the PO reference, and its collection point", () => {
    const groups = [
      { list: "AWM Clayton.xlsx", supplier: "AWM Clayton" },
      { list: "Rexel.csv", supplier: "Rexel Dandenong" },
      { list: null, supplier: null },
    ];
    expect(
      collectionOf(
        groups,
        { reference: "PO-1042", salesOrders: { "AWM Clayton.xlsx": "SO88123" } },
        {
          "AWM Clayton": { address: "1 Example Rd, Clayton VIC 3168" },
        },
      ),
    ).toEqual([
      { wholesaler: "AWM Clayton", order: "SO88123", address: "1 Example Rd, Clayton VIC 3168" },
      { wholesaler: "Rexel Dandenong", order: "PO-1042", address: null },
    ]);
  });

  it("is built from the shared job card, with sizes and the EV charger, never the customer's email", () => {
    const sheet = jobSheet({
      id: "shr_1",
      retailer: "Sunrise Solar (example)",
      card: {
        job: { address: "2 Example Way, Doncaster East VIC 3109", installDate: "2026-11-04" },
        customer: { name: "Chloe Fraser", phone: "0491 570 159" },
        details: [
          { label: "System size", value: "7.6 kW" },
          { label: "Battery storage", value: "16 kWh" },
          { label: "EV charger", value: "Yes" },
          { label: "Property storeys", value: "Double" },
          { label: "Roof type", value: "Tin" },
        ],
        roof: { lat: -37.78, lng: 145.15 },
        designed: null,
      },
      collection: [],
    });
    expect(sheet).toMatchObject({ solarKw: 7.6, batteryKwh: 16, ev: true, storeys: "Double storey", roofProfile: "Tin" });
    expect(JSON.stringify(sheet)).not.toContain("@");
  });

  it("shows a period's jobs soonest first, and lists jobs with no day apart", () => {
    const base = jobSheet({
      id: "a",
      retailer: "R",
      card: { job: { address: "", installDate: null }, customer: { name: "", phone: "" }, details: [], roof: null, designed: null },
      collection: [],
    });
    const sheets = [
      { ...base, id: "late", installDate: "2026-11-06" },
      { ...base, id: "soon", installDate: "2026-11-03" },
      { ...base, id: "next-month", installDate: "2026-12-02" },
      { ...base, id: "tbc", installDate: null },
    ];
    const week = sheetsFor(sheets, "week", today);
    expect(week.shown.map((s) => s.id)).toEqual(["soon", "late"]);
    expect(week.undated.map((s) => s.id)).toEqual(["tbc"]);
  });
});
