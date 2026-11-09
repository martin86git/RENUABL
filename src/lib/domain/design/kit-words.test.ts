import { describe, expect, it } from "vitest";
import { KIT_WORDS_MAX, makerOf, panelWords, productWords } from "./kit-words";

describe("the kit in a few words", () => {
  it("names a product by its maker and model", () => {
    expect(makerOf("Sungrow 5kW Single Phase 2 MPPT Hybrid Solar Inverter")).toBe("Sungrow");
    expect(productWords("Sungrow 5kW Single Phase 2 MPPT Hybrid Solar Inverter", "SH5.0RS")).toBe("Sungrow SH5.0RS");
    expect(productWords("Tesla Powerwall 3", "")).toBe("Tesla Powerwall 3");
    expect(productWords("SigenStor SIGEN-BAT-8.0", "SIGEN-BAT-8.0")).toBe("SigenStor SIGEN-BAT-8.0");
  });
  it("cuts a long one", () => {
    expect(productWords("A very long product name that runs on and on", "").length).toBeLessThanOrEqual(KIT_WORDS_MAX);
  });
  it("says the panels as how many, the maker and the watts", () => {
    expect(panelWords(25, "Jinko Tiger Neo 475W All Black", 475)).toBe("25 × Jinko 475 W");
    expect(panelWords(0, undefined, undefined)).toBe("0 × panels");
  });
});
