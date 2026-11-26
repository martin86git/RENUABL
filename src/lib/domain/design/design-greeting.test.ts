import { describe, expect, it } from "vitest";
import { designGreeting } from "./design-greeting";
import type { ReadinessItem } from "./readiness";

const pass: ReadinessItem[] = [{ id: "panels", state: "pass", label: "Panels", words: "12 on the roof." }];
const noInverter: ReadinessItem[] = [
  ...pass,
  { id: "inverter", state: "fix", label: "Inverter", words: "Choose an inverter for these panels." },
  { id: "pitch", state: "fix", label: "Pitch", words: "Set the roof pitch." },
];
const base = { panels: 12, items: pass, ready: true, onDeal: true };

describe("designGreeting", () => {
  it("says nothing for an empty roof or while the proposal loads", () => {
    expect(designGreeting({ ...base, panels: 0, proposal: null })).toBeNull();
    expect(designGreeting({ ...base, proposal: undefined })).toBeNull();
  });

  it("names a missing inverter", () => {
    const g = designGreeting({ ...base, items: noInverter, ready: false, proposal: undefined });
    expect(g).toEqual({ tone: "todo", title: "Design incomplete", line: "Panels are in, but no inverter yet." });
  });

  it("names the first thing to fix otherwise", () => {
    const items: ReadinessItem[] = [...pass, { id: "pitch", state: "fix", label: "Pitch", words: "Set the roof pitch." }];
    expect(designGreeting({ ...base, items, ready: false, proposal: null })?.line).toBe("Set the roof pitch.");
  });

  it("says where the proposal stands", () => {
    const at = (state: "live" | "lapsed" | "withdrawn" | "accepted", openedAt: string | null = null) =>
      designGreeting({ ...base, proposal: { state, openedAt, indicative: false } })?.line;
    expect(designGreeting({ ...base, proposal: null })?.line).toBe("Proposal pending: not sent yet.");
    expect(at("withdrawn")).toBe("Proposal pending: not sent yet.");
    expect(at("live")).toBe("Proposal published, not opened yet.");
    expect(at("live", "2026-11-20T00:00:00Z")).toBe("Proposal sent and opened by the customer.");
    expect(at("accepted")).toBe("Proposal signed.");
    expect(at("lapsed")).toBe("Proposal sent, but its price has lapsed.");
  });

  it("knows a roof with no deal has no proposal", () => {
    expect(designGreeting({ ...base, onDeal: false, proposal: undefined })?.line).toBe("Not on a deal yet, so no proposal.");
  });
});
