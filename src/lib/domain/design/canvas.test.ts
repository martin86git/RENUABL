import { describe, expect, it } from "vitest";
import { canvasFacts, canvasSystemPrompt, guessCanvas, readCanvasAnswer } from "./canvas";
import type { JobStage } from "./crm";

const job = (stage: JobStage, more: Partial<{ value: number; installDate: string; kw: number; wonAt: string }> = {}) => ({
  stage,
  details: {},
  value: more.value ?? null,
  installDate: more.installDate ?? null,
  kw: more.kw ?? null,
  wonAt: more.wonAt ?? null,
  title: "Solar",
  customerName: "Jamie Sample",
});

describe("what the canvas knows", () => {
  it("gives the journey's counts and each live job, by first name only", () => {
    const facts = canvasFacts([job("lead"), job("proposal", { value: 12345.6, kw: 6.6 }), job("lost")], 2, "2026-10-25");
    expect(facts).toContain("Today is 2026-10-25.");
    expect(facts).toContain("- Enquiries (New leads to answer): 1");
    expect(facts).toContain("- Service (Customers to look after): 2");
    expect(facts).toContain("Jamie: Solar, stop Sale, stage Proposal sent, value $12,346, 6.6 kW");
    expect(facts).not.toContain("Sample");
    expect(facts).toContain("Lost deals: 1");
  });

  it("adds up what was sold this month and this financial year", () => {
    const facts = canvasFacts(
      [
        job("won", { value: 10000, kw: 6.6, wonAt: "2026-10-03T01:00:00Z" }),
        job("installed", { value: 5000, kw: 3, wonAt: "2026-08-01T01:00:00Z" }),
      ],
      0,
      "2026-10-25",
    );
    expect(facts).toContain("Sold this month (2026-10): 1 deal, $10,000, 6.6 kW");
    expect(facts).toContain("Sold this financial year (from 2026-07-01): 2 deals, $15,000, 9.6 kW");
    expect(facts).toContain("sold 2026-10-03");
  });

  it("tells Claude to answer from the facts only, and how to ask for a panel", () => {
    const prompt = canvasSystemPrompt("Sunny Co", "FACTS");
    expect(prompt).toContain("Sunny Co");
    expect(prompt).toContain("Never invent a figure");
    expect(prompt).toContain('"SHOW: <panel>"');
    expect(prompt.endsWith("FACTS")).toBe(true);
  });
});

describe("reading an answer", () => {
  it("keeps the words and takes the panels from the last line", () => {
    expect(readCanvasAnswer("Two installs this week.\nSHOW: upcoming, today")).toEqual({
      reply: "Two installs this week.",
      show: ["upcoming", "today"],
    });
  });

  it("drops panels it doesn't know and keeps at most two", () => {
    expect(readCanvasAnswer("Hi.\nSHOW: weather journey sales completed").show).toEqual(["journey", "sales"]);
    expect(readCanvasAnswer("Nothing to show.")).toEqual({ reply: "Nothing to show.", show: [] });
  });
});

describe("without Claude", () => {
  it("picks the panel from the question's words", () => {
    expect(guessCanvas("What needs doing today?").show).toEqual(["today"]);
    expect(guessCanvas("How are sales going this month?").show).toEqual(["sales"]);
    expect(guessCanvas("What installs are coming up?").show).toEqual(["upcoming"]);
    expect(guessCanvas("Where is every job?").show).toEqual(["journey"]);
    expect(guessCanvas("Which STCs are still to claim?").show).toEqual(["completed"]);
  });

  it("says what it can show when nothing fits", () => {
    const g = guessCanvas("Tell me a joke");
    expect(g.show).toEqual([]);
    expect(g.reply).toContain("every job, from enquiry to service");
  });
});
