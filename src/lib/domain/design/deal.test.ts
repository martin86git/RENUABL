import { describe, expect, it } from "vitest";
import { JOB_STAGES } from "./crm";
import {
  PIPELINES,
  cleanPipelineChoice,
  dashboard,
  daysUntil,
  power,
  type DashJob,
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
    expect(cleanPipelineChoice({ stages: [] }).stages).toEqual(["lead", "designed", "proposal", "won"]);
    expect(cleanPipelineChoice(null).view).toBe("cards");
  });

  it("name a set of stages that is exactly one of them", () => {
    expect(pipelineOf(["installed", "won", "ordered", "scheduled"])?.id).toBe("post-sale");
    expect(pipelineOf(["lead", "claimed"])).toBeNull();
    // A business's own pipeline is found too, and the one picked wins over another with the same stages.
    const own = [{ id: "pipe_1", name: "Commercial", stages: ["lost"] as const }];
    expect(pipelineOf(["lead", "claimed"], null, [{ id: "pipe_2", name: "Mine", stages: ["lead", "claimed"] }])?.name).toBe("Mine");
    expect(pipelineOf(["lost"], "pipe_1", own)?.name).toBe("Commercial");
    expect(pipelineOf(["lost"], null, own)?.id).toBe("lost");
  });

  it("hand a deal on from one to the next: each starts at the stage the last one ends on", () => {
    const [sales, postSale, postInstall] = PIPELINES;
    expect(sales.stages[sales.stages.length - 1]).toBe(postSale.stages[0]);
    expect(postSale.stages[postSale.stages.length - 1]).toBe(postInstall.stages[0]);
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

describe("the overview's figures", () => {
  const at = (date: string) => `${date}T02:00:00.000Z`; // midday-ish in Melbourne: the same day there
  const job = (o: Partial<DashJob>): DashJob => ({
    stage: "lead",
    value: null,
    kw: null,
    createdAt: at("2026-01-01"),
    wonAt: null,
    installedAt: null,
    installDate: null,
    ...o,
  });
  const jobs: DashJob[] = [
    job({ stage: "won", value: 10000, kw: 6.6, createdAt: at("2026-10-02"), wonAt: at("2026-10-05") }),
    job({ stage: "grid", value: 20000, kw: 13.2, wonAt: at("2026-08-10"), installedAt: at("2026-10-03") }),
    job({ stage: "scheduled", value: 8000, wonAt: at("2026-09-04"), installDate: "2026-10-20" }),
    job({ stage: "installed", value: 5000, wonAt: at("2025-10-06"), installedAt: at("2025-11-01") }),
    job({ stage: "won", value: 9000, wonAt: at("2026-10-28") }), // later this month than today: not yet
    job({ stage: "lost", value: 7000, wonAt: at("2026-10-03") }), // lost: counts for nothing
    job({ stage: "proposal", value: 12000, createdAt: at("2026-10-08") }),
    job({ stage: "lead", createdAt: at("2026-10-09") }),
    job({ stage: "lead", createdAt: at("2026-06-30") }),
  ];
  const d = dashboard(jobs, "2026-10-11");

  it("add up sales for the month to date and the financial year, from when each job was sold", () => {
    expect(d.salesMonth).toBe(10000);
    expect(d.salesYear).toBe(10000 + 20000 + 8000);
    expect(d.soldYear).toBe(3);
    expect(d.yearLabel).toBe("FY 2026-27");
    expect(dashboard(jobs, "2026-03-11").yearLabel).toBe("FY 2025-26");
  });

  it("compare like with like: the same days last month and this month last year", () => {
    // 4 Sep falls within 1 to 11 Sep: $8,000 then, $10,000 now.
    expect(d.vsLastMonth).toBe(25);
    // 6 Oct 2025 falls within 1 to 11 Oct 2025: $5,000 then.
    expect(d.vsLastYear).toBe(100);
    expect(dashboard([], "2026-10-11").vsLastMonth).toBeNull();
  });

  it("count new deals, deals sold and the conversion between them", () => {
    expect(d.newDeals).toBe(3);
    expect(d.sold).toBe(1);
    expect(d.conversion).toBeCloseTo(1 / 3);
    expect(dashboard([], "2026-10-11").conversion).toBeNull();
  });

  it("count the kilowatts sold, installations and the open pipeline", () => {
    expect(d.kwMonth).toBe(6.6);
    expect(d.kwYear).toBe(19.8);
    expect(d.installsBooked).toBe(1);
    expect(d.installsDone).toBe(1);
    expect(d.inGrid).toBe(1);
    expect([d.openDeals, d.openValue]).toEqual([3, 12000]);
    expect(power(19.8)).toBe("19.8 kW");
    expect(power(1250)).toBe("1.25 MW");
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
    expect(inTheWorks([{ stage: "ordered" }, { stage: "scheduled" }, { stage: "inspection" }, { stage: "lead" }] as const)).toHaveLength(2);
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
