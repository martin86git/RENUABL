import { describe, expect, it } from "vitest";
import {
  capReached,
  cleanCap,
  DEFAULT_CAP_CENTS,
  minutesOf,
  monthBefore,
  unitPrice,
  usageBill,
  usageInvoiceLine,
  usageMonth,
  usagePriceWords,
  capStanding,
  capWarningEmail,
  marginOn,
  usageWords,
  VOICE_FREE,
  VOICE_PRICES,
} from "./voice-usage";

describe("voice usage", () => {
  it("gives 30 minutes and 30 texts free", () => {
    expect(VOICE_FREE).toEqual({ minutes: 30, texts: 30 });
    expect(usageBill({ minutes: 30, texts: 30 }).cents).toBe(0);
  });

  it("prices beyond the allowance at 50c a minute and 30c a text (Martin, 21 Nov 2026)", () => {
    expect(VOICE_PRICES).toEqual({ minuteCents: 50, textCents: 30 });
    expect(unitPrice(40, 0.5)).toBe(66);
    expect(marginOn(55, 40)).toBe(0.25);
    const bill = usageBill({ minutes: 42, texts: 35 });
    expect(bill).toEqual({ extraMinutes: 12, extraTexts: 5, cents: 12 * VOICE_PRICES.minuteCents + 5 * VOICE_PRICES.textCents });
  });

  it("rounds each call up to the whole minute", () => {
    expect(minutesOf(0)).toBe(0);
    expect(minutesOf(1)).toBe(1);
    expect(minutesOf(60)).toBe(1);
    expect(minutesOf(61)).toBe(2);
    expect(minutesOf(NaN)).toBe(0);
  });

  it("counts months in Melbourne's time", () => {
    expect(usageMonth(new Date("2026-11-30T14:00:00Z"))).toBe("2026-12");
    expect(usageMonth(new Date("2026-11-30T12:00:00Z"))).toBe("2026-11");
    expect(monthBefore("2027-01")).toBe("2026-12");
    expect(monthBefore("2026-11")).toBe("2026-10");
  });

  it("stops at the cap", () => {
    expect(capReached({ minutes: 10, texts: 0 }, DEFAULT_CAP_CENTS)).toBe(false);
    const over = { minutes: 30 + Math.ceil(DEFAULT_CAP_CENTS / VOICE_PRICES.minuteCents), texts: 0 };
    expect(capReached(over, DEFAULT_CAP_CENTS, "minute")).toBe(true);
    expect(capReached(over, DEFAULT_CAP_CENTS, "text")).toBe(true);
  });

  it("a $0 cap stops each at its own free allowance", () => {
    const u = { minutes: 30, texts: 3 };
    expect(capReached(u, 0, "minute")).toBe(true);
    expect(capReached(u, 0, "text")).toBe(false);
  });

  it("reads a cap typed in dollars", () => {
    expect(cleanCap("150")).toBe(15_000);
    expect(cleanCap("$1,000")).toBe(100_000);
    expect(cleanCap(0)).toBe(0);
    expect(cleanCap(-5)).toBeNull();
    expect(cleanCap("lots")).toBeNull();
    expect(cleanCap(100_000)).toBeNull();
  });

  it("warns at 80% of the cap, and when it is reached", () => {
    const cap = 1000;
    const at = (minutes: number) => capStanding({ minutes, texts: 0 }, cap);
    expect(at(30 + 15)).toBeNull(); // $7.50
    expect(at(30 + 16)).toBe("near"); // $8
    expect(at(30 + 20)).toBe("reached"); // $10
    expect(capStanding({ minutes: 24, texts: 0 }, 0)).toBe("near");
    expect(capStanding({ minutes: 30, texts: 30 }, 0)).toBe("reached");
    expect(capStanding({ minutes: 5, texts: 5 }, 0)).toBeNull();
  });

  it("writes the warning in the business's figures", () => {
    const near = capWarningEmail({
      business: "Sunrise Solar",
      kind: "near",
      usage: { minutes: 46, texts: 10 },
      capCents: 1000,
      link: "https://x/b",
    });
    expect(near.subject).toContain("80%");
    expect(near.text).toContain("46 voice-agent minutes");
    expect(near.text).toContain("https://x/b");
    const reached = capWarningEmail({
      business: "Sunrise Solar",
      kind: "reached",
      usage: { minutes: 50, texts: 0 },
      capCents: 1000,
      link: null,
    });
    expect(reached.subject).toContain("reached");
    expect(reached.text).toContain("still answered");
  });

  it("says it plainly", () => {
    expect(usagePriceWords()).toContain("30 minutes and 30 texts free each month");
    expect(usageWords({ minutes: 12, texts: 4 }, DEFAULT_CAP_CENTS).join(" ")).toContain("12 of 30 free minutes");
    expect(usageInvoiceLine("2026-11", usageBill({ minutes: 40, texts: 30 }))).toContain("November 2026");
  });
});
