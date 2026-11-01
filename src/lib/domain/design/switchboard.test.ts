import { describe, expect, it } from "vitest";
import { cleanSwitchboardRead, spacesNeeded, switchboardAdvice, type SwitchboardRead } from "./switchboard";

const board: SwitchboardRead = { isSwitchboard: true, phase: "single", spareSpaces: 4, rcd: "yes", oldFuses: "no", notes: "" };

describe("the switchboard from a photo", () => {
  it("leaves the upgrade and RCBO out for a modern board with room", () => {
    const a = switchboardAdvice(board, { battery: true, ev: false });
    expect(a).toMatchObject({ upgrade: false, rcbo: false, phase: "single" });
  });
  it("suggests an upgrade for old fuses, or too few spaces", () => {
    expect(switchboardAdvice({ ...board, oldFuses: "yes" }, { battery: false, ev: false }).upgrade).toBe(true);
    const tight = switchboardAdvice({ ...board, spareSpaces: 1 }, { battery: true, ev: true });
    expect(tight.upgrade).toBe(true);
    expect(tight.reasons[0]).toContain("1 spare space, 3 needed");
  });
  it("suggests an RCBO when no safety switch is seen", () => {
    expect(switchboardAdvice({ ...board, rcd: "no" }, { battery: false, ev: false }).rcbo).toBe(true);
  });
  it("leaves to the site what the photo can't tell", () => {
    const a = switchboardAdvice(
      { ...board, spareSpaces: null, oldFuses: "unclear", rcd: "unclear", phase: "unclear" },
      { battery: false, ev: false },
    );
    expect(a).toMatchObject({ upgrade: null, rcbo: null, phase: null });
  });
  it("counts the spaces a system takes, and cleans Sol's reading", () => {
    expect(spacesNeeded({ battery: true, ev: true })).toBe(3);
    expect(cleanSwitchboardRead({ phase: "four", spareSpaces: 2.5, rcd: "maybe", notes: 5 })).toEqual({
      isSwitchboard: false,
      phase: "unclear",
      spareSpaces: null,
      rcd: "unclear",
      oldFuses: "unclear",
      notes: "",
    });
  });
});
