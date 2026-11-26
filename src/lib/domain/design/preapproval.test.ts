import { describe, expect, it } from "vitest";
import { gateOf } from "./approvals";
import {
  changeRecordLine,
  cleanKw,
  cleanNmi,
  cleanPreApprovalChange,
  cleanSuggestion,
  preApprovalView,
  stepOf,
  withPreApprovalChange,
} from "./preapproval";
import { cleanTurns } from "./sol";

const deal = (typed: Record<string, string>, extra: Record<string, string> = {}) =>
  preApprovalView({
    jobId: "job_1",
    customer: "Sam Sample",
    address: "8 Example Court, Glen Waverley VIC 3150",
    kw: 6.65,
    typed,
    details: { ...typed, ...extra },
  });

describe("a deal's pre-approval card", () => {
  it("reads the network and its portal from the NMI, and says what the application still needs", () => {
    const v = deal({ nmi: "63051234567" }, { inverter: "Sungrow SG5.0RS", inverterCapacity: "5 kW" });
    expect(v.network).toEqual({ name: "AusNet Services", guessed: false });
    expect(v.portal).toMatchObject({ id: "ausnet", known: true });
    expect(v.missing).toEqual({ fields: ["phases"], other: [] });
    expect(v.status).toBe("Not submitted");
    expect(v.step).toBe("to-submit");
  });

  it("guesses from the postcode with no NMI, and asks for it and the inverter", () => {
    const v = deal({});
    expect(v.network?.guessed).toBe(true);
    expect(v.missing.fields).toEqual(["nmi", "phases"]);
    expect(v.missing.other.join(" ")).toContain("inverter");
  });

  it("follows where it stands", () => {
    expect(stepOf("Requested")).toBe("to-submit");
    expect(stepOf("Submitted")).toBe("waiting");
    expect(stepOf("Approved, export limited")).toBe("through");
    expect(stepOf("Declined")).toBe("declined");
    expect(deal({ preApproval: "Submitted", preApprovalRef: "PA-1" })).toMatchObject({
      step: "waiting",
      reference: "PA-1",
      tone: "waiting",
    });
  });
});

describe("a change to it", () => {
  it("is checked", () => {
    expect(cleanNmi("6305 123 456-7")).toBe("63051234567");
    expect(cleanNmi("123")).toBe("");
    expect(cleanKw("5 kW")).toBe("5");
    expect(cleanKw("1.5")).toBe("1.5");
    expect(cleanKw("lots")).toBe("");
    expect(cleanPreApprovalChange({ nmi: "123" })).toMatchObject({ ok: false });
    expect(cleanPreApprovalChange({ status: "Sorted" })).toMatchObject({ ok: false });
    expect(cleanPreApprovalChange({})).toMatchObject({ ok: false });
    expect(cleanPreApprovalChange({ status: "Submitted", reference: " PA-77\n", stage: "won" })).toEqual({
      ok: true,
      change: { status: "Submitted", reference: "PA-77" },
    });
  });

  it("lands on the deal's own Network fields and moves it through its gate", () => {
    const current = { details: { nmi: "63051234567" } as Record<string, string>, address: "8 Example Court, Glen Waverley VIC 3150" };
    const submitted = withPreApprovalChange(current, { status: "Submitted", reference: "PA-77" });
    expect(submitted).toMatchObject({ preApproval: "Submitted", preApprovalRef: "PA-77", distributor: "AusNet Services" });
    expect(gateOf({ stage: "won", installDate: null, details: submitted })).toBe("preapproval");
    const approved = withPreApprovalChange({ ...current, details: submitted }, { status: "Approved, export limited", exportLimit: "5" });
    expect(approved).toMatchObject({
      preApproval: "Approved, export limited",
      exportLimiting: "Yes",
      exportLimit: "5",
      preApprovalRef: "PA-77",
    });
    expect(gateOf({ stage: "won", installDate: null, details: approved })).toBe("book");
    // A distributor someone typed is left alone.
    expect(withPreApprovalChange({ ...current, details: { distributor: "Jemena" } }, { status: "Submitted" }).distributor).toBe("Jemena");
  });

  it("is written on the deal's record in words", () => {
    expect(changeRecordLine({ status: "Submitted", reference: "PA-77" }, "AusNet Services")).toBe(
      "Network pre-approval submitted (AusNet Services) · reference PA-77.",
    );
    expect(changeRecordLine({ status: "Approved, export limited", exportLimit: "5" }, null)).toBe(
      "Network pre-approval approved · export limited to 5 kW.",
    );
    expect(changeRecordLine({ nmi: "63051234567" }, "AusNet Services")).toBe("Filled in for the application: NMI 63051234567.");
  });
});

describe("what Sol proposes from the member's words", () => {
  it("keeps what reads and drops what doesn't", () => {
    expect(cleanSuggestion({ nmi: "nope", status: "Submitted", reference: "PA-1" })).toEqual({ status: "Submitted", reference: "PA-1" });
    expect(cleanSuggestion({ nmi: "nope" })).toBeNull();
  });

  it("is kept on his turn only with a deal", () => {
    const at = new Date().toISOString();
    const suggest = { status: "Submitted", reference: "PA-1", stage: "won" };
    const turns = cleanTurns([
      { role: "sol", text: "a", at, portal: { network: "ausnet", jobId: "job_1", facts: [], suggest } },
      { role: "sol", text: "b", at, portal: { network: "ausnet", facts: [], suggest } },
    ]);
    expect(turns[0].portal?.suggest).toEqual({ status: "Submitted", reference: "PA-1" });
    expect(turns[1].portal?.suggest).toBeUndefined();
  });
});
