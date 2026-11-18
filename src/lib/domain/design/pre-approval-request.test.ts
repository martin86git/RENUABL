import { describe, expect, it } from "vitest";
import { gateOf, networkOf, preApprovalOf, withPreApprovalRequest } from "./approvals";
import { nudgesFor, type NudgeState } from "./sol-nudges";

const base: NudgeState = {
  panels: 14,
  kw: 6.65,
  inverterKw: 5,
  inverters: 1,
  unstrung: 0,
  oversize: null,
  battery: null,
  fill: null,
  panelDayKwh: 1.9,
  homeDayKwh: 20,
  onDeal: true,
  phase: "single",
  shaded: 0,
  undecided: [],
  backupAnswered: false,
  costsHidden: false,
};
const exportCard = (s: Partial<NudgeState>) => nudgesFor({ ...base, ...s }).find((n) => n.id === "export");

describe("Sol's pre-approval card in the designer", () => {
  it("names the network and offers to raise the request", () => {
    const card = exportCard({ network: { name: "United Energy", guessed: true, preApproval: null, mayRequest: true } });
    expect(card?.words).toBe(
      "Over 5 kW on single phase, so United Energy will likely need to pre-approve it, or limit its exports. Raise a pre-approval request?",
    );
    expect(card?.why).toBe("United Energy going by the postcode: the NMI on the bill settles it.");
    expect(card?.actions).toEqual([{ label: "Yes, raise the request", act: "request-preapproval" }]);
  });

  it("says where a request stands, and goes once the network has approved", () => {
    const asked = exportCard({ network: { name: "AusNet Services", guessed: false, preApproval: "Requested", mayRequest: false } });
    expect(asked?.words).toContain("requested, waiting in Pre-approvals to be submitted");
    expect(asked?.actions).toEqual([]);
    expect(
      exportCard({ network: { name: "AusNet Services", guessed: false, preApproval: "Approved", mayRequest: false } }),
    ).toBeUndefined();
  });

  it("offers nothing to press off a deal", () => {
    const card = exportCard({ onDeal: false });
    expect(card?.actions).toEqual([]);
    expect(card?.why).toBe("Put the design on a deal to raise a pre-approval request.");
  });
});

describe("a pre-approval asked for before the sale", () => {
  const lead = (details: Record<string, string>) => ({
    stage: "designed" as const,
    installDate: null,
    details,
    address: "8 Example Court, Glen Waverley VIC 3150",
  });

  it("files it in Pre-approvals until the network approves", () => {
    expect(gateOf(lead({}))).toBeNull();
    expect(gateOf(lead({ preApproval: "Requested" }))).toBe("preapproval");
    expect(gateOf(lead({ preApproval: "Submitted" }))).toBe("preapproval");
    expect(gateOf(lead({ preApproval: "Approved" }))).toBeNull();
    expect(preApprovalOf(lead({ preApproval: "Requested" })).words).toBe("Requested: to submit");
  });

  it("marks it requested and fills in the network, never over an answer", () => {
    const next = withPreApprovalRequest(lead({}));
    expect(next?.preApproval).toBe("Requested");
    expect(next?.distributor).toBe(networkOf(lead({}))?.name);
    expect(withPreApprovalRequest(lead({ distributor: "Jemena" }))?.distributor).toBe("Jemena");
    expect(withPreApprovalRequest(lead({ preApproval: "Submitted" }))).toBeNull();
  });
});
