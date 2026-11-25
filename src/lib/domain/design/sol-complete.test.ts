import { describe, expect, it } from "vitest";
import { completionFor } from "./sol-complete";

describe("completionFor", () => {
  const phrases = ["Who should I call first today?", "Which proposals have gone quiet?", "Draft a text to"];

  it("offers the rest of a phrase that starts the same way, in any case", () => {
    expect(completionFor("who sh", phrases)).toBe("ould I call first today?");
    expect(completionFor("WHICH pro", phrases)).toBe("posals have gone quiet?");
  });

  it("waits for three letters and stops at a finished sentence", () => {
    expect(completionFor("wh", phrases)).toBe("");
    expect(completionFor("Who should I call first today?", phrases)).toBe("");
    expect(completionFor("anything else.", phrases)).toBe("");
  });

  it("completes the last sentence only", () => {
    expect(completionFor("Thanks. Draft a t", phrases)).toBe("ext to");
  });

  it("offers nothing that doesn't match", () => {
    expect(completionFor("zebra", phrases)).toBe("");
  });

  it("has the built-in phrases to hand", () => {
    expect(completionFor("Which new lea")).toBe("ds has nobody contacted yet?");
  });
});
