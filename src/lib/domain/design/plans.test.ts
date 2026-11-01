import { describe, expect, it } from "vitest";
import {
  ENTERPRISE_FROM,
  PLAN_WORDS,
  cleanInterval,
  cleanPack,
  cleanSeats,
  dollars,
  packPriceCents,
  priceFor,
  seatPriceCents,
} from "./plans";

describe("what RENUABL costs", () => {
  it("is $29 a user a month, GST inclusive", () => {
    expect(priceFor(1, "month")).toMatchObject({ chargeCents: 2900, perMonthCents: 2900, yearCents: 34800, savedCents: 0 });
    expect(priceFor(5, "month").chargeCents).toBe(14500);
  });

  it("takes 20% off the whole package when paid for the year", () => {
    expect(seatPriceCents("year")).toBe(27840);
    // Five users: $1,740 a year monthly, $1,392 paid yearly.
    expect(priceFor(5, "year")).toMatchObject({ chargeCents: 139200, yearCents: 139200, perMonthCents: 11600, savedCents: 34800 });
    expect(PLAN_WORDS.yearlySeat).toBe("$23.20 a user a month, billed yearly");
  });

  it("signs up 1 to 12 users on the page; 13 or more is Enterprise", () => {
    expect(cleanSeats(1)).toBe(1);
    expect(cleanSeats("12")).toBe(12);
    expect(cleanSeats(ENTERPRISE_FROM)).toBeNull();
    expect(cleanSeats(0)).toBeNull();
    expect(cleanSeats(2.5)).toBeNull();
    expect(cleanSeats("two")).toBeNull();
  });

  it("sells the design tool at $3 a job in packs", () => {
    expect(packPriceCents(20)).toBe(6000);
    expect(packPriceCents(100)).toBe(30000);
    expect(cleanPack("50")).toBe(50);
    expect(cleanPack(30)).toBeNull();
    expect(PLAN_WORDS.token).toBe("$3 a job");
  });

  it("only takes the two billing intervals", () => {
    expect(cleanInterval("year")).toBe("year");
    expect(cleanInterval("week")).toBeNull();
  });

  it("writes dollars as the page shows them", () => {
    expect(dollars(2900)).toBe("$29");
    expect(dollars(2320)).toBe("$23.20");
    expect(dollars(139200)).toBe("$1,392");
  });
});
