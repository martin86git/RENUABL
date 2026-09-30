import { describe, expect, it } from "vitest";
import { demoCookieValid, demoCookieValue, demoKey, demoKeyMatches } from "./demo-access";

const KEY = "a3f9c2e81b7d4f60aa12bc";
const env = { PARTNER_DEMO_KEY: KEY };

describe("private demo link", () => {
  it("needs a long key", () => {
    expect(demoKey({ PARTNER_DEMO_KEY: "short" })).toBeNull();
    expect(demoKey({})).toBeNull();
    expect(demoKey(env)).toBe(KEY);
  });

  it("opens only with the exact key", () => {
    expect(demoKeyMatches(KEY, env)).toBe(true);
    expect(demoKeyMatches(`${KEY}x`, env)).toBe(false);
    expect(demoKeyMatches(undefined, env)).toBe(false);
    expect(demoKeyMatches(KEY, {})).toBe(false);
  });

  it("keeps the live site closed to a plain demo cookie", () => {
    expect(demoCookieValid("1", { preview: false, env })).toBe(false);
    expect(demoCookieValid("1", { preview: true, env: {} })).toBe(true);
    expect(demoCookieValid(demoCookieValue(KEY), { preview: false, env })).toBe(true);
    // A new key closes demos opened with the old one.
    expect(demoCookieValid(demoCookieValue(KEY), { preview: false, env: { PARTNER_DEMO_KEY: "b".repeat(24) } })).toBe(false);
  });

  it("never stores the key itself in the cookie", () => {
    expect(demoCookieValue(KEY)).not.toContain(KEY);
  });
});
