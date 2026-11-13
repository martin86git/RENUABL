import { describe, expect, it } from "vitest";
import { RAIL_CALLS_MAX, callInitials, railCallWords, railCalls } from "./rail-calls";

describe("a call's round on the rail", () => {
  it("carries the customer's initials", () => {
    expect(callInitials("Tom Example")).toBe("TE");
    expect(callInitials("  michelle  ")).toBe("M");
    expect(callInitials("Anna Maria De Luca")).toBe("AL");
    expect(callInitials("New lead (mobile 0491 570 156)")).toBe("NM");
    expect(callInitials("")).toBe("?");
    expect(callInitials("0491 570 156")).toBe("?");
  });
  it("says who, where the call stands and the deal", () => {
    const c = { customer: "Tom Example", deal: "Solar and battery", by: "Charlie" };
    expect(railCallWords({ ...c, phase: "on-call" }, "2:14")).toBe("Tom Example · on the call with Charlie · 2:14 · Solar and battery");
    expect(railCallWords({ ...c, phase: "ringing" }, null)).toBe("Tom Example · Charlie is ringing · Solar and battery");
    expect(railCallWords({ customer: "", deal: "", by: "Charlie", phase: "ringing" }, null)).toBe("A customer · Charlie is ringing");
  });
});

describe("how many calls get a round", () => {
  const calls = (n: number) => Array.from({ length: n }, (_, i) => i);
  it("shows each while they fit", () => {
    expect(railCalls(calls(0))).toEqual({ shown: [], more: 0 });
    expect(railCalls(calls(RAIL_CALLS_MAX))).toEqual({ shown: calls(RAIL_CALLS_MAX), more: 0 });
  });
  it("counts the rest past that, never as a lone +1 where a round would fit", () => {
    const { shown, more } = railCalls(calls(RAIL_CALLS_MAX + 1));
    expect(shown).toHaveLength(RAIL_CALLS_MAX - 1);
    expect(more).toBe(2);
    expect(railCalls(calls(9)).more).toBe(9 - (RAIL_CALLS_MAX - 1));
  });
});
