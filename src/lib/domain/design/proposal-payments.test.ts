import { describe, expect, it } from "vitest";
import { NOT_CONNECTED, isDueKey, nextDue, paymentsDue, platformFeeCents, takesCards } from "./proposal-payments";

const milestones = [
  { name: "On acceptance", amount: 2000 },
  { name: "On installation", amount: 8000 },
];

describe("paying from a proposal", () => {
  it("asks for the deposit first, then each milestone with the deposit taken off the first", () => {
    expect(paymentsDue({ deposit: 500, milestones })).toEqual([
      { key: "deposit", name: "Deposit", amount: 500 },
      { key: "m0", name: "On acceptance", amount: 1500 },
      { key: "m1", name: "On installation", amount: 8000 },
    ]);
  });

  it("lets a deposit larger than the first milestone run into the next, and leaves out what comes to nothing", () => {
    expect(paymentsDue({ deposit: 2500, milestones })).toEqual([
      { key: "deposit", name: "Deposit", amount: 2500 },
      { key: "m1", name: "On installation", amount: 7500 },
    ]);
  });

  it("works with only a deposit, only milestones, or neither", () => {
    expect(paymentsDue({ deposit: 999.95, milestones: [] })).toEqual([{ key: "deposit", name: "Deposit", amount: 999.95 }]);
    expect(paymentsDue({ deposit: null, milestones }).map((d) => d.key)).toEqual(["m0", "m1"]);
    expect(paymentsDue(undefined)).toEqual([]);
  });

  it("offers only the next amount due", () => {
    const dues = paymentsDue({ deposit: 500, milestones });
    expect(nextDue(dues, new Set())?.key).toBe("deposit");
    expect(nextDue(dues, new Set(["deposit"]))?.key).toBe("m0");
    expect(nextDue(dues, new Set(["deposit", "m0", "m1"]))).toBeNull();
  });

  it("takes RENUABL's 1% to the cent", () => {
    expect(platformFeeCents(50_000)).toBe(500);
    expect(platformFeeCents(99_995)).toBe(1000);
  });

  it("takes cards only from a connected, checked account with them switched on", () => {
    expect(takesCards({ connected: true, chargesEnabled: true, detailsSubmitted: true }, true)).toBe(true);
    expect(takesCards({ connected: true, chargesEnabled: true, detailsSubmitted: true }, false)).toBe(false);
    expect(takesCards({ connected: true, chargesEnabled: false, detailsSubmitted: true }, true)).toBe(false);
    expect(takesCards(NOT_CONNECTED, true)).toBe(false);
  });

  it("reads only due keys it made", () => {
    expect(isDueKey("deposit")).toBe(true);
    expect(isDueKey("m3")).toBe(true);
    expect(isDueKey("m9")).toBe(false);
    expect(isDueKey("x")).toBe(false);
  });
});
