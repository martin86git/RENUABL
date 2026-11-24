import { describe, expect, it } from "vitest";
import { cleanKeptOrder, moveTab, orderTabs } from "./tray-order";

describe("tray order", () => {
  const offered = ["performance", "needs", "pipeline", "calls"] as const;

  it("keeps the offered order with nothing kept", () => {
    expect(orderTabs(offered, null)).toEqual([...offered]);
  });

  it("follows the kept order, dropping keys no longer offered", () => {
    expect(orderTabs(offered, ["calls", "gone", "needs", "performance", "pipeline"])).toEqual([
      "calls",
      "needs",
      "performance",
      "pipeline",
    ]);
  });

  it("slots a new tab in after the one it follows as offered", () => {
    expect(orderTabs(offered, ["calls", "needs", "performance"])).toEqual(["calls", "needs", "pipeline", "performance"]);
    expect(orderTabs(["new", ...offered], ["calls", "performance"])).toEqual(["new", "calls", "performance", "needs", "pipeline"]);
  });

  it("moves one tab, the rest in order", () => {
    expect(moveTab([...offered], "calls", 0)).toEqual(["calls", "performance", "needs", "pipeline"]);
    expect(moveTab([...offered], "performance", 9)).toEqual(["needs", "pipeline", "calls", "performance"]);
    expect(moveTab([...offered], "needs", 1)).toEqual([...offered]);
  });

  it("reads back only plain keys", () => {
    expect(cleanKeptOrder(["needs", 3, "<b>", "calls"])).toEqual(["needs", "calls"]);
    expect(cleanKeptOrder("needs")).toBeNull();
  });
});
