import { describe, expect, it } from "vitest";
import { interestTitle, interestsOf, toggleInterest } from "./deal-interest";

describe("a new deal's interest", () => {
  it("names the deal from what was picked, in a set order", () => {
    expect(interestTitle(["solar"])).toBe("Solar");
    expect(interestTitle(["battery", "solar"])).toBe("Solar and battery");
    expect(interestTitle(["ev", "battery", "solar"])).toBe("Solar, battery and EV charger");
    expect(interestTitle(["ev"])).toBe("EV charger");
    expect(interestTitle(["battery", "ev"])).toBe("Battery and EV charger");
    expect(interestTitle([])).toBe("");
  });

  it("reads the choices back from a name, or says it was written another way", () => {
    expect(interestsOf("Solar and battery")).toEqual(["solar", "battery"]);
    expect(interestsOf("solar")).toEqual(["solar"]);
    expect(interestsOf("")).toEqual([]);
    expect(interestsOf("Heat pump")).toBeNull();
  });

  it("picks and unpicks one choice", () => {
    expect(toggleInterest("Solar", "battery")).toBe("Solar and battery");
    expect(toggleInterest("Solar and battery", "solar")).toBe("Battery");
    expect(toggleInterest("Heat pump", "solar")).toBe("Solar");
  });
});
