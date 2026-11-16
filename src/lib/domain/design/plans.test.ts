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
  packBonus,
  packPriceCents,
  packWords,
  planNow,
  priceFor,
} from "./plans";

describe("what RENUABL costs", () => {
  it("is $49 a user a month, GST inclusive, the first month free and $39 on the 12-month plan", () => {
    expect(priceFor(1, "month")).toMatchObject({ chargeCents: 4900, perMonthCents: 4900 });
    expect(priceFor(5, "month").chargeCents).toBe(24500);
    expect(COMMIT_SAVING_CENTS).toBe(1000);
    expect(PLAN_WORDS.offer).toBe("$49 a user a month. Your first month is free.");
    expect(PLAN_WORDS.commit).toBe("$39 a user a month on the 12-month plan");
    expect(PLAN_WORDS.startExplained).not.toContain("$0");
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

  it("charges back $10 a user for each month billed at $39 on the plan", () => {
    // Chosen in the first month: nothing saved yet until the second bill.
    expect(commitBillsBy("2026-12-03", "2026-12-02")).toBe(0);
    expect(commitBillsBy("2026-12-03", "2026-12-03")).toBe(1);
    expect(commitBillsBy("2026-12-03", "2027-03-10")).toBe(4);
    expect(commitBillsBy("2026-12-03", "2030-01-01")).toBe(12);
    expect(earlyExitCents(3, 4)).toBe(12000);
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

  it("sells design credits in packs, the bigger ones with bonus credits", () => {
    expect(packPriceCents(60)).toBe(6000);
    expect(packPriceCents(600)).toBe(60000);
    expect([60, 150, 300, 600].map((p) => packDollars(p as 60))).toEqual([60, 165, 345, 720]);
    expect(packBonus(60)).toBe(0);
    expect(packWords(150)).toBe("165 credits · $150 · +15 bonus");
    expect(cleanPack("150")).toBe(150);
    expect(cleanPack(20)).toBeNull();
    expect(PLAN_WORDS.token).toBe("3 credits a site, 7 with a battery");
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
  it("offers the 12-month plan to a month-to-month plan at $49", () => {
    expect(planNow(base, "2026-11-10", day)).toMatchObject({ nextPerUserCents: 4900, canCommit: true, exitCents: 0 });
  });
  it("keeps $39 on the 12-month plan and says what leaving costs", () => {
    const p = { ...base, term: "commit" as const, commitFrom: "2026-12-03", commitUntil: "2027-11-03" };
    expect(planNow(p, "2027-01-10", day)).toMatchObject({ nextPerUserCents: 3900, canCommit: false, exitCents: 4000 });
    expect(planNow(p, "2027-01-10", day).termWords).toBe("12-month plan until 2027-11-03");
    // Over: month to month again, and the plan can be chosen again.
    expect(planNow(p, "2027-11-03", day)).toMatchObject({ nextPerUserCents: 4900, canCommit: true });
  });
});

describe("design credits", () => {
  it("are 3 a site, and 4 more once a battery goes on", () => {
    expect(BATTERY_EXTRA_DOLLARS).toBe(4);
    expect(designBalanceWords(57)).toBe("57 credits · 19 sites, or 8 with a battery");
    expect(designBalanceWords(-2)).toBe("0 credits · 0 sites, or 0 with a battery");
  });
});
