import { describe, expect, it } from "vitest";
import { CAMPAIGN_GOALS, GOAL_WORDS, campaignName, goalAngle, isCampaignGoal } from "./campaign-goals";
import { claimsToCheck, edmSolPrompt } from "./edm-sol";

describe("what a new campaign is for", () => {
  it("has words for every goal, with nothing that would need proof", () => {
    for (const g of CAMPAIGN_GOALS) {
      const w = GOAL_WORDS[g];
      for (const v of Object.values(w)) expect(v.trim().length).toBeGreaterThan(3);
      expect(claimsToCheck([w.label, w.what, w.ask, w.angle].join(" "))).toEqual([]);
    }
    expect(isCampaignGoal("offer")).toBe(true);
    expect(isCampaignGoal("restock")).toBe(false);
  });

  it("gives Sol the goal's angle after his rules, and nothing without a goal", () => {
    const draft = { subject: "", preview: "", heading: "", text: "" };
    const p = edmSolPrompt("all", { business: "Sunrise Solar", brief: "Free meter until 19 December", draft, angle: goalAngle("offer") });
    expect(p).toContain(goalAngle("offer")!);
    expect(p.indexOf(goalAngle("offer")!)).toBeLessThan(p.indexOf("<brief>"));
    expect(edmSolPrompt("all", { business: "Sunrise Solar", brief: "x", draft })).not.toMatch(/This email/);
  });

  it("names a campaign from Sol's subject, else the goal", () => {
    expect(campaignName("offer", "  A free meter for {firstName}  ")).toBe("A free meter for");
    expect(campaignName("winback", "")).toBe("Checking in");
    expect(campaignName(null)).toBe("New campaign");
    expect(campaignName("new", "x".repeat(200))).toHaveLength(80);
  });
});
