import { describe, expect, it } from "vitest";
import { CALLER_NAME_MAX, callerInitial, callerIntro, cleanCallerName, DEFAULT_CALLER } from "./caller";

describe("the phone assistant's name", () => {
  it("keeps a name that can be said out loud", () => {
    expect(cleanCallerName("  Ella  ")).toEqual({ ok: true, value: "Ella" });
    expect(cleanCallerName("Mary-Jane O'Neil")).toEqual({ ok: true, value: "Mary-Jane O'Neil" });
    expect(cleanCallerName("Zoë")).toEqual({ ok: true, value: "Zoë" });
  });

  it("refuses what can't be said, or is too short", () => {
    expect(cleanCallerName("R2D2").ok).toBe(false);
    expect(cleanCallerName("<script>").ok).toBe(false);
    expect(cleanCallerName("A").ok).toBe(false);
    expect(cleanCallerName(42).ok).toBe(false);
  });

  it("keeps it short", () => {
    const long = cleanCallerName("Bartholomew Montgomery");
    expect(long.ok && long.value.length).toBeLessThanOrEqual(CALLER_NAME_MAX);
  });

  it("opens a call with its name and the business, as automated and recorded", () => {
    const words = callerIntro("Ella", "Sunrise Solar");
    expect(words).toContain("It's Ella, Sunrise Solar's automated assistant");
    expect(words).toContain("recorded");
    expect(callerIntro("", "")).toContain(DEFAULT_CALLER);
  });

  it("shows an initial with no picture", () => {
    expect(callerInitial("ella")).toBe("E");
    expect(callerInitial("")).toBe("S");
  });
});
