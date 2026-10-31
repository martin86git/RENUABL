import { describe, expect, it } from "vitest";
import { PIXEL_GIF, cleanOpens, isOpenToken, openPixel, openedWords, withOpen, withPixel } from "./email-opens";

const zone = "Australia/Melbourne";

describe("email open tracking", () => {
  it("knows a token, and keeps two opens a minute apart as one", () => {
    expect(isOpenToken("a".repeat(32))).toBe(true);
    expect(isOpenToken("../etc")).toBe(false);
    const first = withOpen([], new Date("2026-11-02T00:00:00Z"))!;
    expect(withOpen(first, new Date("2026-11-02T00:00:30Z"))).toBeNull();
    expect(withOpen(first, new Date("2026-11-02T00:02:00Z"))).toHaveLength(2);
    expect(cleanOpens(["x", "2026-11-02T00:00:00Z", 3])).toEqual(["2026-11-02T00:00:00Z"]);
  });

  it("puts the pixel inside the email, carrying only the token", () => {
    const px = openPixel("https://www.example.com/", "b".repeat(32));
    expect(px).toContain(`https://www.example.com/api/o/${"b".repeat(32)}`);
    expect(withPixel("<div><p>Hi</p></div>", px)).toBe(`<div><p>Hi</p>${px}</div>`);
    expect(withPixel("<p>Hi</p>", px)).toBe(`<p>Hi</p>${px}`);
  });

  it("says when it was opened, plainly", () => {
    const now = new Date("2026-11-02T05:00:00Z");
    expect(openedWords([], zone, now)).toBe("Not opened yet");
    expect(openedWords(["2026-11-02T04:15:00Z"], zone, now)).toBe("Opened today at 3:15 pm");
    expect(openedWords(["2026-10-30T01:00:00Z", "2026-10-31T01:00:00Z"], zone, now)).toMatch(/^Opened 2 times, last on Sat,? 31 Oct$/);
  });

  it("serves a real GIF", () => {
    expect(String.fromCharCode(...PIXEL_GIF.slice(0, 6))).toBe("GIF89a");
  });
});
