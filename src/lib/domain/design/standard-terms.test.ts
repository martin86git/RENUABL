import { describe, expect, it } from "vitest";
import { NETCC_INFORMATION, STANDARD_TERMS, fillTerms } from "./standard-terms";

describe("the standard terms", () => {
  const everything = JSON.stringify([STANDARD_TERMS, NETCC_INFORMATION]);

  it("name no particular business, product or person", () => {
    expect(everything).not.toMatch(/primero|pylon|renuabl/i);
  });

  it("never promise a saving, an output or an approval", () => {
    expect(everything).not.toMatch(/guaranteed (saving|output|return)/i);
    expect(everything).toMatch(/estimates/);
    expect(everything).toMatch(/if you are eligible and are approved/);
  });

  it("keep the consumer guarantees that cannot be excluded", () => {
    expect(everything).toMatch(/cannot be excluded under the Australian Consumer Law/);
  });

  it("are filled with the seller's and the customer's names, and with plain words when a name is missing", () => {
    const filled = JSON.stringify(fillTerms({ seller: "Sample Solar", customer: "Alex Example" }));
    expect(filled).toContain("Sample Solar (we, us)");
    expect(filled).toContain("Alex Example (you)");
    expect(filled).not.toMatch(/\{seller\}|\{customer\}/);
    expect(JSON.stringify(fillTerms({ seller: "", customer: "" }))).toContain("the seller (we, us)");
  });

  it("number their sections in order", () => {
    STANDARD_TERMS.forEach((s, i) => expect(s.heading.startsWith(`${i + 1}. `)).toBe(true));
  });
});
