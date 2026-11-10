import { describe, expect, it } from "vitest";
import {
  inTheirSystems,
  listWords,
  meets,
  moveShare,
  namesModel,
  needsALook,
  onTheLists,
  priceMoves,
  priceMovesWords,
  systemsWords,
  type JobKit,
} from "./product-watch";
import { cleanNewsItems } from "./industry-news";

const products = [
  { sku: "SE5000H-AU000BEI4", name: "SolarEdge Home Wave SE5000H" },
  { sku: "SE8K-RWS", name: "SolarEdge SE8K three phase" },
  { sku: "TSL-PW3", name: "Tesla Powerwall 3 13.5 kWh" },
  { sku: "SIG-BAT8", name: "Sigenergy SigenStor 8 kWh module" },
];

const jobs: JobKit[] = [
  { jobId: "j1", customer: "Pat Lee", installed: true, products: ["Tesla Powerwall 3 13.5 kWh TSL-PW3", "Jinko 475 W"] },
  { jobId: "j2", customer: "Sam Wu", installed: false, products: ["SolarEdge SE8K three phase SE8K-RWS"] },
  { jobId: "j3", customer: "Ali Khan", installed: true, products: ["Sigenergy SigenStor"] },
];

describe("a model named in a story", () => {
  it("matches a product carrying that model, written another way", () => {
    expect(namesModel("SolarEdge Home Wave SE5000H", "SE-5000H")).toBe(true);
    expect(namesModel("Tesla Powerwall 3 13.5 kWh", "Powerwall 3")).toBe(true);
  });
  it("is too loose to count when short or without a digit", () => {
    expect(namesModel("Tesla Powerwall 3", "PW3")).toBe(false);
    expect(namesModel("Tesla Powerwall 3", "Tesla")).toBe(false);
  });
  it("matches by model when the story names models, by maker only when it names none", () => {
    expect(meets("SolarEdge SE8K", { brands: ["SolarEdge"], models: ["SE5000H"] })).toBeNull();
    expect(meets("SolarEdge SE8K", { brands: ["SolarEdge"], models: [] })).toBe("maker");
  });
});

describe("a story against the price lists", () => {
  it("finds the recalled model, not the maker's other products", () => {
    const m = onTheLists({ brands: ["SolarEdge"], models: ["SE5000H"] }, products)!;
    expect(m.by).toBe("model");
    expect(m.count).toBe(1);
    expect(listWords(m)).toBe("This model is on your price lists");
  });
  it("finds every product of a maker leaving", () => {
    const m = onTheLists({ brands: ["SolarEdge"] }, products)!;
    expect(m.count).toBe(2);
    expect(listWords(m)).toBe("2 SolarEdge products on your price lists");
  });
  it("says which of the lists' products a new model replaces", () => {
    const m = onTheLists({ brands: ["Acme"], models: ["Powerwall 4"], replaces: ["Powerwall 3"] }, products)!;
    expect(m.count).toBe(0);
    expect(listWords(m)).toBe("Replaces Tesla Powerwall 3 13.5 kWh on your price lists");
  });
  it("is nothing when nothing matches", () => {
    expect(onTheLists({ brands: ["Fronius"], models: [] }, products)).toBeNull();
  });
});

describe("a story against the customers' systems", () => {
  it("names the installed systems first, and counts sold jobs apart", () => {
    const m = inTheirSystems({ brands: ["Tesla"], models: ["Powerwall 3"] }, jobs)!;
    expect(m.installed).toBe(1);
    expect(m.sold).toBe(0);
    expect(m.deals[0]).toEqual({ jobId: "j1", customer: "Pat Lee", installed: true });
    expect(systemsWords(m)).toBe("This model is in 1 installed system of yours");
  });
  it("reads a maker leaving across every system of theirs", () => {
    const m = inTheirSystems({ brands: ["SolarEdge"] }, jobs)!;
    expect(systemsWords(m)).toBe("This maker is in 1 sold job of yours");
  });
  it("marks a recall touching a customer as needing a look, and a product launch never", () => {
    const m = inTheirSystems({ brands: ["Tesla"], models: ["Powerwall 3"] }, jobs);
    expect(needsALook({ topic: "recalls" }, m, null)).toBe(true);
    expect(needsALook({ topic: "products" }, m, null)).toBe(false);
    const list = onTheLists({ brands: ["SolarEdge"] }, products);
    expect(needsALook({ topic: "recalls" }, null, list)).toBe(false);
    expect(needsALook({ topic: "companies" }, null, list)).toBe(true);
  });
});

describe("supplier price moves", () => {
  const before = [
    {
      items: [
        { sku: "JKM475", cost: 120 },
        { sku: "SIG-BAT8", cost: 3000 },
        { sku: "CLIP", cost: 1 },
      ],
    },
  ];
  it("reports what moved by more than a little, biggest first", () => {
    const m = priceMoves(
      {
        name: "AWM November.xlsx",
        items: [
          { sku: "JKM-475", name: "Jinko 475", cost: 132 },
          { sku: "SIG-BAT8", name: "Sigen 8 kWh", cost: 2970 },
          { sku: "CLIP", name: "Clip", cost: 1.02 },
          { sku: "NEW1", name: "New thing", cost: 50 },
        ],
      },
      before,
    )!;
    expect(m.up).toBe(1);
    expect(m.down).toBe(0);
    expect(m.added).toBe(1);
    expect(m.biggest.map((b) => b.sku)).toEqual(["JKM-475"]);
    expect(priceMovesWords(m)).toBe("Prices moved on AWM November.xlsx: 1 up.");
    expect(moveShare(m.biggest[0])).toBe("+10%");
  });
  it("says nothing for a first list or when nothing moved", () => {
    expect(priceMoves({ name: "a", items: [{ sku: "X", name: "x", cost: 5 }] }, [])).toBeNull();
    expect(priceMoves({ name: "a", items: [{ sku: "JKM475", name: "j", cost: 120 }] }, before)).toBeNull();
  });
});

describe("Sol's stories keep the models they name", () => {
  it("keeps models and replaces, each once", () => {
    const [s] = cleanNewsItems(
      [
        {
          topic: "recalls",
          headline: "A battery is recalled in Australia",
          summary: "The regulator lists a recall of a home battery model.",
          url: "https://www.productsafety.gov.au/recalls/x",
          brands: ["Acme"],
          models: ["AB-100", "AB-100", ""],
          replaces: [],
          standing: "confirmed",
          standingNote: "On the regulator's own page.",
        },
      ],
      ["https://www.productsafety.gov.au/recalls/x"],
      [],
      "2026-11-10",
    );
    expect(s.topic).toBe("recalls");
    expect(s.models).toEqual(["AB-100"]);
    expect(s.standing).toBe("confirmed");
  });
});
