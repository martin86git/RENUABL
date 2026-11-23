import { describe, expect, it } from "vitest";
import { SESSION_DAYS, sessionNeedsRenewing } from "./accounts";

const DAY = 86_400_000;

describe("rolling sessions", () => {
  const now = new Date("2026-11-23T00:00:00Z");
  it("leaves a session alone on the day it was made", () => {
    expect(sessionNeedsRenewing(new Date(now.getTime() + SESSION_DAYS * DAY - 60_000), now)).toBe(false);
  });
  it("pushes one out once a day of it has gone", () => {
    expect(sessionNeedsRenewing(new Date(now.getTime() + (SESSION_DAYS - 2) * DAY), now)).toBe(true);
  });
  it("lasts months, not weeks", () => {
    expect(SESSION_DAYS).toBeGreaterThanOrEqual(60);
  });
});
