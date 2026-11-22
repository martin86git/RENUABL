import { describe, expect, it } from "vitest";
import { HOME_SCREEN_STEPS, phoneBrowserOf } from "./home-screen";

describe("phoneBrowserOf", () => {
  it("knows an iPhone, an iPad and an Android", () => {
    expect(phoneBrowserOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1")).toBe("ios");
    expect(phoneBrowserOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", 5)).toBe("ios");
    expect(phoneBrowserOf("Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/131.0 Mobile")).toBe("android");
  });
  it("says nothing for a computer", () => {
    expect(phoneBrowserOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", 0)).toBeNull();
    expect(phoneBrowserOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0")).toBeNull();
  });
  it("names each browser's own steps", () => {
    expect(HOME_SCREEN_STEPS.ios).toContain("Add to Home Screen");
    expect(HOME_SCREEN_STEPS.android).toContain("Add to Home screen");
  });
});
