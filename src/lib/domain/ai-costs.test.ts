import { describe, expect, it } from "vitest";
import { addUsage, costOfCalls, costUsd, noUsage, toMicros, usageOf } from "./ai-costs";

describe("ai costs", () => {
  it("reads the API's usage, ignoring what's missing", () => {
    const u = usageOf("claude-sonnet-5-5", {
      input_tokens: 1000,
      output_tokens: 200,
      cache_read_input_tokens: null,
      server_tool_use: { web_search_requests: 2 },
    });
    expect(u).toEqual({ model: "claude-sonnet-5-5", input: 1000, output: 200, cacheRead: 0, cacheWrite: 0, searches: 2 });
    expect(usageOf("x", undefined)).toEqual(noUsage("x"));
  });

  it("costs tokens, cache and searches at list prices", () => {
    // 10k in at $2, 1k out at $10, 50k cache read at $0.20, 4k cache write at $2.50, 1 search at 1c.
    const u = { model: "claude-sonnet-5-5", input: 10_000, output: 1_000, cacheRead: 50_000, cacheWrite: 4_000, searches: 1 };
    expect(costUsd(u)).toBeCloseTo(0.02 + 0.01 + 0.01 + 0.01 + 0.01, 6);
  });

  it("costs an unknown model as Opus, never less", () => {
    const u = { ...noUsage("claude-something-new"), input: 1e6 };
    expect(costUsd(u)).toBe(5);
  });

  it("adds calls up, each at its own model's rate", () => {
    const a = { ...noUsage("claude-sonnet-5-5"), output: 1e6 };
    const b = { ...noUsage("claude-opus-5-5"), output: 1e6 };
    expect(costOfCalls([a, b])).toBe(30);
    expect(addUsage(a, b)).toMatchObject({ model: "claude-opus-5-5", output: 2e6 });
    expect(toMicros(0.0123456)).toBe(12346);
    expect(toMicros(-1)).toBe(0);
  });
});
