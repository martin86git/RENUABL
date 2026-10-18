import { describe, expect, it } from "vitest";
import { CHART_STYLES, TEMPLATES } from "@/lib/domain/design/brand";
import { acceptLine, buildProposal, type ProposalView } from "@/lib/domain/design/proposal";
import { sampleInputs } from "@/lib/domain/design/proposal-fixture";
import { proposalPdf } from "./proposal-pdf";

function sample(): ProposalView {
  const built = buildProposal(sampleInputs({ withBattery: true }));
  if (!built.ok) throw new Error(built.problems.join(" "));
  return built.view;
}

describe("the proposal PDF in each design", () => {
  it("is made in all five designs and all four chart styles", async () => {
    const view = sample();
    for (const t of TEMPLATES)
      for (const c of CHART_STYLES) {
        const pdf = await proposalPdf({ ...view, template: t.id, theme: { ...view.theme, chart: c.id } }, {}, null);
        expect(pdf.subarray(0, 5).toString(), `${t.id} / ${c.id}`).toBe("%PDF-");
      }
  }, 60_000);

  it("names the business's own terms when it sends its own, in place of ours", async () => {
    const view: ProposalView = { ...sample(), contract: null, ownTerms: { id: "doc_0123456789abcdef01234567", name: "Our terms" } };
    expect(acceptLine(view)).toContain("terms and conditions attached");
    const pdf = await proposalPdf(view, {}, null);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
