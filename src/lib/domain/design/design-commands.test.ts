import { describe, expect, it } from "vitest";
import { allByQuery, batteryWords, commandFrom, faces, parseCommand, pickByQuery } from "./design-commands";

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

describe("Sol changing the panels themselves", () => {
  it("reads portrait or landscape, turning, moving and tilting", () => {
    expect(parseCommand("make them landscape")).toEqual({ do: "orient", landscape: true });
    expect(parseCommand("lay the panels portrait")).toEqual({ do: "orient", landscape: false });
    expect(parseCommand("rotate the panels 5 degrees")).toEqual({ do: "rotate", degrees: 5 });
    expect(parseCommand("turn them 10° anticlockwise")).toEqual({ do: "rotate", degrees: -10 });
    expect(parseCommand("move the panels 50 cm north")).toEqual({ do: "move", east: 0, south: -0.5 });
    expect(parseCommand("move them 1.5 m right")).toEqual({ do: "move", east: 1.5, south: 0 });
    expect(parseCommand("tilt them to 10")).toEqual({ do: "tilt", degrees: 10 });
  });
  it("checks Sol's reading of them", () => {
    expect(commandFrom({ do: "orient", landscape: true, words: "" })).toEqual({ do: "orient", landscape: true });
    expect(commandFrom({ do: "orient", landscape: null, words: "Which way?" })).toEqual({ do: "answer", words: "Which way?" });
    expect(commandFrom({ do: "move", east: 0.25, south: null, words: "" })).toEqual({ do: "move", east: 0.25, south: 0 });
    expect(commandFrom({ do: "move", east: 900, south: 0, words: "Too far." }).do).toBe("answer");
    expect(commandFrom({ do: "rotate", degrees: 15, words: "" })).toEqual({ do: "rotate", degrees: 15 });
  });
});

describe("Sol asking with options", () => {
  it("keeps two or three options with a request each, and answers in words otherwise", () => {
    const options = [
      { label: "North face", detail: "All on the sunniest face.", request: "fit 10 kW on the north face" },
      { label: "Split", detail: "North and west.", request: "fit 10 kW" },
      { label: "Bare", detail: "", request: "" },
    ];
    expect(commandFrom({ do: "choose", question: "Where should the 10 kW go?", options, words: "" })).toEqual({
      do: "choose",
      question: "Where should the 10 kW go?",
      options: options.slice(0, 2),
    });
    expect(commandFrom({ do: "choose", question: "Which?", options: [options[0]], words: "Say which." })).toEqual({
      do: "answer",
      words: "Say which.",
    });
  });
});

describe("adding a battery with none named", () => {
  it("reads storage as a battery and leaves no product words", () => {
    expect(parseCommand("add a battery")).toEqual({ do: "battery", query: "" });
    expect(parseCommand("add the required amount of storage")).toEqual({ do: "battery", query: "" });
    expect(parseCommand("add the recommended storage for this home")).toEqual({ do: "battery", query: "" });
  });

  it("keeps a maker named", () => {
    expect(parseCommand("add a Sigenergy battery")).toEqual({ do: "battery", query: "Sigenergy" });
    expect(batteryWords("use sig energy storage")).toBe("sig energy");
  });

  it("still takes a battery off", () => {
    expect(parseCommand("remove the storage")).toEqual({ do: "noBattery" });
  });

  it("finds every product of a maker", () => {
    const list = [
      { name: "Sigenergy SigenStor 8 kWh module", sku: "SIG-BAT8" },
      { name: "Sigenergy SigenStor 5 kWh module", sku: "SIG-BAT5" },
      { name: "BYD HVS 10.2", sku: "BYD-10" },
    ];
    expect(allByQuery(list, "sig energy").map((b) => b.sku)).toEqual(["SIG-BAT8", "SIG-BAT5"]);
    expect(allByQuery(list, "")).toEqual([]);
  });
});

describe("a battery asked for beside the system's size", () => {
  it("is a battery, never a call to lay the panels again", () => {
    expect(parseCommand("add a battery to this 8.55 kW system")?.do).toBe("battery");
    expect(parseCommand("add a battery for the 8.55kW of panels")?.do).toBe("battery");
    expect(parseCommand("fit 10 kW")).toEqual({ do: "targetKw", kw: 10 });
  });
});

describe("Sol laying panels in rows, or again", () => {
  it("reads rows and laying again", () => {
    expect(parseCommand("lay the panels in 2 rows")).toEqual({ do: "rows", rows: 2 });
    expect(parseCommand("put them into three single rows")).toEqual({ do: "rows", rows: 3 });
    expect(parseCommand("2 symmetric rows in portrait")).toEqual({ do: "rows", rows: 2, landscape: false });
    expect(parseCommand("lay them in two even rows, landscape")).toEqual({ do: "rows", rows: 2, landscape: true });
    expect(parseCommand("lay the panels so they fit on the roof")).toEqual({ do: "relay" });
    expect(parseCommand("tidy them up")).toEqual({ do: "relay" });
    expect(commandFrom({ do: "rows", rows: 4, words: "" })).toEqual({ do: "rows", rows: 4 });
    expect(commandFrom({ do: "relay", words: "" })).toEqual({ do: "relay" });
  });
});
