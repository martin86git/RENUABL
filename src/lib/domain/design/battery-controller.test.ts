import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readXlsxRows } from "@/lib/server/xlsx";
import { controllerFor, needsController } from "./makers";
import { DEFAULT_WORKSPACE, readSupplierList, workspaceCatalogue, type Workspace } from "./pricing";
import { costSystem, defaultQuote, type SystemSpec } from "./quote";

// A wholesaler's real price list (AWM Clayton): Sigenergy controllers and modules on it.
const list = readSupplierList("awm.xlsx", readXlsxRows(readFileSync("src/lib/domain/__fixtures__/awm-price-list.xlsx")), "2026-10-10");
const withList: Workspace = { ...DEFAULT_WORKSPACE, lists: [list] };
const form = defaultQuote("3150").form;
const sigenergy = workspaceCatalogue(withList).batteries!.find((b) => /sigen/i.test(b.name))!;

const batteryOnly: SystemSpec = {
  panels: 0,
  panel: { sku: "", name: "Panels", watts: 475, short: 1.134 },
  inverters: [],
  battery: { sku: sigenergy.sku, name: sigenergy.name, kwh: sigenergy.kwh, qty: 2 },
  arrays: 1,
  tiltedPanels: 0,
  tiltDegrees: 0,
};

describe("a battery's controller", () => {
  it("is needed unless the design has its maker's hybrid, or the battery has its inverter built in", () => {
    expect(needsController({ name: "Sigenergy 8.0kW SigenStor Battery Module" }, [])).toBe(true);
    expect(needsController({ name: "Sigenergy 8.0kW SigenStor Battery Module" }, [{ name: "Sungrow SH5.0RS" }])).toBe(true);
    expect(
      needsController({ name: "Sigenergy 8.0kW SigenStor Battery Module" }, [
        { name: "Sigenergy 8.0kW SigenStor Single Phase Controller" },
      ]),
    ).toBe(false);
    expect(needsController({ name: "Tesla Powerwall 3" }, [])).toBe(false);
  });

  it("is its maker's smallest for the home's phase", () => {
    const inverters = [
      { name: "Sigenergy 10.0kW SigenStor Three Phase Controller", kw: 10 },
      { name: "Sigenergy 8.0kW SigenStor Single Phase Controller", kw: 8 },
      { name: "Sigenergy 5.0kW SigenStor Single Phase Controller", kw: 5 },
      { name: "Sungrow SH5.0RS hybrid", kw: 5 },
    ];
    expect(controllerFor({ name: "Sigenergy battery" }, inverters, "single")?.kw).toBe(5);
    expect(controllerFor({ name: "Sigenergy battery" }, inverters, "three")?.kw).toBe(10);
    expect(controllerFor({ name: "BYD HVS 5.1" }, inverters, "single")).toBeNull();
  });

  it("goes on the quote of a battery sold alone, priced from the lists", () => {
    const c = costSystem(batteryOnly, form, withList);
    const line = c.lines.find((l) => l.group === "Inverters");
    expect(line?.label).toMatch(/Sigenergy .*Controller \(for the battery\)/);
    expect(line?.missing).toBeUndefined();
    expect(line!.amount).toBeGreaterThan(0);
  });

  it("is a line marked missing when the lists have none of its maker", () => {
    const c = costSystem(batteryOnly, form, DEFAULT_WORKSPACE);
    expect(c.lines.find((l) => l.group === "Inverters")).toMatchObject({ missing: true, amount: 0 });
  });

  it("isn't added when the design already has its controller", () => {
    const controller = workspaceCatalogue(withList).inverters!.find((i) => /sigen/i.test(i.name) && /single/i.test(i.name))!;
    const c = costSystem({ ...batteryOnly, inverters: [{ sku: controller.sku, name: controller.name }] }, form, withList);
    expect(c.lines.filter((l) => l.group === "Inverters")).toHaveLength(1);
  });
});
