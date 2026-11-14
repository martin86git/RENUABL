import { describe, expect, it } from "vitest";
import { applyTidy, cleanCues, cuesFor, isWalkthroughPath, lengthWords, toVtt, videoType, walkthroughPrefix } from "./walkthrough";

describe("a recorded walkthrough", () => {
  it("keeps captions inside the recording, in order, plain and without overlaps", () => {
    const cues = cleanCues(
      [
        { start: 5, end: 9, text: "then the <b>battery</b>" },
        { start: 0, end: 6, text: "  here's   your roof " },
        { start: 3, end: 2, text: "" },
        { start: 40, end: 50, text: "past the end" },
        "nonsense",
      ],
      20,
    );
    expect(cues).toEqual([
      { start: 0, end: 6, text: "here's your roof" },
      { start: 6, end: 9, text: "then the b battery /b" },
    ]);
  });

  it("cuts a long phrase into captions at whole words, sharing its time", () => {
    const cues = cuesFor("one two three four five six seven eight", 0, 16);
    expect(cues.length).toBeGreaterThan(1);
    expect(cues[0].start).toBe(0);
    expect(cues[cues.length - 1].end).toBe(16);
    expect(cues.map((c) => c.text).join(" ")).toBe("one two three four five six seven eight");
    expect(cuesFor("", 0, 2)).toEqual([]);
  });

  it("writes WebVTT", () => {
    const vtt = toVtt([{ start: 1.5, end: 62.25, text: "a --> b" }]);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:01.500 --> 00:01:02.250");
    expect(vtt).toContain("a -> b");
  });

  it("only lets a recording be kept under its own business and deal", () => {
    expect(isWalkthroughPath(`${walkthroughPrefix("b1", "j1")}rec-1.webm`, "b1", "j1")).toBe(true);
    expect(isWalkthroughPath(`${walkthroughPrefix("b2", "j1")}rec-1.webm`, "b1", "j1")).toBe(false);
    expect(isWalkthroughPath(`${walkthroughPrefix("b1", "j1")}../x.webm`, "b1", "j1")).toBe(false);
    expect(videoType("video/webm;codecs=vp9,opus")).toBe("video/webm");
    expect(videoType("text/html")).toBeNull();
    expect(lengthWords(125)).toBe("2:05");
  });

  it("puts Sol's tidied lines back on the same times, and ignores a reply of the wrong length", () => {
    const cues = [
      { start: 0, end: 2, text: "six point six kilo what" },
      { start: 2, end: 4, text: "and a battery" },
    ];
    expect(applyTidy(cues, { lines: ["6.6 kW.", "And a battery."] })).toEqual([
      { start: 0, end: 2, text: "6.6 kW." },
      { start: 2, end: 4, text: "And a battery." },
    ]);
    expect(applyTidy(cues, { lines: ["only one"] })).toEqual(cues);
  });
});

describe("sending a walkthrough by text", () => {
  it("starts from a plain message and puts the link on a line of its own", async () => {
    const { walkthroughText, textWithLink, isWatchToken } = await import("./walkthrough");
    expect(walkthroughText("Jo", "Sunrise Solar")).toBe(
      "Hi Jo, here's a short video from Sunrise Solar walking you through your solar design:",
    );
    expect(textWithLink(" Hi ", "https://x.test/w/abc")).toBe("Hi\nhttps://x.test/w/abc");
    expect(isWatchToken("a".repeat(40))).toBe(true);
    expect(isWatchToken("a".repeat(48))).toBe(false);
  });
});
