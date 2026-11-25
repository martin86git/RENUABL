import { describe, expect, it } from "vitest";
import { JOB_STAGES } from "./crm";
import { groupedStageChoices } from "./pipeline-stages";

describe("groupedStageChoices", () => {
  it("lists every stage once, under its pipeline, with the business's own under their base", () => {
    const own = [
      { id: "st_contacted", name: "Contacted", base: "lead" as const },
      { id: "st_invoiced", name: "Invoiced", base: "installed" as const },
    ];
    const groups = groupedStageChoices(own);
    expect(groups.map((g) => g.name)).toEqual(["Sales", "Post sale", "Post installation", "Lost"]);
    const keys = groups.flatMap((g) => g.choices.map((c) => c.key));
    expect(keys.length).toBe(JOB_STAGES.length + own.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect(groups[0].choices.map((c) => c.key)).toEqual(["lead", "st_contacted", "designed", "proposal", "won"]);
    expect(groups[2].choices.map((c) => c.key)).toContain("st_invoiced");
  });
});
