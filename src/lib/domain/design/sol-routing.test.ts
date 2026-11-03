import { describe, expect, it } from "vitest";
import { costWords, creditsFor, inboxTier, routeQuestion, solModel, SOL_MODELS, USE_TIER } from "./sol-routing";

const route = (text: string, files = 0, asked = false) => routeQuestion({ text, files, asked }).tier;

describe("routeQuestion", () => {
  it("answers everyday questions quickly", () => {
    expect(route("Find the Nguyen deal")).toBe("quick");
    expect(route("What's at proposal sent?")).toBe("quick");
    expect(route("Remind me to call Jo tomorrow at 9")).toBe("quick");
    expect(route("Show me sales this month as a chart")).toBe("quick");
    expect(route("What's Jo's phone number?")).toBe("quick");
    expect(route("Who installs on Friday?")).toBe("quick");
  });

  it("thinks deeper for writing someone will read", () => {
    expect(route("Draft a follow-up to Jo about the battery")).toBe("deep");
    expect(route("Write an email to the Smiths")).toBe("deep");
    expect(route("Help me reply to this customer")).toBe("deep");
  });

  it("thinks deeper for judgement and advice", () => {
    expect(route("Why are we losing deals at proposal?")).toBe("deep");
    expect(route("Should we offer the bigger battery here?")).toBe("deep");
    expect(route("How do I handle the price objection?")).toBe("deep");
    expect(route("Compare Sigenergy and Tesla for this home")).toBe("deep");
  });

  it("thinks deeper for files, a long question, or when asked", () => {
    expect(route("What's this?", 1)).toBe("deep");
    expect(route("x".repeat(701))).toBe("deep");
    expect(route("Think it through: export limits for AusNet")).toBe("deep");
    expect(route("Find the Nguyen deal", 0, true)).toBe("deep");
  });

  it("says why", () => {
    expect(routeQuestion({ text: "Draft an email", files: 0 }).reason).toBe("writing");
    expect(routeQuestion({ text: "Find Jo", files: 0 }).reason).toBe("everyday");
  });
});

describe("credits", () => {
  it("charges a deep answer three, a quick one one, and more when researched online", () => {
    expect(creditsFor("quick", false)).toBe(1);
    expect(creditsFor("deep", false)).toBe(3);
    expect(creditsFor("quick", true)).toBe(3);
    expect(creditsFor("deep", true)).toBe(5);
  });

  it("puts customer-facing work on the deeper model", () => {
    expect(USE_TIER.customer).toBe("deep");
    expect(USE_TIER["call-notes"]).toBe("deep");
    expect(USE_TIER.usage).toBe("quick");
    expect(inboxTier(true)).toBe("deep");
    expect(inboxTier(false)).toBe("quick");
  });

  it("says what an answer took", () => {
    expect(costWords("quick", 1)).toBe("1 credit");
    expect(costWords("deep", 3)).toBe("Deep answer · 3 credits");
  });
});

describe("solModel", () => {
  it("is Sonnet for quick and Opus for deep, unless set", () => {
    expect(solModel("quick")).toBe(SOL_MODELS.quick);
    expect(solModel("deep")).toBe(SOL_MODELS.deep);
    expect(solModel("deep", { SOL_MODEL: " claude-fable-5-1 " })).toBe("claude-fable-5-1");
    expect(solModel("quick", { SOL_QUICK_MODEL: "claude-haiku-5-5" })).toBe("claude-haiku-5-5");
    expect(solModel("quick", { SOL_MODEL: "claude-fable-5-1" })).toBe(SOL_MODELS.quick);
  });
});
