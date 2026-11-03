import { describe, expect, it } from "vitest";
import { commandFrom, faces, parseCommand, pickByQuery } from "./design-commands";

describe("reading a designer command at once", () => {
  it("reads a size, with a direction", () => {
    expect(parseCommand("fit 10 kW on the north face")).toEqual({ do: "targetKw", kw: 10, facing: "N" });
    expect(parseCommand("make it 6.6kw")).toEqual({ do: "targetKw", kw: 6.6 });
  });
  it("reads a whole system in one request", () => {
    expect(parseCommand("Load 8 kW PV + an inverter and a battery")).toEqual({ do: "system", kw: 8, inverter: "", battery: "" });
    expect(parseCommand("load for me 8kW pv + an inverter and battery")).toEqual({ do: "system", kw: 8, inverter: "", battery: "" });
    expect(parseCommand("6.6 kW on the north face with a Sungrow inverter and a Sigenergy battery")).toEqual({
      do: "system",
      kw: 6.6,
      facing: "N",
      inverter: "Sungrow",
      battery: "Sigenergy",
    });
    expect(parseCommand("fit 10 kW and an inverter")).toEqual({ do: "system", kw: 10, inverter: "" });
    expect(parseCommand("make it 8 kW with an inverter, no battery")).toEqual({ do: "system", kw: 8, inverter: "" });
  });
  it("reads products by their words", () => {
    expect(parseCommand("swap to the Sigenergy battery")).toEqual({ do: "battery", query: "Sigenergy" });
    expect(parseCommand("use the Sungrow 8 kW inverter")).toEqual({ do: "inverter", query: "Sungrow 8 kW" });
    expect(parseCommand("take off the battery")).toEqual({ do: "noBattery" });
  });
  it("reads questions about strings and the common switches", () => {
    expect(parseCommand("why is string B failing?")).toEqual({ do: "explainString", letter: "B" });
    expect(parseCommand("string it")).toEqual({ do: "stringAuto" });
    expect(parseCommand("Design it for me")).toEqual({ do: "designForMe" });
    expect(parseCommand("pitch is 25 degrees")).toEqual({ do: "pitch", degrees: 25 });
    expect(parseCommand("it's a flat roof")).toEqual({ do: "flat" });
    expect(parseCommand("three phase")).toEqual({ do: "phase", phase: "three" });
    expect(parseCommand("double storey")).toEqual({ do: "storeys", storeys: "double" });
    expect(parseCommand("undo")).toEqual({ do: "undo" });
  });
  it("leaves anything else to Sol", () => {
    expect(parseCommand("what would the payback be without the battery?")).toBeNull();
    expect(parseCommand("")).toBeNull();
  });
});

describe("the rest", () => {
  it("finds a product by the most words", () => {
    const list = [
      { name: "Sungrow SBR 9.6 kWh", sku: "SBR096" },
      { name: "Sigenergy SigenStor 8 kWh module", sku: "SIGEN-BAT-8" },
    ];
    expect(pickByQuery(list, "Sigenergy")?.sku).toBe("SIGEN-BAT-8");
    expect(pickByQuery(list, "Tesla")).toBeNull();
  });
  it("tells which way a face looks", () => {
    expect(faces("N", 20)).toBe(true);
    expect(faces("N", 350)).toBe(true);
    expect(faces("N", 90)).toBe(false);
    expect(faces("W", 260)).toBe(true);
  });
  it("checks Sol's reading, falling back to words", () => {
    expect(commandFrom({ do: "targetKw", kw: 8, facing: "N", words: "ok" })).toEqual({ do: "targetKw", kw: 8, facing: "N" });
    expect(commandFrom({ do: "targetKw", kw: 900, words: "too big" })).toEqual({ do: "answer", words: "too big" });
    expect(commandFrom({ do: "system", kw: 8, facing: null, inverter: "", battery: null, words: "ok" })).toEqual({
      do: "system",
      kw: 8,
      inverter: "",
    });
    expect(commandFrom({ do: "answer", words: "About 6 years." })).toEqual({ do: "answer", words: "About 6 years." });
    expect(commandFrom({ do: "hack" }).do).toBe("answer");
  });
});
