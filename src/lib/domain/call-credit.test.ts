import { describe, expect, it } from "vitest";
import { OUT_OF_CALL_CREDIT, outOfCallCredit } from "./call-credit";

describe("a call turned away for want of credit", () => {
  it("reads the phone service's own words", () => {
    expect(outOfCallCredit("Vapi 400: Your Wallet Balance is -0.07. Please add credits.")).toBe(true);
    expect(outOfCallCredit("Insufficient credits to start the call")).toBe(true);
  });

  it("leaves every other refusal alone", () => {
    expect(outOfCallCredit("Vapi 400: startSpeakingPlan.waitSeconds must not be greater than 5")).toBe(false);
    expect(outOfCallCredit("Vapi didn't answer")).toBe(false);
    expect(outOfCallCredit(null)).toBe(false);
    expect(outOfCallCredit(undefined)).toBe(false);
  });

  it("says nothing went out, and doesn't ask them to try again", () => {
    expect(OUT_OF_CALL_CREDIT).toContain("No call went out");
    expect(OUT_OF_CALL_CREDIT.toLowerCase()).not.toContain("try again");
  });
});
