import { describe, expect, it } from "vitest";
import { DETAIL_KEYS, cleanJobDetails } from "./crm";
import {
  BUILTIN_FIELDS,
  MOVED_FROM_SYSTEM,
  cleanDealFields,
  cleanFieldValue,
  defaultDealFields,
  fieldLine,
  resolveDealFields,
  typedFields,
  type DealFieldsConfig,
} from "./deal-sections";

const ours = (key: string) => BUILTIN_FIELDS.find((f) => f.key === key)!;
const ctx = { installDate: null, installer: null, signed: null };

describe("a deal's fields", () => {
  it("has every system detail on the System tab, but those typed in on another tab", () => {
    const system = BUILTIN_FIELDS.filter((f) => f.source === "design").map((f) => f.key);
    expect(system).toEqual(DETAIL_KEYS.filter((k) => !(MOVED_FROM_SYSTEM as readonly string[]).includes(k)));
  });

  it("keeps each typed value in range for its kind", () => {
    expect(cleanFieldValue(ours("commission"), "$1,250.5")).toBe("1250.5");
    expect(cleanFieldValue(ours("commission"), "-5")).toBe("");
    expect(cleanFieldValue({ key: "c_x", label: "N", kind: "number" }, "-5")).toBe("-5");
    expect(cleanFieldValue(ours("siteInspectionDate"), "20/10/2026")).toBe("");
    expect(cleanFieldValue(ours("preApproval"), "Maybe")).toBe("");
    expect(cleanFieldValue(ours("installNotes"), "Line one\nLine two")).toBe("Line one\nLine two");
  });

  it("keeps them with the job's details, checked against the business's own fields and choices", () => {
    expect(cleanJobDetails({ meterNo: "M123", bookingStatus: "Booked", panel: "Jinko", secret: "x" })).toEqual({
      meterNo: "M123",
      bookingStatus: "Booked",
      panel: "Jinko",
    });
    const config = defaultDealFields();
    config.tabs[1].fields.push({ key: "c_colour1", label: "Roof colour", hidden: false, kind: "select", options: ["Red", "Grey"] });
    const booking = config.tabs[1].fields.find((f) => f.key === "bookingStatus")!;
    booking.options = ["Pencilled", "Locked in"];
    const fields = typedFields(config);
    expect(cleanJobDetails({ c_colour1: "Grey", bookingStatus: "Locked in" }, fields)).toEqual({
      c_colour1: "Grey",
      bookingStatus: "Locked in",
    });
    expect(cleanJobDetails({ c_colour1: "Blue", bookingStatus: "Booked" }, fields)).toEqual({});
  });
});

describe("a business's arrangement of them", () => {
  it("keeps renames, order, hiding, its own tabs and fields, and drops anything unknown", () => {
    const sent = {
      tabs: [
        {
          id: "network",
          label: "Grid",
          hidden: false,
          fields: [
            { key: "nmi", label: "NMI number", hidden: false },
            { key: "distributor", label: "Distributor", hidden: true },
            { key: "nope", label: "x", hidden: false },
          ],
        },
        {
          id: "t_sales01",
          label: "Sales",
          hidden: false,
          fields: [{ key: "c_source1", label: "Heard of us", kind: "text", hidden: false }],
        },
        { id: "evil", label: "x", fields: [] },
      ],
    };
    const c = cleanDealFields(sent);
    expect(c.tabs.map((t) => t.label)).toEqual(["Grid", "Sales", "System", "Installation", "Financials"]);
    expect(c.tabs[0].fields.slice(0, 2)).toEqual([
      { key: "nmi", label: "NMI number", hidden: false },
      { key: "distributor", label: "Distributor", hidden: true },
    ]);
    // Ours left out come back at the end of their own tab.
    expect(c.tabs[0].fields.map((f) => f.key)).toContain("meterNo");
    expect(c.tabs[1].fields).toEqual([{ key: "c_source1", label: "Heard of us", hidden: false, kind: "text" }]);
    expect(c.tabs.flatMap((t) => t.fields).map((f) => f.key)).not.toContain("nope");
  });

  it("gives a dropdown of its own at least one choice, and never lets a known figure be given choices", () => {
    const c = cleanDealFields({
      tabs: [
        {
          id: "system",
          label: "System",
          fields: [
            { key: "c_pick001", label: "Pick", kind: "select", options: [] },
            { key: "incGst", label: "Price", options: ["A"] },
          ],
        },
      ],
    } satisfies { tabs: unknown[] } as unknown as DealFieldsConfig);
    expect(c.tabs[0].fields[0].options).toEqual(["Yes", "No"]);
    expect(c.tabs[0].fields[1].options).toBeUndefined();
  });

  it("resolves ours with their kinds and the business's names", () => {
    const config = defaultDealFields();
    config.tabs[3].fields[0].label = "Contract price";
    const financials = resolveDealFields(config)[3];
    expect(financials.fields[0]).toMatchObject({ key: "incGst", label: "Contract price", source: "known" });
  });
});

describe("a field's line on a deal", () => {
  it("fills Financials from the signed proposal, with a typed figure winning", () => {
    const signed = {
      incGst: 12000,
      stc: 2500,
      youPay: 9500,
      depositAsked: 950,
      depositReceived: 0,
      solarVicRebate: 1400,
      solarVicLoan: null,
    };
    const fin = resolveDealFields(null)[3].fields;
    const line = (key: string, details: Record<string, string> = {}) =>
      fieldLine(
        fin.find((f) => f.key === key)!,
        details,
        { ...ctx, signed },
      );
    expect(line("incGst").value).toBe("$12,000");
    expect(line("depositReceived").value).toBe("Not yet");
    expect(line("solarVicRebate", { solarVicRebate: "1300" })).toMatchObject({ value: "$1,300", filled: "$1,400", typed: true });
  });

  it("shows the progress lists and what the design says", () => {
    const tabs = resolveDealFields(null);
    const grid = tabs[2].fields.find((f) => f.key === "gridConnection")!;
    expect(fieldLine(grid, { gridConnection: "underway" }, ctx).value).toBe("Underway");
    const panel = tabs[0].fields.find((f) => f.key === "panel")!;
    expect(fieldLine(panel, {}, { ...ctx, designed: { panel: "Jinko 475 W" } }).value).toBe("Jinko 475 W");
  });
});
