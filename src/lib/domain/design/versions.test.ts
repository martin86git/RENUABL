import { describe, expect, it } from "vitest";
import { nudgesFor, type NudgeState } from "./sol-nudges";
import { versionLines } from "./sol-guide";
import { cleanExtras, lineKey, withHomeOf, type QuoteFields } from "./quote";

// 19 Nov 2026, Martin: the two versions written as v1 and v2; the quote's questions offered for v2 alone, so one version
// is bare and one has the extras; and an OK on a note that needs nothing done.
const base: NudgeState = {
  panels: 14,
  kw: 6.65,
  inverterKw: 5,
  inverters: 1,
  unstrung: 0,
  oversize: null,
  battery: null,
  fill: null,
  panelDayKwh: 1.9,
  homeDayKwh: 20,
  onDeal: true,
  phase: "three",
  shaded: 0,
  undecided: [],
  backupAnswered: false,
  costsHidden: false,
};

describe("the two versions in Sol's words", () => {
  const sigen = { qty: 1, name: "Sigenergy 8.0kW SigenStor Battery Module", kwh: 8 };
  it("lists each with its count, what they hold together and how it is charged", () => {
    const lines = versionLines(sigen, { ...sigen, qty: 2 }, 15);
    expect(lines.v1).toBe("1× Sigenergy 8.0kW SigenStor Battery Module (8 kWh, charged by the solar surplus)");
    expect(lines.v2).toBe("2× Sigenergy 8.0kW SigenStor Battery Module (16 kWh, charged in the 3 free grid hours)");
  });
  it("says a bigger battery when none on the lists is big enough", () => {
    expect(versionLines(sigen, null, 15).v2).toBe("A bigger battery (about 15 kWh, charged in the 3 free grid hours)");
  });
});

describe("the quote's questions with two versions", () => {
  it("offers v2 alone first, then both, then no", () => {
    const [q] = nudgesFor({ ...base, versions: true, undecided: ["Switchboard upgrade"] });
    expect(q.actions.map((a) => [a.label, a.act])).toEqual([
      ["Yes, in v2 only", "line-v2"],
      ["Yes, in both", "line-on"],
      ["No", "line-off"],
    ]);
    const [plain] = nudgesFor({ ...base, undecided: ["Switchboard upgrade"] });
    expect(plain.actions.map((a) => a.act)).toEqual(["line-on", "line-off"]);
  });

  it("keeps a cost decided for one version alone, never handed to the other", () => {
    const key = lineKey({ group: "Switchboard", label: "Switchboard upgrade" });
    const v1: QuoteFields = { form: {} as QuoteFields["form"], edits: { [key]: { removed: true, own: true } } };
    const v2: QuoteFields = { form: {} as QuoteFields["form"], edits: { [key]: { on: true, own: true } } };
    expect(withHomeOf(v1, v2).edits[key]).toEqual({ on: true, own: true });
    expect(withHomeOf(v2, v1).edits[key]).toEqual({ removed: true, own: true });
    // A shared decision still reaches a design that hasn't one of its own.
    const shared: QuoteFields = { form: {} as QuoteFields["form"], edits: { [key]: { on: true } } };
    expect(withHomeOf(shared, { form: {} as QuoteFields["form"], edits: {} }).edits[key]).toEqual({ on: true });
  });

  it("survives a save", () => {
    const key = lineKey({ group: "Switchboard", label: "Switchboard upgrade" });
    const extras = cleanExtras(
      {
        quotes: [
          { form: {}, edits: { [key]: { removed: true, own: true } } },
          { form: {}, edits: { [key]: { on: true, own: true } } },
        ],
      },
      2,
      { bill: { interval: "quarterly", amount: "", supplyPerDay: "1", rate: "0.3", feedIn: "0.04" }, postcode: "3150" },
    );
    expect(extras.quotes[0].edits[key]).toEqual({ removed: true, own: true });
    expect(extras.quotes[1].edits[key]).toEqual({ on: true, own: true });
  });
});

describe("a note that needs nothing done", () => {
  it("has OK once the pre-approval is asked for", () => {
    const n = nudgesFor({
      ...base,
      phase: "single",
      kw: 8,
      network: { name: "United Energy", guessed: false, preApproval: "Requested", mayRequest: true },
    }).find((x) => x.id === "export")!;
    expect(n.actions).toEqual([{ label: "OK", act: "ok" }]);
  });
  it("offers No beside raising the request, and OK when it can't be raised", () => {
    const ask = nudgesFor({
      ...base,
      phase: "single",
      kw: 8,
      network: { name: "United Energy", guessed: false, preApproval: null, mayRequest: true },
    }).find((x) => x.id === "export")!;
    expect(ask.actions.map((a) => a.act)).toEqual(["request-preapproval", "ok"]);
    const off = nudgesFor({ ...base, phase: "single", kw: 8, onDeal: false }).find((x) => x.id === "export")!;
    expect(off.actions.map((a) => a.act)).toEqual(["ok"]);
  });
});
