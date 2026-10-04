import { afterEach, describe, expect, it, vi } from "vitest";
import { ASK_FACTS } from "@/lib/domain/ask-knowledge";
import { askRenuabl } from "./ask";

afterEach(() => vi.unstubAllGlobals());

// Without the server (or when Claude fails), the reviewed answers are used.
const offline = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );

describe("Ask Revo and the bill", () => {
  it("tells Claude the bill is the most accurate and a spend range is indicative", () => {
    const fact = ASK_FACTS.find((f) => f.startsWith("Two ways to continue"));
    expect(fact).toContain("the most accurate");
    expect(fact).toContain("indicative");
    expect(fact).toContain("Never say a spend range is as accurate as the bill");
  });

  it.each(["I don't have my bill handy", "Can I continue without a bill?", "can I skip the bill", "I lost my bill"])(
    "offers the spend range and how to get the bill: %s",
    async (q) => {
      offline();
      const { answer } = await askRenuabl(q, "profile");
      expect(answer).toContain("indicative plan");
      expect(answer).toContain("most accurate");
      expect(answer).toMatch(/retailer's app/);
    },
  );

  it("still explains why the bill is needed", async () => {
    offline();
    expect((await askRenuabl("Why do you need my bill?", "profile")).answer).toContain("how much power your home really uses");
  });

  it("calls heat pumps and reverse-cycle coming soon, not quoted on the call", async () => {
    offline();
    const { answer } = await askRenuabl("Can I get a heat pump?", "extras");
    expect(answer).toContain("coming soon");
  });
});
