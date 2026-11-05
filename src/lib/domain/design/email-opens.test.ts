import { describe, expect, it } from "vitest";
import {
  NOT_TRACKED,
  PIXEL_GIF,
  cleanOpens,
  isOpenToken,
  mailMark,
  mailMarkWords,
  openPixel,
  openedWords,
  ourCopyNote,
  splitOurCopies,
  withOpen,
  withPixel,
} from "./email-opens";

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
    expect(openedWords(["2026-10-30T01:00:00Z", "2026-10-31T01:00:00Z"], zone, now)).toMatch(/^Opened 2 times · last on Sat,? 31 Oct$/);
    expect(openedWords(["2026-11-02T01:00:00Z", "2026-11-02T04:15:00Z"], zone, now, 3)).toBe("Opened 3 times · last today at 3:15 pm");
    // The count is every open, though only the latest are kept; it is never fewer than the times given.
    expect(openedWords(["2026-11-02T04:15:00Z"], zone, now, 41)).toBe("Opened 41 times · last today at 3:15 pm");
    expect(openedWords(["2026-11-02T01:00:00Z", "2026-11-02T04:15:00Z"], zone, now, 0)).toBe("Opened 2 times · last today at 3:15 pm");
    expect(NOT_TRACKED).toBe("Not tracked");
  });

  it("sends the business's own people on Cc a copy of their own, so only the customer's opens count", () => {
    const ours = ["Sam@Example-Solar.com.au", "hello@example-solar.com.au"];
    expect(
      splitOurCopies(["sam@example-solar.com.au", "partner@gmail.com", "HELLO@example-solar.com.au", "partner@gmail.com"], ours),
    ).toEqual({
      cc: ["partner@gmail.com"],
      ours: ["sam@example-solar.com.au", "hello@example-solar.com.au"],
    });
    expect(splitOurCopies(["partner@gmail.com"], ours)).toEqual({ cc: ["partner@gmail.com"], ours: [] });
    expect(splitOurCopies([], ours)).toEqual({ cc: [], ours: [] });
    expect(ourCopyNote("alex@example.com")).toContain("alex@example.com");
  });

  it("serves a real GIF", () => {
    expect(String.fromCharCode(...PIXEL_GIF.slice(0, 6))).toBe("GIF89a");
  });
});

describe("mailMark", () => {
  it("is nothing until an email has gone", () => {
    expect(mailMark([])).toBeNull();
  });
  it("reads the latest email: how many went, when, and whether it was opened", () => {
    const mark = mailMark([
      { sentAt: "2026-11-01T01:00:00Z", opens: ["2026-11-01T02:00:00Z"] },
      { sentAt: "2026-11-04T01:00:00Z", opens: [] },
    ]);
    expect(mark).toEqual({ sent: 2, lastSent: "2026-11-04T01:00:00Z", opened: false, lastOpened: null });
  });
  it("takes the latest open of the latest email", () => {
    const mark = mailMark([{ sentAt: "2026-11-04T01:00:00Z", opens: ["2026-11-04T05:00:00Z", "2026-11-04T03:00:00Z"] }]);
    expect(mark?.opened).toBe(true);
    expect(mark?.lastOpened).toBe("2026-11-04T05:00:00Z");
  });
  it("says it in words", () => {
    const now = new Date("2026-11-05T04:00:00Z");
    const sentToday = { sent: 1, lastSent: "2026-11-05T01:00:00Z", opened: true, lastOpened: "2026-11-05T03:15:00Z" };
    expect(mailMarkWords(sentToday, "Australia/Melbourne", now)).toBe("Email sent today · opened today at 2:15 pm");
    const older = { sent: 3, lastSent: "2026-11-02T22:00:00Z", opened: false, lastOpened: null };
    expect(mailMarkWords(older, "Australia/Melbourne", now)).toBe("3 emails sent, the latest on Tue, 3 Nov · not opened yet");
  });
});
