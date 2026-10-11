import { describe, expect, it } from "vitest";
import { JOB_STAGES } from "./crm";
import {
  PIPELINES,
  cleanPipelineChoice,
  daysUntil,
  inTheWorks,
  installOrder,
  materialsCsv,
  materialsOrder,
  pipelineOf,
  systemDetails,
} from "./deal";
import { lineKey } from "./quote";
import type { RoofDesign } from "./roof-design";

const line = (lines: { label: string; value: string | null }[], label: string) => lines.find((l) => l.label === label)?.value;

describe("pipelines", () => {
  it("between them cover every stage", () => {
    const covered = new Set(PIPELINES.flatMap((p) => p.stages));
    for (const stage of JOB_STAGES) expect(covered.has(stage)).toBe(true);
  });

  it("read a choice back with only real stages, in order, and never none", () => {
    expect(cleanPipelineChoice({ view: "list", stages: ["won", "nonsense", "lead"], pipeline: "pipe_ab12" })).toEqual({
      view: "list",
      stages: ["lead", "won"],
      pipeline: "pipe_ab12",
    });
    expect(cleanPipelineChoice({ stages: [] }).stages).toEqual(["lead", "designed", "proposal"]);
    expect(cleanPipelineChoice(null).view).toBe("cards");
  });

  it("name a set of stages that is exactly one of them", () => {
    expect(pipelineOf(["installed", "won"])?.id).toBe("delivery");
    expect(pipelineOf(["lead", "won"])).toBeNull();
    // A business's own pipeline is found too, and the one picked wins over another with the same stages.
    const own = [{ id: "pipe_1", name: "Commercial", stages: ["won", "installed"] as const }];
    expect(pipelineOf(["lead", "won"], null, [{ id: "pipe_2", name: "Mine", stages: ["lead", "won"] }])?.name).toBe("Mine");
    expect(pipelineOf(["won", "installed"], "pipe_1", own)?.name).toBe("Commercial");
    expect(pipelineOf(["won", "installed"], null, own)?.id).toBe("delivery");
  });
});

describe("system details", () => {
  it("are all there and empty with no design", () => {
    const lines = systemDetails(null, null);
    expect(lines.length).toBeGreaterThan(10);
    expect(lines.every((l) => l.value === null)).toBe(true);
  });

  it("read the panels, inverters, battery and the home from a design", () => {
    const design: RoofDesign = {
      lat: -37.8,
      lng: 145.1,
      faces: [],
      loose: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, x: i * 1.2, y: 0, angle: 0 })),
      panel: { sku: "P1", name: "Panel 440", watts: 440, long: 1.7, short: 1.1, gap: 0.02 } as RoofDesign["panel"],
      inverters: [
        { sku: "I5", name: "Inverter 5", kw: 5 },
        { sku: "I5", name: "Inverter 5", kw: 5 },
        { sku: "I3", name: "Inverter 3", kw: 3 },
      ],
      battery: { sku: "B", name: "Battery 10", kwh: 10, qty: 2, x: 0, y: 0 },
    };
    const lines = systemDetails(design, { phase: "three", roof: "tin", storeys: "double", postcode: "3150" });
    expect(line(lines, "System type")).toBe("Solar and battery");
    expect(line(lines, "System size")).toBe("4.4 kW");
    expect(line(lines, "Panel qty")).toBe("10");
    expect(line(lines, "PV panel")).toBe("Panel 440");
    expect(line(lines, "Inverter")).toBe("Inverter 5");
    expect(line(lines, "Inverter qty")).toBe("2");
    expect(line(lines, "Additional inverter")).toBe("Inverter 3");
    expect(line(lines, "Inverter capacity")).toBe("13 kW");
    expect(line(lines, "Battery storage")).toBe("20 kWh");
    expect(line(lines, "Phases")).toBe("3");
    expect(line(lines, "Roof type")).toBe("Tin");
    expect(line(lines, "Property storeys")).toBe("Double");
    // Only a person knows these.
    expect(line(lines, "Property type")).toBeNull();
    expect(line(lines, "NMI")).toBeNull();

    // What is typed in by hand stands in place of what the design says, and is marked so.
    const typed = systemDetails(design, null, { panelQty: "12", propertyType: "Factory" });
    const qty = typed.find((l) => l.key === "panelQty")!;
    expect([qty.value, qty.designed, qty.typed]).toEqual(["12", "10", true]);
    expect(typed.find((l) => l.key === "propertyType")).toMatchObject({ value: "Factory", designed: null, typed: true });
    expect(typed.find((l) => l.key === "panel")).toMatchObject({ value: "Panel 440", typed: false });
  });
});

describe("the materials to order", () => {
  const lines = [
    { group: "Panels", label: "16 × Panel 475", amount: 1976, qty: 16, sku: "P475" },
    { group: "Racking", label: "Rails (9 lengths for 16 panels)", amount: 223, qty: 9, sku: "RAIL" },
    { group: "Electrical", label: 'Sundries, 2" conduit', amount: 150 },
    { group: "Installation", label: "Solar installation", amount: 2280 },
    { group: "Commission", label: "Sales commission", amount: 300 },
  ] as const;

  it("is the quote's hardware, with no prices and none of the business's own costs", () => {
    const order = materialsOrder(lines);
    expect(order).toEqual([
      { group: "Panels", item: "Panel 475", sku: "P475", qty: 16 },
      { group: "Racking", item: "Rails (9 lengths for 16 panels)", sku: "RAIL", qty: 9 },
      { group: "Electrical", item: 'Sundries, 2" conduit', sku: "", qty: 1 },
    ]);
    expect(JSON.stringify(order)).not.toMatch(/amount|1976|2280/);
  });

  it("leaves out a line taken out of the quote by hand", () => {
    expect(materialsOrder(lines, { [lineKey(lines[1])]: { removed: true } }).map((l) => l.group)).toEqual(["Panels", "Electrical"]);
  });

  it("writes a spreadsheet file that keeps commas and quote marks", () => {
    const csv = materialsCsv(materialsOrder(lines));
    expect(csv.split("\r\n")[0]).toBe('"Group","Item","Code","Qty"');
    expect(csv).toContain('"Sundries, 2"" conduit"');
  });
});

describe("installations", () => {
  const jobs = [
    { id: "a", stage: "won", installDate: "2026-11-02", updatedAt: "2026-10-01T00:00:00.000Z" },
    { id: "b", stage: "won", installDate: null, updatedAt: "2026-10-05T00:00:00.000Z" },
    { id: "c", stage: "installed", installDate: "2026-09-01", updatedAt: "2026-09-01T00:00:00.000Z" },
    { id: "d", stage: "won", installDate: "2026-10-20", updatedAt: "2026-10-02T00:00:00.000Z" },
    { id: "e", stage: "won", installDate: null, updatedAt: "2026-10-03T00:00:00.000Z" },
    { id: "f", stage: "proposal", installDate: null, updatedAt: "2026-10-03T00:00:00.000Z" },
  ] as const;

  it("are the won jobs not yet installed", () => {
    expect(inTheWorks(jobs).map((j) => j.id)).toEqual(["a", "b", "d", "e"]);
  });

  it("come soonest first, then those to book, longest waiting first", () => {
    const { booked, toBook } = installOrder(inTheWorks(jobs));
    expect(booked.map((j) => j.id)).toEqual(["d", "a"]);
    expect(toBook.map((j) => j.id)).toEqual(["e", "b"]);
  });

  it("count the days to a date", () => {
    expect(daysUntil("2026-10-20", "2026-10-11")).toBe(9);
    expect(daysUntil("2026-10-10", "2026-10-11")).toBe(-1);
  });
});
