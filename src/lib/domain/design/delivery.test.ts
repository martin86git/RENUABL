import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY,
  DELIVERY_COPY,
  NATURAL_DELIVERY,
  cleanDelivery,
  defaultDelivery,
  deliveryBlock,
  deliveryParams,
  sameDelivery,
} from "./delivery";

describe("how a voice agent speaks", () => {
  it("changes nothing until something is chosen", () => {
    expect(deliveryBlock(null)).toBe("");
    expect(deliveryParams(null)).toEqual({});
    expect(deliveryBlock(DEFAULT_DELIVERY)).toBe("");
    expect(deliveryParams(DEFAULT_DELIVERY)).toEqual({});
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

  it("sends Vapi only what differs from its defaults", () => {
    expect(deliveryParams(NATURAL_DELIVERY)).toEqual({ startSpeakingPlan: { waitSeconds: 0.8 } });
    expect(deliveryParams({ ...DEFAULT_DELIVERY, pause: "unhurried", room: "silent" })).toEqual({
      startSpeakingPlan: { waitSeconds: 1.2 },
      backgroundSound: "off",
    });
  });

  it("says the choice in a line", () => {
    expect(DELIVERY_COPY.summary(null)).toContain("As it comes");
    expect(DELIVERY_COPY.summary(NATURAL_DELIVERY)).toBe("Natural, relaxed, an easy opening");
  });
});
