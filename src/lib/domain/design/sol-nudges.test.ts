import { describe, expect, it } from "vitest";
import { nudgesFor, type NudgeState } from "./sol-nudges";

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
const ids = (s: Partial<NudgeState>) => nudgesFor({ ...base, ...s }).map((n) => n.id);

describe("Sol beside the design", () => {
  it("says nothing on an empty roof", () => {
    expect(nudgesFor({ ...base, panels: 0 })).toEqual([]);
  });

  it("puts what the design needs first, then the quote's questions, then options", () => {
    const list = ids({
      inverters: 0,
      homeDayKwh: null,
      battery: { kwh: 9.6 },
      undecided: ["Switchboard upgrade", "Protective bollard"],
      shaded: 2,
    });
    expect(list).toEqual(["inverter", "bill", "backup", "line:Switchboard upgrade", "line:Protective bollard", "shade"]);
  });

  it("asks the quote's questions in plain words, with yes and no", () => {
    const [q] = nudgesFor({ ...base, undecided: ["Switchboard upgrade"] });
    expect(q.words).toBe("Does the switchboard need upgrading?");
    expect(q.actions.map((a) => a.act)).toEqual(["line-on", "line-off"]);
    expect(q.actions[0].line).toBe("Switchboard upgrade");
    expect(ids({ undecided: ["RCBO"], costsHidden: true })).not.toContain("line:RCBO");
  });

  it("shows the battery on its wall for the battery's own questions, not the switchboard's", () => {
    const pics = nudgesFor({ ...base, undecided: ["Protective bollard", "Fireproofing (sheeting)", "Shade awning", "RCBO"] })
      .filter((n) => n.id.startsWith("line:"))
      .map((n) => n.picture);
    expect(pics).toEqual(["bollard", "fire-sheeting", "awning", undefined]);
  });

  it("asks about backup once, only with a battery", () => {
    expect(ids({ battery: { kwh: 9.6 } })).toContain("backup");
    expect(ids({ battery: { kwh: 9.6 }, backupAnswered: true })).not.toContain("backup");
    expect(ids({ battery: { kwh: 9.6, backup: true } })).not.toContain("backup");
  });

  it("offers a battery for big evenings, and more panels when they can't fill it", () => {
    expect(ids({})).toContain("battery");
    expect(ids({ homeDayKwh: 6 })).not.toContain("battery");
    const fill = nudgesFor({ ...base, battery: { kwh: 9.6 }, backupAnswered: true, fill: { share: 0.6, limit: "panels" } });
    expect(fill.find((n) => n.id === "fill")?.words).toMatch(/fill the battery to about 60%\. About \d+ more panels would fill it/);
    expect(ids({ battery: { kwh: 9.6 }, backupAnswered: true, fill: { share: 0.6, limit: "evenings" } })).not.toContain("fill");
  });

  it("points out unstrung panels, an overfull inverter and single-phase export", () => {
    expect(ids({ unstrung: 4 })).toContain("strings");
    expect(ids({ oversize: { percent: 160, limit: 133, over: true } })).toContain("oversize");
    expect(ids({ phase: "single", kw: 6.65 })).toContain("export");
  });

  it("gives the ways to deal with a shaded panel, naming the string it holds back", () => {
    const n = nudgesFor({ ...base, shaded: 1, shadedStrings: [{ letter: "B", shaded: 1, others: 10 }] }).find((x) => x.id === "shade")!;
    expect(n.why).toContain("string B");
    expect(n.options?.join(" ")).toMatch(/optimiser/);
    expect(n.options?.join(" ")).toMatch(/Rewire/);
    expect(n.options?.join(" ")).toMatch(/Move it/);
    expect(n.options?.join(" ")).toMatch(/Take it off/);
  });
});
