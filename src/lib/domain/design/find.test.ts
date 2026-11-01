import { describe, expect, it } from "vitest";
import { digitsOf, looksLikePhone, looksLikeQuestion, matches } from "./find";

const casey = { words: ["Casey Demo", "casey@example.com", "31 Mock Lane, Geelong VIC 3220"], phone: "+61 423 111 222" };

describe("finding a customer", () => {
  it("matches a number as it is typed, from the fourth digit, however it was written", () => {
    expect(digitsOf("+61 423 111 222")).toBe("0423111222");
    expect(matches(casey, "042")).toBe(false);
    expect(matches(casey, "0423")).toBe(true);
    expect(matches(casey, "111 222")).toBe(true);
    expect(matches(casey, "0499")).toBe(false);
  });

  it("needs every word typed somewhere in the name, email or address", () => {
    expect(matches(casey, "casey geelong")).toBe(true);
    expect(matches(casey, "casey sydney")).toBe(false);
    expect(matches(casey, "c")).toBe(false);
  });

  it("tells a number from words", () => {
    expect(looksLikePhone("(03) 9555-1234")).toBe(true);
    expect(looksLikePhone("3 Bill Place")).toBe(false);
  });
});

describe("asking Sol from the search", () => {
  it("reads a question or a request as one for Sol", () => {
    expect(looksLikeQuestion("which deals should I chase?")).toBe(true);
    expect(looksLikeQuestion("draft a follow up for Casey")).toBe(true);
    expect(looksLikeQuestion("how much did we sell this month")).toBe(true);
    expect(looksLikeQuestion("deals waiting on a proposal from last week")).toBe(true);
  });

  it("leaves a name, an address or a number to the search", () => {
    expect(looksLikeQuestion("casey")).toBe(false);
    expect(looksLikeQuestion("3 Bill Place")).toBe(false);
    expect(looksLikeQuestion("0423 111 222")).toBe(false);
    expect(looksLikeQuestion("whoami street")).toBe(false);
  });
});
