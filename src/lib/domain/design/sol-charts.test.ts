import { describe, expect, it } from "vitest";
import { cleanChart, cleanCharts, MORE_DETAIL, offersMore } from "./sol-charts";

describe("Sol's charts", () => {
  it("keeps a chart with real figures and drops what can't be drawn", () => {
    expect(
      cleanChart({
        kind: "columns",
        title: "Deals a month",
        rows: [
          { label: "Aug", value: 3 },
          { label: "Sep", value: "x" },
          { label: "", value: 2 },
        ],
      }),
    ).toEqual({ kind: "columns", title: "Deals a month", rows: [{ label: "Aug", value: 3 }] });
    expect(cleanChart({ kind: "bars", title: "Nothing", rows: [] })).toBeNull();
    expect(cleanChart({ kind: "bars", rows: [{ label: "A", value: 1 }] })).toBeNull();
    expect(cleanChart({ kind: "bars", title: "Negative", rows: [{ label: "A", value: -4 }] })).toBeNull();
    expect(cleanChart({ kind: "pie", title: "T", rows: [{ label: "A", value: 1 }] })?.kind).toBe("bars");
  });

  it("keeps at most three a turn", () => {
    const one = { kind: "bars", title: "T", rows: [{ label: "A", value: 1 }] };
    expect(cleanCharts([one, one, one, one])).toHaveLength(3);
  });

  it("knows when an answer offers more detail", () => {
    expect(offersMore(`Four deals are at proposal.\n${MORE_DETAIL}`)).toBe(true);
    expect(offersMore("Want me to provide more detail?")).toBe(true);
    expect(offersMore("Here's the draft.")).toBe(false);
  });
});
