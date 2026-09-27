import { describe, expect, it } from "vitest";
import { BATTERY, BOS, PANEL, RACKING } from "./catalogue";
import { combineMaterials, jobMaterials, jobsToOrderFor, materialsCsv, roofFromNotes } from "./materials";
import type { Job } from "./types";

function job(over: Partial<Job> & { system?: Job["system"]; roof?: string; phase?: "single" | "three" } = {}): Job {
  return {
    id: over.id ?? "j1",
    reference: over.reference ?? "RN-1",
    recordKey: "a".repeat(24),
    customer: { name: "A", phone: "", email: "" },
    address: { line: "1 A St", suburb: "B", state: "VIC", postcode: "3000" },
    packageName: "p",
    system: over.system ?? { panelCount: 12, batteryKwh: 0, evCharger: false },
    stage: over.stage ?? "scheduled",
    preferredDate: over.preferredDate ?? "2026-10-01",
    windowId: "0700",
    crewId: null,
    value: 0,
    site: {
      storeys: "single",
      roof: over.roof ?? "Colorbond, 20° pitch",
      phase: over.phase,
      orientation: "",
      accessNotes: "",
      switchboardNotes: "",
      imagery: [],
    },
    checklist: [],
    documents: [],
    messages: [],
    activity: [],
    statusHistory: [],
  };
}

const qty = (lines: ReturnType<typeof jobMaterials>, sku: string) => lines.find((l) => l.sku === sku)?.qty ?? 0;

describe("materials", () => {
  it("reads the roof from site notes", () => {
    expect(roofFromNotes("Colorbond, 22° pitch")).toBe("tin");
    expect(roofFromNotes("Terracotta tile, 25° pitch")).toBe("tile");
    expect(roofFromNotes("Flat membrane roof")).toBe("flat");
    expect(roofFromNotes("Unknown")).toBe("unsure");
  });

  it("lists products only, with tin kits on a tin roof and clips in packs", () => {
    const lines = jobMaterials(job());
    expect(lines.every((l) => l.sku && l.qty > 0)).toBe(true);
    expect(qty(lines, PANEL.sku)).toBe(12);
    expect(qty(lines, RACKING.tinKit.sku)).toBeGreaterThan(0);
    expect(qty(lines, RACKING.tileKit.sku)).toBe(0);
    expect(qty(lines, BOS.panelClip.sku) % BOS.panelClip.packSize).toBe(0);
    expect(lines.find((l) => l.sku === BOS.panelClip.sku)?.note).toMatch(/pack of 100/);
    expect(lines[0].group).toBe("panels");
  });

  it("adds battery modules and the three-phase isolator", () => {
    const lines = jobMaterials(job({ system: { panelCount: 20, batteryKwh: 16, evCharger: false }, phase: "three" }));
    expect(qty(lines, BATTERY.module.sku)).toBe(2);
    expect(qty(lines, BOS.acIsolator3ph.sku)).toBe(1);
    expect(qty(lines, BATTERY.gateway3ph.sku)).toBe(1);
  });

  it("adds up jobs by product and lists which jobs", () => {
    const all = combineMaterials([job(), job({ id: "j2", reference: "RN-2" })]);
    const panels = all.find((l) => l.sku === PANEL.sku)!;
    expect(panels.qty).toBe(24);
    expect(panels.jobs).toEqual(["RN-1", "RN-2"]);
  });

  it("orders only for accepted or scheduled jobs in range", () => {
    const jobs = [
      job({ id: "a", preferredDate: "2026-10-05" }),
      job({ id: "b", preferredDate: "2026-10-20" }),
      job({ id: "c", preferredDate: "2026-10-02", stage: "new" }),
      job({ id: "d", preferredDate: "2026-09-20" }),
    ];
    expect(jobsToOrderFor(jobs, "2026-10-01", 14).map((j) => j.id)).toEqual(["a"]);
  });

  it("writes a CSV that quotes commas", () => {
    const csv = materialsCsv([{ sku: "X", name: "Rail, black", qty: 3, group: "racking" }]);
    expect(csv).toBe('SKU,Description,Qty\nX,"Rail, black",3\n');
  });
});
