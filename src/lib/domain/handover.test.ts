import { describe, expect, it } from "vitest";
import {
  batteryModuleCount,
  cleanHandoverUpdate,
  emptyHandover,
  handoverProgress,
  isSerial,
  parseSerials,
  type HandoverRecord,
} from "./handover";

const system = { panelCount: 3, batteryKwh: 16 };

function withEverything(): HandoverRecord {
  const r = emptyHandover("k".repeat(20), "RN-1234");
  r.arrays = 2;
  let n = 0;
  const photo = (category: HandoverRecord["photos"][number]["category"], array?: number) =>
    r.photos.push({ id: `p${++n}`, category, array, path: `jobs/x/${n}.jpg`, takenAt: "2026-10-22T01:00:00Z" });
  photo("roof-before");
  photo("array", 1);
  photo("array", 2);
  photo("inverter");
  photo("switchboard");
  photo("commissioning");
  photo("inverter-online");
  r.serials = { panels: ["JK001AAA", "JK002AAA", "JK003AAA"], inverter: "SIG2026X001", batteries: ["BAT0000001", "BAT0000002"] };
  return r;
}

describe("handover", () => {
  it("reads pasted or scanned serials, setting aside repeats and junk", () => {
    const r = parseSerials("jk001aaa\nJK002AAA, JK001AAA  ??? JK003AAA");
    expect(r.serials).toEqual(["JK001AAA", "JK002AAA", "JK003AAA"]);
    expect(r.duplicates).toEqual(["JK001AAA"]);
    expect(r.invalid).toEqual(["???"]);
    expect(isSerial("AB")).toBe(false);
  });

  it("counts battery modules from the system", () => {
    expect(batteryModuleCount({ batteryKwh: 16 })).toBe(2);
    expect(batteryModuleCount({ batteryKwh: 0 })).toBe(0);
  });

  it("is complete only with every photo (each array) and every serial", () => {
    expect(handoverProgress(withEverything(), system).complete).toBe(true);

    const noArray2 = withEverything();
    noArray2.photos = noArray2.photos.filter((p) => !(p.category === "array" && p.array === 2));
    const p = handoverProgress(noArray2, system);
    expect(p.complete).toBe(false);
    expect(p.items.find((i) => i.id === "array-2")!.done).toBe(false);

    const shortSerials = withEverything();
    shortSerials.serials.panels.pop();
    expect(handoverProgress(shortSerials, system).items.find((i) => i.id === "panel-serials")!.detail).toBe("2 of 3");
  });

  it("doesn't ask for battery serials when there's no battery", () => {
    const r = withEverything();
    r.serials.batteries = [];
    const p = handoverProgress(r, { panelCount: 3, batteryKwh: 0 });
    expect(p.items.some((i) => i.id === "battery-serials")).toBe(false);
    expect(p.complete).toBe(true);
  });

  it("groups uploaded document pages by document", async () => {
    const { documentFiles } = await import("./handover");
    const r = {
      documents: [
        { id: "d1", docId: "d4", name: "p1.jpg", path: "x", contentType: "image/jpeg", uploadedAt: "" },
        { id: "d2", docId: "d4", name: "p2.jpg", path: "y", contentType: "image/jpeg", uploadedAt: "" },
        { id: "d3", docId: "d9", name: "a.pdf", path: "z", contentType: "application/pdf", uploadedAt: "" },
      ],
    };
    expect(documentFiles(r, "d4").map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(documentFiles({}, "d4")).toEqual([]);
  });

  it("cleans updates from the portal", () => {
    expect(cleanHandoverUpdate(null)).toBeNull();
    const c = cleanHandoverUpdate({ arrays: 40, serials: { panels: ["a1b2c3d4", "a1b2c3d4", 5], inverter: "bad", batteries: [] } })!;
    expect(c.arrays).toBe(6);
    expect(c.serials.panels).toEqual(["A1B2C3D4"]);
    expect(c.serials.inverter).toBe("");
  });
});
