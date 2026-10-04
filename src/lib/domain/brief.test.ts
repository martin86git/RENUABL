import { describe, expect, it } from "vitest";
import {
  BRIEF_COPY,
  BRIEF_NEXT_STEPS,
  BRIEF_QUESTIONS,
  briefAnswerLines,
  briefSms,
  briefSteps,
  cleanBriefAnswers,
  houseShares,
  isBriefKey,
  profileFromBrief,
  scoreBrief,
  solarVicLook,
} from "./brief";

const ids = (answers: Record<string, string>, state: string | null = "VIC") =>
  briefSteps(answers, state).map((s) => (s.kind === "question" ? s.id : s.kind));

describe("guided brief", () => {
  it("asks the smallest things first and ends with a call", () => {
    const steps = ids({});
    expect(steps.slice(0, 6)).toEqual(["welcome", "address", "timeframe", "date", "bill", "interest"]);
    expect(steps.indexOf("house")).toBeGreaterThan(steps.indexOf("bill"));
    expect(steps.indexOf("price")).toBeGreaterThan(steps.indexOf("phase"));
    expect(steps.slice(-3)).toEqual(["notes", "booking", "done"]);
  });

  it("asks the Solar Victoria questions only of Victorian owner-occupiers", () => {
    expect(ids({ ownership: "owner_occupier" })).toContain("sv_income");
    expect(ids({ ownership: "renting" })).not.toContain("sv_income");
    expect(ids({ ownership: "owner_occupier" }, "NSW")).not.toContain("sv_income");
    expect(ids({ ownership: "owner_occupier", interest: "battery" })).not.toContain("sv_income");
  });

  it("asks about products only when they want to choose, and only the ones their project has", () => {
    expect(ids({ products: "leave" })).not.toContain("pref_panels");
    expect(ids({ products: "choose", interest: "solar" })).toEqual(expect.arrayContaining(["pref_panels"]));
    expect(ids({ products: "choose", interest: "solar" })).not.toContain("pref_battery");
    expect(ids({ products: "choose", interest: "battery" })).not.toContain("pref_panels");
    expect(ids({ products: "choose", interest: "solar_battery" })).toEqual(expect.arrayContaining(["pref_panels", "pref_battery"]));
  });

  it("product choices show the same facts, with leave-it and something-else always there", () => {
    for (const id of ["pref_panels", "pref_battery"]) {
      const q = BRIEF_QUESTIONS.find((x) => x.id === id)!;
      const products = q.choices.filter((c) => c.facts);
      expect(products.length).toBeGreaterThan(0);
      for (const c of products) expect(c.facts!.length).toBe(products[0].facts!.length);
      expect(q.choices.map((c) => c.value)).toEqual(expect.arrayContaining(["leave", "other"]));
      // Never a dollar figure on a product.
      expect(JSON.stringify(q.choices)).not.toContain("$");
    }
  });

  it("keeps only real answers and a short note", () => {
    expect(cleanBriefAnswers({ timeframe: "asap", roof: "thatch", evil: "x", notes: " <b>hi</b> " })).toEqual({
      timeframe: "asap",
      notes: "b hi /b",
    });
  });

  it("maps answers onto the sizing profile", () => {
    expect(profileFromBrief({ roof: "tin", storeys: "more", phase: "three", interest: "solar_battery", priority: "backup" })).toEqual({
      roofType: "tin",
      storeys: "double",
      phase: "three",
      wantsBattery: true,
      backup: true,
    });
    expect(profileFromBrief({ interest: "battery" }).existingPlan).toBe("expand");
    expect(profileFromBrief({ interest: "solar" }).wantsBattery).toBe(false);
  });

  it("only says Solar Victoria looks likely when every answer says so", () => {
    expect(solarVicLook({ sv_income: "yes", sv_value: "yes", sv_history: "no" })).toBe("likely");
    expect(solarVicLook({ sv_income: "unsure", sv_value: "yes", sv_history: "no" })).toBe("check");
    expect(solarVicLook({ sv_income: "no", sv_value: "yes", sv_history: "no" })).toBe("unlikely");
    expect(solarVicLook({ sv_income: "yes", sv_value: "yes", sv_history: "yes" })).toBe("unlikely");
  });

  it("scores for staff, with flags", () => {
    const hot = scoreBrief({ answers: { timeframe: "asap", ownership: "owner_occupier" }, billRead: true, booked: true });
    expect(hot.score).toBe("hot");
    const renter = scoreBrief({
      answers: { timeframe: "3_6_months", ownership: "renting", shade: "lots" },
      billRead: false,
      booked: false,
    });
    expect(renter.score).toBe("cold");
    expect(renter.flags.join(" ")).toMatch(/Renting/);
    expect(renter.flags.join(" ")).toMatch(/shade/);
    expect(renter.flags.join(" ")).toMatch(/No bill/);
  });

  it("writes the answers in plain words for the note", () => {
    expect(briefAnswerLines({ timeframe: "asap", notes: "Can I add a battery later?" })).toEqual([
      "Timeframe: As soon as possible",
      "Their questions or notes: Can I add a battery later?",
    ]);
  });

  it("draws the house from the same rule of thumb as the savings", () => {
    const o = { dailyKwh: 20, solarKw: 6.6, yieldKwhPerKw: 3.8, batteryUsableKwh: 14.4 };
    const grid = houseShares(o, "grid");
    expect(grid).toMatchObject({ solar: 0, battery: 0, grid: 1 });
    const solar = houseShares(o, "solar");
    const battery = houseShares(o, "battery");
    expect(solar.solar).toBeGreaterThan(0);
    expect(battery.battery).toBeGreaterThan(0);
    for (const s of [solar, battery]) {
      expect(s.solar + s.battery + s.grid).toBeCloseTo(1, 5);
      expect(s.grid).toBeGreaterThanOrEqual(0.05);
    }
  });

  it("links are long random keys, and the text names RENUABL with Reply STOP", () => {
    expect(isBriefKey("a".repeat(40))).toBe(true);
    expect(isBriefKey("../etc")).toBe(false);
    const sms = briefSms({ firstName: "Sam Lee", link: "https://www.renuabl.com.au/brief/abc", from: "Martin" });
    expect(sms).toContain("Hi Sam, it's Martin from RENUABL.");
    expect(sms).toContain("Reply STOP");
  });

  it("makes no unprovable claims and never names other businesses", () => {
    const all = JSON.stringify({ BRIEF_QUESTIONS, BRIEF_COPY, BRIEF_NEXT_STEPS });
    expect(all).not.toMatch(/guarantee|exact|precise|best|leading|installer\b|primero/i);
  });
});
