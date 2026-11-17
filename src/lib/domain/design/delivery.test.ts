import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY,
  DELIVERY_COPY,
  END_OF_TURN,
  NATURAL_DELIVERY,
  PAUSE_SECONDS,
  cleanDelivery,
  defaultDelivery,
  deliveryBlock,
  deliveryParams,
  sameDelivery,
} from "./delivery";

describe("how a voice agent speaks", () => {
  it("adds no instructions until something is chosen, and always answers quickly", () => {
    expect(deliveryBlock(null)).toBe("");
    expect(deliveryBlock(DEFAULT_DELIVERY)).toBe("");
    expect(deliveryParams(null)).toEqual({ startSpeakingPlan: { waitSeconds: 0.2, ...END_OF_TURN } });
    expect(deliveryParams(DEFAULT_DELIVERY)).toEqual(deliveryParams(null));
  });

  it("never leaves a second of silence before the agent starts to answer", () => {
    for (const pause of ["quick", "considered", "unhurried"] as const) expect(PAUSE_SECONDS[pause]).toBeLessThanOrEqual(1);
    expect(NATURAL_DELIVERY.pause).toBe("quick");
    expect(END_OF_TURN.transcriptionEndpointingPlan.onNoPunctuationSeconds).toBeLessThan(1);
    // The longest Vapi's model may wait when it thinks they're still talking: 900 ms.
    expect(END_OF_TURN.smartEndpointingPlan.waitFunction.startsWith("900 /")).toBe(true);
  });

  it("has a sales agent speak naturally until someone chooses, and the post-sale one plainly", () => {
    expect(defaultDelivery(true)).toEqual(NATURAL_DELIVERY);
    expect(defaultDelivery(false)).toEqual(DEFAULT_DELIVERY);
  });

  it("reads only the choices it knows", () => {
    expect(cleanDelivery({ manner: "natural", pace: "fast", opening: "easy", pause: 3, room: "city" })).toEqual({
      ...DEFAULT_DELIVERY,
      manner: "natural",
      opening: "easy",
    });
    expect(cleanDelivery("nonsense")).toEqual(DEFAULT_DELIVERY);
    expect(sameDelivery(cleanDelivery(NATURAL_DELIVERY), NATURAL_DELIVERY)).toBe(true);
  });

  it("asks for a natural manner without loosening a rule", () => {
    const b = deliveryBlock(NATURAL_DELIVERY);
    expect(b).toContain("One short thought");
    expect(b).toContain("stop at once and listen");
    expect(b).toContain("unhurried");
    expect(b).toContain("every rule above still holds");
    expect(b).toContain("you still say you're automated");
    expect(deliveryBlock({ ...DEFAULT_DELIVERY, pace: "brisk" })).toContain("keep it moving");
  });

  it("sends Vapi the pause chosen and the room behind it", () => {
    expect(deliveryParams(NATURAL_DELIVERY)).toMatchObject({ startSpeakingPlan: { waitSeconds: 0.2 } });
    expect(deliveryParams(NATURAL_DELIVERY)).not.toHaveProperty("backgroundSound");
    expect(deliveryParams({ ...DEFAULT_DELIVERY, pause: "unhurried", room: "silent" })).toEqual({
      startSpeakingPlan: { waitSeconds: 1, ...END_OF_TURN },
      backgroundSound: "off",
    });
  });

  it("says the choice in a line", () => {
    expect(DELIVERY_COPY.summary(null)).toContain("As it comes");
    expect(DELIVERY_COPY.summary(NATURAL_DELIVERY)).toBe("Natural, relaxed, an easy opening");
  });
});
