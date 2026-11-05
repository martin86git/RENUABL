import { describe, expect, it } from "vitest";
import { systemDetails, materialsOrder } from "./deal";
import { jobDrawing } from "./job-card";
import { withoutCosts, HIDDEN_COST } from "./permissions";
import {
  DEFAULT_WORKSPACE,
  chargerCatalogue,
  cleanWorkspace,
  isEvCharger,
  parseItemChargers,
  readSupplierList,
  type Workspace,
} from "./pricing";
import { costSystem, defaultQuote, type SystemSpec } from "./quote";
import { cleanDesign } from "./roof-design";
import { systemSpecOf } from "./system";

// Made-up products and round prices: real supplier costs never go in the repo.
const rows = [
  ["SOLAR EV CHARGERS", "", ""],
  ["EV7", "Maker 7kW Single Phase AC EV Charger", "600"],
  ["EV22", "Maker One Electric Vehicle Charger 22kW 3 Phase", "800"],
  ["INV5", "Maker 5kW Single Phase Solar Inverter (EV Charger ready)", "500"],
  ["CAB", "Maker EV Charging Cable 10m", "120"],
  ["RFID", "Maker RFID Card for AC EV chargers", "13"],
];
const list = readSupplierList("maker.csv", rows, "2026-11-05");
const workspace: Workspace = { ...DEFAULT_WORKSPACE, lists: [list] };
const form = defaultQuote("3150").form;
const spec: SystemSpec = {
  panels: 0,
  panel: { sku: "", name: "Panels", watts: 475, short: 1.134 },
  inverters: [],
  battery: null,
  arrays: 1,
  tiltedPanels: 0,
  tiltDegrees: 0,
};
const design = cleanDesign({
  lat: -37.88,
  lng: 145.16,
  faces: [],
  loose: [{ id: "a", x: 1, y: 1, angle: 0 }],
  charger: { sku: "EV7", name: "Maker 7kW Single Phase AC EV Charger", kw: 7, x: 3, y: -2 },
})!;

describe("an EV charger on a design", () => {
  it("reads the chargers off a price list, and leaves inverters only ready for one, cables and cards", () => {
    expect(list.chargers?.map((c) => [c.sku, c.kw])).toEqual([
      ["EV7", 7],
      ["EV22", 22],
    ]);
    expect(isEvCharger("Maker 5kW Inverter (EV Charger ready)")).toBe(false);
    expect(chargerCatalogue(workspace)[0]).toEqual({ sku: "EV7", name: "Maker 7kW Single Phase AC EV Charger", kw: 7 });
    expect(chargerCatalogue(DEFAULT_WORKSPACE)).toEqual([]);
  });

  it("finds them on a list kept before chargers were read, from its rows", () => {
    const { chargers: _gone, ...older } = list;
    void _gone;
    expect(cleanWorkspace({ lists: [older] }).lists[0].chargers?.map((c) => c.sku)).toEqual(["EV7", "EV22"]);
    expect(parseItemChargers([{ sku: "X", name: "EV Charger, no rating", cost: 5 }])).toEqual([]);
  });

  it("still offers them to someone who may not see costs, with the cost taken out", () => {
    const hidden = withoutCosts(null, [list]);
    expect(hidden.lists[0].chargers?.map((c) => c.cost)).toEqual([HIDDEN_COST, HIDDEN_COST]);
  });

  it("is kept with the design and carried into the system the quote reads", () => {
    expect(design.charger).toEqual({ sku: "EV7", name: "Maker 7kW Single Phase AC EV Charger", kw: 7, x: 3, y: -2 });
    expect(systemSpecOf(design).charger).toEqual({ sku: "EV7", name: "Maker 7kW Single Phase AC EV Charger", kw: 7 });
    expect(cleanDesign({ lat: 0, lng: 0, faces: [], charger: { sku: "<x>", kw: 7, x: 0, y: 0 } })?.charger).toBeUndefined();
  });

  it("costs the charger at its list cost and its installation at the business's rate, $1,000 to start", () => {
    const costing = costSystem({ ...spec, charger: { sku: "EV7", name: "Maker 7kW Single Phase AC EV Charger", kw: 7 } }, form, workspace);
    const product = costing.lines.find((l) => l.group === "EV charger");
    expect(product).toMatchObject({ sku: "EV7", qty: 1, amount: 600 });
    expect(costing.lines.find((l) => l.label === "EV charger installation")).toMatchObject({ group: "Installation", amount: 1000 });
    expect(costing.hardware).toBe(600);
    expect(costing.install).toBe(1000);
    const own = costSystem({ ...spec, charger: { sku: "EV7", name: "Charger", kw: 7 } }, form, {
      ...workspace,
      install: { ...workspace.install, evCharger: 750 },
    });
    expect(own.install).toBe(750);
  });

  it("marks a charger with no cost on file as missing, never a guess", () => {
    const costing = costSystem({ ...spec, charger: { sku: "NOPE", name: "Unknown charger", kw: 7 } }, form, workspace);
    expect(costing.lines.find((l) => l.group === "EV charger")).toMatchObject({ amount: 0, missing: true });
    expect(costing.missing).toBe(1);
  });

  it("goes on the order, the deal's system lines and the job card's drawing", () => {
    const costing = costSystem({ ...spec, charger: { sku: "EV7", name: "Maker 7kW Single Phase AC EV Charger", kw: 7 } }, form, workspace);
    expect(materialsOrder(costing.lines)).toContainEqual({
      group: "EV charger",
      item: "Maker 7kW Single Phase AC EV Charger",
      sku: "EV7",
      qty: 1,
    });
    expect(materialsOrder(costing.lines).some((l) => /installation/i.test(l.item))).toBe(false);
    const line = systemDetails(design, form).find((d) => d.key === "evCharger");
    expect(line?.value).toBe("Maker 7kW Single Phase AC EV Charger (7 kW)");
    expect(jobDrawing(design, "layout")?.marks).toContain(">EV<");
  });
});
