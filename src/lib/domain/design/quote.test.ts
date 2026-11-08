import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readXlsxRows } from "@/lib/server/xlsx";
import { VERIFIED_RATES } from "../rebates";
import {
  COMPONENTS,
  DEFAULT_WORKSPACE,
  cleanWorkspace,
  componentCost,
  listed,
  marginFor,
  parsePriceCell,
  readSupplierList,
  withSetting,
  withSupplierList,
  workspaceCatalogue,
  type Workspace,
} from "./pricing";
import {
  cleanExtras,
  costSystem,
  defaultBill,
  defaultQuote,
  DECIDED_LINES,
  sharedHome,
  designFinance,
  editedLines,
  lineKey,
  postcodeIn,
  repriced,
  solarVicBar,
  solarVicFor,
  solarVicNote,
  stcValue,
  type SystemSpec,
  undecidedLines,
  variationsOf,
} from "./quote";

// A wholesaler's real price list (AWM Clayton), as a business would upload it.
const rows = readXlsxRows(readFileSync("src/lib/domain/__fixtures__/awm-price-list.xlsx"));
const list = readSupplierList("awm.xlsx", rows, "2026-10-10");
const withList: Workspace = { ...DEFAULT_WORKSPACE, lists: [list] };
const form = defaultQuote("3150").form;
const system: SystemSpec = {
  panels: 14,
  panel: { sku: "JKM475N-48QL6-DB", name: "Jinko 475W", watts: 475, short: 1.134 },
  inverters: [{ sku: "SGWSG5.0RS", name: "Sungrow 5kW Single Phase 2 MPPT Inverter" }],
  battery: null,
  arrays: 2,
  tiltedPanels: 0,
  tiltDegrees: 0,
};

describe("a business's supplier price lists", () => {
  it("reads a price cell however the wholesaler writes it", () => {
    expect(parsePriceCell("870")).toBe(870);
    expect(parsePriceCell("$1,755.55")).toBe(1755.55);
    expect(parsePriceCell("26.0c/w ($123.50)")).toBe(123.5);
    expect(parsePriceCell("POA")).toBeNull();
  });
  it("keeps every priced row by its code, and reads out the panels, inverters and batteries", () => {
    expect(list.items.length).toBeGreaterThan(300);
    expect(list.panels.find((p) => p.sku === "JKM475N-48QL6-DB")).toMatchObject({ watts: 475, cost: 123.5 });
    expect(list.inverters.find((i) => i.sku === "SGWSG5.0RS")).toMatchObject({ kw: 5, cost: 870 });
    expect(list.batteries.find((b) => b.sku === "SIG11130001")).toMatchObject({ kwh: 8, cost: 2299 });
    expect(listed(withList, "ANTRAIL4800/B")?.cost).toBe(24.81);
    expect(listed(withList, "NOT-A-CODE")).toBeNull();
  });
  it("finds a part whose code the list writes differently, but never one of two that could be meant", () => {
    // AWM's newer list writes the roof kits "ANTTILE2.0" and "ANTTIN2.0"; the parts start as "ANTTILE20" and "ANTTIN20".
    const newer = readSupplierList(
      "awm-new.csv",
      [
        ["ANTTILE2.0", "Antai 2.0kW Tile Kit (Black)", "99.80"],
        ["ANTTIN2.0", "Antai Tin Kit", "49"],
      ],
      "2026-11-08",
    );
    const ws: Workspace = { ...DEFAULT_WORKSPACE, lists: [newer] };
    expect(componentCost(ws, "tileKit")).toBe(99.8);
    expect(componentCost(ws, "tinKit")).toBe(49);
    expect(listed(ws, "anttile-2.0")?.sku).toBe("ANTTILE2.0");
    const two = readSupplierList(
      "two.csv",
      [
        ["AB-12", "One", "1"],
        ["AB12", "Two", "2"],
      ],
      "2026-11-08",
    );
    expect(listed({ lists: [two] }, "AB 12")).toBeNull();
    expect(listed({ lists: [two] }, "AB12")?.name).toBe("Two");
  });
  it("finds every part the quote adds on that list by the codes it starts with", () => {
    expect(COMPONENTS.filter((c) => componentCost(withList, c.key) === null).map((c) => c.key)).toEqual([]);
  });
  it("lets a cost typed in win over the list, and stand in when the code isn't on it", () => {
    const typed: Workspace = { ...withList, components: { ...withList.components, rail: { sku: "ANTRAIL4800/B", cost: 30 } } };
    expect(componentCost(typed, "rail")).toBe(30);
    expect(componentCost(DEFAULT_WORKSPACE, "rail")).toBeNull();
    const noCode: Workspace = { ...DEFAULT_WORKSPACE, components: { ...DEFAULT_WORKSPACE.components, rail: { sku: "", cost: 22 } } };
    expect(componentCost(noCode, "rail")).toBe(22);
  });
  it("replaces a list uploaded again under the same name, newest first", () => {
    const second = readSupplierList("other.csv", [["X1", "Widget", "10"]], "2026-10-11");
    expect(withSupplierList([list], second).map((l) => l.name)).toEqual(["other.csv", "awm.xlsx"]);
    const again = readSupplierList("awm.xlsx", [["X2", "Thing", "5"]], "2026-10-12");
    expect(withSupplierList([second, list], again).map((l) => [l.name, l.items.length])).toEqual([
      ["awm.xlsx", 1],
      ["other.csv", 1],
    ]);
  });
  it("offers the designer the list's products, never their costs", () => {
    const offered = workspaceCatalogue(withList);
    expect(offered.panels!.length).toBe(list.panels.length);
    expect(JSON.stringify(offered)).not.toMatch(/"cost"/);
    expect(workspaceCatalogue(DEFAULT_WORKSPACE)).toEqual({ panels: null, inverters: null, batteries: null });
  });
  it("only keeps settings that are settings", () => {
    const back = cleanWorkspace(JSON.parse(JSON.stringify(withList)));
    expect(back.lists[0].items.length).toBe(list.items.length);
    expect(cleanWorkspace({ install: { pvPerWatt: "0.45", battery: -5 }, settings: { stcPrice: 900, sundries: "x" } })).toMatchObject({
      install: { pvPerWatt: 0.45, battery: 0 },
      settings: { stcPrice: 40, sundries: 120 },
    });
    expect(cleanWorkspace(null)).toEqual(DEFAULT_WORKSPACE);
    expect(withSetting(DEFAULT_WORKSPACE.settings, "margin.base", 2500).margin.base).toBe(2500);
  });
});

describe("the quote that follows a design", () => {
  it("costs what is drawn from the business's lists, parts and rates", () => {
    const c = costSystem(system, form, withList);
    expect(c.pvKw).toBe(6.65);
    expect(c.missing).toBe(0);
    const line = (what: RegExp) => c.lines.find((l) => what.test(l.label))!;
    expect(line(/Jinko/)).toMatchObject({ group: "Panels", qty: 14, amount: 1729 });
    expect(line(/Sungrow 5kW/)).toMatchObject({ group: "Inverters", amount: 870 });
    // 14 panels × (1.134 + 0.1) m × 2 rails, 5% spare, in 4.8 m lengths.
    expect(line(/^Rails \(/)).toMatchObject({ qty: 8, amount: 198.48 });
    expect(line(/Roof kits \(tile, 4\)/).amount).toBe(399.2);
    expect(line(/Solar installation/).amount).toBe(1995);
    expect(c.cost).toBe(c.hardware + c.install + c.commission);
    expect(c.margin).toBe(marginFor(6.65, 0, withList.settings.margin));
    expect(c.priceIncGst).toBe(Math.round((c.cost + c.margin) * 1.1));
  });
  it("marks a product with no cost on file instead of guessing one", () => {
    const c = costSystem(system, form, DEFAULT_WORKSPACE);
    expect(c.missing).toBeGreaterThan(5);
    expect(c.lines.filter((l) => l.missing).every((l) => l.amount === 0)).toBe(true);
    // Installation and the allowance are the business's own figures, so they are still counted.
    expect(c.cost).toBe(1995 + 120);
  });
  it("adds an inverter or a battery only when the design names one", () => {
    const bare = costSystem({ ...system, inverters: [] }, form, withList);
    expect(bare.lines.some((l) => l.group === "Inverters" || l.group === "Battery")).toBe(false);
    const stored = costSystem(
      { ...system, battery: { sku: "SIG11130001", name: "Sigenergy 8.0kW SigenStor Battery Module", kwh: 8, qty: 2 } },
      form,
      withList,
    );
    expect(stored.batteryKwh).toBe(16);
    expect(stored.lines.find((l) => l.group === "Battery")).toMatchObject({ qty: 2, amount: 4598 });
    expect(stored.lines.find((l) => l.label === "Battery installation")!.amount).toBe(1800);
    expect(stored.margin).toBe(marginFor(6.65, 16, withList.settings.margin));
  });
  it("follows the roof, the storeys, the phase and the arrays", () => {
    const c = costSystem(
      { ...system, arrays: 4, tiltedPanels: 6, tiltDegrees: 12 },
      { phase: "three", roof: "flat", storeys: "double", postcode: "" },
      withList,
    );
    const labels = c.lines.map((l) => l.label);
    expect(labels).toContain("Kliplok interfaces (36)");
    expect(labels).toContain("Tilt kits, 10 to 15 degrees (2 for 6 tilted panels)");
    expect(labels).toContain("Double storey");
    expect(labels).toContain("Three-phase installation");
    expect(c.lines.find((l) => /Split arrays: 4/.test(l.label))!.amount).toBe(300);
    expect(c.lines.find((l) => l.label === "Smart meter")!.sku).toBe("SGWDTSU666-20");
    // On a pitched roof, tilted panels need no frames.
    expect(costSystem({ ...system, tiltedPanels: 6 }, form, withList).lines.some((l) => /Tilt/.test(l.label))).toBe(false);
  });
  it("is empty for an empty roof", () => {
    const c = costSystem({ ...system, panels: 0, inverters: [] }, form, withList);
    expect(c.lines).toEqual([]);
    expect(c.priceIncGst).toBe(0);
  });
  it("keeps a line changed by hand as the design grows under it", () => {
    const c = costSystem(system, form, withList);
    const rails = c.lines.find((l) => /^Rails/.test(l.label))!;
    const bigger = costSystem({ ...system, panels: 20 }, form, withList);
    expect(lineKey(bigger.lines.find((l) => /^Rails/.test(l.label))!)).toBe(lineKey(rails));
    const mc4 = c.lines.find((l) => l.label === "MC4 connectors")!;
    const lines = editedLines(c.lines, { [lineKey(rails)]: { amount: 250 }, [lineKey(mc4)]: { removed: true } });
    // The costs decided on each job stay out until included.
    const decided = c.lines.filter((l) => !l.confirm);
    expect(lines.length).toBe(decided.length - 1);
    const totals = repriced(c, lines);
    expect(totals.cost).toBe(Math.round(decided.reduce((s, l) => s + l.amount, 0) - rails.amount + 250 - mc4.amount));
    expect(totals.priceExGst).toBe(totals.cost + c.margin);
    // A cost typed over a line with none on file settles it.
    const short = costSystem(system, form, DEFAULT_WORKSPACE);
    expect(short.lines[0].missing).toBe(true);
    expect(editedLines(short.lines, { [lineKey(short.lines[0])]: { amount: 1700 } })[0].missing).toBeUndefined();
  });
  it("values the STCs at the business's own price per certificate", () => {
    // 6.65 kW at Melbourne's rating (1.185), five deeming years in 2026: 39 certificates.
    expect(stcValue({ pvKw: 6.65, batteryKwh: 0 }, "3150", "2026-10-10", VERIFIED_RATES, 38)).toBe(39 * 38);
    expect(stcValue({ pvKw: 6.65, batteryKwh: 0 }, "3150", "2026-10-10", VERIFIED_RATES, 35)).toBe(39 * 35);
    expect(stcValue({ pvKw: 6.65, batteryKwh: 16 }, null, "2026-10-10", VERIFIED_RATES, 38)).toBeGreaterThan(39 * 38);
    expect(stcValue({ pvKw: 0, batteryKwh: 0 }, "3150", "2026-10-10", VERIFIED_RATES, 38)).toBe(0);
  });
});

describe("the customer's electricity bill", () => {
  const year = [900, 800, 700, 500, 350, 280, 300, 400, 550, 700, 800, 900];
  const bill = { interval: "quarterly" as const, amount: 500, supplyPerDay: 1, rate: 0.3, feedIn: 0.05 };

  it("works back from the bill to the home's use, and forward to the bill with the system", () => {
    const f = designFinance(bill, year, 0, 0.35)!;
    // $500 a quarter is $5.48 a day; less $1 supply, at 30c: about 14.9 kWh a day.
    expect(f.dailyKwh).toBe(14.9);
    expect(f.billNow).toBe(2000);
    expect(f.billAfter).toBeLessThan(f.billNow);
    expect(f.saving).toBe(f.billNow - f.billAfter);
    expect(Math.abs(f.usedKwh + f.exportedKwh - f.productionKwh)).toBeLessThanOrEqual(2);
    expect(f.selfConsumption).toBeGreaterThan(0.2);
    expect(f.selfConsumption).toBeLessThanOrEqual(0.35);
  });
  it("counts a battery as carrying solar into the evening", () => {
    const without = designFinance(bill, year, 0, 0.35)!;
    const stored = designFinance(bill, year, 10, 0.35)!;
    expect(stored.saving).toBeGreaterThan(without.saving);
    expect(stored.selfConsumption).toBeGreaterThan(without.selfConsumption);
  });
  it("gives nothing when there isn't a bill to work from", () => {
    expect(designFinance({ ...bill, amount: 0 }, year, 0, 0.35)).toBeNull();
    // A bill that is no more than its supply charge.
    expect(designFinance({ ...bill, amount: 80 }, year, 0, 0.35)).toBeNull();
    expect(designFinance(bill, [1, 2, 3], 0, 0.35)).toBeNull();
  });
  it("keeps the bill and each design's quote settings, checked", () => {
    const defaults = {
      bill: defaultBill({ rate: 0.3, feedIn: 0.04, supplyPerDay: 1 }),
      postcode: postcodeIn("8 Example Court, Glen Waverley, VIC, 3150"),
    };
    expect(defaults.postcode).toBe("3150");
    const kept = cleanExtras(
      {
        bill: { interval: "monthly", amount: "180", rate: "abc" },
        quotes: [{ form: { roof: "flat", phase: "seven" }, edits: { "Racking|Rails (#)": { amount: 250 }, bad: 4 } }],
      },
      2,
      defaults,
    );
    expect(kept.bill).toEqual({ interval: "monthly", amount: "180", supplyPerDay: "1.00", rate: "0.30", feedIn: "0.04" });
    expect(kept.quotes.length).toBe(2);
    expect(kept.quotes[0]).toEqual({
      form: { phase: "single", roof: "flat", storeys: "single", postcode: "3150" },
      edits: { "Racking|Rails (#)": { amount: 250 } },
    });
    // A house number can be four digits too: the postcode is the one at the end.
    expect(postcodeIn("1250 High Street, Malvern VIC 3144")).toBe("3144");
  });
});

describe("Solar Victoria on a quote", () => {
  const rates = VERIFIED_RATES;
  const form = { phase: "single", roof: "tile", storeys: "single", postcode: "3150" } as const;

  it("is nothing until it is switched on, and only for Victorian homes with panels", () => {
    expect(solarVicFor(form, 20, 12000, 3000, rates)).toBeNull();
    expect(solarVicFor({ ...form, solarVicRebate: true, postcode: "2000" }, 20, 12000, 3000, rates)).toBeNull();
    expect(solarVicFor({ ...form, solarVicRebate: true }, 0, 12000, 3000, rates)).toBeNull();
    expect(solarVicBar({ ...form, postcode: "2000" }, 20, rates)).toMatch(/Victoria/);
    expect(solarVicBar(form, 20, rates)).toBeNull();
  });

  it("takes the rebate off the price after STCs, and the loan off what is paid up front", () => {
    const max = rates.solarVictoria.pvRebateMax;
    const rebate = solarVicFor({ ...form, solarVicRebate: true }, 20, 12000, 3000, rates)!;
    expect(rebate).toMatchObject({ rebate: max, loan: 0, monthly: 0, afterRebate: 9000 - max, upfront: 9000 - max });
    const both = solarVicFor({ ...form, solarVicRebate: true, solarVicLoan: true }, 20, 12000, 3000, rates)!;
    expect(both.loan).toBe(Math.min(rates.solarVictoria.pvLoanMax, max));
    expect(both.upfront).toBe(9000 - max - both.loan);
    expect(both.monthly).toBeCloseTo(both.loan / rates.solarVictoria.loanMonths, 2);
    // Never more than its share of a small price.
    expect(solarVicFor({ ...form, solarVicRebate: true }, 4, 2000, 1000, rates)!.rebate).toBe(
      Math.round(1000 * rates.solarVictoria.pvRebateShare),
    );
  });

  it("always says it depends on eligibility and approval, and what the price is without it", () => {
    const both = solarVicFor({ ...form, solarVicRebate: true, solarVicLoan: true }, 20, 12000, 3000, rates)!;
    const note = solarVicNote(both);
    expect(note).toMatch(/subject to eligibility/);
    expect(note).toMatch(/approval/);
    expect(note).toContain("$9,000");
  });

  it("keeps the loan only with the rebate when read back", () => {
    const read = (form: Record<string, unknown>) =>
      cleanExtras({ quotes: [{ form }] }, 1, { bill: defaultBill({ rate: 0.3, feedIn: 0.05, supplyPerDay: 1 }), postcode: "3150" })
        .quotes[0].form;
    expect(read({ solarVicLoan: true }).solarVicLoan).toBeUndefined();
    expect(read({ solarVicRebate: true, solarVicLoan: true })).toMatchObject({ solarVicRebate: true, solarVicLoan: true });
  });
});

describe("quantities typed over a line", () => {
  const line = { group: "Battery" as const, label: "3 × Battery module", amount: 3000, qty: 3, sku: "BAT" };
  const allowance = { group: "Electrical" as const, label: "Cable, conduit, labels and sundries (allowance)", amount: 120 };

  it("price the line again at its cost each", () => {
    const [edited] = editedLines([line], { [lineKey(line)]: { qty: 5 } });
    expect(edited.qty).toBe(5);
    expect(edited.amount).toBe(5000);
  });

  it("give way to a cost typed over the same line", () => {
    const [edited] = editedLines([line], { [lineKey(line)]: { qty: 5, amount: 4200 } });
    expect(edited.qty).toBe(5);
    expect(edited.amount).toBe(4200);
  });

  it("leave a line with no count alone", () => {
    const [edited] = editedLines([allowance], { [lineKey(allowance)]: { qty: 4 } });
    expect(edited).toEqual(allowance);
  });

  it("are kept with the design, whole numbers within reason only", () => {
    const kept = cleanExtras(
      {
        quotes: [
          {
            edits: {
              a: { qty: 5 },
              b: { qty: 5, amount: 99.5 },
              c: { qty: -1 },
              d: { qty: 2.5 },
              e: { qty: 5000 },
            },
          },
        ],
      },
      1,
      { bill: defaultBill(DEFAULT_WORKSPACE.settings.bill), postcode: "3150" },
    );
    expect(kept.quotes[0].edits).toEqual({ a: { qty: 5 }, b: { amount: 99.5, qty: 5 } });
  });
});

describe("costs decided on each job", () => {
  it("puts the switchboard on every quote and the battery ones with a battery, outside the price", () => {
    const solar = costSystem(system, form, withList);
    expect(solar.lines.filter((l) => l.confirm).map((l) => l.label)).toEqual(["Switchboard upgrade", "RCBO"]);
    const withBattery = costSystem({ ...system, battery: { sku: "B", name: "Battery", kwh: 8, qty: 1 } }, form, withList);
    expect(withBattery.lines.filter((l) => l.confirm).map((l) => l.label)).toEqual([
      "Switchboard upgrade",
      "RCBO",
      "Protective bollard",
      "Fireproofing (sheeting)",
      "Shade awning",
    ]);
    expect(solar.cost).toBe(Math.round(solar.lines.filter((l) => !l.confirm).reduce((n, l) => n + l.amount, 0)));
  });
  it("knows every cost decided on each job by name, and shares the home and those decisions across a roof's designs", () => {
    const withBattery = costSystem({ ...system, battery: { sku: "B", name: "Battery", kwh: 8, qty: 1 } }, form, withList);
    expect(withBattery.lines.filter((l) => l.confirm).map((l) => [l.group, l.label])).toEqual(DECIDED_LINES.map((d) => [...d]));
    const board = lineKey({ group: "Switchboard", label: "Switchboard upgrade" });
    const rails = "Racking|Rails (# lengths for # panels)";
    const worked = { form: { ...form, phase: "three" as const, storeys: "double" as const }, edits: { [board]: { on: true } } };
    const other = { form, edits: { [rails]: { amount: 5 }, [lineKey({ group: "Switchboard", label: "RCBO" })]: { removed: true } } };
    const [a, b] = sharedHome([worked, other], 0);
    expect(a).toBe(worked);
    expect(b.form).toMatchObject({ phase: "three", storeys: "double" });
    expect(b.edits[board]).toEqual({ on: true });
    // A decision not made on the design worked on is undone on the others; their own hand changes stay.
    expect(b.edits[lineKey({ group: "Switchboard", label: "RCBO" })]).toBeUndefined();
    expect(b.edits[rails]).toEqual({ amount: 5 });
  });
  it("includes one switched on, leaves one left out, and names it as a possible variation", () => {
    const c = costSystem(system, form, withList);
    const board = c.lines.find((l) => l.label === "Switchboard upgrade")!;
    const rcbo = c.lines.find((l) => l.label === "RCBO")!;
    const edits = { [lineKey(board)]: { on: true }, [lineKey(rcbo)]: { removed: true } };
    expect(editedLines(c.lines, edits).some((l) => l.label === "Switchboard upgrade")).toBe(true);
    expect(undecidedLines(c.lines, edits)).toEqual([]);
    expect(undecidedLines(c.lines, {}).length).toBe(2);
    expect(variationsOf(c.lines, edits)).toEqual(["RCBO switches"]);
    expect(repriced(c, editedLines(c.lines, edits)).cost).toBe(c.cost + board.amount);
  });
});
