import { describe, expect, it } from "vitest";
import {
  alike,
  cleanPoints,
  marginCheck,
  priceAdvice,
  priceAgainstSigned,
  signedAgainstQuiet,
  typedCostFlags,
  type PricePoint,
} from "./price-check";
import { lineKey, type CostLine } from "./quote";

const today = new Date("2026-11-18T00:00:00Z");
const point = (over: Partial<PricePoint>): PricePoint => ({
  jobId: "job_1",
  kw: 6.6,
  batteryKwh: 0,
  youPay: 6.6 * 1000 * 1.7,
  marginShare: 0.2,
  signed: true,
  quiet: false,
  at: "2026-10-01T00:00:00.000Z",
  costs: [],
  ...over,
});
const signedAt = (perW: number, i: number) => point({ jobId: `job_s${i}`, youPay: 6.6 * 1000 * perW });

describe("Sol's price check", () => {
  it("compares only systems of the same kind and about the same size", () => {
    expect(alike({ kw: 6.6, batteryKwh: 0 }, { kw: 8, batteryKwh: 0 })).toBe(true);
    expect(alike({ kw: 6.6, batteryKwh: 0 }, { kw: 13, batteryKwh: 0 })).toBe(false);
    expect(alike({ kw: 6.6, batteryKwh: 13.5 }, { kw: 6.6, batteryKwh: 0 })).toBe(false);
    expect(alike({ kw: 6.6, batteryKwh: 16 }, { kw: 7, batteryKwh: 40 })).toBe(false);
  });

  it("says there aren't enough signed jobs rather than judging", () => {
    const got = priceAgainstSigned({ kw: 6.6, batteryKwh: 0, youPay: 10_000, marginShare: 0.15 }, [signedAt(1.7, 1)], today);
    expect(got?.tone).toBe("info");
    expect(got?.text).toContain("Not enough signed solar-only jobs this size to compare yet (1 of 5)");
  });

  it("sets the price per watt against the middle of signed jobs this size", () => {
    const points = [1.6, 1.65, 1.7, 1.75, 1.8].map(signedAt);
    const got = priceAgainstSigned({ kw: 6.6, batteryKwh: 0, youPay: 6.6 * 1000 * 1.5, marginShare: 0.15 }, points, today);
    expect(got?.tone).toBe("warn");
    expect(got?.text).toBe(
      "$1.50/W after STCs, 12% below your last 5 signed solar-only jobs this size ($1.70/W; the middle half $1.65/W–$1.75/W).",
    );
    const inLine = priceAgainstSigned({ kw: 6.6, batteryKwh: 0, youPay: 6.6 * 1000 * 1.72, marginShare: 0.2 }, points, today);
    expect(inLine?.tone).toBe("ok");
  });

  it("leaves out proposals more than a year old", () => {
    const old = [1, 2, 3, 4, 5].map((i) => point({ jobId: `o${i}`, at: "2025-06-01T00:00:00.000Z" }));
    expect(priceAgainstSigned({ kw: 6.6, batteryKwh: 0, youPay: 9000, marginShare: 0.2 }, old, today)?.tone).toBe("info");
  });

  it("flags a typed cost far from the price list, then from what it was costed at before", () => {
    const listed: CostLine = { group: "Battery", label: "1 × Module", qty: 1, amount: 3420, sku: "SIG8" };
    const unlisted: CostLine = { group: "Inverters", label: "1 × Controller", qty: 1, amount: 0, sku: "SIGC", missing: true };
    const edits = { [lineKey(listed)]: { amount: 3000 }, [lineKey(unlisted)]: { amount: 2000 } };
    const before = [point({ at: "2026-11-06T00:00:00.000Z", costs: [{ sku: "SIGC", each: 2450 }] })];
    const flags = typedCostFlags([listed, unlisted], edits, before);
    expect(flags[lineKey(listed)]).toBe("Typed $3,000 each; your price list has $3,420.");
    expect(flags[lineKey(unlisted)]).toBe("Typed $2,000 each; you costed it at $2,450 on 6 Nov.");
    // Close enough says nothing.
    expect(typedCostFlags([listed], { [lineKey(listed)]: { amount: 3300 } }, before)).toEqual({});
  });

  it("warns under the business's floor, at the quarter's lowest, and against signed margins", () => {
    const points = [0.18, 0.2, 0.21, 0.22, 0.25].map((m, i) => point({ jobId: `m${i}`, marginShare: m }));
    const got = marginCheck({ kw: 6.6, batteryKwh: 0, youPay: 10_000, marginShare: 0.15 }, points, 0.18, today);
    expect(got.map((a) => a.text)).toEqual([
      "15% margin is under your 18% floor.",
      "The lowest margin of anything you've sent this quarter (5 proposals).",
      "15% margin; your 5 signed jobs this year sit at 21% in the middle.",
    ]);
    expect(marginCheck({ kw: 6.6, batteryKwh: 0, youPay: 10_000, marginShare: 0.2 }, points, 0, today).every((a) => a.tone === "ok")).toBe(
      true,
    );
  });

  it("finds the price above which nothing signed, once there are enough of each", () => {
    const signed = [1.6, 1.65, 1.7, 1.75, 1.8].map(signedAt);
    const quiet = [1.7, 1.95, 2.0, 2.1, 2.2].map((w, i) => point({ jobId: `q${i}`, signed: false, quiet: true, youPay: 6.6 * 1000 * w }));
    const got = signedAgainstQuiet({ kw: 6.6, batteryKwh: 0, youPay: 6.6 * 1000 * 1.98, marginShare: 0.2 }, [...signed, ...quiet], today);
    expect(got?.tone).toBe("warn");
    expect(got?.text).toBe("Above $1.80/W none of your solar-only proposals this size signed (4 went quiet). This one is above that.");
    expect(signedAgainstQuiet({ kw: 6.6, batteryKwh: 0, youPay: 11_000, marginShare: 0.2 }, signed, today)).toBeNull();
  });

  it("leaves the quote's own deal out, and puts a floor warning first", () => {
    const points = [1.6, 1.65, 1.7, 1.75].map(signedAt).concat(point({ jobId: "job_here" }));
    const got = priceAdvice({ kw: 6.6, batteryKwh: 0, youPay: 11_000, marginShare: 0.1 }, points, 0.15, today, "job_here");
    expect(got[0].text).toContain("under your 15% floor");
    expect(got[1].text).toContain("(4 of 5)");
  });

  it("keeps only well-formed points from outside", () => {
    expect(cleanPoints([{ kw: 6.6, youPay: 9000, marginShare: 0.2, at: "2026-10-01" }, { kw: "x" }, null])).toHaveLength(1);
  });
});
