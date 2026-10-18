import { describe, expect, it } from "vitest";
import { cleanJobDetails } from "./crm";
import { installRevenueThisMonth, installedOn, installerBooked, paperworkDone, type JobExtra } from "./deal";

const TODAY = "2026-10-18";
const job = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, stage: "won", installDate: null, value: 10000, details: {}, installedAt: null, ...over }) as never;

describe("the Installations lists", () => {
  it("counts install revenue this month: what is still payable on this month's installs", () => {
    const jobs = [
      job("a", { installDate: "2026-10-23", value: 20000 }),
      job("b", { installDate: "2026-10-30", value: 9000 }),
      job("c", { installDate: "2026-11-04", value: 15000 }),
      job("d", { installDate: "2026-10-21", value: 5000, stage: "installed" }),
      job("e", { value: 7000 }),
    ];
    const extras: JobExtra[] = [{ jobId: "a", batteryKwh: 16, youPay: 21480, depositReceived: 2148, ordered: true }];
    // a: 21,480 less its 2,148 deposit; b: its value (no signed proposal); c next month, d installed, e no date: left out.
    expect(installRevenueThisMonth(jobs, extras, TODAY)).toBe(21480 - 2148 + 9000);
  });

  it("books an installer only with a name and a date", () => {
    expect(installerBooked(job("a", { installDate: "2026-10-23", details: { installer: "Sparky" } }))).toBe(true);
    expect(installerBooked(job("a", { details: { installer: "Sparky" } }))).toBe(false);
    expect(installerBooked(job("a", { installDate: "2026-10-23" }))).toBe(false);
  });

  it("calls the paperwork done only when all three are", () => {
    expect(paperworkDone(job("a", { details: { customerInvoice: "paid", stcClaim: "claimed", gridConnection: "completed" } }))).toBe(true);
    expect(paperworkDone(job("a", { details: { customerInvoice: "paid", stcClaim: "claimed", gridConnection: "underway" } }))).toBe(false);
  });

  it("places a completed install on its install date, else the day it was marked installed", () => {
    expect(installedOn(job("a", { installDate: "2026-10-14" }))).toBe("2026-10-14");
    expect(installedOn(job("a", { installedAt: "2026-10-15T03:00:00.000Z" }))).toBe("2026-10-15");
    expect(installedOn(job("a"))).toBeNull();
  });

  it("keeps only the progress choices on offer", () => {
    expect(
      cleanJobDetails({
        installer: " Sparky Pty Ltd ",
        customerInvoice: "paid",
        stcClaim: "maybe",
        gridConnection: "underway",
        evCharger: "7 kW",
      }),
    ).toEqual({ installer: "Sparky Pty Ltd", customerInvoice: "paid", gridConnection: "underway", evCharger: "7 kW" });
  });
});
