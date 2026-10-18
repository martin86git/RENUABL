import { describe, expect, it } from "vitest";
import { cleanJobDetails } from "./crm";
import { SECTION_FIELDS, cleanFieldValue, sectionLines } from "./deal-sections";

const field = (key: string) => SECTION_FIELDS.find((f) => f.key === key)!;

describe("a deal's Installation, Network and Financials fields", () => {
  it("keeps each typed value in range for its kind", () => {
    expect(cleanFieldValue(field("commission"), "$1,250.5")).toBe("1250.5");
    expect(cleanFieldValue(field("commission"), "-5")).toBe("");
    expect(cleanFieldValue(field("siteInspectionDate"), "2026-10-20")).toBe("2026-10-20");
    expect(cleanFieldValue(field("siteInspectionDate"), "20/10/2026")).toBe("");
    expect(cleanFieldValue(field("preApproval"), "Approved")).toBe("Approved");
    expect(cleanFieldValue(field("preApproval"), "Maybe")).toBe("");
    expect(cleanFieldValue(field("installNotes"), "Line one\nLine two")).toBe("Line one\nLine two");
  });

  it("are kept with the job's details, and nothing unknown is", () => {
    const kept = cleanJobDetails({ meterNo: "M123", bookingStatus: "Booked", panel: "Jinko", secret: "x" });
    expect(kept).toEqual({ meterNo: "M123", bookingStatus: "Booked", panel: "Jinko" });
  });

  it("fill Financials from the signed proposal, with a typed figure winning", () => {
    const signed = {
      incGst: 12000,
      stc: 2500,
      youPay: 9500,
      depositAsked: 950,
      depositReceived: 0,
      solarVicRebate: 1400,
      solarVicLoan: null,
    };
    const lines = sectionLines("financials", { solarVicRebate: "1300" }, { installDate: null, installer: null, signed });
    const at = (key: string) => lines.find((l) => l.key === key)!;
    expect(at("incGst").value).toBe("$12,000");
    expect(at("depositReceived").value).toBe("Not yet");
    expect(at("solarVicRebate")).toMatchObject({ value: "$1,300", filled: "$1,400", typed: true });
    expect(at("solarVicLoan").value).toBeNull();
  });

  it("show the install date and installer on Installation, and the grid connection on Network", () => {
    const install = sectionLines("installation", {}, { installDate: "2026-10-23", installer: "Amped", signed: null });
    expect(install.slice(0, 2).map((l) => l.value)).toEqual(["2026-10-23", "Amped"]);
    const network = sectionLines("network", { gridConnection: "underway", nmi: "6305" }, { installDate: null, installer: null, signed: null });
    expect(network.find((l) => l.key === "gridConnection")!.value).toBe("Underway");
    expect(network.find((l) => l.key === "nmi")!.value).toBe("6305");
  });
});
