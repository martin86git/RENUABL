import { describe, expect, it } from "vitest";
import { emptySystem } from "./call-notes";
import {
  callChanges,
  callReminder,
  cleanCallDetails,
  cleanDraft,
  composeFollowUp,
  followUpBasis,
  followUpKey,
  followUpPrompt,
  followUpWhy,
  plainFollowUp,
  remindAt,
  type FollowUpFacts,
} from "./prepared";

const facts: FollowUpFacts = {
  business: "Sunrise Solar",
  customer: "Olivia Hart",
  title: "Solar and battery",
  step: 2,
  age: 7,
  opened: true,
  options: 3,
  indicative: false,
  lastWord: null,
};

describe("a follow-up Sol prepares", () => {
  it("is kept once for each version and follow-up day", () => {
    expect(followUpKey("job_1", 2, 7)).toBe("follow-up:job_1:2:7");
    expect(followUpKey("job_1", 3, 7)).not.toBe(followUpKey("job_1", 2, 7));
  });

  it("says why it is there and what it was based on", () => {
    expect(followUpWhy(facts)).toBe("Second follow-up due · sent 7 days ago · opened");
    expect(followUpBasis({ ...facts, lastWord: "Can we do it before Christmas?" })).toContain(
      'Their last message: "Can we do it before Christmas?"',
    );
    expect(followUpBasis({ ...facts, opened: false })).toContain("They haven't opened the proposal yet");
  });

  it("ends with the link to the proposal and the business, never a person", () => {
    const email = composeFollowUp("Hi Olivia,\n\nJust checking in.", "Sunrise Solar", "https://example.com/p/abc");
    expect(email).toContain("You can open your proposal here: https://example.com/p/abc");
    expect(email.endsWith("The Sunrise Solar team")).toBe(true);
    expect(composeFollowUp("Hi.", "Sunrise Solar", null)).not.toContain("open your proposal");
  });

  it("has plain words for every step, with no figure or promise", () => {
    for (const step of [1, 2, 3])
      for (const opened of [true, false]) {
        const { subject, body } = plainFollowUp({ ...facts, step, opened });
        expect(subject).toBeTruthy();
        expect(body.startsWith("Hi Olivia,")).toBe(true);
        expect(`${subject} ${body}`).not.toMatch(/\$|\d|guarantee|discount/i);
      }
  });

  it("asks Sol never to say he knows it was opened, nor to name a figure", () => {
    const prompt = followUpPrompt(facts);
    expect(prompt).toContain("Never say or hint that you know whether they opened it");
    expect(prompt).toContain("Never mention a price, a figure");
    expect(followUpPrompt({ ...facts, step: 3 })).toContain("last follow-up");
  });

  it("keeps only a draft with both a subject and words", () => {
    expect(cleanDraft({ subject: "  Hello  there ", body: "Hi\r\n" })).toEqual({ subject: "Hello there", body: "Hi" });
    expect(cleanDraft({ subject: "", body: "Hi" })).toBeNull();
    expect(cleanDraft("nonsense")).toBeNull();
  });
});

describe("a call's write-up, applied", () => {
  it("fills in only the deal's empty fields to start with, and says what a change replaces", () => {
    const system = { ...emptySystem(), solar: "6.6 kW", battery: "13.5 kWh", budget: "about $15k", roof: "tile" };
    const changes = callChanges(system, { batteryStorage: "10 kWh", roofType: "Tile" });
    expect(changes).toEqual([
      { key: "systemSize", label: "Solar", value: "6.6 kW", was: "", tick: true },
      { key: "batteryStorage", label: "Battery", value: "13.5 kWh", was: "10 kWh", tick: false },
    ]);
  });

  it("takes only the call's own fields from the browser", () => {
    expect(cleanCallDetails({ systemSize: " 6.6  kW ", nmi: "123", owner: "x", batteryStorage: "" })).toEqual({ systemSize: "6.6 kW" });
  });

  it("sets a reminder at 9am on a working day, skipping the weekend", () => {
    // Friday 6 Nov 2026, mid-morning in Melbourne: one working day on is Monday the 9th.
    expect(remindAt(1, new Date("2026-11-05T23:00:00Z"))).toBe("2026-11-08T22:00:00.000Z");
    expect(callReminder("Olivia Hart", "Send the quote by Thursday.")).toBe("Follow up with Olivia: Send the quote by Thursday");
    expect(callReminder("", "")).toBe("Follow up with the customer after your call");
  });
});
