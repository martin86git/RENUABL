import { describe, expect, it } from "vitest";
import { labelled, notePoints } from "./deal-note";

const QUICK_QUOTE =
  "New lead from Quick quote. Stage: Quick quote from the ad landing page: call now First name: Michelle Looking for: Solar and a battery Power bill: Up to $150 a month Owns the home: yes Shown on screen: about $1,100 a year (solar + battery), INDICATIVE from the spend range Home: 2 Hanwell Court, Glen Waverley VIC 3150 Landing page: Quick quote Consent: Ticked";

describe("The deal note", () => {
  it("keeps only what bears on the design from a lead's note", () => {
    expect(notePoints([{ text: QUICK_QUOTE }])).toEqual(["Wants solar and a battery", "Bill up to $150 a month"]);
  });

  it("reads labelled facts in order", () => {
    expect(labelled("Looking for: Solar Power bill: $300 a quarter").map((l) => l.label)).toEqual(["Looking for", "Power bill"]);
  });

  it("falls back to the customer's own words, cut short", () => {
    const said =
      "Can someone come out and have a look at the place sometime next week, we are home most days and happy to talk it over then.";
    const [line] = notePoints([{ text: said }]);
    expect(line.endsWith("…")).toBe(true);
    expect(line.length).toBeLessThanOrEqual(110);
  });

  it("says nothing when there is nothing", () => {
    expect(notePoints([])).toEqual([]);
  });
});

describe("The deal note from words written freely", () => {
  it("reads what they want and their bill", () => {
    expect(notePoints([{ text: "Enquiry from the website: bill about $480 a quarter, wants a battery for the evenings." }])).toEqual([
      "Wants a battery",
      "Bill $480 a quarter",
    ]);
    expect(notePoints([{ text: "Olivia wants solar and a battery to cut her evening bill. Tile roof, single storey." }])).toEqual([
      "Wants solar and a battery",
    ]);
  });
});
