import { describe, expect, it } from "vitest";
import { OFFER_HOURS } from "./offers";
import { PAYOUT_DAYS_AFTER_INSTALL } from "./payouts";
import { PITCH_FAQ, PITCH_MONEY, PITCH_STEPS, pitchText } from "./partner-pitch";

describe("partner pitch", () => {
  it("makes no claims we can't back up", () => {
    const text = pitchText();
    expect(text).not.toMatch(/\b(best|first|leading|guaranteed?|exact|precise|AI)\b/i);
    // No job volumes, earnings or ratings until they're real.
    expect(text).not.toMatch(/\d+\s*(jobs|installs)\b|per (week|month)|\bearn|stars?|rating|reviews?/i);
  });

  it("uses the portal's real terms", () => {
    expect(PITCH_STEPS[0].detail).toContain(`${OFFER_HOURS} hours`);
    expect(PITCH_MONEY[2].title).toContain(`${PAYOUT_DAYS_AFTER_INSTALL} days`);
  });

  it("answers the questions a tradie asks first", () => {
    const qs = PITCH_FAQ.map((f) => f.q).join(" ");
    expect(qs).toMatch(/every job/);
    expect(qs).toMatch(/fee|lock-in/);
  });
});
