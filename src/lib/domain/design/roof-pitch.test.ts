import { describe, expect, it } from "vitest";
import { PITCH_NOT_READ, pitchOfRoof, pitchReadWords } from "./roof-pitch";

describe("the roof's pitch from its faces", () => {
  it("reads a hip roof whose faces agree", () => {
    const read = pitchOfRoof([
      { pitch: 22.4, areaM2: 60 },
      { pitch: 23.1, areaM2: 55 },
      { pitch: 21.8, areaM2: 30 },
      { pitch: 22.9, areaM2: 28 },
    ]);
    expect(read).toMatchObject({ pitch: 23, flat: false, faces: 4, of: 4, share: 1, sure: true });
  });

  it("takes the pitch most of the roof is at, not the garage's or the verandah's", () => {
    const read = pitchOfRoof([
      { pitch: 25, areaM2: 70 },
      { pitch: 26, areaM2: 65 },
      { pitch: 8, areaM2: 30 },
      { pitch: 2, areaM2: 12 },
    ]);
    expect(read?.pitch).toBe(25);
    expect(read?.faces).toBe(2);
    expect(read?.of).toBe(4);
    expect(read?.sure).toBe(true);
  });

  it("weighs faces by their size", () => {
    expect(
      pitchOfRoof([
        { pitch: 20, areaM2: 90 },
        { pitch: 23, areaM2: 10 },
      ])?.pitch,
    ).toBe(20);
  });

  it("reads a flat roof as flat", () => {
    expect(
      pitchOfRoof([
        { pitch: 1.2, areaM2: 120 },
        { pitch: 2, areaM2: 40 },
      ]),
    ).toMatchObject({ pitch: 0, flat: true, sure: true });
  });

  it("isn't sure when the roof is split between pitches", () => {
    const read = pitchOfRoof([
      { pitch: 15, areaM2: 40 },
      { pitch: 30, areaM2: 42 },
      { pitch: 5, areaM2: 30 },
    ]);
    expect(read?.pitch).toBe(30);
    expect(read?.sure).toBe(false);
  });

  it("leaves out what is too steep to be a roof, and says nothing on too little roof", () => {
    expect(
      pitchOfRoof([
        { pitch: 70, areaM2: 80 },
        { pitch: 24, areaM2: 40 },
      ])?.pitch,
    ).toBe(24);
    expect(pitchOfRoof([{ pitch: 24, areaM2: 12 }])).toBeNull();
    expect(pitchOfRoof([])).toBeNull();
    expect(pitchOfRoof([{ pitch: Number.NaN, areaM2: 80 }])).toBeNull();
  });

  it("says what was read, from what, and to check it, with no promise", () => {
    const read = pitchOfRoof([
      { pitch: 25, areaM2: 70 },
      { pitch: 26, areaM2: 65 },
      { pitch: 8, areaM2: 30 },
    ])!;
    const words = pitchReadWords(read, "Nearmap's heights", "27 Jan 2026");
    expect(words).toContain("25°");
    expect(words).toContain("Nearmap's heights (27 Jan 2026)");
    expect(words).toContain("2 of 3 roof faces");
    expect(words).toMatch(/check it/);
    expect(words).not.toMatch(/exact|precise|guarantee|accurate/i);
    expect(pitchReadWords(pitchOfRoof([{ pitch: 1, areaM2: 90 }])!, "Nearmap's heights", null)).toContain("reads as flat");
    expect(PITCH_NOT_READ).toMatch(/by hand/);
  });
});
