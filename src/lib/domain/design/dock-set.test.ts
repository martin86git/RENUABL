import { describe, expect, it } from "vitest";
import { DOCK_SET_WORDS, cleanDockSet, installingOn, otherDockSet } from "./dock-set";

describe("the dock's sets", () => {
  it("reads only the two sets, anything else as sales", () => {
    expect(cleanDockSet("post")).toBe("post");
    expect(cleanDockSet("sales")).toBe("sales");
    expect(cleanDockSet(null)).toBe("sales");
    expect(cleanDockSet("service")).toBe("sales");
  });

  it("turns to the other set", () => {
    expect(otherDockSet("sales")).toBe("post");
    expect(otherDockSet("post")).toBe("sales");
  });

  it("calls the post sale feed Jobs", () => {
    expect(DOCK_SET_WORDS.sales.feed).toBe("Feed");
    expect(DOCK_SET_WORDS.post.feed).toBe("Jobs");
  });

  it("lists the jobs installing that day, never a lost one", () => {
    const jobs = [
      { installDate: "2026-11-23", stage: "scheduled", customerName: "Zoe" },
      { installDate: "2026-11-23", stage: "lost", customerName: "Lost" },
      { installDate: "2026-11-24", stage: "scheduled", customerName: "Tomorrow" },
      { installDate: "2026-11-23", stage: "ordered", customerName: "Ann" },
      { installDate: null, stage: "won", customerName: "None" },
    ];
    expect(installingOn(jobs, "2026-11-23").map((j) => j.customerName)).toEqual(["Ann", "Zoe"]);
  });
});
