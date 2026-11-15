import { describe, expect, it } from "vitest";
import { cleanInbound, localMobile, replyRecord, signedText, stopRecord, stopWord, textSignOff, waitingOnUs } from "./texts";

describe("a text's sign-off", () => {
  it("is Regards, the sender's first name and the company", () => {
    expect(textSignOff("Martin", "RENUABL")).toBe("Regards,\nMartin | RENUABL");
  });

  it("makes do with what it has", () => {
    expect(textSignOff(null, "Sunrise Solar")).toBe("Regards,\nSunrise Solar");
    expect(textSignOff("Sam", "")).toBe("Regards,\nSam");
    expect(textSignOff("", "  ")).toBe("");
  });

  it("keeps a name to one plain piece", () => {
    expect(textSignOff("Sam\nJones", "A | B")).toBe("Regards,\nSam Jones | A B");
  });

  it("is added after a blank line, once", () => {
    const sign = textSignOff("Martin", "RENUABL");
    expect(signedText("  See you Tuesday.  ", sign)).toBe("See you Tuesday.\n\nRegards,\nMartin | RENUABL");
    expect(signedText("See you Tuesday.\n\nRegards,\nMartin | RENUABL", sign)).toBe("See you Tuesday.\n\nRegards,\nMartin | RENUABL");
    expect(signedText("See you Tuesday.", "")).toBe("See you Tuesday.");
  });
});

describe("a text that comes in", () => {
  it("is kept as plain words", () => {
    expect(cleanInbound("  Yes please\r\n\r\n\r\n\r\ncall me\u0007 ")).toBe("Yes please\n\ncall me");
    expect(cleanInbound("x".repeat(5000))).toHaveLength(1600);
    expect(cleanInbound(undefined)).toBe("");
  });

  it("stops texts only when STOP is the whole reply", () => {
    expect(stopWord("STOP")).toBe("stop");
    expect(stopWord(" Stop. ")).toBe("stop");
    expect(stopWord("unsubscribe!")).toBe("stop");
    expect(stopWord("Opt  out")).toBe("stop");
    expect(stopWord("START")).toBe("start");
    expect(stopWord("Please don't stop by before 9")).toBeNull();
    expect(stopWord("ok")).toBeNull();
  });

  it("is written on the deal with the number as people write it", () => {
    expect(localMobile("+61412345678")).toBe("0412 345 678");
    expect(localMobile("0412345678")).toBe("0412 345 678");
    expect(localMobile("  03 9000 0000 ")).toBe("03 9000 0000");
    expect(replyRecord("+61412345678", "Yes please")).toBe("Text from 0412 345 678: Yes please");
    expect(stopRecord("+61412345678", "stop")).toMatch(/replied STOP/);
    expect(stopRecord("+61412345678", "start")).toMatch(/texted again/);
  });

  it("is waiting on us while theirs is the latest", () => {
    expect(waitingOnUs([])).toBe(false);
    expect(waitingOnUs([{ direction: "out" }, { direction: "in" }])).toBe(true);
    expect(waitingOnUs([{ direction: "in" }, { direction: "out" }])).toBe(false);
  });
});
