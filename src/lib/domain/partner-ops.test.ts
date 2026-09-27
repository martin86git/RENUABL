import { describe, expect, it } from "vitest";
import { complianceStatus, expiryPhrase, offersPaused, remindersDue, type ComplianceRecord } from "./compliance";
import { validateComplianceUpdate } from "./compliance-upload";
import { cleanConnection, connectionComplete, connectionSteps, nextConnectionStep, partnerMayUpdate, updateConnection } from "./connection";
import { isValidAbn } from "./partner";
import { RENUABL_BUSINESS, formatBsb, jobPayout, maskAccount, payoutInvoice, payoutTotals, validateBankDetails } from "./payouts";
import { SMS_MAX, newOfferSms, siteUrl, variationSentSms } from "./sms";
import { stripeKeyMode } from "./status";
import { addVariation, approvedTotals, cleanVariationInput, decideVariation, priceVariation } from "./variations";
import type { Job } from "./types";

const today = "2026-09-27";

const all = (liabilityExpires: string, amount = 20_000_000): ComplianceRecord[] => [
  { kind: "public-liability", amount, expires: liabilityExpires },
  { kind: "electrical-licence", expires: "2029-01-01" },
  { kind: "accreditation", expires: "2027-03-01" },
];

describe("compliance", () => {
  it("is current, expiring within 30 days, or expired", () => {
    expect(complianceStatus(all("2027-06-01")[0], today)).toBe("current");
    expect(complianceStatus(all("2026-10-20")[0], today)).toBe("expiring");
    expect(complianceStatus(all("2026-09-26")[0], today)).toBe("expired");
    expect(complianceStatus(undefined, today)).toBe("missing");
  });

  it("treats cover under $10M as lapsed", () => {
    expect(complianceStatus(all("2027-06-01", 5_000_000)[0], today)).toBe("expired");
  });

  it("pauses offers when anything lapses or is missing, not when it's only expiring", () => {
    expect(offersPaused(all("2026-10-20"), today).paused).toBe(false);
    expect(offersPaused(all("2026-09-01"), today)).toEqual({ paused: true, reasons: ["Public liability insurance: expired"] });
    expect(offersPaused(all("2027-06-01").slice(0, 2), today).reasons).toEqual(["Solar Accreditation Australia: not on file"]);
  });

  it("sends reminders on the set days only", () => {
    expect(remindersDue(all("2026-10-27"), today)).toEqual([{ kind: "public-liability", label: "Public liability insurance", days: 30 }]);
    expect(remindersDue(all("2026-10-26"), today)).toEqual([]);
    expect(expiryPhrase("2026-09-28", today)).toBe("expires tomorrow");
    expect(expiryPhrase("2026-09-20", today)).toBe("expired 7 days ago");
  });

  it("checks renewals", () => {
    expect(validateComplianceUpdate({ kind: "public-liability", expires: "2027-09-01", amount: "20000000" }, today)).toEqual({
      update: { kind: "public-liability", expires: "2027-09-01", number: undefined, amount: 20_000_000 },
    });
    expect(validateComplianceUpdate({ kind: "public-liability", expires: "2027-09-01", amount: "5000000" }, today)).toHaveProperty("error");
    expect(validateComplianceUpdate({ kind: "accreditation", expires: "2026-09-01" }, today)).toHaveProperty("error");
    expect(validateComplianceUpdate({ kind: "nope", expires: "2027-09-01" }, today)).toHaveProperty("error");
  });
});

describe("grid connection and rebates", () => {
  it("splits responsibility by partner type", () => {
    expect(partnerMayUpdate("ces", "installer")).toBe(true);
    expect(partnerMayUpdate("stc-claim", "installer")).toBe(false);
    expect(partnerMayUpdate("stc-claim", "retailer")).toBe(true);
    expect(partnerMayUpdate("pre-approval", "installer")).toBe(false);
  });

  it("includes Solar Victoria only when claimed", () => {
    expect(connectionSteps({ solarVictoria: false }).some((s) => s.id === "solar-vic")).toBe(false);
    expect(connectionSteps({ solarVictoria: true }).some((s) => s.id === "solar-vic")).toBe(true);
  });

  it("tracks progress and the next step", () => {
    const steps = connectionSteps({ solarVictoria: false });
    let r = updateConnection({}, "pre-approval", { done: "2026-09-01", reference: "PA-123" });
    expect(nextConnectionStep(r, steps, "installer")).toMatchObject({ step: { id: "ces" }, owner: "partner" });
    r = updateConnection(r, "pre-approval", null);
    expect(r).toEqual({});
    for (const s of steps) r = updateConnection(r, s.id, { done: "2026-09-10" });
    expect(connectionComplete(r, steps)).toBe(true);
  });

  it("cleans untrusted input", () => {
    expect(
      cleanConnection({ ces: { done: "2026-09-10", reference: "<b>CES-9</b>" }, bogus: { done: "2026-09-10" }, ewr: { done: "soon" } }),
    ).toEqual({ ces: { done: "2026-09-10", reference: "bCES-9/b" } });
  });
});

describe("variations", () => {
  const input = { reason: "Ceramic fuses, no room for the solar breaker.", items: [{ label: "Switchboard upgrade", amount: 1500 }] };

  it("prices with margin and GST", () => {
    expect(priceVariation(input.items, { type: "installer" })).toEqual({ partnerAmount: 1500, customerPrice: 1980 });
    expect(priceVariation(input.items, { type: "retailer", margin: 0.3 }).customerPrice).toBe(2145);
  });

  it("rejects incomplete or odd input", () => {
    expect(cleanVariationInput(input)).toEqual(input);
    expect(cleanVariationInput({ ...input, reason: "" })).toBeNull();
    expect(cleanVariationInput({ ...input, items: [] })).toBeNull();
    expect(cleanVariationInput({ ...input, items: [{ label: "x", amount: -5 }] })).toBeNull();
    expect(cleanVariationInput({ ...input, items: [{ label: "x", amount: 50_000 }] })).toBeNull();
    expect(cleanVariationInput({ ...input, reason: "see https://evil.example now" })?.reason).toBe("see now");
  });

  it("is decided once", () => {
    let list = addVariation([], input, { type: "installer" }, { id: "var_a1b2", now: "t0" });
    expect(list[0].status).toBe("sent");
    list = decideVariation(list, "var_a1b2", "approve", "t1")!;
    expect(list[0]).toMatchObject({ status: "approved", decidedAt: "t1" });
    expect(decideVariation(list, "var_a1b2", "decline", "t2")).toBeNull();
    expect(decideVariation(list, "var_zzzz", "approve", "t2")).toBeNull();
    expect(approvedTotals(list)).toEqual({ partnerAmount: 1500, customerPrice: 1980 });
  });
});

function job(stage: Job["stage"], preferredDate: string): Job {
  return {
    id: "j1",
    reference: "RN-1",
    recordKey: "a".repeat(24),
    customer: { name: "Sam Lee", phone: "", email: "" },
    address: { line: "", suburb: "", state: "VIC", postcode: "3000" },
    packageName: "",
    system: { panelCount: 12, batteryKwh: 0, evCharger: false },
    stage,
    preferredDate,
    windowId: "0700",
    crewId: null,
    value: 0,
    site: { storeys: "single", roof: "Colorbond", orientation: "", accessNotes: "", switchboardNotes: "", imagery: [] },
    checklist: [],
    documents: [],
    messages: [],
    activity: [],
    statusHistory: [],
  };
}

describe("payouts", () => {
  it("pays installation labour plus approved variations, not equipment", () => {
    const variations = decideVariation(
      addVariation(
        [],
        { reason: "Needed", items: [{ label: "Switchboard upgrade", amount: 1500 }] },
        { type: "installer" },
        { id: "var_1111", now: "t" },
      ),
      "var_1111",
      "approve",
      "t",
    )!;
    const p = jobPayout(job("scheduled", "2026-10-01"), { today, variations });
    // 12 x 475 W = 5.7 kW at 30c/W = $1,710
    expect(p.lines).toEqual([
      { description: "Solar installation (5.7 kW at 30c/W)", amount: 1710 },
      { description: "Variation: Switchboard upgrade", amount: 1500 },
    ]);
    expect(p).toMatchObject({ status: "upcoming", subtotal: 3210, date: "2026-10-08" });
  });

  it("is processing until 7 days after the install, then paid", () => {
    expect(jobPayout(job("completed", "2026-09-24"), { today }).status).toBe("processing");
    expect(jobPayout(job("completed", "2026-09-10"), { today }).status).toBe("paid");
    const t = payoutTotals([jobPayout(job("completed", "2026-09-10"), { today }), jobPayout(job("scheduled", "2026-10-10"), { today })]);
    expect(t).toEqual({ paid: 1710, processing: 0, upcoming: 1710 });
  });

  it("is issued by RENUABL's legal entity, with a valid ABN", () => {
    expect(isValidAbn(RENUABL_BUSINESS.abn)).toBe(true);
    const inv = payoutInvoice(jobPayout(job("completed", "2026-09-10"), { today }), { name: "A", abn: "51824753556", gstRegistered: true });
    expect(inv.recipient).toEqual({ name: "Reburthed Pty Ltd", tradingAs: "RENUABL", abn: "96662374905" });
  });

  it("adds GST only for GST-registered partners", () => {
    const p = jobPayout(job("completed", "2026-09-10"), { today });
    expect(payoutInvoice(p, { name: "A", abn: "51824753556", gstRegistered: true })).toMatchObject({
      title: "Recipient-created tax invoice",
      gst: 171,
      total: 1881,
    });
    expect(payoutInvoice(p, { name: "A", abn: "51824753556", gstRegistered: false })).toMatchObject({ gst: 0, total: 1710 });
  });

  it("checks bank details", () => {
    expect(
      validateBankDetails({ accountName: " Primero  Pty Ltd ", bsb: "063-000", accountNumber: "1234 5678", gstRegistered: true }),
    ).toEqual({
      bank: { accountName: "Primero Pty Ltd", bsb: "063000", accountNumber: "12345678", gstRegistered: true },
    });
    const bad = validateBankDetails({ accountName: "", bsb: "12", accountNumber: "1" });
    expect(Object.keys("errors" in bad ? bad.errors : {})).toEqual(["accountName", "bsb", "accountNumber"]);
    expect(formatBsb("063000")).toBe("063-000");
    expect(maskAccount("12345678")).toBe("•••• 678");
  });
});

describe("sms", () => {
  it("keeps messages short and link-safe", () => {
    const s = newOfferSms({ suburb: "Glen Waverley", system: "6.6 kW solar", hours: 24, link: "https://renuabl.com.au/installer" });
    expect(s).toContain("Accept within 24 hours");
    expect(s.length).toBeLessThanOrEqual(SMS_MAX);
    expect(variationSentSms({ customer: "Sarah Chen", link: "https://x.au/r" })).toMatch(/^RENUABL: Hi Sarah,/);
  });

  it("builds links from the site's own address only", () => {
    expect(siteUrl({ SITE_URL: "https://renuabl.com.au/path" })).toBe("https://renuabl.com.au");
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "renuabl.vercel.app" })).toBe("https://renuabl.vercel.app");
    expect(siteUrl({ SITE_URL: "http://evil.example" })).toBeNull();
    expect(siteUrl({})).toBeNull();
  });
});

describe("stripe key mode", () => {
  it("reads the mode without the key", () => {
    expect(stripeKeyMode("sk_test_abc")).toBe("test");
    expect(stripeKeyMode(" sk_live_abc ")).toBe("live");
    expect(stripeKeyMode("pk_live_abc")).toBe("invalid");
    expect(stripeKeyMode(undefined)).toBe("missing");
  });
});
