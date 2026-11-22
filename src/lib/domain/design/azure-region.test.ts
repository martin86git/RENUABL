import { describe, expect, it } from "vitest";
import { azureRegionFrom } from "./caller";

describe("azureRegionFrom", () => {
  it("reads the region however it was typed", () => {
    expect(azureRegionFrom("australiaeast")).toBe("australiaeast");
    expect(azureRegionFrom(" Australia East ")).toBe("australiaeast");
    expect(azureRegionFrom("https://australiaeast.api.cognitive.microsoft.com/")).toBe("australiaeast");
    expect(azureRegionFrom("australiaeast.tts.speech.microsoft.com")).toBe("australiaeast");
    expect(azureRegionFrom("https://eastus.tts.speech.microsoft.com/cognitiveservices/v1")).toBe("eastus");
  });

  it("says nothing when no region can be read", () => {
    expect(azureRegionFrom("")).toBeNull();
    expect(azureRegionFrom(undefined)).toBeNull();
    expect(azureRegionFrom("https://my-speech.cognitiveservices.azure.com/")).toBeNull();
    expect(azureRegionFrom("https://example.com/")).toBeNull();
  });
});
