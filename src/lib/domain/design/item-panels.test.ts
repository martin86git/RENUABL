import { describe, expect, it } from "vitest";
import { cleanWorkspace, parseItemPanels, readSupplierList } from "./pricing";
import { withoutCosts } from "./permissions";

const rows = [
  ["TSM-440NEG9R.28", "Trina Vertex S+ 440W N-Type Dual Glass Black Frame", "165.00"],
  ["JKM475N-48QL6-DB", "Jinko Tiger Neo 475W N-Type All Black Panel", "171.60"],
  ["AIKO-A460", "Aiko Neostar 460W ABC Module", "$189.50"],
  ["SG5.0RS", "Sungrow 5kW Single Phase String Inverter", "990.00"],
  ["CL-RAIL-48", "Clenergy Rail 4.8m for 440W panels", "42.00"],
  ["MC4-PAIR", "MC4 connector pair", "4.50"],
  ["TIGO-TS4", "Tigo TS4-A-O optimiser 700W", "75.00"],
];

describe("panels priced per panel", () => {
  it("reads panels from a list that doesn't price per watt, and leaves the rest out", () => {
    const list = readSupplierList("Other wholesaler.xlsx", rows, "2026-11-22");
    expect(list.panels.map((p) => [p.sku, p.watts, p.cost])).toEqual([
      ["TSM-440NEG9R.28", 440, 165],
      ["JKM475N-48QL6-DB", 475, 171.6],
      ["AIKO-A460", 460, 189.5],
    ]);
  });

  it("finds them on a list kept before, with no panels saved", () => {
    const list = readSupplierList("Other wholesaler.xlsx", rows, "2026-11-22");
    const ws = cleanWorkspace({ lists: [{ ...list, panels: [] }] });
    expect(ws.lists[0].panels).toHaveLength(3);
  });

  it("keeps them for someone who can't see costs, without the cost", () => {
    const list = { ...readSupplierList("Other wholesaler.xlsx", rows, "2026-11-22"), panels: [] };
    const hidden = withoutCosts(null, [list]).lists[0];
    expect(hidden.panels).toHaveLength(3);
    expect(hidden.panels.every((p) => p.cost !== 165)).toBe(true);
  });

  it("isn't fooled by a cheap accessory naming a wattage", () => {
    expect(parseItemPanels([{ sku: "X", name: "Solar panel 400W cleaning brush", cost: 12 }])).toEqual([]);
  });
});
