import { describe, expect, it } from "vitest";
import { VERIFIED_RATES } from "@/lib/domain/rebates";
import { stcSplit, stcValue } from "./quote";

describe("stcSplit", () => {
  it("splits the STCs into the panels' and the battery's, adding up to the total", () => {
    const system = { pvKw: 6.6, batteryKwh: 16 };
    const split = stcSplit(system, "3150", "2026-11-22", VERIFIED_RATES, 38);
    expect(split.solar.certificates).toBeGreaterThan(0);
    expect(split.battery.certificates).toBeGreaterThan(0);
    expect(split.solar.value + split.battery.value).toBe(split.total);
    expect(split.total).toBe(stcValue(system, "3150", "2026-11-22", VERIFIED_RATES, 38));
  });

  it("has no battery certificates without a battery", () => {
    const split = stcSplit({ pvKw: 6.6, batteryKwh: 0 }, "3150", "2026-11-22", VERIFIED_RATES, 38);
    expect(split.battery).toEqual({ certificates: 0, value: 0 });
  });
});
