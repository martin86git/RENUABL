import { describe, expect, it } from "vitest";
import { cardRecoverShare } from "./quote";
import { DEFAULT_WORKSPACE, cleanSettings, withSetting } from "./pricing";

describe("card fees recovered through the price", () => {
  it("is none to start, and held to what RENUABL charges", () => {
    expect(DEFAULT_WORKSPACE.settings.cardRecover).toBe(0);
    expect(cardRecoverShare(0.05)).toBe(0.025);
    expect(cardRecoverShare(-1)).toBe(0);
    expect(cleanSettings({ cardRecover: 0.0175 }).cardRecover).toBe(0.0175);
    expect(withSetting(DEFAULT_WORKSPACE.settings, "cardRecover", 0.9).cardRecover).toBe(0.025);
  });
});
