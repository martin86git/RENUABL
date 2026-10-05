import { describe, expect, it } from "vitest";
import { inLaunchMarket, outsideMarketMessage } from "./address";

describe("addresses outside Victoria", () => {
  it("are turned away kindly, naming where they are", () => {
    expect(inLaunchMarket({ state: "QLD" })).toBe(false);
    expect(inLaunchMarket({ state: "vic" })).toBe(true);
    expect(outsideMarketMessage({ state: "QLD", suburb: "Brisbane City" })).toEqual({
      title: "Sorry, we're not servicing Brisbane City at this time.",
      body: "RENUABL is installing in Victoria for now. We're working on more areas and hope to be with you soon.",
    });
    expect(outsideMarketMessage({ state: "NSW", suburb: "" }).title).toBe("Sorry, we're not servicing New South Wales at this time.");
  });
});
