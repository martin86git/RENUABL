import { describe, expect, it } from "vitest";
import { autoCheckDue, cleanFindings, photoCheckNote, photoCheckPrompt, stillToRecord } from "./photo-check";

const designed = { panels: 20, panelModel: "Jinko 475", inverters: ["Sungrow SH10RS"], battery: { model: "SigenStor", modules: 2 } };

describe("Sol's look at the photos", () => {
  it("is asked never to say anything complies, only what to check", () => {
    const p = photoCheckPrompt({ details: [], designed, toRecord: ["20 panel serials"], photos: 3 });
    expect(p).toMatch(/Never say anything complies or is safe/);
    expect(p).toContain("20 × Jinko 475");
    expect(p).toContain("20 panel serials");
  });
  it("lists what is still to record from the as-built, else from the design", () => {
    expect(stillToRecord(null, designed)).toEqual(["20 panel serials", "1 inverter serial", "2 battery serials", "the install date"]);
    expect(stillToRecord(null, null)).toEqual([]);
  });
  it("cleans his reading to short lists", () => {
    expect(cleanFindings({ seen: ["Inverter", 5, ""], missing: "no", check: Array(9).fill("x") })).toEqual({
      seen: ["Inverter"],
      missing: [],
      check: Array(6).fill("x"),
    });
  });
  it("writes one note, always saying it's a helper, not an inspection", () => {
    const note = photoCheckNote(
      { seen: ["the inverter"], missing: ["the switchboard"], check: ["Check the battery's distance from the window."] },
      4,
    );
    expect(note).toContain("I looked at the 4 newest photos.");
    expect(note).toContain("Still to photograph or record: the switchboard.");
    expect(note).toMatch(/not an inspection/);
    expect(photoCheckNote({ seen: [], missing: [], check: [] }, 1)).toContain("Nothing missing that I can see.");
    expect(photoCheckNote({ seen: [], missing: ["the switchboard"], check: [] }, 2, ["20 panel serials"])).toContain(
      "Still to photograph or record: the switchboard; 20 panel serials.",
    );
  });
});

describe("checking by himself", () => {
  const now = new Date("2026-11-03T03:00:00Z");
  const base = { today: "2026-11-03", yesterday: "2026-11-02", lastCheck: null, now };
  it("only on install day or the day after, and not twice in half an hour", () => {
    expect(autoCheckDue({ ...base, installDate: "2026-11-03" })).toBe(true);
    expect(autoCheckDue({ ...base, installDate: "2026-11-02" })).toBe(true);
    expect(autoCheckDue({ ...base, installDate: "2026-11-10" })).toBe(false);
    expect(autoCheckDue({ ...base, installDate: null })).toBe(false);
    expect(autoCheckDue({ ...base, installDate: "2026-11-03", lastCheck: "2026-11-03T02:45:00Z" })).toBe(false);
    expect(autoCheckDue({ ...base, installDate: "2026-11-03", lastCheck: "2026-11-03T02:00:00Z" })).toBe(true);
  });
});
