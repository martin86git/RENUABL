import { describe, expect, it } from "vitest";
import { cleanContent, starterContent, type EdmContent } from "./edm";
import { SEQUENCE_LIMITS, WAIT_BETWEEN_PICKED, cleanSteps, withCampaignEmail, type SequenceStep } from "./sequences";

const campaign: EdmContent = cleanContent({
  ...starterContent(() => 0.42),
  subject: "One giant leap",
  preview: "Solar just got an AI sales force",
});
const ids = { email: "mailaaaa", wait: "waitaaaa" };

describe("a sequence email started from a campaign", () => {
  it("is the campaign's email, as the first step", () => {
    const steps = withCampaignEmail([], campaign, ids)!;
    expect(steps).toEqual([{ id: "mailaaaa", kind: "email", content: campaign }]);
    expect(cleanSteps(steps)).toEqual(steps);
  });

  it("is its own copy: changing it leaves the campaign alone", () => {
    const steps = withCampaignEmail([], campaign, ids)!;
    const step = steps[0] as Extract<SequenceStep, { kind: "email" }>;
    step.content.blocks[0].text = "Changed in the sequence";
    expect(campaign.blocks[0].text).not.toBe("Changed in the sequence");
  });

  it("puts a wait between two emails picked one after another, and none after a wait", () => {
    const one = withCampaignEmail([], campaign, ids)!;
    const two = withCampaignEmail(one, campaign, { email: "mailbbbb", wait: "waitbbbb" })!;
    expect(two.map((s) => s.kind)).toEqual(["email", "wait", "email"]);
    expect(two[1]).toEqual({ id: "waitbbbb", kind: "wait", days: WAIT_BETWEEN_PICKED });
    const afterWait = withCampaignEmail([...one, { id: "waitcccc", kind: "wait", days: 5 }], campaign, {
      email: "mailcccc",
      wait: "waitdddd",
    })!;
    expect(afterWait.map((s) => s.kind)).toEqual(["email", "wait", "email"]);
  });

  it("is refused when the sequence has no room for it", () => {
    const full: SequenceStep[] = Array.from({ length: SEQUENCE_LIMITS.steps - 1 }, (_, i) => ({
      id: `step${i}xx`,
      kind: "email",
      content: campaign,
    }));
    expect(withCampaignEmail(full, campaign, ids)).toBeNull();
    const waits: SequenceStep[] = [...full.slice(0, -1), { id: "waiteeee", kind: "wait", days: 2 }];
    expect(withCampaignEmail(waits, campaign, ids)).toHaveLength(SEQUENCE_LIMITS.steps);
  });
});
