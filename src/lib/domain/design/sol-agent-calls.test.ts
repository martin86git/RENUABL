import { describe, expect, it } from "vitest";
import { agentCallsWords, agentNamed, agentsBlock, callDay } from "./sol-agent-calls";
import type { CallLogEntry } from "./call-log";

const agents = [
  { name: "Andre", job: "sales voice agent" },
  { name: "Tim", job: "post-sale voice agent" },
];
const call = (by: string, at: string): CallLogEntry => ({
  id: at,
  jobId: "j1",
  customer: "Andrew Curwood",
  deal: "Solar",
  at,
  who: "sol",
  by,
  outcome: "talked",
  words: "Asked about batteries.",
  transcript: null,
});

describe("Sol and the business's agents", () => {
  it("names the agents as not customers", () => {
    expect(agentsBlock(agents)).toContain("Andre (sales voice agent)");
    expect(agentsBlock(agents)).toContain("agent_calls");
    expect(agentsBlock([])).toBe("");
  });
  it("finds an agent by name, not a customer's name", () => {
    expect(agentNamed(agents, "andre")?.name).toBe("Andre");
    expect(agentNamed(agents, "Andre's")?.name).toBe("Andre");
    expect(agentNamed(agents, "Sam")).toBeNull();
  });
  it("reads days", () => {
    const now = new Date("2026-11-26T01:00:00Z");
    expect(callDay("today", now)).toBe("2026-11-26");
    expect(callDay("yesterday", now)).toBe("2026-11-25");
    expect(callDay("2026-11-20")).toBe("2026-11-20");
    expect(callDay("soon")).toBeNull();
  });
  it("lists only that agent's calls on the day", () => {
    const words = agentCallsWords(
      "Andre",
      [call("Andre", "2026-11-25T23:00:00Z"), call("Andre", "2026-11-20T01:00:00Z"), call("Tim", "2026-11-25T23:30:00Z")],
      [],
      "2026-11-26",
    );
    expect(words).toContain("Made (1)");
    expect(words).toContain("Andrew Curwood");
    expect(agentCallsWords("Andre", [], [], "2026-11-26")).toContain("No calls made on 2026-11-26");
  });
});
