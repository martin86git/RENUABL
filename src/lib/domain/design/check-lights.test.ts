import { describe, expect, it } from "vitest";
import { lightOf, shadeLight, type ReadinessItem } from "./readiness";

const item = (id: ReadinessItem["id"], state: ReadinessItem["state"]): ReadinessItem => ({ id, state, label: id, words: "" });

describe("the rail's check lights", () => {
  it("takes the worst of the checks it covers", () => {
    const items = [item("strings", "pass"), item("unstrung", "check"), item("pitch", "fix")];
    expect(lightOf(items, ["strings", "unstrung"])).toBe("check");
    expect(lightOf(items, ["strings"])).toBe("pass");
    expect(lightOf(items, ["pitch", "strings"])).toBe("fix");
  });
  it("is dark while none of its checks is on the list", () => {
    expect(lightOf([item("panels", "fix")], ["strings"])).toBeNull();
  });
  it("reads the shade by its worst panel", () => {
    expect(shadeLight(null)).toBeNull();
    expect(shadeLight({ shaded: 0, worst: 0.95 })).toBe("pass");
    expect(shadeLight({ shaded: 2, worst: 0.7 })).toBe("check");
    expect(shadeLight({ shaded: 1, worst: 0.4 })).toBe("fix");
  });
});
