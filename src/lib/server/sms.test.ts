import { describe, expect, it } from "vitest";
import { smsFrom } from "./sms";

describe("who texts come from", () => {
  it("is the sender set for texts", () => {
    expect(smsFrom({ TWILIO_FROM: " RENUABL ", TWILIO_CALLER_ID: "+61 485 045 505" })).toBe("RENUABL");
  });
  it("is the number calls are made from when no sender is set", () => {
    expect(smsFrom({ TWILIO_CALLER_ID: "+61 485 045 505" })).toBe("+61485045505");
  });
  it("is nothing when neither is set", () => {
    expect(smsFrom({})).toBe("");
  });
});
