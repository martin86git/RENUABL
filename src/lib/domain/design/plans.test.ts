import { describe, expect, it } from "vitest";
import {
  BATTERY_EXTRA_DOLLARS,
  COMMIT_SAVING_CENTS,
  designBalanceWords,
  packDollars,
  ENTERPRISE_FROM,
  PLAN_WORDS,
  addMonthsISO,
  cleanInterval,
  cleanPack,
  cleanSeats,
  commitBillsBy,
  commitRunning,
  commitTerm,
  dollars,
  earlyExitCents,
  packPriceCents,
  planNow,
  priceFor,
} from "./plans";

describe("what RENUABL costs", () => {
  it("is $99 a user a month, GST inclusive, $29 the first month and $69 on the 12-month plan", () => {
    expect(priceFor(1, "month")).toMatchObject({ chargeCents: 9900, perMonthCents: 9900 });
    expect(priceFor(5, "month").chargeCents).toBe(49500);
    expect(COMMIT_SAVING_CENTS).toBe(3000);
    expect(PLAN_WORDS.offer).toBe("$99 a user. Your first month, $29.");
    expect(PLAN_WORDS.commit).toBe("$69 a user a month on the 12-month plan");
  });

  it("never calls the offer founding, and says what leaving early costs", () => {
    for (const w of Object.values(PLAN_WORDS)) expect(w.toLowerCase()).not.toContain("founding");
    expect(PLAN_WORDS.commitExplained).toContain("pay back what you saved");
  });

  it("runs the 12-month plan from the start of the month it's chosen, its own bills from the next", () => {
    expect(commitTerm("2026-11-03", "2026-12-03")).toEqual({ from: "2026-12-03", until: "2027-11-03" });
    expect(commitRunning("2027-11-03", "2027-11-02")).toBe(true);
    expect(commitRunning("2027-11-03", "2027-11-03")).toBe(false);
    expect(commitRunning(null, "2027-01-01")).toBe(false);
  });

  it("charges back $30 a user for each month billed at $69 on the plan, the first month free of it", () => {
    // Chosen in the first month: nothing saved yet until the second bill.
    expect(commitBillsBy("2026-12-03", "2026-12-02")).toBe(0);
    expect(commitBillsBy("2026-12-03", "2026-12-03")).toBe(1);
    expect(commitBillsBy("2026-12-03", "2027-03-10")).toBe(4);
    expect(commitBillsBy("2026-12-03", "2030-01-01")).toBe(12);
    expect(earlyExitCents(3, 4)).toBe(36000);
    expect(earlyExitCents(1, 0)).toBe(0);
  });

  it("adds months on the same day, or the last of a shorter month", () => {
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2026-11-03", 12)).toBe("2027-11-03");
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
    expect(PLAN_WORDS.token).toBe("$3 a design, $7 with a battery");
  });

  it("still reads the two billing intervals (old yearly plans)", () => {
    expect(cleanInterval("year")).toBe("year");
    expect(cleanInterval("week")).toBeNull();
  });

  it("writes dollars as the page shows them", () => {
    expect(dollars(2900)).toBe("$29");
    expect(dollars(2320)).toBe("$23.20");
    expect(dollars(139200)).toBe("$1,392");
  });
});

describe("planNow", () => {
  const day = (iso: string) => iso;
  const base = { seats: 2, interval: "month" as const, term: "flex" as const, commitFrom: null, commitUntil: null };
  it("offers the 12-month plan to a month-to-month plan at $99", () => {
    expect(planNow(base, "2026-11-10", day)).toMatchObject({ nextPerUserCents: 9900, canCommit: true, exitCents: 0 });
  });
  it("keeps $69 on the 12-month plan and says what leaving costs", () => {
    const p = { ...base, term: "commit" as const, commitFrom: "2026-12-03", commitUntil: "2027-11-03" };
    expect(planNow(p, "2027-01-10", day)).toMatchObject({ nextPerUserCents: 6900, canCommit: false, exitCents: 12000 });
    expect(planNow(p, "2027-01-10", day).termWords).toBe("12-month plan until 2027-11-03");
    // Over: month to month again, and the plan can be chosen again.
    expect(planNow(p, "2027-11-03", day)).toMatchObject({ nextPerUserCents: 9900, canCommit: true });
  });
});

describe("design jobs", () => {
  it("are $3, and $7 once a battery goes on", () => {
    expect(PLAN_WORDS.token).toBe("$3 a design, $7 with a battery");
    expect(BATTERY_EXTRA_DOLLARS).toBe(4);
    expect(packDollars(20)).toBe(60);
    expect(designBalanceWords(57)).toBe("$57 · 19 designs, or 8 with a battery");
    expect(designBalanceWords(-2)).toBe("$0 · 0 designs, or 0 with a battery");
  });
});
