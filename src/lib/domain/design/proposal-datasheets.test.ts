import { describe, expect, it } from "vitest";
import { COST_WORDS, type ProposalInternal } from "./proposal";
import {
  customerDatasheets,
  designProducts,
  sheetsInMix,
  datasheetId,
  isDatasheetId,
  productForId,
  productName,
  quotedProducts,
  sheetsForChoice,
} from "./proposal-datasheets";

const line = (group: ProposalInternal["lines"][number]["group"], label: string, sku?: string) => ({
  group,
  label,
  amount: 100,
  ...(sku ? { sku } : {}),
});

const base: ProposalInternal = {
  cost: 0,
  margin: 0,
  priceExGst: 0,
  projectVersion: 1,
  design: 0,
  lines: [
    line("Panels", "14 × Jinko Tiger Neo 475 W", "JKM475N-48QL6-DB"),
    line("Inverters", "Sungrow 5 kW hybrid", "SGWSH5.0RS"),
    line("Battery", "2 × Sigenergy SigenStor 8 kWh", "SIGEN-BAT-8.0"),
    line("EV charger", "Zappi 7 kW", "ZAPPI-7"),
    line("Racking", "Rail 4.8 m", "RAIL-48"),
    line("Electrical", "Cable allowance"),
  ],
};

describe("the products a proposal quotes", () => {
  it("takes panels, inverters, batteries and EV chargers, named without their count, nothing else", () => {
    const p = quotedProducts(base);
    expect(p.map((x) => x.kind)).toEqual(["panel", "inverter", "battery", "charger"]);
    expect(p[0].name).toBe("Jinko Tiger Neo 475 W");
    expect(p.every((x) => x.options === null)).toBe(true);
  });

  it("with options, says which options each product is in, once each", () => {
    const internal: ProposalInternal = {
      ...base,
      options: [
        { goal: "payback", design: 0, cost: 0, margin: 0, priceExGst: 0, lines: [line("Panels", "10 × Jinko", "JKM475")] },
        {
          goal: "return",
          design: 1,
          cost: 0,
          margin: 0,
          priceExGst: 0,
          lines: [line("Panels", "14 × Jinko", "jkm-475"), line("Battery", "Sigen 8", "SIGEN8")],
        },
      ],
    };
    const p = quotedProducts(internal);
    expect(p).toHaveLength(2);
    expect(p.find((x) => x.kind === "panel")?.options).toEqual(["payback", "return"]);
    expect(p.find((x) => x.kind === "battery")?.options).toEqual(["return"]);
    // Once accepted, only the system chosen.
    expect(quotedProducts(internal, "payback").map((x) => x.kind)).toEqual(["panel"]);
  });

  it("leaves the configurator's other products out unless asked, and marks them when asked", () => {
    const internal: ProposalInternal = {
      ...base,
      configurator: [
        { goal: "cfg-0-1-0-0", design: 0, cost: 0, margin: 0, priceExGst: 0, lines: [line("Battery", "Sungrow SBR 3.2", "SBR032")] },
      ] as ProposalInternal["configurator"],
    };
    expect(quotedProducts(internal).some((x) => x.sku === "SBR032")).toBe(false);
    const all = quotedProducts(internal, null, { mixes: true });
    expect(all.find((x) => x.sku === "SBR032")?.mixOnly).toBe(true);
    expect(all.find((x) => x.sku === "SIGEN-BAT-8.0")?.mixOnly).toBeUndefined();
    const sent = customerDatasheets(all, () => true);
    expect(sheetsForChoice(sent, null).some((s) => s.name.includes("SBR"))).toBe(false);
  });

  it("strips a count", () => {
    expect(productName("3 × Thing")).toBe("Thing");
    expect(productName("Thing")).toBe("Thing");
  });
});

describe("what the customer is sent", () => {
  const products = quotedProducts(base);
  const sent = customerDatasheets(products, (p) => p.kind !== "charger");

  it("only the sheets on hand, by an id that is never the product code", () => {
    expect(sent.map((s) => s.kind)).toEqual(["panel", "inverter", "battery"]);
    for (const s of sent) {
      expect(isDatasheetId(s.id)).toBe(true);
      expect(JSON.stringify(s)).not.toContain("JKM475N");
      expect(JSON.stringify(s)).not.toContain("SIGEN-BAT");
    }
    const keys = sent.flatMap((s) => Object.keys(s));
    for (const w of COST_WORDS) expect(keys).not.toContain(w);
  });

  it("finds the product again from its id, ignoring how its code is written", () => {
    expect(datasheetId("inverter", "SGWSH5.0RS")).toBe(datasheetId("inverter", "sgw-sh5rs"));
    expect(productForId(products, sent[1].id)?.sku).toBe("SGWSH5.0RS");
    expect(productForId(products, "0123456789abcdef")).toBeNull();
  });

  it("shows the sheets for the system on show", () => {
    const sheets = [
      { id: "a".repeat(16), kind: "panel" as const, name: "P" },
      { id: "b".repeat(16), kind: "battery" as const, name: "B", options: ["return" as const] },
    ];
    expect(sheetsForChoice(sheets, "payback")).toHaveLength(1);
    expect(sheetsForChoice(sheets, "return")).toHaveLength(2);
  });
});

describe("designProducts and sheetsInMix", () => {
  it("reads a design's products once each", () => {
    const got = designProducts({
      panel: { sku: "JKM475", name: "Jinko 475 W" },
      inverters: [
        { sku: "SG5", name: "Sungrow 5 kW" },
        { sku: "sg-5", name: "Sungrow 5 kW" },
      ],
      battery: { sku: "SIG8", name: "Sigenergy 8 kWh" },
    });
    expect(got.map((p) => p.kind)).toEqual(["panel", "inverter", "battery"]);
  });

  it("keeps the sheets the mix names, all of a kind when none is named, none of a kind it lacks", () => {
    const sheets = [
      { id: "a", kind: "panel", name: "Jinko 475 W" },
      { id: "b", kind: "panel", name: "Tindo 430 W" },
      { id: "c", kind: "inverter", name: "Odd inverter name" },
      { id: "d", kind: "battery", name: "Sigenergy 8 kWh" },
    ] as const;
    const one = sheetsInMix([...sheets], { words: "Panels: 14 × Jinko 475 W; Inverter: Sungrow", has: { battery: true } });
    expect(one.map((s) => s.id)).toEqual(["a", "c", "d"]);
    const none = sheetsInMix([...sheets], { words: "Jinko 475 W", has: { battery: false } });
    expect(none.map((s) => s.id)).toEqual(["a", "c"]);
  });
});
