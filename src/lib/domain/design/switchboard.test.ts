import { describe, expect, it } from "vitest";
import { cleanSwitchboardRead, spacesNeeded, switchboardAdvice, type SwitchboardRead } from "./switchboard";

const board: SwitchboardRead = {
  isSwitchboard: true,
  phase: "single",
  phaseClue: "a one-pole main switch",
  spareSpaces: 4,
  rcd: "yes",
  oldFuses: "no",
  notes: "",
};

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
      phaseClue: "",
      spareSpaces: null,
      rcd: "unclear",
      oldFuses: "unclear",
      notes: "",
    });
  });
});

describe("what the card says first", () => {
  it("names the phase, single, two or three, with what showed it", () => {
    expect(switchboardAdvice(board, { battery: false, ev: false }).phaseLine).toBe("Single phase: a one-pole main switch.");
    const two = switchboardAdvice({ ...board, phase: "two", phaseClue: "a two-pole main switch" }, { battery: false, ev: false });
    expect(two.phaseLine).toMatch(/^Two phase: a two-pole main switch\. The quote has single or three phase/);
    expect(two.phase).toBeNull();
    expect(switchboardAdvice({ ...board, phase: "unclear", phaseClue: "" }, { battery: false, ev: false }).phaseLine).toMatch(
      /couldn't be told/,
    );
    expect(cleanSwitchboardRead({ phase: "two", phaseClue: "two linked poles <b>" }).phaseClue).toBe("two linked poles b");
  });
  it("says whether the solar's circuits fit, and what they are", () => {
    const fits = switchboardAdvice({ ...board, spareSpaces: 3 }, { battery: true, ev: false });
    expect([fits.room, fits.roomLine]).toEqual(["yes", "Room for the solar: 3 spare spaces, 2 needed for the inverter and the battery."]);
    const full = switchboardAdvice({ ...board, spareSpaces: 1 }, { battery: true, ev: true });
    expect(full.room).toBe("no");
    expect(full.roomLine).toMatch(/3 needed for the inverter, the battery and the EV charger/);
    expect(switchboardAdvice({ ...board, oldFuses: "yes" }, { battery: false, ev: false }).room).toBe("no");
    expect(switchboardAdvice({ ...board, spareSpaces: null }, { battery: false, ev: false }).room).toBe("unclear");
  });
});
