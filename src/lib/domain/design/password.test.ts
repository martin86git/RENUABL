import { describe, expect, it } from "vitest";
import { PASSWORD_MAX, passwordProblem } from "./password";

describe("designer passwords", () => {
  it("takes a long enough password", () => {
    expect(passwordProblem("correct horse")).toBeNull();
  });

  it("says why one can't be used", () => {
    expect(passwordProblem("")).toBe("Enter a password.");
    expect(passwordProblem(undefined)).toBe("Enter a password.");
    expect(passwordProblem("short")).toMatch(/at least 10/);
    expect(passwordProblem("x".repeat(PASSWORD_MAX + 1))).toMatch(/at most/);
    expect(passwordProblem("           ")).toMatch(/only spaces/);
  });
});
