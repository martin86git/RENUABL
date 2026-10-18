import { describe, expect, it } from "vitest";
import { cleanInvoiceFigures, installCostOf, matchScore, varianceOf, varianceText } from "./installer-invoices";

describe("installer invoices", () => {
  const cost = installCostOf(
    [
      { group: "Panels", label: "18 panels", amount: 3000 },
      { group: "Installation", label: "Solar installation: 8.55 kW", amount: 2565 },
      { group: "Installation", label: "Split arrays", amount: 150 },
      { group: "Installation", label: "Arrays: 2 on the roof", amount: 0 },
      { group: "Installation", label: "Three-phase installation", amount: 150 },
    ],
    "2026-10-18T00:00:00Z",
    "signing",
  );

  it("allows for the quote's installation lines only", () => {
    expect(cost.lines.map((l) => l.label)).toEqual(["Solar installation: 8.55 kW", "Split arrays", "Three-phase installation"]);
    expect(cost.total).toBe(2865);
  });

  it("shows the difference against the tolerance", () => {
    expect(varianceOf(cost, [], 50)).toMatchObject({ status: "awaiting", difference: null });
    expect(varianceOf(cost, [{ subTotal: 2900 }], 50)).toMatchObject({ status: "match", difference: 35 });
    expect(varianceOf(cost, [{ subTotal: 2900 }, { subTotal: 200 }], 50)).toMatchObject({ status: "over", difference: 235 });
    expect(varianceOf(cost, [{ subTotal: 2700 }], 50)).toMatchObject({ status: "under", difference: -165 });
    expect(varianceText({ status: "over", difference: 235 })).toBe("Over by $235");
    expect(varianceText({ status: "match", difference: -10 })).toBe("Matches (-$10)");
  });

  it("reads an invoice's figures, working out the total ex GST", () => {
    expect(cleanInvoiceFigures({ total: "$3,300.00", gst: 300 })).toMatchObject({ subTotal: 3000, gst: 300 });
    expect(
      cleanInvoiceFigures({
        installer: " Sparky  Pty Ltd ",
        date: "2026-10-20",
        lines: [
          { description: "Install", amount: 2500 },
          { description: "", amount: 5 },
        ],
      }),
    ).toMatchObject({ installer: "Sparky Pty Ltd", subTotal: 2500, lines: [{ description: "Install", amount: 2500 }] });
    expect(cleanInvoiceFigures({ total: "nothing" })).toBeNull();
    expect(cleanInvoiceFigures({ subTotal: 100, date: "20/10/2026" })?.date).toBe("");
  });

  it("matches a waiting invoice to its job", () => {
    const job = { reference: "PO-7Q2", address: "14 Sample Street, Glen Waverley VIC 3150", surname: "Nguyen" };
    const inv = (text: string) => ({ number: "INV-1", installer: "Sparky", lines: [{ description: text, amount: 1 }] });
    expect(matchScore(job, inv("Job PO-7Q2"))).toBe(100);
    expect(matchScore(job, inv("Install at 14 Sample St for Nguyen"))).toBe(90);
    expect(matchScore(job, inv("Sample St job"))).toBe(20);
    expect(matchScore(job, inv("Install for Nguyen"))).toBe(30);
    expect(matchScore(job, inv("Install, 14 Sample Street, Nguyen"))).toBe(90);
    expect(matchScore(job, inv("Install, 14 Sample Street"))).toBe(75);
    expect(matchScore(job, inv("Something else"))).toBe(0);
  });
});
