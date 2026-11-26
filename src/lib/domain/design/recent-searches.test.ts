import { describe, expect, it } from "vitest";
import { cleanRecentSearches, withRecent, type RecentSearch } from "./recent-searches";

const deal = (id: string): RecentSearch => ({ kind: "deal", id, label: `Deal ${id}`, sub: "" });
const place = (line: string): RecentSearch => ({
  kind: "place",
  address: { line, suburb: "Rowville", state: "VIC", postcode: "3178" },
  label: line,
  sub: "Rowville",
});

describe("recent searches", () => {
  it("puts the newest first, keeps three and no repeats", () => {
    let list: RecentSearch[] = [];
    for (const r of [deal("a"), place("1 A St"), deal("b"), deal("c")]) list = withRecent(list, r);
    expect(list.map((r) => r.label)).toEqual(["Deal c", "Deal b", "1 A St"]);
    list = withRecent(list, place("1 a st"));
    expect(list.map((r) => r.label)).toEqual(["1 a st", "Deal c", "Deal b"]);
  });
  it("drops what is malformed", () => {
    expect(cleanRecentSearches("x")).toEqual([]);
    expect(cleanRecentSearches([{ kind: "deal", label: "x" }, { kind: "place", label: "y", address: {} }, deal("z")])).toEqual([deal("z")]);
  });
});
