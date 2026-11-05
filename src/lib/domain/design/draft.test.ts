import { describe, expect, it } from "vitest";
import { cleanBase, cleanDraft, draftStillFits, fingerprint, keptWhen } from "./draft";

const roof = { address: "8 Example Court, Glen Waverley VIC 3150", lat: -37.88, lng: 145.16 };
const design = { lat: 0, lng: 0, faces: [], loose: [{ id: "a", x: 1, y: 2, angle: 0 }] };

describe("designer drafts", () => {
  it("keeps a draft only through the designer's own checks, at the roof's own place", () => {
    const draft = cleanDraft(roof, { design, extras: {}, base: "v3", at: "2026-11-05T04:15:00Z" });
    expect(draft?.base).toBe("v3");
    expect(draft?.design.lat).toBe(roof.lat);
    expect(draft?.at).toBe("2026-11-05T04:15:00.000Z");
    expect(draft?.extras.quotes).toHaveLength(1);
    expect(cleanDraft(roof, { design, extras: {}, base: "<script>" })).toBeNull();
    expect(cleanDraft(roof, { design: null, base: "v3" })).toBeNull();
  });

  it("is set aside once the roof has been saved since it was taken", () => {
    expect(draftStillFits({ base: "v3" }, "v3")).toBe(true);
    expect(draftStillFits({ base: "v3" }, "v4")).toBe(false);
    expect(draftStillFits({ base: "new" }, "new")).toBe(true);
  });

  it("fingerprints what a device saved: the same text the same, a change a different one", () => {
    expect(fingerprint('{"a":1}')).toBe(fingerprint('{"a":1}'));
    expect(fingerprint('{"a":1}')).not.toBe(fingerprint('{"a":2}'));
    expect(cleanBase(fingerprint("anything"))).not.toBeNull();
  });

  it("says when it was kept in the market's time", () => {
    const now = new Date("2026-11-05T06:00:00Z"); // 5 pm in Melbourne
    expect(keptWhen("2026-11-05T04:15:00Z", now)).toBe("today at 3:15 pm");
    expect(keptWhen("2026-11-04T22:02:00Z", now)).toBe("today at 9:02 am");
    expect(keptWhen("2026-11-03T22:02:00Z", now)).toBe("yesterday at 9:02 am");
    expect(keptWhen("2026-11-02T05:40:00Z", now)).toBe("on 2 Nov at 4:40 pm");
    expect(keptWhen("nonsense", now)).toBe("");
  });
});
